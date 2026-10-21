const crypto = require("node:crypto");
const { promisify } = require("node:util");
const prisma = require("./db");

const scrypt = promisify(crypto.scrypt);
const tokenSecret = process.env.JWT_SECRET || "development-only-change-me";

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authenticate(req, res, next) {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Inicia sesión para continuar." });
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return res.status(401).json({ error: "Sesión inválida." });
  }
  const expected = crypto.createHmac("sha256", tokenSecret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return res.status(401).json({ error: "Sesión inválida." });
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: "Sesión inválida." });
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!Number.isInteger(claims.sub) || claims.exp <= Date.now() / 1000) {
      return res.status(401).json({ error: "La sesión expiró." });
    }
    req.userId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida." });
  }
}

async function requireEventMember(req, res, next) {
  const eventId = Number(req.params.eventId || req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: "Evento inválido." });
  }
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: req.userId } },
  });
  if (!membership) return res.status(404).json({ error: "No se encontró el evento." });
  req.eventId = eventId;
  req.membership = membership;
  next();
}

module.exports = { authenticate, hashPassword, requireEventMember, signToken, verifyPassword };
