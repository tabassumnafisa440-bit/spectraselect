/* =========================================================
   SpectraSelect — app.js

   HOW IT WORKS (single-input flow)
   1. User enters requirements + weights ONCE (section 01).
   2. runRecommendation() ranks all standards -> lastRanking.
   3. applyRecommendation() rebuilds every other section
      (map, calculators, radar, table, charts) from that ranking.
========================================================= */

const STANDARDS = {
    "Wi-Fi": {
        freq: "2.4 / 5 GHz",
        rangeM: 100,
        rateKbps: 1000000,
        power: 8,
        latencyMs: 20,
        cost: "Low",
        scores: { range: 4, dataRate: 9, power: 3, budget: 8, latency: 8 },
        desc: "High-throughput local networking for substantial data transfer, especially where accessible power is available.",
        freqOptions: [
            { label: "2.4 GHz band", mhz: 2450 },
            { label: "5 GHz band", mhz: 5200 }
        ],
        freqDefault: 0,
        battery: { tx: 250, sleep: 0.01, duty: 1 }
    },

    "Bluetooth": {
        freq: "2.4 GHz",
        rangeM: 30,
        rateKbps: 2000,
        power: 3,
        latencyMs: 15,
        cost: "Low",
        scores: { range: 2, dataRate: 6, power: 8, budget: 9, latency: 8 },
        desc: "Short-range personal-area networking for wearables, peripherals, and direct smartphone-sensor links.",
        freqOptions: [{ label: "2.4 GHz ISM", mhz: 2450 }],
        freqDefault: 0,
        battery: { tx: 8, sleep: 0.002, duty: 1 }
    },

    "ZigBee": {
        freq: "2.4 GHz",
        rangeM: 100,
        rateKbps: 250,
        power: 2,
        latencyMs: 30,
        cost: "Low",
        scores: { range: 4, dataRate: 3, power: 9, budget: 8, latency: 6 },
        desc: "Low-power mesh networking for smart-home, building automation, and sensor networks.",
        freqOptions: [{ label: "2.4 GHz ISM", mhz: 2450 }],
        freqDefault: 0,
        battery: { tx: 35, sleep: 0.001, duty: 1 }
    },

    "LoRaWAN": {
        freq: "868 / 915 MHz",
        rangeM: 10000,
        rateKbps: 27,
        power: 1,
        latencyMs: 1500,
        cost: "Low",
        scores: { range: 10, dataRate: 1, power: 10, budget: 9, latency: 2 },
        desc: "Ultra-long-range, low-power sub-GHz technology for agriculture, environmental sensing, and smart-city deployments.",
        freqOptions: [
            { label: "868 MHz (EU868)", mhz: 868 },
            { label: "915 MHz (US915 / AS923)", mhz: 915 }
        ],
        freqDefault: 1,
        battery: { tx: 120, sleep: 0.015, duty: 0.1 }
    },

    "NB-IoT": {
        freq: "Licensed Cellular",
        rangeM: 8000,
        rateKbps: 250,
        power: 2,
        latencyMs: 1000,
        cost: "Medium",
        scores: { range: 9, dataRate: 3, power: 9, budget: 6, latency: 3 },
        desc: "Low-power wide-area cellular technology for connected sensors, utility metering, and logistics.",
        freqOptions: [
            { label: "800 MHz (Band 20)", mhz: 800 },
            { label: "900 MHz (Band 8)", mhz: 900 },
            { label: "1800 MHz (Band 3)", mhz: 1800 }
        ],
        freqDefault: 1,
        battery: { tx: 220, sleep: 0.003, duty: 0.1 }
    },

    "LTE": {
        freq: "Licensed Cellular",
        rangeM: 5000,
        rateKbps: 150000,
        power: 6,
        latencyMs: 40,
        cost: "Medium",
        scores: { range: 7, dataRate: 8, power: 4, budget: 5, latency: 7 },
        desc: "Mobile broadband with wide coverage and high mobility for field and vehicular systems.",
        freqOptions: [
            { label: "900 MHz (Band 8)", mhz: 900 },
            { label: "1800 MHz (Band 3)", mhz: 1800 },
            { label: "2600 MHz (Band 7)", mhz: 2600 }
        ],
        freqDefault: 1,
        battery: { tx: 600, sleep: 2, duty: 5 }
    },

    "5G": {
        freq: "Sub-6GHz / mmWave",
        rangeM: 3000,
        rateKbps: 10000000,
        power: 8,
        latencyMs: 4,
        cost: "High",
        scores: { range: 6, dataRate: 10, power: 2, budget: 3, latency: 10 },
        desc: "Next-generation cellular technology supporting high throughput and low latency.",
        freqOptions: [
            { label: "3.5 GHz (n78, sub-6)", mhz: 3500 },
            { label: "28 GHz (n257, mmWave)", mhz: 28000 }
        ],
        freqDefault: 0,
        battery: { tx: 1000, sleep: 5, duty: 5 }
    }
};

const MAP_HOME = [24.3636, 88.6284];
const COLOR_REC = "#16a34a";      /* rank 1  */
const COLOR_TOP = "#2563eb";      /* rank 2-3 */
const COLOR_OTHER = "#cbd5e1";    /* rest    */

/* Backend (Node + MySQL). When it is running, the Compute button uses it.
   When it is not reachable, the website calculates locally with the same formula. */
const API_BASE = "https://spectraselect-backend.onrender.com";
const USE_BACKEND = true;
const BACKEND_TIMEOUT_MS = 2500;


/* =========================================================
   GLOBAL STATE
========================================================= */

var currentUser = null;

var lastRanking = null;      /* [{name, score, pct, rank}] best -> worst */
var calcStd = null;          /* standard currently shown in calculators  */

var mapObj = null;
var mapMarker = null;
var mapCircle = null;
var lastMapRadius = null;

var multiRadarChartObj = null;
var matchChartObj = null;
var rangeChartObj = null;
var scatterChartObj = null;
var fsplChartObj = null;
var batteryChartObj = null;

var activeRadarStds = [];
var recomputeTimer = null;

var recommendSeq = 0;            /* ignores out-of-date backend answers */
var engineSource = "checking";  /* "checking" | "backend" | "local" */
var engineNote = "";


/* =========================================================
   SMALL HELPERS
========================================================= */

function byId(id) {
    return document.getElementById(id);
}

function fmt(n, digits) {
    return Number(n).toLocaleString("en-US", {
        maximumFractionDigits: digits === undefined ? 2 : digits
    });
}

function formatRange(range) {
    if (range >= 1000) {
        return (range / 1000) + " km";
    }
    return range + " m";
}

function formatDataRate(rate) {
    if (rate >= 1000000) {
        return (rate / 1000000) + " Gbps";
    }
    if (rate >= 1000) {
        return (rate / 1000) + " Mbps";
    }
    return rate + " kbps";
}

function formatLife(hours) {
    if (!isFinite(hours)) {
        return "∞";
    }
    var years = hours / (24 * 365.25);
    if (years >= 1) {
        return fmt(years, 2) + " years";
    }
    var days = hours / 24;
    if (days >= 1) {
        return fmt(days, 1) + " days";
    }
    return fmt(hours, 1) + " hours";
}

function fsplDb(distanceM, freqMHz) {
    return 20 * Math.log10(distanceM) + 20 * Math.log10(freqMHz) - 27.55;
}

