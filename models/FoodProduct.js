const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const FoodProductSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, index: true },
  description: { type: String, default: "", maxlength: 2000 },
  price: { type: Number, required: true, min: 0 },
  imageURL: { type: String, default: "" },
  category: { type: String, default: "Goan favourites", trim: true, index: true },
  ingredients: [{ type: String, trim: true }],
  isAvailable: { type: Boolean, default: true, index: true }
}, { timestamps: true });

FoodProductSchema.index({ name: "text", description: "text", category: "text" });
module.exports = mongoose.models.FoodProduct || model("FoodProduct", FoodProductSchema);
