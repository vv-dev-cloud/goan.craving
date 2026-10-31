const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Comment = require("../models/Comment");
const FoodOrder = require("../models/FoodOrder");
const cloudinaryUpload = require("../middlewares/CloudinaryUploads");
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");

const upload = cloudinaryUpload.array("foodImages", 5);

function validId(value) {
    return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

router.post("/orders/:orderId/products/:productId", restrictToLoggedInUserOnly, upload, async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        if (!validId(orderId) || !validId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid order or food item." });
        }

        const order = await FoodOrder.findOne({ _id: orderId, user: req.user._id });
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });
        if (order.orderStatus !== "delivered") {
            return res.status(403).json({ success: false, message: "You can review food only after the order is delivered." });
        }

        const orderedItem = order.items.find(item => item.product && String(item.product) === productId);
        if (!orderedItem) {
            return res.status(403).json({ success: false, message: "This food item is not part of your order." });
        }

        const rating = Number(req.body.rating);
        const description = String(req.body.description || "").trim();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Choose a rating from 1 to 5 stars." });
        }
        if (description.length > 1200) {
            return res.status(400).json({ success: false, message: "Review description must be 1,200 characters or fewer." });
        }
        if ((req.files || []).length > 5) {
            return res.status(400).json({ success: false, message: "You can upload up to 5 food photos." });
        }

        const existing = await Comment.findOne({
            type: "food_review",
            author: req.user._id,
            foodOrder: order._id,
            foodProduct: orderedItem.product
        });

        let imageUrls = existing?.images || [];
        if (req.files?.length) {
            const uploaded = await Promise.all(req.files.map(file =>
                cloudinaryUpload.uploadBuffer(file.buffer, {
                    folder: "goan_craving_reviews",
                    transformation: [{ width: 1400, height: 1400, crop: "limit" }]
                })
            ));
            imageUrls = uploaded.map(image => image.secure_url);
        }

        const reviewData = {
            type: "food_review",
            content: description || "Rated this food.",
            author: req.user._id,
            foodOrder: order._id,
            foodProduct: orderedItem.product,
            restaurant: orderedItem.seller || null,
            rating,
            images: imageUrls,
            isVerifiedPurchase: true,
            isApproved: true,
            isDeleted: false,
            parentComment: null
        };

        let review;
        if (existing) {
            Object.assign(existing, reviewData);
            review = await existing.save();
        } else {
            review = await Comment.create(reviewData);
        }

        return res.redirect("/orders/" + order._id + "?review=success");
    } catch (error) {
        if (error.code === 11000) {
            return res.redirect("/orders/" + req.params.orderId + "?review=already-submitted");
        }
        console.error("Food review submission:", error.message);
        return res.status(500).send("Unable to save your review. Please try again.");
    }
});

router.post("/:reviewId/delete", restrictToLoggedInUserOnly, async (req, res) => {
    try {
        if (!validId(req.params.reviewId)) return res.status(400).send("Invalid review.");
        const review = await Comment.findOne({
            _id: req.params.reviewId,
            type: "food_review",
            author: req.user._id,
            isDeleted: false
        });
        if (!review) return res.status(404).send("Review not found.");
        review.isDeleted = true;
        await review.save();
        return res.redirect("/orders/" + review.foodOrder);
    } catch (error) {
        console.error("Food review deletion:", error.message);
        return res.status(500).send("Unable to delete this review.");
    }
});

module.exports = router;
