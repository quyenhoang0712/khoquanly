const mongoose = require("mongoose");

const overtimeRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, default: "" },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    hours: { type: Number, required: true, min: 0 },
    hourlyRate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    note: { type: String, default: "" },
    adminNote: { type: String, default: "" },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OvertimeRecord", overtimeRecordSchema);
