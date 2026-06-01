const mongoose = require("mongoose");

const overtimeRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    hours: { type: Number, required: true, min: 0 },
    hourlyRate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OvertimeRecord", overtimeRecordSchema);
