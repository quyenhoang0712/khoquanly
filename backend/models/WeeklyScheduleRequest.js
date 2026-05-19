const mongoose = require("mongoose");

const requestedShiftSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    shift: { type: String, enum: ["morning", "afternoon"], required: true },
  },
  { _id: false }
);

const weeklyScheduleRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weekStart: { type: String, required: true },
    shifts: { type: [requestedShiftSchema], validate: [(value) => value.length > 0, "Select at least one shift"] },
    note: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminNote: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WeeklyScheduleRequest", weeklyScheduleRequestSchema);