function batteryCalc(capMah, txMa, sleepMa, dutyPct) {
    var duty = dutyPct / 100;
    var avg = txMa * duty + sleepMa * (1 - duty);
    var hours = avg > 0 ? capMah / avg : Infinity;
    return { duty: duty, avg: avg, hours: hours };
}

function typicalFreq(std) {
    return std.freqOptions[std.freqDefault].mhz;
}

function getRankItem(name) {
    if (!lastRanking) {
        return null;
    }
    for (var i = 0; i < lastRanking.length; i++) {
        if (lastRanking[i].name === name) {
            return lastRanking[i];
        }
    }
    return null;
}

function topNames(n) {
    if (!lastRanking) {
        return Object.keys(STANDARDS).slice(0, n);
    }
    return lastRanking.slice(0, n).map(function (item) {
        return item.name;
    });
}

function rankColor(rank) {
    if (rank === 1) {
        return COLOR_REC;
    }
    if (rank && rank <= 3) {
        return COLOR_TOP;
    }
    return COLOR_OTHER;
}

/* Chart.js plugin: draws small text labels on bars / points.
   Labels come from  dataset.labelTexts[i]  */
var valueLabelPlugin = {
    id: "valueLabels",
    afterDatasetsDraw: function (chart) {
        var opts = chart.options.plugins && chart.options.plugins.valueLabels;
        var side = opts && opts.side ? opts.side : "top";
        var ctx = chart.ctx;

        chart.data.datasets.forEach(function (ds, di) {
            if (!ds.labelTexts) {
                return;
            }
            var meta = chart.getDatasetMeta(di);
            if (meta.hidden) {
                return;
            }
            meta.data.forEach(function (el, i) {
                var text = ds.labelTexts[i];
                if (!text) {
                    return;
                }
                ctx.save();
                ctx.font = "600 11px 'JetBrains Mono', monospace";
                ctx.fillStyle = "#0f172a";
                if (side === "right") {
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";
                    ctx.fillText(text, el.x + 12, el.y);
                } else {
                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom";
                    ctx.fillText(text, el.x, el.y - 6);
                }
                ctx.restore();
            });
        });
    }
};

/* Clean tick labels for logarithmic axes: only 1, 3, 10, 30, 100 ... */
function logTicks(formatter) {
    return function (value) {
        if (!(value > 0)) {
            return "";
        }
        var exp = Math.floor(Math.log10(value) + 1e-9);
        var mantissa = value / Math.pow(10, exp);
        if (Math.abs(mantissa - 1) < 1e-6 || Math.abs(mantissa - 3) < 1e-6) {
            return formatter(value);
        }
        return "";
    };
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
    return null;
}


/* =========================================================
   LOGIN  (demo: any username + access key 1234)
========================================================= */

function handleLogin() {

    var userInput = byId("loginUser");
    var passInput = byId("loginPass");

    var username = userInput ? userInput.value.trim() : "";
    var password = passInput ? passInput.value.trim() : "";

    var loginErr = byId("loginErr");

    if (username !== "" && password === "1234") {

        currentUser = username;

        byId("loginOverlay").style.display = "none";
        byId("userBadge").textContent = "👤 " + username;
        byId("logoutBtn").style.display = "inline";

        if (loginErr) {
            loginErr.style.display = "none";
        }

        initApp();

    } else if (loginErr) {
        loginErr.style.display = "block";
    }
}

function handleLogout() {

    currentUser = null;

    byId("loginOverlay").style.display = "flex";
    byId("userBadge").textContent = "🔒 Guest";
    byId("logoutBtn").style.display = "none";
}


/* =========================================================
   WEIGHTS
========================================================= */

var WEIGHT_IDS = ["range", "dataRate", "power", "budget", "latency"];

function readWeights() {

    var w = { total: 0 };

    WEIGHT_IDS.forEach(function (id) {
        var slider = byId("w_" + id);
        w[id] = slider ? Number(slider.value) : 0;
        w.total += w[id];
    });

    return w;
}

function updateWeights() {

    var w = readWeights();

    WEIGHT_IDS.forEach(function (id) {
        var display = byId("w_" + id + "_val");
        if (display) {
            display.textContent = w[id] + "%";
        }
    });

    var totalDisplay = byId("weightTotalDisplay");

    if (totalDisplay) {

        totalDisplay.textContent = "Total: " + w.total + "%" +
            (w.total !== 100 && w.total > 0 ? " (auto-normalised)" : "");

        totalDisplay.style.color =
            w.total === 100 ? "var(--green)" : "var(--primary)";
    }
}


/* =========================================================
   RECOMMENDATION ENGINE
========================================================= */

/* ---------------------------------------------------------
   REQUIREMENT MODEL
   The dropdowns define hard-ish requirements. A standard that
   cannot meet one gets its score reduced (max 40 % per criterion),
   proportional to how badly it misses.
   The sliders (weights) still say how much each criterion matters.
--------------------------------------------------------- */

var REQ_RANGE_M = { short: 10, medium: 100, long: 1000, verylong: 2000 };
var REQ_RATE_KBPS = { low: 20, medium: 1600, high: 70000, veryhigh: 500000 };
var REQ_LATENCY_MS = { verylow: 10, low: 100, medium: 1000, high: Infinity };
var REQ_POWER_MAX = { low: 3, medium: 6, notconstraint: 10 };
var REQ_COST_MAX = { low: 1, medium: 2, high: 3 };
var REQ_ENV_MIN_RANGE = { indoor: 0, outdoor: 100, both: 50 };
var COST_LEVEL = { Low: 1, Medium: 2, High: 3 };
var MAX_PENALTY = 0.4;

var REQ_LABELS = {
    range: { short: "< 10 m", medium: "10–100 m", long: "100 m–1 km", verylong: "> 1 km" },
    dataRate: { low: "< 250 kbps", medium: "250 kbps–10 Mbps", high: "10–500 Mbps", veryhigh: "> 500 Mbps" },
    environment: { indoor: "indoor", outdoor: "outdoor", both: "mixed" },
    power: { low: "multi-year battery", medium: "rechargeable", notconstraint: "mains powered" },
    budget: { low: "low budget", medium: "medium budget", high: "high budget" },
    latency: { verylow: "< 10 ms", low: "< 100 ms", medium: "< 1 s", high: "delay tolerant" }
};

function readRequirements() {

    var req = {};

    ["range", "dataRate", "environment", "power", "budget", "latency"].forEach(function (key) {
        var el = byId("in_" + key);
        req[key] = el ? el.value : "";
    });

    return req;
}

/* severity 0..1 from a shortfall measured in decades (factors of 10) */
function decadeSeverity(decades) {
    return Math.min(1, Math.max(0, decades) / 1.5);
}

