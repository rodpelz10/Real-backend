const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userUid: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, trim: true, lowercase: true },
  customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["Pending", "Preparing", "Out for delivery", "Completed", "Cancelled"], default: "Pending" }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
