const express = require("express");
const prisma = require("../db");
const { authenticate, hashPassword, signToken, verifyPassword } = require("../auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Ingresa nombre, correo válido y contraseña de al menos 10 caracteres." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
});

router.post("/login", async (req, res) => {
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