function evaluateFit(std, req) {

    var checks = [];

    /* range */
    var rTarget = REQ_RANGE_M[req.range] || 0;
    var rOk = std.rangeM >= rTarget;
    var rSev = rOk ? 0 : decadeSeverity(Math.log10(rTarget / std.rangeM));

    checks.push({
        key: "range", label: "Range", ok: rOk, sev: rSev,
        text: formatRange(std.rangeM) + (rOk ? " ≥ " : " < ") + formatRange(rTarget) + " needed"
    });

    /* environment (needs a minimum outdoor-capable range) */
    var eTarget = REQ_ENV_MIN_RANGE[req.environment] || 0;
    var eOk = std.rangeM >= eTarget;
    var eSev = eOk ? 0 : decadeSeverity(Math.log10(eTarget / std.rangeM));

    checks.push({
        key: "environment", label: "Environment", ok: eOk, sev: eSev,
        text: eTarget === 0 ? "indoor — no extra range needed" :
            (eOk ? "suits " : "range too short for ") + REQ_LABELS.environment[req.environment] + " use"
    });

    /* data rate */
    var dTarget = REQ_RATE_KBPS[req.dataRate] || 0;
    var dOk = std.rateKbps >= dTarget;
    var dSev = dOk ? 0 : decadeSeverity(Math.log10(dTarget / std.rateKbps));

    checks.push({
        key: "dataRate", label: "Data rate", ok: dOk, sev: dSev,
        text: formatDataRate(std.rateKbps) + (dOk ? " ≥ " : " < ") + formatDataRate(dTarget) + " target"
    });

    /* latency */
    var lTarget = REQ_LATENCY_MS[req.latency];
    if (lTarget === undefined) {
        lTarget = Infinity;
    }
    var lOk = std.latencyMs <= lTarget;
    var lSev = lOk ? 0 : decadeSeverity(Math.log10(std.latencyMs / lTarget));

    checks.push({
        key: "latency", label: "Latency", ok: lOk, sev: lSev,
        text: lTarget === Infinity ? "delay tolerant — any latency" :
            std.latencyMs + " ms" + (lOk ? " ≤ " : " > ") + lTarget + " ms limit"
    });

    /* power */
    var pMax = REQ_POWER_MAX[req.power];
    if (pMax === undefined) {
        pMax = 10;
    }
    var pOk = std.power <= pMax;
    var pSev = pOk ? 0 : Math.min(1, (std.power - pMax) / 4);

    checks.push({
        key: "power", label: "Power", ok: pOk, sev: pSev,
        text: pMax >= 10 ? "mains powered — no limit" :
            "draw " + std.power + "/10" + (pOk ? " ≤ " : " > ") + pMax + "/10 for " + REQ_LABELS.power[req.power]
    });

    /* budget */
    var bMax = REQ_COST_MAX[req.budget];
    if (bMax === undefined) {
        bMax = 3;
    }
    var bLevel = COST_LEVEL[std.cost] || 1;
    var bOk = bLevel <= bMax;
    var bSev = bOk ? 0 : Math.min(1, (bLevel - bMax) / 2);

    checks.push({
        key: "budget", label: "Budget", ok: bOk, sev: bSev,
        text: std.cost + " cost" + (bOk ? " fits " : " exceeds ") + (REQ_LABELS.budget[req.budget] || "any budget")
    });

    /* range and environment both test coverage, so only the worse one counts */
    var covSev = Math.max(rSev, eSev);

    var fit =
        (1 - MAX_PENALTY * covSev) *
        (1 - MAX_PENALTY * dSev) *
        (1 - MAX_PENALTY * lSev) *
        (1 - MAX_PENALTY * pSev) *
        (1 - MAX_PENALTY * bSev);

    var met = checks.filter(function (c) { return c.ok; }).length;

    return { checks: checks, fit: fit, met: met, total: checks.length };
}

function computeRanking() {

    var w = readWeights();

    if (w.total <= 0) {
        return null;
    }

    var req = readRequirements();
    var names = Object.keys(STANDARDS);

    var results = names.map(function (name, idx) {

        var std = STANDARDS[name];
        var s = std.scores;

        /* 1) preference score from the weights (0-10, weights normalised by their total) */
        var base =
            s.range * (w.range / w.total) +
            s.dataRate * (w.dataRate / w.total) +
            s.power * (w.power / w.total) +
            s.budget * (w.budget / w.total) +
            s.latency * (w.latency / w.total);

        /* 2) requirement fit from the dropdowns (0.4 - 1.0) */
        var fitInfo = evaluateFit(std, req);

        var score = base * fitInfo.fit;

        /* remove floating-point noise so equal scores show equal percentages */
        score = Math.round(score * 1e6) / 1e6;

        return {
            name: name,
            idx: idx,
            base: base,
            fit: fitInfo.fit,
            checks: fitInfo.checks,
            met: fitInfo.met,
            total: fitInfo.total,
            score: score,
            pct: Math.round(score * 10)
        };
    });

    results.sort(function (a, b) {
        if (Math.abs(a.score - b.score) > 1e-9) {
            return b.score - a.score;
        }
        return a.idx - b.idx;
    });

    results.forEach(function (item, i) {
        item.rank = i + 1;
    });

    return results;
}

function runRecommendation() {

    var panel = byId("resultPanel");
    var payload = buildBackendPayload();
    var w = readWeights();

    if (!w.total) {
        recommendSeq++;
        if (panel) {
            panel.innerHTML = '<div class="result-empty">All weights are 0%.<br>Increase at least one priority slider.</div>';
        }
        return;
    }

    /* Backend-only mode: the recommendation is calculated from MySQL data.
       There is deliberately NO browser/local fallback here. */
    var seq = ++recommendSeq;
    engineSource = "checking";
    engineNote = "";
    if (panel) {
        panel.innerHTML = '<div class="result-empty">Connecting to SpectraSelect backend…<br><span class="mono small">MySQL → Node/Express → Frontend</span></div>';
    }
    updateEngineStatus();

    fetchBackendRanking(payload).then(function (data) {
        if (seq !== recommendSeq) return;

        var remote = data.ranking
            .filter(function (item) { return STANDARDS[item.name]; })
            .map(function (item) {
                return {
                    name: item.name, idx: item.idx, base: item.base, fit: item.fit,
                    checks: item.checks, met: item.met, total: item.total,
                    score: item.score, pct: item.pct, rank: item.rank
                };
            });

        if (remote.length !== Object.keys(STANDARDS).length) {
            throw new Error("Backend returned an incomplete standards list");
        }

        lastRanking = remote;
        engineSource = "backend";
        engineNote = "MySQL database";
        renderResultPanel();
        applyRecommendation();
    }).catch(function (err) {
        if (seq !== recommendSeq) return;
        engineSource = "local";
        engineNote = (err && err.name === "AbortError")
            ? "backend did not answer in time"
            : (err && err.message ? err.message : "backend not reachable");
        if (panel) {
            panel.innerHTML = '<div class="result-empty"><strong>Backend not reachable.</strong><br>' +
                'Start the Node/Express backend and make sure MySQL is running.<br><br>' +
                '<span class="mono small">' + engineNote + '</span><br><br>' +
                '<span class="mono small">Test: http://localhost:4000/api/health</span></div>';
        }
        updateEngineStatus();
    });
}

function buildBackendPayload() {

    var req = readRequirements();
    var w = readWeights();

    return {
        communication_range: req.range,
        required_data_rate: req.dataRate,
        environment: req.environment,
        power_source: req.power,
        budget: req.budget,
        latency_target: req.latency,
        weights: {
            range: w.range,
            data_rate: w.dataRate,
            power_efficiency: w.power,
            cost: w.budget,
            latency: w.latency
        }
    };
}

function fetchBackendRanking(payload) {

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, BACKEND_TIMEOUT_MS);

    return fetch(API_BASE + "/api/recommendations/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
    }).then(function (response) {
        return response.json().then(function (data) {
            if (!response.ok || !data.success) {
                throw new Error(data.message || ("HTTP " + response.status));
            }
            return data;
        });
    }).finally(function () {
        clearTimeout(timer);
    });
}

function sameRanking(a, b) {

    if (a.length !== b.length) {
        return false;
    }

    for (var i = 0; i < a.length; i++) {
        if (a[i].name !== b[i].name || a[i].pct !== b[i].pct || a[i].met !== b[i].met) {
            return false;
        }
    }

    return true;
}

