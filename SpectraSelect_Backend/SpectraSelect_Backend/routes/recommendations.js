const router = require("express").Router();
const db = require("../db");
const authenticateToken = require("../middleware/auth");
const { rankStandards, normalizeRequirements } = require("../engine/recommend");

/*
  Request body (all requirement fields are optional; "" = no constraint):
  {
    "communication_range": "short | medium | long | verylong",
    "required_data_rate":  "low | medium | high | veryhigh",
    "environment":         "indoor | outdoor | both",
    "power_source":        "low | medium | notconstraint",
    "budget":              "low | medium | high",
    "latency_target":      "verylow | low | medium | high",
    "weights": { "range": 25, "data_rate": 20, "power_efficiency": 25, "cost": 15, "latency": 15 }
  }
  (the visible dropdown labels such as "Very long (> 1 km)" are also accepted)
*/

async function buildRecommendation(body) {
  const parsed = normalizeRequirements(body || {});

  if (parsed.error) {
    return { status: 400, payload: { success: false, message: parsed.error } };
  }

  const [rows] = await db.query("SELECT * FROM standards ORDER BY id");

  if (!rows.length) {
    return { status: 404, payload: { success: false, message: "No standards found in database" } };
  }

  if (rows[0].power_draw === undefined) {
    return {
      status: 500,
      payload: {
        success: false,
        message: "Database is outdated (column power_draw is missing). Run sql/spectraselect.sql again in MySQL Workbench."
      }
    };
  }

  const result = rankStandards(rows, parsed.req, (body && body.weights) || {});

  if (result.error) {
    return { status: 400, payload: { success: false, message: result.error } };
  }

  const ranking = result.ranking.map((item) => ({ ...item, match_score: item.pct }));

  return {
    status: 200,
    payload: {
      success: true,
      engine: "backend",
      requirements: parsed.req,
      recommended: ranking[0],
      alternatives: ranking.slice(1, 4),
      ranking
    }
  };
}

/* Public: calculate only (used by the website's Compute button, nothing is saved) */
router.post("/preview", async (req, res) => {
  try {
    const { status, payload } = await buildRecommendation(req.body);
    res.status(status).json(payload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Logged-in: calculate AND save to recommendation_history */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { status, payload } = await buildRecommendation(req.body);

    if (status === 200) {
      await db.query(
        `INSERT INTO recommendation_history
         (user_id, requirements_json, recommended_standard, match_score)
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          JSON.stringify(req.body),
          payload.recommended.name,
          payload.recommended.match_score
        ]
      );
    }

    res.status(status).json(payload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
