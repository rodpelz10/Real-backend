const mongoose = require("mongoose");
const Food = require("../models/Food");
const Order = require("../models/Order");

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const createOrder = asyncHandler(async (req, res) => {
  const { customerName, phone, address, items } = req.body;
  if (!String(customerName || "").trim() || !String(phone || "").trim() || !String(address || "").trim()) {
    const error = new Error("Customer name, phone, and delivery address are required."); error.statusCode = 400; throw error;
  }
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Add at least one menu item before placing an order."); error.statusCode = 400; throw error;
  }
  const quantities = new Map();
  for (const item of items) {
    if (!item || !mongoose.isValidObjectId(item.foodId)) {
      const error = new Error("One of the selected menu items is invalid. Refresh the menu and try again."); error.statusCode = 400; throw error;
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      const error = new Error("Item quantities must be whole numbers between 1 and 99."); error.statusCode = 400; throw error;
    }
    quantities.set(String(item.foodId), (quantities.get(String(item.foodId)) || 0) + quantity);
  }
  const ids = [...quantities.keys()];
  const foods = await Food.find({ _id: { $in: ids }, available: true });
  if (foods.length !== ids.length) {
    const error = new Error("One or more items are unavailable. Please refresh your menu."); error.statusCode = 400; throw error;
  }
  const byId = new Map(foods.map(food => [String(food._id), food]));
  const orderItems = ids.map(id => {
    const food = byId.get(id);
    return { food: food._id, name: food.name, price: food.price, quantity: quantities.get(id) };
  });
  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = await Order.create({
    customerName: String(customerName).trim(), phone: String(phone).trim(), address: String(address).trim(),
    items: orderItems, total,
    userUid: req.user.uid,
    userEmail: req.user.email
  });
  res.status(201).json({ success: true, message: "Order placed successfully.", data: order });
});

const getOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(500).lean();
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const allowed = ["Pending", "Preparing", "Out for delivery", "Completed", "Cancelled"];
  if (!mongoose.isValidObjectId(req.params.id)) { const error = new Error("Invalid order ID"); error.statusCode = 400; throw error; }
  if (!allowed.includes(req.body.status)) { const error = new Error("Choose a valid order status."); error.statusCode = 400; throw error; }
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!order) { const error = new Error("Order not found."); error.statusCode = 404; throw error; }
  res.json({ success: true, data: order });
});

module.exports = { createOrder, getOrders, updateOrderStatus };
