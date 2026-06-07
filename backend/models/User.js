const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    position: { type: String, enum: ["warehouse", "sale"], default: "warehouse" },
    hourlyRate: { type: Number, default: 30000 },
    travelAllowanceEnabled: { type: Boolean, default: false },
    travelAllowanceAmount: { type: Number, default: 150000 },
    avatar: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
