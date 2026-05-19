const mongoose = require("mongoose");

const dailyTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    date: { type: String, required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    statusByUser: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["not-started", "in-progress", "completed"], default: "not-started" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyTask", dailyTaskSchema);
