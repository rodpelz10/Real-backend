
const mongoose = require("mongoose");
const Food = require("../models/Food");

function parseNumber(value, fieldName) {
  if (value === undefined || value === "") return undefined;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    const error = new Error(`${fieldName} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function validateId(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error("Invalid food ID");
    error.statusCode = 400;
    throw error;
  }
}

function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

// Escape special characters before using user input in a regular expression.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/foods
const getFoods = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    cuisine,
    maxPrice,
    minPrice,
    available,
    dietaryTag,
    page = "1",
    limit = "12"
  } = req.query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    100,
    Math.max(1, parseInt(limit, 10) || 12)
  );

  const filter = {};

  if (search && String(search).trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");

    filter.$or = [
      { name: regex },
      { description: regex },
      { category: regex },
      { cuisine: regex },
      { ingredients: regex }
    ];
  }

  if (category) {
    filter.category = new RegExp(
      `^${escapeRegex(category)}$`,
      "i"
    );
  }

  if (cuisine) {
    filter.cuisine = new RegExp(
      `^${escapeRegex(cuisine)}$`,
      "i"
    );
  }

  const low = parseNumber(minPrice, "minPrice");
  const high = parseNumber(maxPrice, "maxPrice");

  if (
    (low !== undefined && low < 0) ||
    (high !== undefined && high < 0)
  ) {
    const error = new Error("Price filters cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  if (
    low !== undefined &&
    high !== undefined &&
    low > high
  ) {
    const error = new Error(
      "minPrice cannot be greater than maxPrice"
    );
    error.statusCode = 400;
    throw error;
  }

  if (low !== undefined || high !== undefined) {
    filter.price = {};

    if (low !== undefined) filter.price.$gte = low;
    if (high !== undefined) filter.price.$lte = high;
  }

  if (available !== undefined) {
    if (!["true", "false"].includes(String(available))) {
      const error = new Error("available must be true or false");
      error.statusCode = 400;
      throw error;
    }

    filter.available = available === "true";
  }

  if (dietaryTag) {
    filter.dietaryTags = new RegExp(
      `^${escapeRegex(dietaryTag)}$`,
      "i"
    );
  }

  const [foods, total] = await Promise.all([
    Food.find(filter)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),

    Food.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: foods,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.ceil(total / parsedLimit)
    }
  });
});

// GET /api/foods/:id
const getFoodById = asyncHandler(async (req, res) => {
  validateId(req.params.id);

  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: "Food not found"
    });
  }

  res.json({ success: true, data: food });
});

// POST /api/foods
const createFood = asyncHandler(async (req, res) => {
  const allowed = [
    "name",
    "description",
    "price",
    "category",
    "cuisine",
    "ingredients",
    "dietaryTags",
    "imageUrl",
    "available",
    "rating",
    "popularity"
  ];

  const payload = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      payload[key] = req.body[key];
    }
  }

  const food = await Food.create(payload);

  res.status(201).json({
    success: true,
    message: "Food created",
    data: food
  });
});

const editableFields = [
  "name",
  "description",
  "price",
  "category",
  "cuisine",
  "ingredients",
  "dietaryTags",
  "imageUrl",
  "available",
  "rating",
  "popularity"
];

// PUT /api/foods/:id
// Updates the supplied fields and preserves fields not supplied.
const updateFood = asyncHandler(async (req, res) => {
  validateId(req.params.id);

  const updates = {};

  for (const key of editableFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  for (const requiredField of ["name", "price", "category"]) {
    if (
      updates[requiredField] === undefined ||
      updates[requiredField] === ""
    ) {
      return res.status(400).json({
        success: false,
        message: `${requiredField} is required`
      });
    }
  }

  const food = await Food.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    {
      new: true,
      runValidators: true
    }
  );

  if (!food) {
    return res.status(404).json({
      success: false,
      message: "Food not found"
    });
  }

  res.json({
    success: true,
    message: "Food updated successfully",
    data: food
  });
});

// PATCH /api/foods/:id
const patchFood = asyncHandler(async (req, res) => {
  validateId(req.params.id);

  const updates = {};

  for (const key of editableFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update"
    });
  }

  const food = await Food.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    {
      new: true,
      runValidators: true
    }
  );

  if (!food) {
    return res.status(404).json({
      success: false,
      message: "Food not found"
    });
  }

  res.json({
    success: true,
    message: "Food updated",
    data: food
  });
});

// DELETE /api/foods/:id
const deleteFood = asyncHandler(async (req, res) => {
  validateId(req.params.id);

  const food = await Food.findByIdAndDelete(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: "Food not found"
    });
  }

  res.json({
    success: true,
    message: "Food deleted",
    data: { _id: food._id }
  });
});

// GET /api/foods/recommendations
const getRecommendations = asyncHandler(async (req, res) => {
  const {
    cuisine,
    maxPrice,
    dietaryTag,
    category,
    limit = "10"
  } = req.query;

  const filter = { available: true };

  if (cuisine) {
    filter.cuisine = new RegExp(
      `^${escapeRegex(cuisine)}$`,
      "i"
    );
  }

  if (category) {
    filter.category = new RegExp(
      `^${escapeRegex(category)}$`,
      "i"
    );
  }

  if (dietaryTag) {
    filter.dietaryTags = new RegExp(
      `^${escapeRegex(dietaryTag)}$`,
      "i"
    );
  }

  const budget = parseNumber(maxPrice, "maxPrice");

  if (budget !== undefined) {
    if (budget < 0) {
      const error = new Error("maxPrice cannot be negative");
      error.statusCode = 400;
      throw error;
    }

    filter.price = { $lte: budget };
  }

  const safeLimit = Math.min(
    50,
    Math.max(1, parseInt(limit, 10) || 10)
  );

  const foods = await Food.find(filter)
    .sort({ popularity: -1, rating: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();

  res.json({
    success: true,
    message: foods.length
      ? "Recommendations matched your filters"
      : "No foods match those preferences. Try changing your filters.",
    data: foods
  });
});

module.exports = {
  getFoods,
  getFoodById,
  createFood,
  updateFood,
  patchFood,
  deleteFood,
  getRecommendations
};
