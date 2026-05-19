const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, enum: ["admin", "user"], required: true, unique: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
