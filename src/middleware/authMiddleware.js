const User = require("../models/User");
const { verifyToken } = require("../utils/auth");

async function requireAuth(req, res, next) {
  try {
    const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ success: false, message: "Please sign in to continue." });
    const payload = verifyToken(match[1]);
    const user = await User.findById(payload.sub).select("name email role");
    if (!user) return res.status(401).json({ success: false, message: "This account no longer exists. Please sign in again." });
    req.user = { uid: String(user._id), email: user.email, name: user.name, role: user.role };
    next();
  } catch (error) {
    if (/token|signature|expired|invalid/i.test(error.message || "")) return res.status(401).json({ success: false, message: "Your session is invalid or expired. Please sign in again." });
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ success: false, message: "Administrator access is required." });
  next();
}

module.exports = { requireAuth, requireAdmin };