function confirmWithBackend(seq) {

    fetchBackendRanking(buildBackendPayload()).then(function (data) {

        if (seq !== recommendSeq) {
            return;      /* a newer request is already running */
        }

        var remote = data.ranking
            .filter(function (item) { return STANDARDS[item.name]; })
            .map(function (item) {
                return {
                    name: item.name,
                    idx: item.idx,
                    base: item.base,
                    fit: item.fit,
                    checks: item.checks,
                    met: item.met,
                    total: item.total,
                    score: item.score,
                    pct: item.pct,
                    rank: item.rank
                };
            });

        if (remote.length !== Object.keys(STANDARDS).length) {
            throw new Error("backend returned an incomplete list");
        }

        var changed = !sameRanking(lastRanking, remote);

        engineSource = "backend";
        engineNote = changed ? "database values differ from the built-in table - showing the database result" : "";

        if (changed) {
            lastRanking = remote;
            renderResultPanel();
            applyRecommendation();
        } else {
            updateEngineStatus();
        }

    }).catch(function (err) {

        if (seq !== recommendSeq) {
            return;
        }

        engineSource = "local";
        engineNote = (err && err.name === "AbortError") ? "backend did not answer in time" : "backend not reachable";

        updateEngineStatus();
    });
}

function updateEngineStatus() {

    var el = byId("engineStatus");

    if (!el) {
        return;
    }

    if (engineSource === "backend") {
        el.className = "engine-pill engine-backend";
        el.textContent = "● Calculated by backend (MySQL data) — " + API_BASE +
            (engineNote ? " — " + engineNote : "");
    } else if (engineSource === "checking") {
        el.className = "engine-pill engine-checking";
        el.textContent = "● Checking backend…";
    } else {
        el.className = "engine-pill engine-local";
        el.textContent = "● Calculated in the browser (built-in table)" +
            (USE_BACKEND ? " — " + engineNote + ". Start the backend to use the database." : "");
    }
}

function renderResultPanel() {

    var panel = byId("resultPanel");

    if (!panel || !lastRanking) {
        return;
    }

    var top = lastRanking[0];
    var data = STANDARDS[top.name];
    var alternatives = lastRanking.slice(1, 4);

    var html = "";

    html += '<div class="result-head"><div>';
    html += '<div class="mono small">Top Recommended Standard</div>';
    html += '<h3>' + top.name + '</h3>';
    html += '<div class="mono small">' + data.freq + '</div>';
    html += '</div>';
    html += '<div class="match-score">' + top.pct + '%<span>Match Score</span></div>';
    html += '</div>';

    html += '<p class="explain">' + data.desc + '</p>';

    html += '<div class="result-facts">';
    html += '<div><span>Range</span>' + formatRange(data.rangeM) + '</div>';
    html += '<div><span>Data rate</span>' + formatDataRate(data.rateKbps) + '</div>';
    html += '<div><span>Latency</span>' + data.latencyMs + ' ms</div>';
    html += '<div><span>Cost</span>' + data.cost + '</div>';
    html += '</div>';

    html += '<div class="req-box">';
    html += '<div class="mono small">Your requirements — ' + top.met + '/' + top.total + ' met by ' + top.name + '</div>';
    html += '<div class="req-list">';

    top.checks.forEach(function (c) {
        html += '<div class="req-item ' + (c.ok ? 'ok' : 'miss') + '">';
        html += '<span class="req-mark">' + (c.ok ? '✓' : '✗') + '</span>';
        html += '<span><strong>' + c.label + '</strong> · ' + c.text + '</span>';
        html += '</div>';
    });

    html += '</div></div>';

    html += '<div class="alt-list">';
    html += '<div class="mono small">Alternative Options</div>';

    alternatives.forEach(function (item) {
        html += '<div class="alt-item">';
        html += '<span class="name">' + item.name + '</span>';
        html += '<span class="bar-track"><span class="bar-fill" style="display:block;width:' + item.pct + '%"></span></span>';
        html += '<span class="pct">' + item.pct + '%</span>';
        html += '<span class="fitcount">' + item.met + '/' + item.total + ' ✓</span>';
        html += '</div>';
    });

    html += '</div>';

    html += '<div id="engineStatus" class="engine-pill"></div>';

    html += '<div class="result-hint">↓ The map, calculators, radar, table and graphs below are now built for <strong>' +
        top.name + '</strong> and its top alternatives.</div>';

    panel.innerHTML = html;

    updateEngineStatus();
}


/* =========================================================
   APPLY RESULT TO EVERYTHING ELSE
========================================================= */

/* one failing section must never stop the others from rendering */
function safely(label, fn) {
    try {
        fn();
    } catch (err) {
        console.error("[SpectraSelect] " + label + " failed:", err);
    }
}

function applyRecommendation() {

    if (!lastRanking) {
        return;
    }

    var top = lastRanking[0];

    safely("context bar", updateContextBar);

    /* map */
    safely("map", function () {
        updateMapSelector();
        updateMapCircle();
    });

    /* calculators */
    safely("calculators", function () {
        setCalcStandard(top.name);
    });

    /* radar + trade-offs */
    safely("radar", function () {
        activeRadarStds = topNames(3);
        initRadarSelectors();
        renderMultiRadar();
        renderTradeoffSummary();
    });

    /* table + charts */
    safely("table", renderTable);
    safely("charts", renderAnalyticsCharts);
}

function updateContextBar() {

    var top = lastRanking[0];
    var top3 = topNames(3);

    var main = byId("ctxMain");
    if (main) {
        main.innerHTML = '★ <strong>' + top.name + '</strong> · ' + top.pct + '% match';
    }

    var list = byId("ctxTop3");
    if (list) {
        list.textContent = "Top 3: " + top3.join(" › ");
    }

    var note = "Generated for ★ " + top.name + " (" + top.pct + "% match) · Top 3: " + top3.join(", ");

    document.querySelectorAll("[data-ctx]").forEach(function (el) {
        el.textContent = note;
    });
}

function scheduleRecompute() {
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(runRecommendation, 150);
}


/* =========================================================
   MAP
========================================================= */

function initMap() {

    if (mapObj) {
        return;
    }

    var mapElement = byId("map");

    if (!mapElement) {
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet is not loaded.");
        return;
    }

    mapObj = L.map("map").setView(MAP_HOME, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
    }).addTo(mapObj);

    mapMarker = L.marker(MAP_HOME, { draggable: true })
        .addTo(mapObj)
        .bindPopup("<b>Wireless Gateway</b><br>Drag to relocate.")
        .openPopup();

    mapMarker.on("dragend", function () {
        updateMapCircle();
    });

    updateMapCircle();
}

function updateMapSelector() {

    var select = byId("mapStdSelect");

    if (!select || !lastRanking) {
        return;
    }

    select.innerHTML = lastRanking.map(function (item) {
        return '<option value="' + item.name + '">#' + item.rank + ' ' + item.name +
            (item.rank === 1 ? ' ★ Recommended' : '') + '</option>';
    }).join("");

    select.value = lastRanking[0].name;
}

function showRecommendedOnMap() {

    var select = byId("mapStdSelect");

    if (select && lastRanking) {
        select.value = lastRanking[0].name;
        updateMapCircle();
    }
}

