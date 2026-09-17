const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

router.post("/register", async (req, res) => {
  try {
    const { username, student_id, password } = req.body;

    if (!username || !student_id || !password) {
      return res.status(400).json({ message: "username, student_id and password are required" });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE username = ? OR student_id = ?",
      [username, student_id]
    );

    if (existing.length) {
      return res.status(409).json({ message: "Username or Student ID already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (username, student_id, password_hash) VALUES (?, ?, ?)",
      [username, student_id, passwordHash]
    );

    res.status(201).json({
      success: true,
      user: { id: result.insertId, username, student_id }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, student_id, password } = req.body;

    if ((!username && !student_id) || !password) {
      return res.status(400).json({ message: "Username/Student ID and password are required" });
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? OR student_id = ? LIMIT 1",
      [username || "", student_id || ""]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid username/student ID or password" });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ message: "Invalid username/student ID or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, student_id: user.student_id },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        student_id: user.student_id
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
