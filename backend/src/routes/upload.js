const express = require("express");
const multer = require("multer");
const prisma = require("../db");
const { authenticate } = require("../auth");

const router = express.Router();
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!acceptedTypes.has(file.mimetype)) {
      const err = new Error("Solo se permiten imágenes JPEG, PNG, WebP o GIF.");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

function imageSignatureMatches(file) {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString());
  if (file.mimetype === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function extractWithClaude(file, type) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: "Extrae datos visibles del comprobante. Devuelve solo JSON válido, no inventes datos y usa null si no es legible.",
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: file.mimetype, data: file.buffer.toString("base64") },
          },
          {
            type: "text",
            text: type === "PAYMENT"
              ? 'Devuelve JSON con amount (número), senderName, senderTaxId, recipientName, recipientAccount, date (YYYY-MM-DD) y currency.'
              : 'Devuelve JSON con items (arreglo de {name, amount, category}), total (número) y date (YYYY-MM-DD).',
          },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error("El servicio de lectura no pudo procesar la imagen.");
  const data = await response.json();
  const content = data.content?.find((item) => item.type === "text")?.text;
  if (!content) throw new Error("No se pudo leer el comprobante.");
  return parseJson(content);
}

router.post("/", authenticate, upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Falta la imagen (campo: receipt)." });
  if (!imageSignatureMatches(req.file)) return res.status(400).json({ error: "El contenido del archivo no coincide con su tipo de imagen." });

  const eventId = Number(req.body.eventId);
  const type = req.body.type === "PAYMENT" ? "PAYMENT" : "EXPENSE";
  if (!Number.isSafeInteger(eventId) || eventId < 1) return res.status(400).json({ error: "Evento inválido." });
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: req.userId } },
  });
  if (!membership) return res.status(404).json({ error: "No se encontró el evento." });

  let debt = null;
  if (type === "PAYMENT") {
    debt = await prisma.debt.findFirst({
      where: {
        id: Number(req.body.debtId),
        eventId,
        debtorId: req.userId,
        status: "PENDING",
      },
      include: {
        debtor: { select: { name: true, taxId: true } },
        creditor: { select: { name: true } },
      },
    });
    if (!debt) return res.status(404).json({ error: "No se encontró una deuda pendiente para esta cuenta." });
  }

  let extracted = null;
  let reviewNote = process.env.ANTHROPIC_API_KEY ? null : "La lectura automática no está configurada; revisa el comprobante manualmente.";
  try {
    extracted = await extractWithClaude(req.file, type);
  } catch (error) {
    reviewNote = error.message;
  }

  let verified = false;
  let proofStatus = "REVIEW";
  if (type === "PAYMENT" && extracted && debt) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const normalize = (value) => typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
    const normalizeAccount = (value) => typeof value === "string" ? value.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase() : "";
    const transferDate = typeof extracted.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)
      ? Date.parse(`${extracted.date}T00:00:00Z`)
      : NaN;
    verified = Number(extracted.amount) === Number(debt.amount) &&
      typeof extracted.currency === "string" && extracted.currency.toUpperCase() === event.currency &&
      normalize(extracted.senderName) === normalize(debt.debtor.name) &&
      Boolean(debt.debtor.taxId) &&
      normalizeAccount(extracted.senderTaxId) === normalizeAccount(debt.debtor.taxId) &&
      Boolean(event.accountName && event.accountNumber) &&
      normalize(extracted.recipientName) === normalize(event.accountName) &&
      normalizeAccount(extracted.recipientAccount) === normalizeAccount(event.accountNumber) &&
      Number.isFinite(transferDate) && transferDate <= Date.now();
    if (verified) {
      proofStatus = "PAID";
      reviewNote = null;
    } else {
      reviewNote = "Los datos extraídos no coinciden por completo; el anfitrión debe revisar el comprobante.";
    }
  }

  const proof = await prisma.$transaction(async (tx) => {
    if (debt) {
      const updated = await tx.debt.updateMany({
        where: { id: debt.id, status: "PENDING" },
        data: { status: proofStatus },
      });
      if (updated.count !== 1) {
        const error = new Error("Esta deuda ya tiene un comprobante en revisión.");
        error.status = 409;
        throw error;
      }
    }
    const created = await tx.paymentProof.create({
      data: {
        type,
        status: proofStatus,
        filename: req.file.originalname.slice(0, 255),
        mimeType: req.file.mimetype,
        fileData: req.file.buffer,
        extracted: extracted || undefined,
        reviewNote,
        eventId,
        uploadedById: req.userId,
        debtId: debt?.id,
      },
      select: { id: true, type: true, status: true, extracted: true, reviewNote: true, createdAt: true },
    });
    return created;
  });

  res.status(201).json({
    ...proof,
    message: proof.status === "PAID" ? "Transferencia validada." : "Comprobante recibido; requiere revisión.",
  });
});

module.exports = router;
