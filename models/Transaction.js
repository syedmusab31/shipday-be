const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  txnId: {
    type: String,
    required: true,
    unique: true,
  },
  customer: String,
  type: {
    type: String,
    enum: ["Credit", "Debit"],
  },
  orderId: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: Number,
  method: {
    type: String,
    enum: ["UPI", "Bank Transfer", "Card", "Wallet", "COD", "PayFast", "Invoice", "cod", "payfast", "ewallet", "online"],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["Completed", "Pending", "Failed", "completed", "pending", "failed"],
    default: "Pending",
  },
  supportingDocument: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
