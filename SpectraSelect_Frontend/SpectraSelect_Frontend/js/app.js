const STANDARDS = {
    "Wi-Fi": {
        freq: "2.4 / 5 GHz",
        rangeM: 100,
        rateKbps: 1000000,
        power: 8,
        latencyMs: 20,
        cost: "Low",
        scores: {
            range: 4,
            dataRate: 9,
            power: 3,
            budget: 8,
            latency: 8
        },
        desc: "High-throughput local networking for substantial data transfer, especially where accessible power is available."
    },

    "Bluetooth": {
        freq: "2.4 GHz",
        rangeM: 30,
        rateKbps: 2000,
        power: 3,
        latencyMs: 15,
        cost: "Low",
        scores: {
            range: 2,
            dataRate: 6,
            power: 8,
            budget: 9,
            latency: 8
        },
        desc: "Short-range personal-area networking for wearables, peripherals, and direct smartphone-sensor links."
    },

    "ZigBee": {
        freq: "2.4 GHz",
        rangeM: 100,
        rateKbps: 250,
        power: 2,
        latencyMs: 30,
        cost: "Low",
        scores: {
            range: 4,
            dataRate: 3,
            power: 9,
            budget: 8,
            latency: 6
        },
        desc: "Low-power mesh networking for smart-home, building automation, and sensor networks."
    },

    "LoRaWAN": {
        freq: "868 / 915 MHz",
        rangeM: 10000,
        rateKbps: 27,
        power: 1,
        latencyMs: 1500,
        cost: "Low",
        scores: {
            range: 10,
            dataRate: 1,
            power: 10,
            budget: 9,
            latency: 2
        },
        desc: "Ultra-long-range, low-power sub-GHz technology for agriculture, environmental sensing, and smart-city deployments."
    },

    "NB-IoT": {
        freq: "Licensed Cellular",
        rangeM: 8000,
        rateKbps: 250,
        power: 2,
        latencyMs: 1000,
        cost: "Medium",
        scores: {
            range: 9,
            dataRate: 3,
            power: 9,
            budget: 6,
            latency: 3
        },
        desc: "Low-power wide-area cellular technology for connected sensors, utility metering, and logistics."
    },

    "LTE": {
        freq: "Licensed Cellular",
        rangeM: 5000,
        rateKbps: 150000,
        power: 6,
        latencyMs: 40,
        cost: "Medium",
        scores: {
            range: 7,
            dataRate: 8,
            power: 4,
            budget: 5,
            latency: 7
        },
        desc: "Mobile broadband with wide coverage and high mobility for field and vehicular systems."
    },

    "5G": {
        freq: "Sub-6GHz / mmWave",
        rangeM: 3000,
        rateKbps: 10000000,
        power: 8,
        latencyMs: 4,
        cost: "High",
        scores: {
            range: 6,
            dataRate: 10,
            power: 2,
            budget: 3,
            latency: 10
        },
        desc: "Next-generation cellular technology supporting high throughput and low latency."
    }
};


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

var currentUser = null;
var mapObj = null;
var mapMarker = null;
var mapCircle = null;

var multiRadarChartObj = null;
var rangeChartObj = null;
var scatterChartObj = null;

var activeRadarStds = ["Wi-Fi", "LoRaWAN", "5G"];


/* =========================================================
   LOGIN
========================================================= */

function handleLogin() {

    var userInput = document.getElementById("loginUser");
    var passInput = document.getElementById("loginPass");

    var username = "";
    var password = "";

    if (userInput) {
        username = userInput.value.trim();
    }

    if (passInput) {
        password = passInput.value.trim();
    }

    var loginErr = document.getElementById("loginErr");

    if (username !== "" && password === "1234") {

        currentUser = username;

        var overlay = document.getElementById("loginOverlay");
        var badge = document.getElementById("userBadge");
        var logoutBtn = document.getElementById("logoutBtn");

        if (overlay) {
            overlay.style.display = "none";
        }

        if (badge) {
            badge.textContent = "👤 " + username;
        }

        if (logoutBtn) {
            logoutBtn.style.display = "inline";
        }

        if (loginErr) {
            loginErr.style.display = "none";
        }

        initApp();

    } else {

        if (loginErr) {
            loginErr.style.display = "block";
        }
    }
}


