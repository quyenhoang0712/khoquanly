require("dotenv").config();

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const { requireAuth, requireRole } = require("./middleware/auth");
const seedDefaults = require("./seed");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/warehouse-management";

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "Warehouse Management API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", requireAuth, requireRole("admin"), adminRoutes);
app.use("/api/user", requireAuth, requireRole("user"), userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: "SKU already exists" });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  res.status(500).json({ message: "Server error", error: error.message });
});

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    await seedDefaults();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  });
