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
const isProduction = process.env.NODE_ENV === "production";

// Set CLIENT_ORIGIN to your deployed frontend URL in Render.
// Multiple frontend origins may be separated with commas.
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);
if (!isProduction) {
  allowedOrigins.add("https://cravesit.vercel.app/");
}

if (isProduction && allowedOrigins.size === 0) {
  console.warn("CLIENT_ORIGIN is not configured. Browser requests will be blocked by CORS until it is set.");
}

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (for example, server-to-server health checks) are allowed.
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked request from origin: ${origin}`));
  }
}));
app.use(express.json({ limit: "1mb" }));

// Friendly response for the Render service root URL (GET /).
// This prevents the generic "Route not found: GET /" response when
// opening the backend URL in a browser.
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Food Delivery API is running",
    endpoints: {
      health: "/api/health",
      authentication: "/api/auth",
      foods: "/api/foods",
      recommendations: "/api/ai",
      orders: "/api/orders"
    }
  });
});

// Health endpoint reports whether the app is connected to MongoDB Atlas.
app.get("/api/health", (_req, res) => {
  const mongoose = require("mongoose");
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? "Food Delivery API is running and connected to MongoDB"
      : "Food Delivery API is running but MongoDB is not connected",
    database: databaseConnected ? "connected" : "disconnected",
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
    console.log(`Food Delivery API listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
