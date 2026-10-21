const express = require("express");
const prisma = require("../db");
const { authenticate, requireEventMember } = require("../auth");
const { allocateCents, settleBalances } = require("../finance");

const router = express.Router();
router.use(authenticate);

const moneyToCents = (value) => Math.round(Number(value) * 100);
const centsToMoney = (cents) => (cents / 100).toFixed(2);
const validAmount = (value) => Number.isFinite(Number(value)) && moneyToCents(value) > 0 && Number(value) <= 10000000;

async function rebuildDebts(tx, eventId) {
  const expenses = await tx.expense.findMany({
    where: { eventId },
    include: { shares: true },
  });
  const members = await tx.eventMember.findMany({ where: { eventId }, select: { id: true, userId: true } });
  const userIdByMemberId = new Map(members.map((member) => [member.id, member.userId]));
  const paidDebts = await tx.debt.findMany({ where: { eventId, status: "PAID" } });
  const balances = new Map();
  const adjust = (userId, cents) => balances.set(userId, (balances.get(userId) || 0) + cents);
  for (const expense of expenses) {
    adjust(expense.paidById, moneyToCents(expense.amount));
    for (const share of expense.shares) {
      const userId = userIdByMemberId.get(share.memberId);
      if (userId) adjust(userId, -moneyToCents(share.amount));
    }
  }
  for (const debt of paidDebts) {
    adjust(debt.debtorId, -moneyToCents(debt.amount));
    adjust(debt.creditorId, moneyToCents(debt.amount));
  }

  await tx.debt.deleteMany({ where: { eventId, status: { in: ["PENDING", "REVIEW", "REJECTED"] } } });
  for (const settlement of settleBalances(balances)) {
    await tx.debt.create({
      data: {
        amount: centsToMoney(settlement.cents),
        eventId,
        debtorId: settlement.debtorId,
        creditorId: settlement.creditorId,
      },
    });
  }
}

router.get("/", async (req, res) => {
  const memberships = await prisma.eventMember.findMany({
    where: { userId: req.userId },
    include: {
      event: {
        include: {
          _count: { select: { members: true } },
          debts: { where: { status: { in: ["PENDING", "REVIEW"] }, debtorId: req.userId } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json(memberships.map(({ event }) => ({
    id: event.id,
    name: event.name,
    date: event.date,
    status: event.status,
    inviteCode: event.inviteCode,
    participantCount: event._count.members,
    amountOwed: event.debts.reduce((sum, debt) => sum + Number(debt.amount), 0),
  })));
});

router.post("/", async (req, res) => {
  const { name, date, bankName, accountName, accountNumber, taxId } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ error: "Escribe un nombre de junta válido." });
  }
  if (date && Number.isNaN(Date.parse(date))) return res.status(400).json({ error: "La fecha de la junta no es válida." });
  const event = await prisma.event.create({
    data: {
      name: name.trim(),
      date: date ? new Date(date) : undefined,
      bankName: typeof bankName === "string" ? bankName.trim() : undefined,
      accountName: typeof accountName === "string" ? accountName.trim() : undefined,
      accountNumber: typeof accountNumber === "string" ? accountNumber.trim() : undefined,
      taxId: typeof taxId === "string" ? taxId.trim() : undefined,
      creatorId: req.userId,
      members: { create: { userId: req.userId } },
    },
    select: { id: true, name: true, inviteCode: true, date: true, status: true },
  });
  res.status(201).json(event);
});

router.post("/join", async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) return res.status(400).json({ error: "Ingresa un código de invitación." });
  const event = await prisma.event.findUnique({ where: { inviteCode: code } });
  if (!event || event.status !== "OPEN") return res.status(404).json({ error: "La junta no existe o está cerrada." });
  await prisma.eventMember.upsert({
    where: { eventId_userId: { eventId: event.id, userId: req.userId } },
    create: { eventId: event.id, userId: req.userId },
    update: {},
  });
  res.json({ id: event.id, name: event.name });
});

router.get("/:id", requireEventMember, async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.eventId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      },
      debts: {
        where: { status: { in: ["PENDING", "REVIEW"] } },
        include: {
          debtor: { select: { id: true, name: true } },
          creditor: { select: { id: true, name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  res.json({
    ...event,
    expenses: event.expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) })),
    debts: event.debts.map((debt) => ({ ...debt, amount: Number(debt.amount) })),
  });
});

