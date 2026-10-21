const express = require("express");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../db");
const { authenticate, hashPassword, signToken, verifyPassword } = require("../auth");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Vuelve a probar más tarde." },
});

function isValidEmail(email) {
  if (email.length > 254) return false;
  const separator = email.indexOf("@");
  if (separator < 1 || separator !== email.lastIndexOf("@") || separator > 64) return false;
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  for (const character of email) {
    if (character.trim() === "") return false;
  }
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) =>
    label.length > 0 && label.length <= 63 &&
    !label.startsWith("-") && !label.endsWith("-") &&
    [...label].every((character) =>
      (character >= "a" && character <= "z") ||
      (character >= "0" && character <= "9") ||
      character === "-"));
}

router.post("/register", authLimiter, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const taxId = typeof req.body?.taxId === "string" ? req.body.taxId.trim() : "";
  const password = req.body?.password;
  if (!name || name.length > 80 || !isValidEmail(email) ||
      taxId.length > 20 || typeof password !== "string" || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Ingresa nombre, correo válido y contraseña de al menos 10 caracteres." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  const user = await prisma.user.create({
    data: { name, email, taxId: taxId || undefined, passwordHash: await hashPassword(password) },
  });
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
});

router.post("/login", authLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;
  if (!email || typeof password !== "string") {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return res.status(401).json({ error: "La cuenta ya no existe." });
  res.json(user);
});

module.exports = router;
