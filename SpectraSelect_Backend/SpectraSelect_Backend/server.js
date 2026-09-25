require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");

const authRoutes = require("./routes/auth");
const standardsRoutes = require("./routes/standards");
const calculationsRoutes = require("./routes/calculations");
const recommendationsRoutes = require("./routes/recommendations");

const app = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON request body" });
  }
  next(err);
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SpectraSelect API is running",
    port: process.env.PORT || 4000
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1 AS ok");
    res.json({ success: true, database: "connected" });
  } catch (error) {
    res.status(500).json({ success: false, database: "not connected", error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/standards", standardsRoutes);
app.use("/api/calculations", calculationsRoutes);
app.use("/api/recommendations", recommendationsRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SpectraSelect API running at http://localhost:${PORT}`);
});
