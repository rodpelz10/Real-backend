require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const User = require("./models/User");
const { hashPassword } = require("./utils/auth");
const foodRoutes = require("./routes/foodRoutes");
const aiRoutes = require("./routes/aiRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Food Delivery API is running",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

async function ensureAdminAccount() {
  const email = String(process.env.ADMIN_EMAIL || "admin@crave.local").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "ChangeMe123!");
  const name = String(process.env.ADMIN_NAME || "Crave Administrator").trim();
  if (password.length < 8 || password.length > 72) throw new Error("ADMIN_PASSWORD must be between 8 and 72 characters.");
  let user = await User.findOne({ email }).select("+passwordHash name email role");
  if (!user) {
    user = await User.create({ name, email, passwordHash: await hashPassword(password), role: "admin" });
    console.log(`Created initial admin account: ${email}`);
  } else if (user.role !== "admin") {
    user.role = "admin";
    await user.save();
    console.log(`Granted admin role to configured account: ${email}`);
  }
}

async function start() {
  await connectDB();
  await ensureAdminAccount();
  app.listen(PORT, () => {
    console.log(`Food Delivery API listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
