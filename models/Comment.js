const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CommentSchema = new Schema({
    type: { type: String, enum: ["blog", "food_review"], default: "blog", index: true },
    content: {
        type: String,
        required: function () { return this.type === "blog"; },
        minlength: 1,
        maxlength: 5000,
        trim: true
    },
    blog: {
        type: Schema.Types.ObjectId,
        ref: "blog",
        required: function () { return this.type === "blog"; },
        index: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
        index: true
    },
    replies: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    likes: [{ type: Schema.Types.ObjectId, ref: "user" }],
    // Verified food reviews reuse the existing comment collection without changing blog comments.
    foodOrder: { type: Schema.Types.ObjectId, ref: "FoodOrder", default: null, index: true },
    foodProduct: { type: Schema.Types.ObjectId, ref: "FoodProduct", default: null, index: true },
    restaurant: { type: Schema.Types.ObjectId, ref: "user", default: null, index: true },
    rating: { type: Number, min: 1, max: 5, validate: Number.isInteger, default: null },
    images: {
        type: [{ type: String, trim: true, maxlength: 2048 }],
        default: [],
        validate: value => Array.isArray(value) && value.length <= 5
    },
    isVerifiedPurchase: { type: Boolean, default: false, index: true },
    isApproved: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

CommentSchema.index({ blog: 1, isDeleted: 1, isApproved: 1, createdAt: 1 });
CommentSchema.index({ blog: 1, parentComment: 1, isDeleted: 1, isApproved: 1, createdAt: 1 });
CommentSchema.index(
    { author: 1, foodOrder: 1, foodProduct: 1 },
    { unique: true, partialFilterExpression: { type: "food_review" } }
);
CommentSchema.index({ foodProduct: 1, type: 1, isDeleted: 1, isApproved: 1, createdAt: -1 });

CommentSchema.virtual("likeCount").get(function () {
    return Array.isArray(this.likes) ? this.likes.length : 0;
});
CommentSchema.query.notDeleted = function () { return this.where({ isDeleted: false }); };
CommentSchema.query.approved = function () { return this.where({ isApproved: true }); };

const Comment = mongoose.models.Comment || model("Comment", CommentSchema);
module.exports = Comment;
