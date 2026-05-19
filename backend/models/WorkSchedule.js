const mongoose = require("mongoose");

const workScheduleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    shift: { type: String, enum: ["morning", "afternoon"], required: true },
    status: { type: String, enum: ["scheduled", "leave"], default: "scheduled" },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "WeeklyScheduleRequest" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workScheduleSchema.index({ user: 1, date: 1, shift: 1 }, { unique: true });

module.exports = mongoose.model("WorkSchedule", workScheduleSchema);
