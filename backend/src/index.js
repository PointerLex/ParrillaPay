const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth");
const eventsRouter = require("./routes/events");
const uploadRouter = require("./routes/upload");

if (process.env.NODE_ENV === "production" &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.FRONTEND_URL)) {
  throw new Error("JWT_SECRET and FRONTEND_URL must be configured for production.");
}

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map((url) => url.trim()) : true,
}));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/upload", uploadRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Ocurrió un error inesperado." : err.message });
});

const port = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(port, () => console.log(`ParrillaPay API listening on ${port}`));
}

module.exports = app;
