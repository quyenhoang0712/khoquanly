const mongoose = require("mongoose");

const reportImageSchema = new mongoose.Schema(
  {
    report: { type: mongoose.Schema.Types.ObjectId, ref: "TaskReport", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    path: { type: String, required: true },
    originalName: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportImage", reportImageSchema);
