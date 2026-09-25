/* =========================================================
   SpectraSelect recommendation engine (backend copy)

   This is the SAME algorithm the frontend uses (js/app.js),
   so both always give the same ranking for the same input.

   match score = preference score (weights)  x  requirement fit (dropdowns)

   NOTE: mysql2 returns DECIMAL columns as STRINGS ("10.00"),
   so every database value is converted with Number() first.
========================================================= */

const REQ_RANGE_M = { short: 10, medium: 100, long: 1000, verylong: 2000 };
const REQ_RATE_KBPS = { low: 20, medium: 1600, high: 70000, veryhigh: 500000 };
const REQ_LATENCY_MS = { verylow: 10, low: 100, medium: 1000, high: Infinity };
const REQ_POWER_MAX = { low: 3, medium: 6, notconstraint: 10 };
const REQ_COST_MAX = { low: 1, medium: 2, high: 3 };
const REQ_ENV_MIN_RANGE = { indoor: 0, outdoor: 100, both: 50 };
const COST_LEVEL = { Low: 1, Medium: 2, High: 3 };
const MAX_PENALTY = 0.4;

const REQ_LABELS = {
  environment: { indoor: "indoor", outdoor: "outdoor", both: "mixed" },
  power: { low: "multi-year battery", medium: "rechargeable", notconstraint: "mains powered" },
  budget: { low: "low budget", medium: "medium budget", high: "high budget" }
};

/* --------- accepted values per requirement (+ readable-label aliases) --------- */

const FIELD_VALUES = {
  range: ["short", "medium", "long", "verylong"],
  dataRate: ["low", "medium", "high", "veryhigh"],
  environment: ["indoor", "outdoor", "both"],
  power: ["low", "medium", "notconstraint"],
  budget: ["low", "medium", "high"],
  latency: ["verylow", "low", "medium", "high"]
};

/* The old API received the visible dropdown text, e.g. "Very long (> 1 km)".
   Those labels are still understood. */
const LABEL_ALIASES = {
  range: [["very long", "verylong"], ["long", "long"], ["medium", "medium"], ["short", "short"]],
  dataRate: [["very high", "veryhigh"], ["high", "high"], ["medium", "medium"], ["low", "low"]],
  environment: [["mixed", "both"], ["indoor", "indoor"], ["outdoor", "outdoor"]],
  power: [["battery", "low"], ["rechargeable", "medium"], ["mains", "notconstraint"]],
  budget: [["low", "low"], ["medium", "medium"], ["high", "high"]],
  latency: [["ultra", "verylow"], ["low", "low"], ["medium", "medium"], ["high", "high"], ["delay", "high"]]
};

/* returns { value } (value may be "" = not given) or { error } */
function normalizeField(field, raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { value: "" };
  }

  const text = String(raw).trim().toLowerCase();

  if (FIELD_VALUES[field].includes(text)) {
    return { value: text };
  }

  for (const [prefix, value] of LABEL_ALIASES[field]) {
    if (text.startsWith(prefix)) {
      return { value };
    }
  }

  return { error: `Invalid value "${raw}" for ${field}. Use one of: ${FIELD_VALUES[field].join(", ")}` };
}

function normalizeRequirements(body) {
  const map = {
    range: body.communication_range,
    dataRate: body.required_data_rate,
    environment: body.environment,
    power: body.power_source,
    budget: body.budget,
    latency: body.latency_target
  };

  const req = {};

  for (const field of Object.keys(map)) {
    const result = normalizeField(field, map[field]);
    if (result.error) {
      return { error: result.error };
    }
    req[field] = result.value;
  }

  return { req };
}

/* --------- formatting (same text as the frontend) --------- */

function formatRange(range) {
  return range >= 1000 ? (range / 1000) + " km" : range + " m";
}

function formatDataRate(rate) {
  if (rate >= 1000000) return (rate / 1000000) + " Gbps";
  if (rate >= 1000) return (rate / 1000) + " Mbps";
  return rate + " kbps";
}

function decadeSeverity(decades) {
  return Math.min(1, Math.max(0, decades) / 1.5);
}

/* --------- requirement fit --------- */