function updateMapCircle() {

    var select = byId("mapStdSelect");

    if (!select) {
        return;
    }

    var standard = STANDARDS[select.value];

    updateMapInfo(select.value);

    if (!mapObj || !mapMarker || !standard) {
        return;
    }

    var radius = standard.rangeM;

    if (mapCircle) {
        mapObj.removeLayer(mapCircle);
    }

    var item = getRankItem(select.value);
    var isTop = item && item.rank === 1;

    mapCircle = L.circle(mapMarker.getLatLng(), {
        radius: radius,
        color: isTop ? "#15803d" : "#1e3a8a",
        fillColor: isTop ? "#16a34a" : "#2563eb",
        fillOpacity: 0.2
    }).addTo(mapObj);

    mapCircle.bindTooltip(select.value + " — radius " + formatRange(radius));

    /* re-fit the view only when the radius actually changed */
    if (radius !== lastMapRadius) {
        mapObj.fitBounds(mapCircle.getBounds(), { padding: [20, 20] });
        lastMapRadius = radius;
    }
}

function updateMapInfo(name) {

    var info = byId("mapInfo");
    var standard = STANDARDS[name];

    if (!info || !standard) {
        return;
    }

    var item = getRankItem(name);
    var html = "";

    html += '<strong>' + name + '</strong> ';

    if (item && item.rank === 1) {
        html += '<span class="badge badge-rec">★ Recommended</span>';
    } else if (item) {
        html += '<span class="badge">#' + item.rank + ' of ' + lastRanking.length + '</span>';
    }

    if (item) {
        html += ' · ' + item.pct + '% match';
    }

    html += ' · theoretical radius <strong>' + formatRange(standard.rangeM) + '</strong>';

    if (item && item.rank !== 1) {
        html += ' · <button type="button" class="link-btn" onclick="showRecommendedOnMap()">back to recommended</button>';
    }

    if (lastRanking) {
        html += '<div class="map-top3">Top 3 ranges: ' +
            topNames(3).map(function (n) {
                return n + " " + formatRange(STANDARDS[n].rangeM);
            }).join(" · ") + '</div>';
    }

    html += '<div class="map-note">Theoretical maximum range — real coverage depends on terrain, buildings and antenna height.</div>';

    info.innerHTML = html;
}

function resetMapLocation() {

    if (!mapMarker) {
        return;
    }

    mapMarker.setLatLng(MAP_HOME);
    updateMapCircle();
}


/* =========================================================
   CALCULATORS  (driven by the recommended standard)
========================================================= */

function setCalcStandard(name) {

    var std = STANDARDS[name];

    if (!std) {
        return;
    }

    calcStd = name;

    byId("fsplDist").value = std.rangeM;
    byId("fsplFreq").value = typicalFreq(std);

    resetBatteryToTypical();

    renderCalcSelectors();
    renderCalcQuickButtons();

    calculateFSPL();
    calculateBattery();
}

function renderCalcSelectors() {

    var box = byId("calcSelectors");

    if (!box || !lastRanking) {
        return;
    }

    var html = '<span class="chip-label mono">Calculate for:</span>';

    lastRanking.slice(0, 3).forEach(function (item) {
        var active = item.name === calcStd;
        html += '<button type="button" class="compare-chip' + (active ? ' active' : '') +
            '" onclick="setCalcStandard(\'' + item.name + '\')">' +
            '#' + item.rank + ' ' + item.name + (item.rank === 1 ? ' ★' : '') + '</button>';
    });

    box.innerHTML = html;
}

function renderCalcQuickButtons() {

    var std = STANDARDS[calcStd];

    if (!std) {
        return;
    }

    var fsplQuick = byId("fsplQuick");

    if (fsplQuick) {

        var html = '<span class="chip-label mono">Typical bands:</span>';

        std.freqOptions.forEach(function (opt) {
            html += '<button type="button" class="compare-chip small-chip" onclick="setFsplFreq(' + opt.mhz + ')">' +
                opt.label + '</button>';
        });

        html += '<span class="chip-label mono">Distance:</span>';
        html += '<button type="button" class="compare-chip small-chip" onclick="setFsplDistance(' + std.rangeM + ')">Max range (' + formatRange(std.rangeM) + ')</button>';
        html += '<button type="button" class="compare-chip small-chip" onclick="setFsplDistance(' + (std.rangeM / 2) + ')">½ range</button>';

        fsplQuick.innerHTML = html;
    }

    var batQuick = byId("batQuick");

    if (batQuick) {
        batQuick.innerHTML =
            '<button type="button" class="compare-chip small-chip" onclick="resetBatteryToTypical(true)">↺ Typical values for ' +
            calcStd + '</button>' +
            '<span class="chip-note">Typical values are approximate — replace them with your module datasheet.</span>';
    }
}

function setFsplFreq(mhz) {
    byId("fsplFreq").value = mhz;
    calculateFSPL();
}

function setFsplDistance(m) {
    byId("fsplDist").value = m;
    calculateFSPL();
}

function resetBatteryToTypical(recalc) {

    var std = STANDARDS[calcStd];

    if (!std) {
        return;
    }

    byId("batTx").value = std.battery.tx;
    byId("batSleep").value = std.battery.sleep;
    byId("batDuty").value = std.battery.duty;

    if (recalc) {
        calculateBattery();
    }
}


/* ---------- FSPL ---------- */

function calculateFSPL() {

    var distance = parseFloat(byId("fsplDist").value);
    var frequency = parseFloat(byId("fsplFreq").value);

    var steps = byId("fsplSteps");
    var result = byId("fsplResult");
    var note = byId("fsplNote");

    if (!(distance > 0) || !(frequency > 0)) {
        steps.textContent = "Enter a distance and a frequency greater than 0.";
        result.textContent = "—";
        note.textContent = "";
        return;
    }

    var t1 = 20 * Math.log10(distance);
    var t2 = 20 * Math.log10(frequency);
    var fspl = t1 + t2 - 27.55;

    steps.textContent =
        "FSPL = 20·log₁₀(d) + 20·log₁₀(f) − 27.55\n" +
        "     = 20·log₁₀(" + fmt(distance, 3) + ") + 20·log₁₀(" + fmt(frequency, 3) + ") − 27.55\n" +
        "     = " + t1.toFixed(2) + " + " + t2.toFixed(2) + " − 27.55\n" +
        "     = " + fspl.toFixed(2) + " dB";

    result.textContent = fspl.toFixed(1) + " dB";

    var std = STANDARDS[calcStd];
    var text = calcStd + " @ " + fmt(frequency, 3) + " MHz, " + formatRange(distance) + ". ";

    if (std) {
        if (distance <= std.rangeM) {
            text += "Within its typical max range (" + formatRange(std.rangeM) + "). ";
        } else {
            text += "Beyond its typical max range (" + formatRange(std.rangeM) + ") — expect a weak link. ";
        }
    }

    text += "Each doubling of distance adds ≈ 6 dB.";
    note.textContent = text;

    renderFsplChart(distance, frequency, fspl);
}

