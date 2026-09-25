CREATE DATABASE IF NOT EXISTS spectraselect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE spectraselect;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  student_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  frequency VARCHAR(100),
  range_m DECIMAL(12,2) NOT NULL,
  data_rate_kbps DECIMAL(15,2) NOT NULL,
  power VARCHAR(30),
  latency_ms DECIMAL(10,2),
  cost VARCHAR(30),
  range_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  data_rate_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  power_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  cost_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  latency_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS recommendation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  requirements_json JSON,
  recommended_standard VARCHAR(50),
  match_score DECIMAL(6,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

INSERT INTO standards
(name, frequency, range_m, data_rate_kbps, power, latency_ms, cost,
 range_score, data_rate_score, power_score, cost_score, latency_score, description)
VALUES
('Wi-Fi', '2.4/5 GHz', 100, 1000000, 'Medium', 10, 'Low', 5, 10, 6, 9, 10,
 'High-throughput WLAN for local networks.'),
('Bluetooth', '2.4 GHz', 30, 2000, 'Low', 20, 'Low', 3, 6, 10, 9, 9,
 'Short-range low-power personal area networking.'),
('ZigBee', '2.4 GHz', 100, 250, 'Very Low', 30, 'Low', 5, 3, 10, 9, 8,
 'Low-power mesh networking for sensors and automation.'),
('LoRaWAN', 'Sub-GHz', 10000, 27, 'Very Low', 1000, 'Low', 10, 2, 10, 9, 3,
 'Long-range low-power IoT connectivity.'),
('NB-IoT', 'Licensed LTE bands', 8000, 250, 'Low', 1500, 'Medium', 9, 3, 8, 6, 2,
 'Cellular IoT standard optimized for low-bandwidth devices.'),
('LTE', 'Licensed LTE bands', 5000, 150000, 'High', 50, 'High', 9, 9, 3, 4, 8,
 'Wide-area cellular connectivity with high data rates.'),
('5G', 'Sub-6/mmWave', 3000, 10000000, 'High', 5, 'High', 8, 10, 3, 3, 10,
 'High-capacity cellular networking with very low latency.')
ON DUPLICATE KEY UPDATE
  frequency=VALUES(frequency),
  range_m=VALUES(range_m),
  data_rate_kbps=VALUES(data_rate_kbps),
  power=VALUES(power),
  latency_ms=VALUES(latency_ms),
  cost=VALUES(cost),
  range_score=VALUES(range_score),
  data_rate_score=VALUES(data_rate_score),
  power_score=VALUES(power_score),
  cost_score=VALUES(cost_score),
  latency_score=VALUES(latency_score),
  description=VALUES(description);
