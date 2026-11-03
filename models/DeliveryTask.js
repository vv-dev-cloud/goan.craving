const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const DeliveryEventSchema = new Schema({
  status: { type: String, required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "user", default: null },
  actorRole: { type: String, enum: ["seller", "delivery", "admin", "system"], default: "system" },
  note: { type: String, maxlength: 500, default: "" },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const DeliveryTaskSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: "FoodOrder", required: true, unique: true, index: true },
  restaurant: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  deliveryPerson: { type: Schema.Types.ObjectId, ref: "user", default: null, index: true },
  status: {
    type: String,
    enum: ["pending_assignment", "assigned", "accepted", "at_restaurant", "picked_up", "en_route", "delivered", "assignment_failed", "delivery_failed", "cancelled", "returned"],
    default: "pending_assignment",
    index: true
  },
  pickup: {
    address: { type: String, default: "" },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  dropoff: {
    address: { type: String, default: "" },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  assignedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  pickedUpAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  attemptCount: { type: Number, min: 0, default: 0 },
  failureReason: { type: String, maxlength: 500, default: "" },
  proofOfDelivery: {
    method: { type: String, enum: ["otp", "photo", "manual", ""], default: "" },
    verifiedAt: { type: Date, default: null }
  },
  events: { type: [DeliveryEventSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.models.DeliveryTask || model("DeliveryTask", DeliveryTaskSchema);
