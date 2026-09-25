const router = require("express").Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, frequency, range_m, data_rate_kbps, power, power_draw, latency_ms, cost, range_score, data_rate_score, power_score, cost_score, latency_score, description FROM standards ORDER BY id"
    );
    res.json({ success: true, standards: rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:name", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM standards WHERE name = ? LIMIT 1",
      [req.params.name]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Standard not found" });
    }

    res.json({ success: true, standard: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
