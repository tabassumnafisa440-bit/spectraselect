const router = require("express").Router();

router.post("/fspl", (req, res) => {
  const distanceM = Number(req.body.distance_m);
  const frequencyMHz = Number(req.body.frequency_mhz);

  if (!(distanceM > 0) || !(frequencyMHz > 0)) {
    return res.status(400).json({ message: "distance_m and frequency_mhz must be greater than 0" });
  }

  const fspl = 20 * Math.log10(distanceM) + 20 * Math.log10(frequencyMHz) - 27.55;

  res.json({
    success: true,
    distance_m: distanceM,
    frequency_mhz: frequencyMHz,
    fspl_db: Number(fspl.toFixed(2))
  });
});

router.post("/battery", (req, res) => {
  const capacityMah = Number(req.body.capacity_mah);
  const txCurrentMa = Number(req.body.tx_current_ma);
  const sleepCurrentMa = Number(req.body.sleep_current_ma);
  const dutyPercent = Number(req.body.duty_percent);

  if (capacityMah <= 0 || txCurrentMa < 0 || sleepCurrentMa < 0 || dutyPercent < 0 || dutyPercent > 100) {
    return res.status(400).json({ message: "Invalid battery calculation inputs" });
  }

  const duty = dutyPercent / 100;
  const averageCurrent = (txCurrentMa * duty) + (sleepCurrentMa * (1 - duty));
  if (!(averageCurrent > 0)) {
    return res.status(400).json({ message: "Average current is 0 - battery life is unlimited" });
  }

  const hours = capacityMah / averageCurrent;
  const years = hours / (24 * 365.25);

  res.json({
    success: true,
    average_current_ma: Number(averageCurrent.toFixed(4)),
    battery_life_hours: Number(hours.toFixed(2)),
    battery_life_years: Number(years.toFixed(2))
  });
});

module.exports = router;
