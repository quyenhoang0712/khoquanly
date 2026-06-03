const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/env");

const JWT_SECRET = getJwtSecret();

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Login required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: payload.id, active: true }).select("_id email name role position hourlyRate");
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      position: user.position,
      hourlyRate: user.hourlyRate,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission for this action" });
  }

  next();
};

module.exports = { requireAuth, requireRole };
