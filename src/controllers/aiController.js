const { GoogleGenAI, Type } = require("@google/genai");
const Food = require("../models/Food");
const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("Gemini AI is not configured. Add GEMINI_API_KEY to the backend .env file.");
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function foodForPrompt(food) {
  return {
    id: String(food._id),
    name: food.name,
    description: food.description || "",
    price: food.price,
    category: food.category,
    cuisine: food.cuisine || "",
    ingredients: food.ingredients || [],
    dietaryTags: food.dietaryTags || [],
    rating: food.rating || 0,
    popularity: food.popularity || 0,
    available: food.available
  };
}

function parseAIJson(response) {
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Gemini returned an unexpected response. Please try again.");
  }
}

function buildFilter({ cuisine, category, dietaryTags, maxPrice, minPrice }) {
  const filter = { available: true };
  if (cuisine) filter.cuisine = new RegExp(`^${String(cuisine).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (category) filter.category = new RegExp(`^${String(category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  if (maxPrice !== undefined && maxPrice !== "") {
    const n = Number(maxPrice);
    if (!Number.isFinite(n) || n < 0) throw badRequest("maxPrice must be a non-negative number");
    filter.price = { ...(filter.price || {}), $lte: n };
  }
  if (minPrice !== undefined && minPrice !== "") {
    const n = Number(minPrice);
    if (!Number.isFinite(n) || n < 0) throw badRequest("minPrice must be a non-negative number");
    filter.price = { ...(filter.price || {}), $gte: n };
  }

  const tags = Array.isArray(dietaryTags)
    ? dietaryTags.filter((tag) => typeof tag === "string" && tag.trim())
    : typeof dietaryTags === "string" && dietaryTags.trim()
      ? [dietaryTags.trim()]
      : [];
  if (tags.length) {
    filter.dietaryTags = { $all: tags.map((tag) => new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) };
  }
  return filter;
}

// POST /api/ai/recommendations
// Body: { preferences: { budget, cuisine, category, dietaryTags, ingredientsToAvoid }, limit }
const getAIRecommendations = asyncHandler(async (req, res) => {
  const preferences = req.body?.preferences || {};
  const filter = buildFilter({
    cuisine: preferences.cuisine,
    category: preferences.category,
    dietaryTags: preferences.dietaryTags,
    maxPrice: preferences.budget
  });
  const ingredientsToAvoid = Array.isArray(preferences.ingredientsToAvoid)
    ? preferences.ingredientsToAvoid.filter((item) => typeof item === "string" && item.trim()).slice(0, 30)
    : [];
  if (ingredientsToAvoid.length) {
    filter.ingredients = {
      $nin: ingredientsToAvoid.map((item) => new RegExp(item.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    };
  }
  const limit = Math.min(10, Math.max(1, Number.parseInt(req.body?.limit, 10) || 5));

  // Enforce availability and budget in MongoDB before AI ranks real menu items.
  const foods = await Food.find(filter)
    .sort({ popularity: -1, rating: -1 })
    .limit(100)
    .lean();

  if (!foods.length) {
    return res.json({
      success: true,
      message: "No available foods match those preferences. Try a different budget or filter.",
      data: []
    });
  }

  const ai = getAI();
  const catalog = foods.map(foodForPrompt);
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [
      "You are a food recommendation assistant for a food delivery app.",
      "Recommend only items from the supplied catalog. Never invent food items or IDs.",
      "Respect the user's budget, dietary preferences, and ingredients to avoid. The catalog has already been filtered for availability and budget.",
      "Return JSON with a recommendations array. Each item must include id (exact catalog ID), reason (one short sentence), and matchScore (integer 0 to 100).",
      `User preferences: ${JSON.stringify({
        ...preferences,
        ingredientsToAvoid: Array.isArray(preferences.ingredientsToAvoid) ? preferences.ingredientsToAvoid : []
      })}`,
      `Maximum recommendations: ${limit}`,
      `Available catalog: ${JSON.stringify(catalog)}`
    ].join("\n\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                reason: { type: Type.STRING },
                matchScore: { type: Type.INTEGER }
              },
              required: ["id", "reason", "matchScore"]
            }
          }
        },
        required: ["recommendations"]
      }
    }
  });

  const parsed = parseAIJson(response);
  const byId = new Map(foods.map((food) => [String(food._id), food]));
  const seen = new Set();
  const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
    .filter((item) => item && byId.has(String(item.id)) && !seen.has(String(item.id)) && seen.add(String(item.id)))
    .slice(0, limit)
    .map((item) => ({
      food: byId.get(String(item.id)),
      reason: typeof item.reason === "string" ? item.reason.slice(0, 300) : "Selected to match your preferences.",
      matchScore: Math.max(0, Math.min(100, Number(item.matchScore) || 0))
    }));

  res.json({
    success: true,
    message: "AI recommendations generated from available menu items",
    data: recommendations
  });
});

// POST /api/ai/search
// Body: { query: "something spicy under 200 pesos" }
const aiSearch = asyncHandler(async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) throw badRequest("query is required");
  if (query.length > 500) throw badRequest("query must be 500 characters or fewer");

  const foods = await Food.find({ available: true })
    .sort({ popularity: -1, rating: -1 })
    .limit(100)
    .lean();

  if (!foods.length) {
    return res.json({ success: true, message: "No available food items found", data: [] });
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [
      "You are a natural-language food search assistant.",
      "Match the user's request against the supplied available menu. Return only IDs present in the catalog, ordered by relevance. Do not invent items or claim ingredients that are not in the catalog.",
      'Return JSON shaped as {"results":[{"id":"exact catalog ID","reason":"short match explanation"}]}.',
      `User search: ${query}`,
      `Catalog: ${JSON.stringify(foods.map(foodForPrompt))}`
    ].join("\n\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["id", "reason"]
            }
          }
        },
        required: ["results"]
      }
    }
  });

  const parsed = parseAIJson(response);
  const byId = new Map(foods.map((food) => [String(food._id), food]));
  const seen = new Set();
  const results = (Array.isArray(parsed.results) ? parsed.results : [])
    .filter((item) => item && byId.has(String(item.id)) && !seen.has(String(item.id)) && seen.add(String(item.id)))
    .slice(0, 20)
    .map((item) => ({
      food: byId.get(String(item.id)),
      reason: typeof item.reason === "string" ? item.reason.slice(0, 300) : "Matches your search."
    }));

  res.json({ success: true, message: "AI search completed", data: results });
});

// POST /api/ai/chat
// Body: { message: "...", preferences?: {...} }
const aiChat = asyncHandler(async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) throw badRequest("message is required");
  if (message.length > 2000) throw badRequest("message must be 2000 characters or fewer");

  const foods = await Food.find({ available: true })
    .sort({ popularity: -1, rating: -1 })
    .limit(50)
    .lean();

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [
      "You are a helpful food delivery assistant.",
      "Answer clearly and briefly. Use the available catalog for specific menu items and prices. Never invent menu items, prices, or availability. If the catalog lacks the requested item, say so. For medical allergies or serious dietary restrictions, remind the user to verify ingredients with the restaurant.",
      `User preferences: ${JSON.stringify(req.body?.preferences || {})}`,
      `Available menu catalog: ${JSON.stringify(foods.map(foodForPrompt))}`,
      `User message: ${message}`
    ].join("\n\n")
  });

  res.json({
    success: true,
    data: { reply: response.text || "Sorry, I couldn't generate a response. Please try again." }
  });
});

module.exports = { getAIRecommendations, aiSearch, aiChat };