function renderFsplChart(distance, frequency, fspl) {

    var canvas = byId("fsplChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    fsplChartObj = destroyChart(fsplChartObj);

    var std = STANDARDS[calcStd];
    var maxD = Math.max(std.rangeM, distance) * 1.5;
    var steps = 60;
    var logMax = Math.log10(maxD);

    var curve = [];

    for (var i = 0; i <= steps; i++) {
        var d = Math.pow(10, (logMax * i) / steps);
        curve.push({ x: d, y: fsplDb(d, frequency) });
    }

    var datasets = [
        {
            label: calcStd + " @ " + fmt(frequency, 0) + " MHz",
            data: curve,
            showLine: true,
            borderColor: "#2563eb",
            backgroundColor: "#2563eb",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0
        },
        {
            label: "Selected distance",
            data: [{ x: distance, y: fspl }],
            pointStyle: "crossRot",
            pointRadius: 10,
            borderColor: "#dc2626",
            backgroundColor: "#dc2626",
            borderWidth: 3
        }
    ];

    /* max-range point of each top-3 standard (at its own typical frequency) */
    lastRanking.slice(0, 3).forEach(function (item) {
        var s = STANDARDS[item.name];
        var f = typicalFreq(s);
        datasets.push({
            label: "#" + item.rank + " " + item.name + " max range",
            data: [{ x: s.rangeM, y: fsplDb(s.rangeM, f) }],
            pointRadius: 7,
            borderColor: "#ffffff",
            borderWidth: 2,
            backgroundColor: [COLOR_REC, COLOR_TOP, "#f59e0b"][item.rank - 1]
        });
    });

    fsplChartObj = new Chart(canvas, {
        type: "scatter",
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: "logarithmic",
                    min: 1,
                    ticks: { callback: logTicks(formatRange), maxRotation: 0 },
                    title: { display: true, text: "Distance (log scale)" }
                },
                y: {
                    title: { display: true, text: "Path loss (dB)" }
                }
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            return c.dataset.label + ": " + formatRange(Math.round(c.parsed.x * 10) / 10) +
                                " → " + c.parsed.y.toFixed(1) + " dB";
                        }
                    }
                }
            }
        }
    });
}


/* ---------- Battery ---------- */

function readNumber(id, fallback) {
    var v = parseFloat(byId(id).value);
    return isNaN(v) ? fallback : v;
}

function calculateBattery() {

    var capacity = readNumber("batCap", NaN);
    var txCurrent = readNumber("batTx", NaN);
    var sleepCurrent = readNumber("batSleep", NaN);
    var dutyPct = readNumber("batDuty", NaN);

    var steps = byId("batSteps");
    var result = byId("batResult");
    var note = byId("batNote");

    var valid =
        capacity > 0 &&
        txCurrent >= 0 &&
        sleepCurrent >= 0 &&
        dutyPct >= 0 && dutyPct <= 100;

    if (!valid) {
        steps.textContent = "Check inputs: capacity > 0, currents ≥ 0, duty cycle between 0 and 100 %.";
        result.textContent = "—";
        note.textContent = "";
        renderCalcCompare();
        return;
    }

    var calc = batteryCalc(capacity, txCurrent, sleepCurrent, dutyPct);
    var days = calc.hours / 24;

    steps.textContent =
        "Duty  D = " + fmt(dutyPct, 4) + " % = " + fmt(calc.duty, 6) + "\n" +
        "I_avg = I_tx·D + I_sleep·(1 − D)\n" +
        "      = " + fmt(txCurrent, 4) + "·" + fmt(calc.duty, 6) + " + " + fmt(sleepCurrent, 4) + "·(1 − " + fmt(calc.duty, 6) + ")\n" +
        "      = " + fmt(txCurrent * calc.duty, 4) + " + " + fmt(sleepCurrent * (1 - calc.duty), 4) + " = " + fmt(calc.avg, 4) + " mA\n" +
        "Life  = C / I_avg = " + fmt(capacity, 2) + " / " + fmt(calc.avg, 4) + "\n" +
        "      = " + (isFinite(calc.hours) ? fmt(calc.hours, 0) + " h = " + fmt(days, 1) + " days" : "∞");

    result.textContent = formatLife(calc.hours);
    note.textContent = "Uses " + calcStd + " typical currents unless you edited them. Higher duty cycle → shorter life.";

    renderBatteryChart(capacity, txCurrent, sleepCurrent, dutyPct);
    renderCalcCompare();
}

function renderBatteryChart(capacity, tx, sleep, dutyPct) {

    var canvas = byId("batteryChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    batteryChartObj = destroyChart(batteryChartObj);

    var curve = [];
    var steps = 50;

    /* duty cycle from 0.01 % to 100 %, log-spaced */
    for (var i = 0; i <= steps; i++) {
        var duty = Math.pow(10, -2 + (4 * i) / steps);
        var hours = batteryCalc(capacity, tx, sleep, duty).hours;
        if (isFinite(hours)) {
            curve.push({ x: duty, y: hours / (24 * 365.25) });
        }
    }

    var datasets = [{
        label: calcStd + " (" + fmt(capacity, 0) + " mAh)",
        data: curve,
        showLine: true,
        borderColor: "#16a34a",
        backgroundColor: "#16a34a",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
    }];

    if (dutyPct > 0) {
        var life = batteryCalc(capacity, tx, sleep, dutyPct).hours;
        if (isFinite(life)) {
            datasets.push({
                label: "Your duty cycle",
                data: [{ x: dutyPct, y: life / (24 * 365.25) }],
                pointStyle: "crossRot",
                pointRadius: 10,
                borderColor: "#dc2626",
                backgroundColor: "#dc2626",
                borderWidth: 3
            });
        }
    }

    batteryChartObj = new Chart(canvas, {
        type: "scatter",
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: "logarithmic",
                    min: 0.01,
                    max: 100,
                    ticks: {
                        callback: logTicks(function (v) { return fmt(v, 3) + "%"; }),
                        maxRotation: 0
                    },
                    title: { display: true, text: "TX duty cycle (log scale)" }
                },
                y: {
                    type: "logarithmic",
                    ticks: { callback: logTicks(function (v) { return fmt(v, 3) + " y"; }) },
                    title: { display: true, text: "Battery life in years (log scale)" }
                }
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            return "duty " + fmt(c.parsed.x, 3) + " % → " + fmt(c.parsed.y, 2) + " years";
                        }
                    }
                }
            }
        }
    });
}


/* ---------- Top-3 calculator comparison ---------- */

function renderCalcCompare() {

    var body = byId("calcCompareBody");

    if (!body || !lastRanking) {
        return;
    }

    var capacity = readNumber("batCap", 2400);

    if (!(capacity > 0)) {
        capacity = 2400;
    }

    var html = "";

    lastRanking.slice(0, 3).forEach(function (item) {

        var std = STANDARDS[item.name];
        var f = typicalFreq(std);
        var loss = fsplDb(std.rangeM, f);
        var bat = batteryCalc(capacity, std.battery.tx, std.battery.sleep, std.battery.duty);

        html += '<tr' + (item.rank === 1 ? ' class="row-top"' : '') + '>';
        html += '<td class="std-name">#' + item.rank + ' ' + item.name + (item.rank === 1 ? ' ★' : '') + '</td>';
        html += '<td class="mono">' + item.pct + '%</td>';
        html += '<td class="mono">' + formatRange(std.rangeM) + '</td>';
        html += '<td class="mono">' + fmt(f, 0) + ' MHz</td>';
        html += '<td class="mono">' + loss.toFixed(1) + ' dB</td>';
        html += '<td class="mono">' + fmt(bat.avg, 4) + ' mA</td>';
        html += '<td class="mono">' + formatLife(bat.hours) + '</td>';
        html += '</tr>';
    });

    body.innerHTML = html;

    var cap = byId("calcCompareCap");

    if (cap) {
        cap.textContent = fmt(capacity, 0) + " mAh";
    }
}


/* =========================================================
   RADAR  (defaults to the top 3 of the ranking)
========================================================= */

