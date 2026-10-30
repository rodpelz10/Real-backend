const express = require("express");
const { getAIRecommendations, aiSearch, aiChat } = require("../controllers/aiController");

const router = express.Router();

router.post("/recommendations", getAIRecommendations);
router.post("/search", aiSearch);
router.post("/chat", aiChat);

module.exports = router;
