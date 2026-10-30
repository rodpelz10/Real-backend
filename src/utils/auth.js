const crypto = require("crypto");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Set JWT_SECRET in backend/.env to a private random value of at least 32 characters.");
  }
  return secret;
}

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: String(user._id), iat: now, exp: now + 7 * 24 * 60 * 60 })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(unsigned).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("Invalid token signature");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (header.alg !== "HS256" || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Expired or invalid token");
  return payload;
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, keyHex] = String(stored || "").split(":");
    if (!salt || !keyHex) return resolve(false);
    const expected = Buffer.from(keyHex, "hex");
    crypto.scrypt(password, salt, expected.length, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword };
