const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const OrderItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "FoodProduct" },
  seller: { type: Schema.Types.ObjectId, ref: "user", index: true },
  sellerName: { type: String, default: "" },
  name: { type: String, required: true },
  imageURL: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const DeliveryAddressSchema = new Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine: { type: String, required: true },
  area: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  instructions: { type: String, maxlength: 250, default: "" }
}, { _id: false });

const OrderEventSchema = new Schema({
  status: { type: String, required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "user", default: null },
  actorRole: { type: String, enum: ["customer", "seller", "delivery", "admin", "system"], default: "system" },
  note: { type: String, maxlength: 500, default: "" },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const EtaSchema = new Schema({
  distanceMeters: { type: Number, min: 0 },
  travelSeconds: { type: Number, min: 0 },
  preparationMinutes: { type: Number, min: 0, default: 0 },
  bufferMinutes: { type: Number, min: 0, default: 10 },
  earliestAt: { type: Date },
  latestAt: { type: Date },
  provider: { type: String, maxlength: 60, default: "" },
  calculatedAt: { type: Date }
}, { _id: false });

const OrderSchema = new Schema({
  orderNumber: { type: String, unique: true, sparse: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  items: { type: [OrderItemSchema], default: [] },
  deliveryAddress: { type: DeliveryAddressSchema, required: true },
  paymentMethod: { type: String, enum: ["cod", "upi", "card"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  orderStatus: {
    type: String,
    enum: ["placed", "accepted", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled", "rejected"],
    default: "placed",
    index: true
  },
  preparationMinutes: { type: Number, min: 0, max: 240, default: 30 },
  estimatedDelivery: { type: EtaSchema, default: () => ({}) },
  statusEvents: { type: [OrderEventSchema], default: [] },
  total: { type: Number, required: true, min: 0 },
  refundStatus: { type: String, enum: ["none", "requested", "processing", "completed", "rejected"], default: "none" },
  refundRequestedAt: { type: Date, default: null },
  refundProcessedAt: { type: Date, default: null },
  refundAmount: { type: Number, min: 0, default: 0 },
  refundNote: { type: String, maxlength: 500, default: "" }
}, { timestamps: true });

module.exports = mongoose.models.FoodOrder || model("FoodOrder", OrderSchema);