function evaluateFit(std, req) {
  const checks = [];

  const rTarget = REQ_RANGE_M[req.range] || 0;
  const rOk = std.rangeM >= rTarget;
  const rSev = rOk ? 0 : decadeSeverity(Math.log10(rTarget / std.rangeM));
  checks.push({
    key: "range", label: "Range", ok: rOk, sev: rSev,
    text: formatRange(std.rangeM) + (rOk ? " ≥ " : " < ") + formatRange(rTarget) + " needed"
  });

  const eTarget = REQ_ENV_MIN_RANGE[req.environment] || 0;
  const eOk = std.rangeM >= eTarget;
  const eSev = eOk ? 0 : decadeSeverity(Math.log10(eTarget / std.rangeM));
  checks.push({
    key: "environment", label: "Environment", ok: eOk, sev: eSev,
    text: eTarget === 0 ? "indoor — no extra range needed" :
      (eOk ? "suits " : "range too short for ") + REQ_LABELS.environment[req.environment] + " use"
  });

  const dTarget = REQ_RATE_KBPS[req.dataRate] || 0;
  const dOk = std.rateKbps >= dTarget;
  const dSev = dOk ? 0 : decadeSeverity(Math.log10(dTarget / std.rateKbps));
  checks.push({
    key: "dataRate", label: "Data rate", ok: dOk, sev: dSev,
    text: formatDataRate(std.rateKbps) + (dOk ? " ≥ " : " < ") + formatDataRate(dTarget) + " target"
  });

  let lTarget = REQ_LATENCY_MS[req.latency];
  if (lTarget === undefined) lTarget = Infinity;
  const lOk = std.latencyMs <= lTarget;
  const lSev = lOk ? 0 : decadeSeverity(Math.log10(std.latencyMs / lTarget));
  checks.push({
    key: "latency", label: "Latency", ok: lOk, sev: lSev,
    text: lTarget === Infinity ? "delay tolerant — any latency" :
      std.latencyMs + " ms" + (lOk ? " ≤ " : " > ") + lTarget + " ms limit"
  });

  let pMax = REQ_POWER_MAX[req.power];
  if (pMax === undefined) pMax = 10;
  const pOk = std.power <= pMax;
  const pSev = pOk ? 0 : Math.min(1, (std.power - pMax) / 4);
  checks.push({
    key: "power", label: "Power", ok: pOk, sev: pSev,
    text: pMax >= 10 ? "mains powered — no limit" :
      "draw " + std.power + "/10" + (pOk ? " ≤ " : " > ") + pMax + "/10 for " + REQ_LABELS.power[req.power]
  });

  let bMax = REQ_COST_MAX[req.budget];
  if (bMax === undefined) bMax = 3;
  const bLevel = COST_LEVEL[std.cost] || 1;
  const bOk = bLevel <= bMax;
  const bSev = bOk ? 0 : Math.min(1, (bLevel - bMax) / 2);
  checks.push({
    key: "budget", label: "Budget", ok: bOk, sev: bSev,
    text: std.cost + " cost" + (bOk ? " fits " : " exceeds ") + (REQ_LABELS.budget[req.budget] || "any budget")
  });

  const covSev = Math.max(rSev, eSev);

  const fit =
    (1 - MAX_PENALTY * covSev) *
    (1 - MAX_PENALTY * dSev) *
    (1 - MAX_PENALTY * lSev) *
    (1 - MAX_PENALTY * pSev) *
    (1 - MAX_PENALTY * bSev);

  const met = checks.filter((c) => c.ok).length;

  return { checks, fit, met, total: checks.length };
}

/* --------- DB row -> engine standard (all numbers converted) --------- */

function rowToStandard(row) {
  return {
    name: row.name,
    frequency: row.frequency,
    description: row.description,
    rangeM: Number(row.range_m),
    rateKbps: Number(row.data_rate_kbps),
    power: Number(row.power_draw),
    latencyMs: Number(row.latency_ms),
    cost: row.cost,
    scores: {
      range: Number(row.range_score),
      dataRate: Number(row.data_rate_score),
      power: Number(row.power_score),
      budget: Number(row.cost_score),
      latency: Number(row.latency_score)
    }
  };
}

/* --------- ranking --------- */

/* weights: { range, data_rate, power_efficiency, cost, latency }  (any positive numbers) */
function rankStandards(rows, req, weights) {
  const w = {
    range: Number(weights.range ?? 20),
    dataRate: Number(weights.data_rate ?? 20),
    power: Number(weights.power_efficiency ?? 20),
    budget: Number(weights.cost ?? 20),
    latency: Number(weights.latency ?? 20)
  };

  const values = Object.values(w);

  if (values.some((v) => !Number.isFinite(v) || v < 0)) {
    return { error: "weights must be numbers ≥ 0" };
  }

  const total = values.reduce((a, b) => a + b, 0);

  if (total <= 0) {
    return { error: "At least one weight must be greater than 0" };
  }

  const results = rows.map((row, idx) => {
    const std = rowToStandard(row);
    const s = std.scores;

    const base =
      s.range * (w.range / total) +
      s.dataRate * (w.dataRate / total) +
      s.power * (w.power / total) +
      s.budget * (w.budget / total) +
      s.latency * (w.latency / total);

    const fitInfo = evaluateFit(std, req);

    let score = base * fitInfo.fit;
    score = Math.round(score * 1e6) / 1e6;

    return {
      name: std.name,
      idx,
      frequency: std.frequency,
      description: std.description,
      range_m: std.rangeM,
      data_rate_kbps: std.rateKbps,
      power_draw: std.power,
      latency_ms: std.latencyMs,
      cost: std.cost,
      base,
      fit: fitInfo.fit,
      checks: fitInfo.checks,
      met: fitInfo.met,
      total: fitInfo.total,
      score,
      pct: Math.round(score * 10)
    };
  });

  results.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-9) return b.score - a.score;
    return a.idx - b.idx;
  });

  results.forEach((item, i) => {
    item.rank = i + 1;
  });

  return { ranking: results };
}

module.exports = { rankStandards, normalizeRequirements, FIELD_VALUES };
