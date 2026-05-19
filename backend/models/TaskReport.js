const mongoose = require("mongoose");

const taskReportSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "DailyTask", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    content: { type: String, required: true },
    images: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskReport", taskReportSchema);