router.patch("/:id", requireEventMember, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.eventId } });
  if (event.creatorId !== req.userId) return res.status(403).json({ error: "Solo el anfitrión puede editar la junta." });
  const data = {};
  for (const field of ["bankName", "accountName", "accountNumber", "taxId"]) {
    if (typeof req.body?.[field] === "string") data[field] = req.body[field].trim();
  }
  if (req.body?.status === "CLOSED" || req.body?.status === "OPEN") data.status = req.body.status;
  const updated = await prisma.event.update({ where: { id: req.eventId }, data });
  res.json({ id: updated.id, status: updated.status });
});

router.patch("/:id/preferences", requireEventMember, async (req, res) => {
  const preferences = req.body?.preferences;
  if (!Array.isArray(preferences) || preferences.length > 20 ||
      preferences.some((item) => typeof item !== "string" || item.length > 40)) {
    return res.status(400).json({ error: "Preferencias inválidas." });
  }
  await prisma.eventMember.update({
    where: { eventId_userId: { eventId: req.eventId, userId: req.userId } },
    data: { preferences: [...new Set(preferences.map((value) => value.trim()).filter(Boolean))] },
  });
  res.json({ preferences });
});

router.post("/:id/expenses", requireEventMember, async (req, res) => {
  const { description, amount, items, participantIds, receiptId } = req.body || {};
  if (typeof description !== "string" || !description.trim() || description.trim().length > 150 || !validAmount(amount)) {
    return res.status(400).json({ error: "Descripción y monto válidos son obligatorios." });
  }
  const event = await prisma.event.findUnique({
    where: { id: req.eventId },
    include: { members: true },
  });
  if (event.status !== "OPEN") return res.status(409).json({ error: "La junta está cerrada." });
  const members = new Map(event.members.map((member) => [member.userId, member]));
  const selected = Array.isArray(participantIds) && participantIds.length
    ? [...new Set(participantIds.map(Number))]
    : [...members.keys()];
  if (selected.some((id) => !members.has(id))) return res.status(400).json({ error: "Hay participantes que no pertenecen a la junta." });

  const itemInputs = Array.isArray(items) ? items : [];
  if (itemInputs.length > 100 || itemInputs.some((item) =>
    !item || typeof item.name !== "string" || !item.name.trim() || !validAmount(item.amount))) {
    return res.status(400).json({ error: "Los productos de la boleta no son válidos." });
  }
  const totalCents = moneyToCents(amount);
  const itemTotalCents = itemInputs.reduce((sum, item) => sum + moneyToCents(item.amount), 0);
  if (itemInputs.length && itemTotalCents !== totalCents) {
    return res.status(400).json({ error: "El total de los productos debe coincidir con el gasto." });
  }

  const sharesByUser = new Map();
  const distributeCents = (cents, userIds) => {
    const allocations = allocateCents(cents, userIds);
    const distributions = [];
    for (const allocation of allocations) {
      sharesByUser.set(allocation.userId, (sharesByUser.get(allocation.userId) || 0) + allocation.cents);
      distributions.push({ memberId: members.get(allocation.userId).id, amount: allocation.cents });
    }
    return distributions;
  };
  const itemDistributions = [];
  try {
    if (itemInputs.length) {
      for (const item of itemInputs) {
        let ids = Array.isArray(item.participantIds) && item.participantIds.length
          ? [...new Set(item.participantIds.map(Number))]
          : selected;
        if (ids.some((id) => !members.has(id))) {
          return res.status(400).json({ error: "Un producto incluye participantes fuera de la junta." });
        }
        const category = typeof item.category === "string" ? item.category.toLowerCase() : "";
        ids = ids.filter((id) => !members.get(id).preferences.some((preference) =>
          category && preference.toLowerCase() === category));
        itemDistributions.push(distributeCents(moneyToCents(item.amount), ids));
      }
    } else {
      distributeCents(totalCents, selected);
    }
  } catch {
    return res.status(400).json({ error: "Cada gasto debe poder dividirse entre al menos una persona." });
  }

  const expense = await prisma.$transaction(async (tx) => {
    if (receiptId !== undefined && receiptId !== null) {
      const receipt = await tx.paymentProof.findFirst({
        where: {
          id: Number(receiptId),
          eventId: req.eventId,
          uploadedById: req.userId,
          type: "EXPENSE",
          status: "REVIEW",
          expenseId: null,
        },
      });
      if (!receipt) {
        const error = new Error("No se encontró la boleta pendiente asociada.");
        error.status = 409;
        throw error;
      }
    }
    const created = await tx.expense.create({
      data: {
        description: description.trim(),
        amount: centsToMoney(totalCents),
        eventId: req.eventId,
        paidById: req.userId,
        items: itemInputs.length ? {
          create: itemInputs.map((item, index) => ({
            name: item.name.trim(),
            amount: centsToMoney(moneyToCents(item.amount)),
            category: typeof item.category === "string" ? item.category.trim() : undefined,
            shares: { create: itemDistributions[index].map(({ memberId }) => ({ memberId })) },
          })),
        } : undefined,
        shares: { create: [...sharesByUser].map(([userId, cents]) => ({
          memberId: members.get(userId).id,
          amount: centsToMoney(cents),
        })) },
        proofs: receiptId !== undefined && receiptId !== null
          ? { connect: { id: Number(receiptId) } }
          : undefined,
      },
      include: { paidBy: { select: { id: true, name: true } }, items: true },
    });
    if (receiptId !== undefined && receiptId !== null) {
      await tx.paymentProof.update({ where: { id: Number(receiptId) }, data: { status: "PAID" } });
    }
    await rebuildDebts(tx, req.eventId);
    return created;
  });
  res.status(201).json({ ...expense, amount: Number(expense.amount) });
});

router.post("/:id/debts/:debtId/confirm", requireEventMember, async (req, res) => {
  const debtId = Number(req.params.debtId);
  const debt = await prisma.debt.findFirst({ where: { id: debtId, eventId: req.eventId } });
  if (!debt) return res.status(404).json({ error: "No se encontró el pago." });
  const event = await prisma.event.findUnique({ where: { id: req.eventId } });
  if (event.creatorId !== req.userId && debt.creditorId !== req.userId) {
    return res.status(403).json({ error: "Solo el anfitrión o destinatario puede confirmar el pago." });
  }
  if (debt.status !== "REVIEW") return res.status(409).json({ error: "Este pago no está pendiente de revisión." });
  await prisma.$transaction(async (tx) => {
    await tx.debt.update({ where: { id: debtId }, data: { status: "PAID" } });
    await tx.paymentProof.updateMany({ where: { debtId, status: "REVIEW" }, data: { status: "PAID" } });
    await rebuildDebts(tx, req.eventId);
  });
  res.json({ status: "PAID" });
});

router.post("/:id/debts/:debtId/reject", requireEventMember, async (req, res) => {
  const debtId = Number(req.params.debtId);
  const debt = await prisma.debt.findFirst({ where: { id: debtId, eventId: req.eventId } });
  if (!debt) return res.status(404).json({ error: "No se encontró el pago." });
  const event = await prisma.event.findUnique({ where: { id: req.eventId } });
  if (event.creatorId !== req.userId && debt.creditorId !== req.userId) {
    return res.status(403).json({ error: "Solo el anfitrión o destinatario puede rechazar el pago." });
  }
  if (debt.status !== "REVIEW") return res.status(409).json({ error: "Este pago no está pendiente de revisión." });
  await prisma.$transaction(async (tx) => {
    await tx.paymentProof.updateMany({ where: { debtId, status: "REVIEW" }, data: { status: "REJECTED" } });
    await tx.debt.delete({ where: { id: debtId } });
    await rebuildDebts(tx, req.eventId);
  });
  res.json({ status: "REJECTED" });
});

module.exports = router;
