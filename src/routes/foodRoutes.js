const express = require("express");
const {
  getFoods,
  getFoodById,
  createFood,
  updateFood,
  patchFood,
  deleteFood,
  getRecommendations
} = require("../controllers/foodController");

const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

// Keep this before "/:id" so "recommendations" is not treated as an ID.
router.get("/recommendations", getRecommendations);
router.route("/")
  .get(getFoods)
  .post(requireAuth, requireAdmin, createFood);

router.route("/:id")
  .get(getFoodById)
  .put(requireAuth, requireAdmin, updateFood)
  .patch(requireAuth, requireAdmin, patchFood)
  .delete(requireAuth, requireAdmin, deleteFood);

module.exports = router;
