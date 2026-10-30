const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Food name is required"],
      trim: true,
      minlength: [2, "Food name must be at least 2 characters"],
      maxlength: [100, "Food name cannot exceed 100 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: ""
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"]
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: 80
    },
    cuisine: {
      type: String,
      trim: true,
      default: ""
    },
    ingredients: {
      type: [String],
      default: []
    },
    dietaryTags: {
      type: [String],
      default: []
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ""
    },
    available: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    popularity: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { timestamps: true }
);

foodSchema.index({
  name: "text",
  description: "text",
  category: "text",
  cuisine: "text",
  ingredients: "text"
});

module.exports = mongoose.model("Food", foodSchema);
