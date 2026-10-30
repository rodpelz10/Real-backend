const express = require("express");
const { createOrder, getOrders, updateOrderStatus } = require("../controllers/orderController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");
const router = express.Router();
router.post("/", requireAuth, createOrder);
router.get("/", requireAuth, requireAdmin, getOrders);
router.patch("/:id/status", requireAuth, requireAdmin, updateOrderStatus);
module.exports = router;
