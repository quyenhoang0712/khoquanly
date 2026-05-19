const mongoose = require("mongoose");

const salaryRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalShifts: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalSalary: { type: Number, default: 0 },
    details: [
      {
        date: String,
        morning: Boolean,
        afternoon: Boolean,
        hours: Number,
        salary: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalaryRecord", salaryRecordSchema);
