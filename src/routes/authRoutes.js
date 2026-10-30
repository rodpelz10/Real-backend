const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { signToken, hashPassword, verifyPassword } = require("../utils/auth");
const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 100) return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ success: false, message: "Password must be between 8 and 72 characters." });
    if (await User.exists({ email })) return res.status(409).json({ success: false, message: "An account with this email already exists. Please sign in." });
    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: "customer" });
    res.status(201).json({ success: true, message: "Account created successfully.", data: { token: signToken(user), user: { uid: String(user._id), name: user.name, email: user.email, role: user.role } } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists." });
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email }).select("+passwordHash name email role");
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Incorrect email or password." });
    }
    res.json({ success: true, message: "Signed in successfully.", data: { token: signToken(user), user: { uid: String(user._id), name: user.name, email: user.email, role: user.role } } });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: { uid: req.user.uid, email: req.user.email, name: req.user.name, role: req.user.role } });
});

module.exports = router;
