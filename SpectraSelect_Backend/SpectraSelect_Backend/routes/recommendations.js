const router = require("express").Router();
const db = require("../db");
const authenticateToken = require("../middleware/auth");

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      communication_range,
      required_data_rate,
      environment,
      power_source,
      budget,
      latency_target,
      weights
    } = req.body;

    const [standards] = await db.query("SELECT * FROM standards");

    if (!standards.length) {
      return res.status(404).json({ message: "No standards found in database" });
    }

    const w = {
      range: Number(weights?.range ?? 20),
      data_rate: Number(weights?.data_rate ?? 20),
      power_efficiency: Number(weights?.power_efficiency ?? 20),
      cost: Number(weights?.cost ?? 20),
      latency: Number(weights?.latency ?? 20)
    };

    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;

    function score(s) {
      let rangeScore = s.range_score;
      let dataScore = s.data_rate_score;
      let powerScore = s.power_score;
      let costScore = s.cost_score;
      let latencyScore = s.latency_score;

      // User requirements add a simple requirement-fit bonus/penalty.
      const rangeText = String(communication_range || "").toLowerCase();
      if (rangeText.includes("long") && s.range_m >= 5000) rangeScore += 10;
      if (rangeText.includes("short") && s.range_m <= 100) rangeScore += 5;

      const rateText = String(required_data_rate || "").toLowerCase();
      if (rateText.includes("high") && s.data_rate_kbps >= 100000) dataScore += 10;
      if (rateText.includes("low") && s.data_rate_kbps <= 1000) dataScore += 5;

      const latencyText = String(latency_target || "").toLowerCase();
      if (latencyText.includes("low") && s.latency_ms <= 50) latencyScore += 10;

      const budgetText = String(budget || "").toLowerCase();
      if (budgetText.includes("low") && s.cost === "Low") costScore += 10;

      const powerText = String(power_source || "").toLowerCase();
      if (powerText.includes("battery") && s.power === "Low") powerScore += 10;

      const raw =
        rangeScore * w.range +
        dataScore * w.data_rate +
        powerScore * w.power_efficiency +
        costScore * w.cost +
        latencyScore * w.latency;

      return raw / totalWeight;
    }

    const ranked = standards
      .map(s => ({ ...s, match_score: Number(score(s).toFixed(2)) }))
      .sort((a, b) => b.match_score - a.match_score);

    const recommendation = ranked[0];
    const alternatives = ranked.slice(1, 4);

    await db.query(
      `INSERT INTO recommendation_history
       (user_id, requirements_json, recommended_standard, match_score)
       VALUES (?, ?, ?, ?)`,
      [
        req.user.id,
        JSON.stringify(req.body),
        recommendation.name,
        recommendation.match_score
      ]
    );

    res.json({
      success: true,
      recommended: recommendation,
      alternatives
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/history", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, recommended_standard, match_score, created_at
       FROM recommendation_history
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, history: rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