function handleLogout() {

    currentUser = null;

    var overlay = document.getElementById("loginOverlay");
    var badge = document.getElementById("userBadge");
    var logoutBtn = document.getElementById("logoutBtn");

    if (overlay) {
        overlay.style.display = "flex";
    }

    if (badge) {
        badge.textContent = "🔒 Guest";
    }

    if (logoutBtn) {
        logoutBtn.style.display = "none";
    }
}


/* =========================================================
   WEIGHTS
========================================================= */

function updateWeights() {

    var ids = [
        "range",
        "dataRate",
        "power",
        "budget",
        "latency"
    ];

    var total = 0;

    ids.forEach(function(id) {

        var slider = document.getElementById("w_" + id);

        if (!slider) {
            return;
        }

        var value = Number(slider.value);
        total += value;

        var display =
            document.getElementById("w_" + id + "_val");

        if (display) {
            display.textContent = value + "%";
        }
    });

    var totalDisplay =
        document.getElementById("weightTotalDisplay");

    if (totalDisplay) {

        totalDisplay.textContent =
            "Total: " + total + "%";

        if (total === 100) {
            totalDisplay.style.color = "var(--green)";
        } else {
            totalDisplay.style.color = "var(--primary)";
        }
    }
}


/* =========================================================
   RECOMMENDATION ENGINE
========================================================= */

function runRecommendation() {

    var rangeInput = document.getElementById("w_range");
    var dataRateInput = document.getElementById("w_dataRate");
    var powerInput = document.getElementById("w_power");
    var budgetInput = document.getElementById("w_budget");
    var latencyInput = document.getElementById("w_latency");

    var rangeWeight = rangeInput ?
        Number(rangeInput.value) / 100 : 0;

    var dataRateWeight = dataRateInput ?
        Number(dataRateInput.value) / 100 : 0;

    var powerWeight = powerInput ?
        Number(powerInput.value) / 100 : 0;

    var budgetWeight = budgetInput ?
        Number(budgetInput.value) / 100 : 0;

    var latencyWeight = latencyInput ?
        Number(latencyInput.value) / 100 : 0;


    var results = Object.keys(STANDARDS).map(function(name) {

        var s = STANDARDS[name].scores;

        var score =
            s.range * rangeWeight +
            s.dataRate * dataRateWeight +
            s.power * powerWeight +
            s.budget * budgetWeight +
            s.latency * latencyWeight;

        return {
            name: name,
            score: score,
            pct: Math.round(score * 10)
        };

    });


    results.sort(function(a, b) {
        return b.score - a.score;
    });


    if (results.length === 0) {
        return;
    }


    var top = results[0];
    var data = STANDARDS[top.name];
    var alternatives = results.slice(1, 4);

    var resultPanel =
        document.getElementById("resultPanel");

    if (!resultPanel) {
        return;
    }


    var html = "";

    html += '<div class="result-head">';
    html += '<div>';

    html += '<div class="mono small">';
    html += 'Top Recommended Standard';
    html += '</div>';

    html += '<h3>';
    html += top.name;
    html += '</h3>';

    html += '<div class="mono small">';
    html += data.freq;
    html += '</div>';

    html += '</div>';

    html += '<div class="match-score">';
    html += top.pct + "%";

    html += '<span>';
    html += 'Weighted Match';
    html += '</span>';

    html += '</div>';
    html += '</div>';

    html += '<p class="explain">';
    html += data.desc;
    html += '</p>';

    html += '<div class="alt-list">';

    html += '<div class="mono small">';
    html += 'Alternative Options';
    html += '</div>';

    alternatives.forEach(function(item) {

        html += '<div class="alt-item">';

        html += '<span class="name">';
        html += item.name;
        html += '</span>';

        html += '<span class="bar-track">';

        html += '<span class="bar-fill" ';
        html += 'style="display:block;width:';
        html += item.pct;
        html += '%">';
        html += '</span>';

        html += '</span>';

        html += '<span class="pct">';
        html += item.pct + "%";
        html += '</span>';

        html += '</div>';
    });

    html += '</div>';

    resultPanel.innerHTML = html;
}


/* =========================================================
   MAP
========================================================= */

function initMap() {

    if (mapObj) {
        return;
    }

    var mapElement =
        document.getElementById("map");

    if (!mapElement) {
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet is not loaded.");
        return;
    }

    var position = [24.3636, 88.6284];

    mapObj =
        L.map("map").setView(position, 12);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 18,
            attribution: "© OpenStreetMap"
        }
    ).addTo(mapObj);

    mapMarker =
        L.marker(
            position,
            {
                draggable: true
            }
        )
        .addTo(mapObj)
        .bindPopup(
            "<b>Wireless Gateway</b><br>Drag to relocate."
        )
        .openPopup();

    mapMarker.on(
        "dragend",
        updateMapCircle
    );

    updateMapCircle();
}


