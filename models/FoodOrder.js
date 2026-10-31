const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const OrderSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  items: [{ product: { type: Schema.Types.ObjectId, ref: "FoodProduct" }, seller: { type: Schema.Types.ObjectId, ref: "user", index: true }, sellerName: { type: String, default: "" }, name: { type: String, required: true }, imageURL: String, unitPrice: { type: Number, required: true }, quantity: { type: Number, required: true, min: 1 } }],
  deliveryAddress: { fullName: { type: String, required: true }, phone: { type: String, required: true }, addressLine: { type: String, required: true }, area: { type: String, required: true }, city: { type: String, required: true }, state: { type: String, required: true }, postalCode: { type: String, required: true } },
  paymentMethod: { type: String, enum: ["cod", "upi", "card"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  orderStatus: { type: String, enum: ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"], default: "placed" },
  total: { type: Number, required: true, min: 0 }
}, { timestamps: true });
module.exports = mongoose.models.FoodOrder || model("FoodOrder", OrderSchema);