const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const FoodCartSchema = new Schema({
  ownerKey: { type: String, required: true, unique: true, index: true },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: "FoodProduct", required: true },
    quantity: { type: Number, required: true, min: 1, max: 99, default: 1 }
  }]
}, { timestamps: true });

module.exports = mongoose.models.FoodCart || model("FoodCart", FoodCartSchema);
