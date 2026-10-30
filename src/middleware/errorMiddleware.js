function notFound(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, "body")) {
    status = 400;
    message = "Malformed JSON request body";
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((item) => item.message).join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid value supplied";
  } else if (err.code === 11000) {
    status = 409;
    message = "A record with that value already exists";
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message
  });
}

module.exports = { notFound, errorHandler };
