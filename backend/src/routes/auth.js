const express = require("express");
const prisma = require("../db");
const { authenticate, hashPassword, signToken, verifyPassword } = require("../auth");

const router = express.Router();
const authAttempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;
let requestsSinceCleanup = 0;

function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const current = authAttempts.get(req.ip);
  if (current && current.expiresAt > now && current.count >= 30) {
    res.set("Retry-After", Math.ceil((current.expiresAt - now) / 1000));
    return res.status(429).json({ error: "Demasiados intentos. Vuelve a probar más tarde." });
  }
  authAttempts.set(req.ip, current && current.expiresAt > now
    ? { count: current.count + 1, expiresAt: current.expiresAt }
    : { count: 1, expiresAt: now + attemptWindowMs });
  if (++requestsSinceCleanup % 128 === 0) {
    for (const [ip, attempt] of authAttempts) {
      if (attempt.expiresAt <= now) authAttempts.delete(ip);
    }
  }
  next();
}

router.post("/register", limitAuthAttempts, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const taxId = typeof req.body?.taxId === "string" ? req.body.taxId.trim() : "";
  const password = req.body?.password;
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
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

router.post("/login", limitAuthAttempts, async (req, res) => {
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