function initRadarSelectors() {

    var container = byId("radarSelectors");

    if (!container) {
        return;
    }

    var order = lastRanking ? lastRanking.map(function (i) { return i.name; }) : Object.keys(STANDARDS);

    var html = "";

    order.forEach(function (name) {

        var active = activeRadarStds.indexOf(name) !== -1;
        var item = getRankItem(name);
        var label = (item ? "#" + item.rank + " " : "") + name;

        html += '<button type="button" class="compare-chip' + (active ? ' active' : '') +
            '" onclick="toggleRadarStd(\'' + name + '\')">' + label + (active ? " ✓" : "") + '</button>';
    });

    html += '<button type="button" class="compare-chip reset-chip" onclick="resetRadarToTop3()">↺ Top 3</button>';

    container.innerHTML = html;

    updateRadarSelectionInfo();
}

function resetRadarToTop3() {

    activeRadarStds = topNames(3);

    initRadarSelectors();
    renderMultiRadar();
    renderTradeoffSummary();
}

function updateRadarSelectionInfo() {

    var container = byId("radarSelectors");

    if (!container) {
        return;
    }

    var info = byId("radarSelectionInfo");

    if (!info) {
        info = document.createElement("div");
        info.id = "radarSelectionInfo";
        info.className = "radar-info";
        container.parentNode.insertBefore(info, container.nextSibling);
    }

    info.innerHTML =
        "<strong>Selected:</strong> " + activeRadarStds.join(" • ") +
        "<br><span>" + activeRadarStds.length + "/3 standards selected</span>";
}

function toggleRadarStd(name) {

    var index = activeRadarStds.indexOf(name);

    if (index !== -1) {

        if (activeRadarStds.length === 1) {
            showRadarMessage("At least one standard must remain selected.");
            return;
        }

        activeRadarStds.splice(index, 1);

    } else {

        if (activeRadarStds.length >= 3) {
            showRadarMessage("You can compare a maximum of 3 standards at a time.");
            return;
        }

        activeRadarStds.push(name);
    }

    initRadarSelectors();
    renderMultiRadar();
    renderTradeoffSummary();
}

function showRadarMessage(message) {

    var container = byId("radarSelectors");

    if (!container) {
        return;
    }

    var box = byId("radarMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "radarMessage";
        box.className = "radar-message";
        container.parentNode.insertBefore(box, container.nextSibling);
    }

    box.textContent = message;

    clearTimeout(box._timer);

    box._timer = setTimeout(function () {
        box.textContent = "";
    }, 2500);
}

function sortByRank(names) {

    return names.slice().sort(function (a, b) {
        var ra = getRankItem(a);
        var rb = getRankItem(b);
        return (ra ? ra.rank : 99) - (rb ? rb.rank : 99);
    });
}

function renderMultiRadar() {

    var canvas = byId("multiRadarChart");

    if (!canvas) {
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    multiRadarChartObj = destroyChart(multiRadarChartObj);

    var borderColors = ["#16a34a", "#2563eb", "#dc2626"];
    var backgroundColors = [
        "rgba(22, 163, 74, 0.15)",
        "rgba(37, 99, 235, 0.15)",
        "rgba(220, 38, 38, 0.15)"
    ];

    var ordered = sortByRank(activeRadarStds);

    var datasets = ordered.map(function (name, index) {

        var score = STANDARDS[name].scores;
        var item = getRankItem(name);

        return {
            label: (item ? "#" + item.rank + " " : "") + name,
            data: [score.range, score.dataRate, score.power, score.budget, score.latency],
            borderColor: borderColors[index],
            backgroundColor: backgroundColors[index],
            borderWidth: item && item.rank === 1 ? 3 : 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
        };
    });

    multiRadarChartObj = new Chart(canvas.getContext("2d"), {
        type: "radar",
        data: {
            labels: ["Range", "Data Rate", "Power Efficiency", "Low Cost", "Low Latency"],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "top" },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ": " + context.raw + "/10";
                        }
                    }
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 10,
                    beginAtZero: true,
                    ticks: { stepSize: 2 },
                    pointLabels: { font: { size: 12 } }
                }
            }
        }
    });
}

function attributeList(scores) {
    return [
        { name: "Range", value: scores.range },
        { name: "Data Rate", value: scores.dataRate },
        { name: "Power Efficiency", value: scores.power },
        { name: "Low Cost", value: scores.budget },
        { name: "Low Latency", value: scores.latency }
    ];
}

function getStrongestAttributes(scores) {

    var attributes = attributeList(scores).sort(function (a, b) {
        return b.value - a.value;
    });

    var highest = attributes[0].value;

    return attributes
        .filter(function (item) { return item.value === highest; })
        .slice(0, 2)
        .map(function (item) { return item.name; });
}

function getWeakestAttributes(scores) {

    var attributes = attributeList(scores).sort(function (a, b) {
        return a.value - b.value;
    });

    var lowest = attributes[0].value;

    return attributes
        .filter(function (item) { return item.value === lowest; })
        .slice(0, 2)
        .map(function (item) { return item.name; });
}

function renderTradeoffSummary() {

    var radarSection = byId("radarSection");

    if (!radarSection) {
        return;
    }

    var summary = byId("radarTradeoffSummary");

    if (!summary) {

        summary = document.createElement("div");
        summary.id = "radarTradeoffSummary";
        summary.className = "panel tradeoff-panel";

        var chartPanel = radarSection.querySelector(".chart-panel");

        if (chartPanel) {
            chartPanel.insertAdjacentElement("afterend", summary);
        } else {
            radarSection.appendChild(summary);
        }
    }

    var html = "";

    html += '<div class="mono small">TRADE-OFF SUMMARY</div>';
    html += '<h3>Selected Standards Comparison</h3>';
    html += '<div class="tradeoff-grid">';

    sortByRank(activeRadarStds).forEach(function (name) {

        var standard = STANDARDS[name];
        var scores = standard.scores;
        var item = getRankItem(name);
        var isTop = item && item.rank === 1;

        html += '<div class="tradeoff-card' + (isTop ? ' is-top' : '') + '">';

        html += '<h4>' + (item ? '#' + item.rank + ' ' : '') + name;
        if (isTop) {
            html += ' <span class="badge badge-rec">★ Recommended</span>';
        }
        html += '</h4>';

        if (item) {
            var missed = item.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.label; });
            html += '<div class="tradeoff-match">' + item.pct + '% match · ' + item.met + '/' + item.total + ' requirements met' +
                (missed.length ? ' <span class="miss-note">(misses: ' + missed.join(', ') + ')</span>' : '') + '</div>';
        }

        html += '<div class="tradeoff-body">';
        html += '<strong>Strong in:</strong> ' + getStrongestAttributes(scores).join(", ") + '<br>';
        html += '<strong>Trade-off:</strong> ' + getWeakestAttributes(scores).join(", ") + '<br>';
        html += '<strong>Range:</strong> ' + formatRange(standard.rangeM) +
            ' &nbsp;|&nbsp; <strong>Data Rate:</strong> ' + formatDataRate(standard.rateKbps) + '<br>';
        html += '<strong>Latency:</strong> ' + standard.latencyMs + ' ms' +
            ' &nbsp;|&nbsp; <strong>Cost:</strong> ' + standard.cost;
        html += '</div>';

        html += '</div>';
    });

    html += '</div>';

    summary.innerHTML = html;
}


/* =========================================================
   TABLE  (sorted by recommendation rank)
========================================================= */

function rankedEntries() {

    var names = lastRanking ?
        lastRanking.map(function (i) { return i.name; }) :
        Object.keys(STANDARDS);

    return names.map(function (name) {
        return [name, STANDARDS[name]];
    });
}

