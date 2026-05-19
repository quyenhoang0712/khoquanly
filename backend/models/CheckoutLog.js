const mongoose = require("mongoose");

const checkoutLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    checkoutAt: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

checkoutLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("CheckoutLog", checkoutLogSchema);
