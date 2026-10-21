const express = require("express");
const cors = require("cors");
const uploadRouter = require("./routes/upload");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/upload", uploadRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  res.status(status).json({ error: err.message });
});

const port = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(port, () => console.log(`ParrillaPay API listening on ${port}`));
}

module.exports = app;