function updateMapCircle() {

    if (!mapObj || !mapMarker) {
        return;
    }

    var select =
        document.getElementById("mapStdSelect");

    if (!select) {
        return;
    }

    var standard =
        STANDARDS[select.value];

    if (!standard) {
        return;
    }

    var radius =
        standard.rangeM;

    if (mapCircle) {
        mapObj.removeLayer(mapCircle);
    }

    mapCircle =
        L.circle(
            mapMarker.getLatLng(),
            {
                radius: radius,
                color: "#1e3a8a",
                fillColor: "#2563eb",
                fillOpacity: 0.2
            }
        ).addTo(mapObj);

    mapObj.fitBounds(
        mapCircle.getBounds(),
        {
            padding: [20, 20]
        }
    );
}


function resetMapLocation() {

    if (!mapMarker) {
        return;
    }

    mapMarker.setLatLng(
        [24.3636, 88.6284]
    );

    updateMapCircle();
}


/* =========================================================
   FSPL CALCULATOR
========================================================= */

function calculateFSPL() {

    var distanceInput =
        document.getElementById("fsplDist");

    var frequencyInput =
        document.getElementById("fsplFreq");

    var result =
        document.getElementById("fsplResult");

    if (!distanceInput ||
        !frequencyInput ||
        !result) {

        return;
    }

    var distance =
        Math.max(
            Number(distanceInput.value) || 1,
            0.001
        );

    var frequency =
        Math.max(
            Number(frequencyInput.value) || 1,
            0.001
        );

    var fspl =
        20 * Math.log10(distance) +
        20 * Math.log10(frequency) -
        27.55;

    result.textContent =
        fspl.toFixed(1) + " dB";
}


/* =========================================================
   BATTERY CALCULATOR
========================================================= */

function calculateBattery() {

    var capInput =
        document.getElementById("batCap");

    var txInput =
        document.getElementById("batTx");

    var sleepInput =
        document.getElementById("batSleep");

    var dutyInput =
        document.getElementById("batDuty");

    var result =
        document.getElementById("batResult");

    if (!capInput ||
        !txInput ||
        !sleepInput ||
        !dutyInput ||
        !result) {

        return;
    }

    var capacity =
        Number(capInput.value) || 2400;

    var txCurrent =
        Number(txInput.value) || 100;

    var sleepCurrent =
        Number(sleepInput.value) || 0.01;

    var dutyCycle =
        (Number(dutyInput.value) || 0.1) / 100;

    var averageCurrent =
        txCurrent * dutyCycle +
        sleepCurrent * (1 - dutyCycle);

    var hours =
        capacity / averageCurrent;

    var years =
        hours / (24 * 365.25);

    result.textContent =
        years.toFixed(2) +
        " Years (" +
        Math.round(hours) +
        " hrs)";
}


/* =========================================================
   RADAR SELECTORS
========================================================= */

function initRadarSelectors() {

    var container =
        document.getElementById("radarSelectors");

    if (!container) {
        return;
    }

    var html = "";

    Object.keys(STANDARDS).forEach(function(name) {

        var active =
            activeRadarStds.indexOf(name) !== -1;

        html += '<button ';
        html += 'type="button" ';
        html += 'class="compare-chip';

        if (active) {
            html += ' active';
        }

        html += '" ';
        html += 'onclick="toggleRadarStd(\'';
        html += name;
        html += '\')">';

        html += name;

        if (active) {
            html += " ✓";
        }

        html += '</button>';
    });

    container.innerHTML = html;

    updateRadarSelectionInfo();
}


function updateRadarSelectionInfo() {

    var container =
        document.getElementById("radarSelectors");

    if (!container) {
        return;
    }

    var info =
        document.getElementById("radarSelectionInfo");

    if (!info) {

        info =
            document.createElement("div");

        info.id =
            "radarSelectionInfo";

        info.style.marginTop = "12px";
        info.style.fontSize = "13px";
        info.style.opacity = "0.8";

        container.parentNode.insertBefore(
            info,
            container.nextSibling
        );
    }

    info.innerHTML =
        "<strong>Selected:</strong> " +
        activeRadarStds.join(" • ") +
        "<br>" +
        "<span>" +
        activeRadarStds.length +
        "/3 standards selected" +
        "</span>";
}


