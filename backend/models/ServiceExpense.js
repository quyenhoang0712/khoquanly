const mongoose = require("mongoose");

const serviceExpenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

serviceExpenseSchema.index({ date: 1, user: 1 });

module.exports = mongoose.model("ServiceExpense", serviceExpenseSchema);