function renderTable() {

    var tableBody = byId("tableBody");

    if (!tableBody) {
        return;
    }

    var searchInput = byId("filterSearch");
    var query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    var html = "";

    rankedEntries()
        .filter(function (entry) {
            return entry[0].toLowerCase().indexOf(query) !== -1;
        })
        .forEach(function (entry) {

            var name = entry[0];
            var data = entry[1];
            var item = getRankItem(name);
            var rank = item ? item.rank : null;

            var rowClass = "";

            if (rank === 1) {
                rowClass = "row-top";
            } else if (rank && rank <= 3) {
                rowClass = "row-top3";
            }

            var powerText = "●".repeat(data.power) + "○".repeat(10 - data.power);

            html += '<tr class="' + rowClass + '">';

            html += '<td class="mono rank-cell">' + (rank ? '#' + rank : '—') + '</td>';

            html += '<td class="std-name">' + name +
                (rank === 1 ? ' <span class="badge badge-rec">★ Recommended</span>' : '') + '</td>';

            html += '<td class="mono match-cell">' + (item ? item.pct + '%' : '—') + '</td>';
            html += '<td class="mono">' + (item ? item.met + '/' + item.total : '—') + '</td>';
            html += '<td class="mono">' + data.freq + '</td>';
            html += '<td class="mono">' + formatRange(data.rangeM) + '</td>';
            html += '<td class="mono">' + formatDataRate(data.rateKbps) + '</td>';
            html += '<td class="mono">' + powerText + '</td>';
            html += '<td class="mono">' + data.latencyMs + ' ms</td>';
            html += '<td class="mono">' + data.cost + '</td>';

            html += '</tr>';
        });

    if (html === "") {
        html = '<tr><td colspan="10" class="empty-row">No standard matches your search.</td></tr>';
    }

    tableBody.innerHTML = html;
}

function exportTableCSV() {

    var csv = "Rank,Standard,Match %,Requirements Met,Frequency,Max Range,Data Rate,Power,Latency,Cost\n";

    rankedEntries().forEach(function (entry) {

        var name = entry[0];
        var data = entry[1];
        var item = getRankItem(name);

        csv +=
            (item ? item.rank : "") + "," +
            '"' + name + '",' +
            (item ? item.pct : "") + "," +
            (item ? item.met + "/" + item.total : "") + "," +
            '"' + data.freq + '",' +
            '"' + data.rangeM + ' m",' +
            '"' + data.rateKbps + ' kbps",' +
            data.power + "," +
            data.latencyMs + "," +
            '"' + data.cost + '"\n';
    });

    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "SpectraSelect_Standards_Matrix.csv";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}


/* =========================================================
   ANALYTICS CHARTS  (recommended = green, rest of top 3 = blue)
========================================================= */

function renderAnalyticsCharts() {

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    var ranked = lastRanking ? lastRanking : Object.keys(STANDARDS).map(function (n, i) {
        return { name: n, pct: 0, rank: i + 1 };
    });

    var names = ranked.map(function (i) { return i.name; });
    var colors = ranked.map(function (i) { return rankColor(i.rank); });

    matchChartObj = destroyChart(matchChartObj);
    rangeChartObj = destroyChart(rangeChartObj);
    scatterChartObj = destroyChart(scatterChartObj);

    /* ---- 1. weighted match score ---- */
    var matchCanvas = byId("matchChart");

    if (matchCanvas) {

        matchChartObj = new Chart(matchCanvas, {
            type: "bar",
            plugins: [valueLabelPlugin],
            data: {
                labels: names,
                datasets: [{
                    label: "Match (%)",
                    data: ranked.map(function (i) { return i.pct; }),
                    backgroundColor: colors,
                    labelTexts: ranked.map(function (i) { return i.pct + "%"; })
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 22 } },
                scales: {
                    y: { min: 0, max: 100, title: { display: true, text: "Weighted match (%)" } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    /* ---- 2. max range (log) ---- */
    var rangeCanvas = byId("rangeChart");

    if (rangeCanvas) {

        rangeChartObj = new Chart(rangeCanvas, {
            type: "bar",
            plugins: [valueLabelPlugin],
            data: {
                labels: names,
                datasets: [{
                    label: "Range (m)",
                    data: names.map(function (n) { return STANDARDS[n].rangeM; }),
                    backgroundColor: colors,
                    labelTexts: names.map(function (n) { return formatRange(STANDARDS[n].rangeM); })
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 22 } },
                scales: {
                    y: {
                        type: "logarithmic",
                        min: 10,
                        max: 100000,
                        ticks: { callback: logTicks(formatRange) },
                        title: { display: true, text: "Max range (log scale)" }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (c) { return "Range: " + formatRange(c.raw); }
                        }
                    }
                }
            }
        });
    }

    /* ---- 3. data rate vs range ---- */
    var scatterCanvas = byId("scatterChart");

    if (scatterCanvas) {

        scatterChartObj = new Chart(scatterCanvas, {
            type: "scatter",
            plugins: [valueLabelPlugin],
            data: {
                datasets: ranked.map(function (item) {

                    var std = STANDARDS[item.name];

                    return {
                        label: "#" + item.rank + " " + item.name,
                        data: [{ x: std.rangeM, y: std.rateKbps }],
                        backgroundColor: rankColor(item.rank),
                        borderColor: item.rank <= 3 ? "#0f172a" : "#94a3b8",
                        borderWidth: item.rank === 1 ? 2 : 1,
                        pointRadius: item.rank === 1 ? 12 : (item.rank <= 3 ? 9 : 6),
                        labelTexts: [(item.rank === 1 ? "★ " : "") + item.name + " · " + formatRange(std.rangeM)]
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 110, top: 10 } },
                scales: {
                    x: {
                        type: "logarithmic",
                        min: 10,
                        max: 100000,
                        ticks: { callback: logTicks(formatRange), maxRotation: 0 },
                        title: { display: true, text: "Range (log scale)" }
                    },
                    y: {
                        type: "logarithmic",
                        ticks: { callback: logTicks(formatDataRate) },
                        title: { display: true, text: "Data Rate (log scale)" }
                    }
                },
                plugins: {
                    legend: { display: false },
                    valueLabels: { side: "right" },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                return c.dataset.label + ": " + formatRange(c.parsed.x) +
                                    ", " + formatDataRate(c.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    var loginPass = byId("loginPass");

    if (loginPass) {
        loginPass.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                handleLogin();
            }
        });
    }

    /* any change to the requirement inputs / weight sliders recomputes everything */
    document.querySelectorAll("#tool select, #tool input[type=range]").forEach(function (el) {
        el.addEventListener("input", function () {
            updateWeights();
            scheduleRecompute();
        });
    });
}


/* =========================================================
   INITIALIZE APP
========================================================= */

function checkLibraries() {

    var warn = byId("libWarning");
    var missing = [];

    if (typeof Chart === "undefined") {
        missing.push("Chart.js (graphs)");
    }

    if (typeof L === "undefined") {
        missing.push("Leaflet (map)");
    }

    if (warn) {
        if (missing.length) {
            warn.textContent = "⚠ Could not load: " + missing.join(", ") +
                ". Make sure the 'vendor' folder is next to index.html and open the site through Live Server.";
            warn.style.display = "block";
        } else {
            warn.style.display = "none";
        }
    }
}

function initApp() {

    checkLibraries();

    initMap();

    updateWeights();

    runRecommendation();
}

document.addEventListener("DOMContentLoaded", setupEventListeners);