/* =========================================================
   RADAR TOGGLE
========================================================= */

function toggleRadarStd(name) {

    var index =
        activeRadarStds.indexOf(name);

    if (index !== -1) {

        if (activeRadarStds.length === 1) {

            showRadarMessage(
                "At least one standard must remain selected."
            );

            return;
        }

        activeRadarStds.splice(index, 1);

    } else {

        if (activeRadarStds.length >= 3) {

            showRadarMessage(
                "You can compare a maximum of 3 standards at a time."
            );

            return;
        }

        activeRadarStds.push(name);
    }

    initRadarSelectors();

    renderMultiRadar();

    renderTradeoffSummary();
}


/* =========================================================
   RADAR MESSAGE
========================================================= */

function showRadarMessage(message) {

    var container =
        document.getElementById("radarSelectors");

    if (!container) {
        return;
    }

    var messageBox =
        document.getElementById("radarMessage");

    if (!messageBox) {

        messageBox =
            document.createElement("div");

        messageBox.id =
            "radarMessage";

        messageBox.style.marginTop = "10px";
        messageBox.style.padding = "10px 14px";
        messageBox.style.borderRadius = "8px";
        messageBox.style.fontSize = "13px";

        container.parentNode.insertBefore(
            messageBox,
            container.nextSibling
        );
    }

    messageBox.textContent =
        message;

    clearTimeout(
        messageBox._timer
    );

    messageBox._timer =
        setTimeout(function() {

            messageBox.textContent = "";

        }, 2500);
}


/* =========================================================
   MULTI RADAR CHART
========================================================= */

