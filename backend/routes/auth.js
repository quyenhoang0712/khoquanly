const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "warehouse-admin-secret";

const signUser = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      position: user.position,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  position: user.position,
});

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: String(email || "").toLowerCase(), active: true });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    const token = signUser(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Admin login required" });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

module.exports = router;
