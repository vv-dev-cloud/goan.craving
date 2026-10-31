const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const NotificationSchema = new Schema({
    recipient: { type: Schema.Types.ObjectId, ref: "user", required: true },
    type: {
        type: String,
        enum: ["comment", "reply", "like", "follow", "follow_request", "follow_request_accepted", "mention", "blog_post", "message", "order_placed", "order_status", "payment", "refund"],
        required: true
    },
    title: String,
    message: String,
    blog: { type: Schema.Types.ObjectId, ref: "blog" },
    actor: { type: Schema.Types.ObjectId, ref: "user" },
    request: { type: Schema.Types.ObjectId, ref: "FollowRequest" },
    messageRef: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    order: { type: Schema.Types.ObjectId, ref: "FoodOrder", default: null },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
NotificationSchema.index({ recipient: 1, type: 1, messageRef: 1 });

const Notification = mongoose.models.Notification || model("Notification", NotificationSchema);
module.exports = Notification;