function renderMultiRadar() {

    var canvas =
        document.getElementById("multiRadarChart");

    if (!canvas) {
        return;
    }

    if (typeof Chart === "undefined") {

        console.error(
            "Chart.js is not loaded."
        );

        return;
    }

    var ctx =
        canvas.getContext("2d");

    if (multiRadarChartObj) {

        multiRadarChartObj.destroy();

        multiRadarChartObj = null;
    }

    var borderColors = [
        "#2563eb",
        "#16a34a",
        "#dc2626"
    ];

    var backgroundColors = [
        "rgba(37, 99, 235, 0.15)",
        "rgba(22, 163, 74, 0.15)",
        "rgba(220, 38, 38, 0.15)"
    ];

    var datasets =
        activeRadarStds.map(
            function(name, index) {

                var score =
                    STANDARDS[name].scores;

                return {
                    label: name,

                    data: [
                        score.range,
                        score.dataRate,
                        score.power,
                        score.budget,
                        score.latency
                    ],

                    borderColor:
                        borderColors[index],

                    backgroundColor:
                        backgroundColors[index],

                    borderWidth: 2,

                    pointRadius: 4,

                    pointHoverRadius: 6,

                    fill: true
                };
            }
        );


    multiRadarChartObj =
        new Chart(
            ctx,
            {
                type: "radar",

                data: {

                    labels: [
                        "Range",
                        "Data Rate",
                        "Power Efficiency",
                        "Low Cost",
                        "Low Latency"
                    ],

                    datasets: datasets
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display: true,
                            position: "top"
                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function(context) {

                                        return (
                                            context.dataset.label +
                                            ": " +
                                            context.raw +
                                            "/10"
                                        );
                                    }
                            }
                        }
                    },

                    scales: {

                        r: {

                            min: 0,

                            max: 10,

                            beginAtZero: true,

                            ticks: {
                                stepSize: 2
                            },

                            pointLabels: {

                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            }
        );
}


/* =========================================================
   RADAR TRADE-OFF SUMMARY
========================================================= */

function getStrongestAttributes(scores) {

    var attributes = [
        {
            name: "Range",
            value: scores.range
        },
        {
            name: "Data Rate",
            value: scores.dataRate
        },
        {
            name: "Power Efficiency",
            value: scores.power
        },
        {
            name: "Low Cost",
            value: scores.budget
        },
        {
            name: "Low Latency",
            value: scores.latency
        }
    ];

    attributes.sort(function(a, b) {
        return b.value - a.value;
    });

    var highest = attributes[0].value;

    return attributes
        .filter(function(item) {
            return item.value === highest;
        })
        .slice(0, 2)
        .map(function(item) {
            return item.name;
        });
}


function getWeakestAttributes(scores) {

    var attributes = [
        {
            name: "Range",
            value: scores.range
        },
        {
            name: "Data Rate",
            value: scores.dataRate
        },
        {
            name: "Power Efficiency",
            value: scores.power
        },
        {
            name: "Low Cost",
            value: scores.budget
        },
        {
            name: "Low Latency",
            value: scores.latency
        }
    ];

    attributes.sort(function(a, b) {
        return a.value - b.value;
    });

    var lowest = attributes[0].value;

    return attributes
        .filter(function(item) {
            return item.value === lowest;
        })
        .slice(0, 2)
        .map(function(item) {
            return item.name;
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


function renderTradeoffSummary() {

    var radarSection =
        document.getElementById("radarSection");

    if (!radarSection) {
        return;
    }

    var summary =
        document.getElementById(
            "radarTradeoffSummary"
        );

    if (!summary) {

        summary =
            document.createElement("div");

        summary.id =
            "radarTradeoffSummary";

        summary.className =
            "panel";

        summary.style.marginTop = "20px";
        summary.style.padding = "20px";

        var chartPanel =
            radarSection.querySelector(
                ".chart-panel"
            );

        if (chartPanel) {

            chartPanel.insertAdjacentElement(
                "afterend",
                summary
            );

        } else {

            radarSection.appendChild(summary);
        }
    }


    var html = "";

    html += '<div class="mono small">';
    html += 'TRADE-OFF SUMMARY';
    html += '</div>';

    html += '<h3 style="margin:8px 0 16px;">';
    html += 'Selected Standards Comparison';
    html += '</h3>';


    activeRadarStds.forEach(
        function(name) {

            var standard =
                STANDARDS[name];

            var scores =
                standard.scores;

            var strongest =
                getStrongestAttributes(scores);

            var weakest =
                getWeakestAttributes(scores);


            html += '<div ';
            html += 'class="radar-summary-card" ';
            html += 'style="';
            html += 'padding:16px;';
            html += 'margin-bottom:12px;';
            html += 'border:1px solid rgba(128,128,128,.2);';
            html += 'border-radius:10px;';
            html += '">';


            html += '<h4 style="margin:0 0 8px;">';
            html += name;
            html += '</h4>';


            html += '<div ';
            html += 'style="font-size:13px;line-height:1.6;">';


            html += '<strong>Strong in:</strong> ';
            html += strongest.join(", ");


            html += '<br>';


            html += '<strong>Trade-off:</strong> ';
            html += weakest.join(", ");


            html += '<br>';


            html += '<strong>Range:</strong> ';
            html += formatRange(
                standard.rangeM
            );


            html += ' &nbsp; | &nbsp; ';


            html += '<strong>Data Rate:</strong> ';
            html += formatDataRate(
                standard.rateKbps
            );


            html += '<br>';


            html += '<strong>Latency:</strong> ';
            html += standard.latencyMs;
            html += ' ms';


            html += ' &nbsp; | &nbsp; ';


            html += '<strong>Cost:</strong> ';
            html += standard.cost;


            html += '</div>';
            html += '</div>';
        }
    );


    summary.innerHTML = html;
}


/* =========================================================
   TABLE
========================================================= */

function renderTable() {

    var tableBody =
        document.getElementById("tableBody");

    if (!tableBody) {
        return;
    }

    var searchInput =
        document.getElementById("filterSearch");

    var query = "";

    if (searchInput) {
        query =
            searchInput.value
                .toLowerCase()
                .trim();
    }


    var html = "";


    Object.entries(STANDARDS)
        .filter(function(entry) {

            var name = entry[0];

            return name
                .toLowerCase()
                .indexOf(query) !== -1;
        })
        .forEach(function(entry) {

            var name = entry[0];
            var data = entry[1];

            var rangeText =
                data.rangeM >= 1000
                    ? (data.rangeM / 1000) + " km"
                    : data.rangeM + " m";


            var rateText;

            if (data.rateKbps >= 1000000) {

                rateText =
                    (data.rateKbps / 1000000) +
                    " Gbps";

            } else if (data.rateKbps >= 1000) {

                rateText =
                    (data.rateKbps / 1000) +
                    " Mbps";

            } else {

                rateText =
                    data.rateKbps +
                    " kbps";
            }


            var powerText =
                "●".repeat(data.power) +
                "○".repeat(10 - data.power);


            html += "<tr>";

            html += '<td class="std-name">';
            html += name;
            html += "</td>";

            html += '<td class="mono">';
            html += data.freq;
            html += "</td>";

            html += '<td class="mono">';
            html += rangeText;
            html += "</td>";

            html += '<td class="mono">';
            html += rateText;
            html += "</td>";

            html += '<td class="mono">';
            html += powerText;
            html += "</td>";

            html += '<td class="mono">';
            html += data.latencyMs;
            html += " ms";
            html += "</td>";

            html += '<td class="mono">';
            html += data.cost;
            html += "</td>";

            html += "</tr>";
        });


    tableBody.innerHTML = html;
}


function exportTableCSV() {

    var csv =
        "Standard,Frequency,Max Range,Data Rate,Power,Latency,Cost\n";


    Object.entries(STANDARDS)
        .forEach(function(entry) {

            var name = entry[0];
            var data = entry[1];

            csv +=
                '"' + name + '",' +
                '"' + data.freq + '",' +
                '"' + data.rangeM + ' m",' +
                '"' + data.rateKbps + ' kbps",' +
                data.power + "," +
                data.latencyMs + "," +
                '"' + data.cost + '"\n';
        });


    var blob =
        new Blob(
            [csv],
            {
                type: "text/csv"
            }
        );


    var url =
        URL.createObjectURL(blob);


    var a =
        document.createElement("a");

    a.href = url;

    a.download =
        "SpectraSelect_Standards_Matrix.csv";

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}


/* =========================================================
   ANALYTICS CHARTS
========================================================= */

function renderAnalyticsCharts() {

    if (typeof Chart === "undefined") {

        console.error(
            "Chart.js is not loaded."
        );

        return;
    }


    var names =
        Object.keys(STANDARDS);


    var rangeCanvas =
        document.getElementById("rangeChart");


    var scatterCanvas =
        document.getElementById("scatterChart");


    if (rangeChartObj) {

        rangeChartObj.destroy();

        rangeChartObj = null;
    }


    if (scatterChartObj) {

        scatterChartObj.destroy();

        scatterChartObj = null;
    }


    if (rangeCanvas) {

        rangeChartObj =
            new Chart(
                rangeCanvas,
                {
                    type: "bar",

                    data: {

                        labels: names,

                        datasets: [
                            {
                                label: "Range (m)",

                                data: names.map(
                                    function(name) {
                                        return STANDARDS[name].rangeM;
                                    }
                                )
                            }
                        ]
                    },

                    options: {

                        responsive: true,

                        scales: {

                            y: {
                                type: "logarithmic"
                            }
                        },

                        plugins: {

                            legend: {
                                display: false
                            }
                        }
                    }
                }
            );
    }


    if (scatterCanvas) {

        scatterChartObj =
            new Chart(
                scatterCanvas,
                {
                    type: "scatter",

                    data: {

                        datasets:
                            names.map(
                                function(name) {

                                    return {

                                        label: name,

                                        data: [
                                            {
                                                x: STANDARDS[name].rangeM,
                                                y: STANDARDS[name].rateKbps
                                            }
                                        ],

                                        pointRadius: 8
                                    };
                                }
                            )
                    },

                    options: {

                        responsive: true,

                        scales: {

                            x: {

                                type: "logarithmic",

                                title: {
                                    display: true,
                                    text: "Range (m)"
                                }
                            },

                            y: {

                                type: "logarithmic",

                                title: {
                                    display: true,
                                    text: "Data Rate (kbps)"
                                }
                            }
                        }
                    }
                }
            );
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    var searchInput =
        document.getElementById("filterSearch");

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderTable
        );
    }


    var mapSelect =
        document.getElementById("mapStdSelect");

    if (mapSelect) {

        mapSelect.addEventListener(
            "change",
            updateMapCircle
        );
    }


    var loginPass =
        document.getElementById("loginPass");

    if (loginPass) {

        loginPass.addEventListener(
            "keydown",
            function(event) {

                if (event.key === "Enter") {
                    handleLogin();
                }
            }
        );
    }
}


/* =========================================================
   INITIALIZE APP
========================================================= */

function initApp() {

    initMap();

    initRadarSelectors();

    renderMultiRadar();

    renderTradeoffSummary();

    renderTable();

    calculateFSPL();

    calculateBattery();

    renderAnalyticsCharts();

    runRecommendation();

    updateWeights();
}


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        setupEventListeners();
    }
);