const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/env");
const { hashPassword, isHashedPassword, verifyPassword } = require("../utils/password");

const router = express.Router();

const JWT_SECRET = getJwtSecret();

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
  avatar: user.avatar,
});

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: String(email || "").toLowerCase(), active: true });

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    if (!isHashedPassword(user.password)) {
      user.password = hashPassword(password);
      await user.save();
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

router.get("/me", async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Admin login required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: payload.id, active: true }).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid or expired token" });
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    next(error);
  }
});

module.exports = router;
