const express = require("express");
const mongoose = require("mongoose");
const FoodOrder = require("../models/FoodOrder");

const router = express.Router();
const auth = (req, res, next) => req.user ? next() : res.status(401).json({ success: false, message: "Please sign in to use order support." });
router.use(auth);

const publicOrder = order => ({
  id: String(order._id),
  reference: String(order._id).slice(-7).toUpperCase(),
  status: order.orderStatus,
  createdAt: order.createdAt,
  estimatedDelivery: order.estimatedDelivery || order.deliveryEstimate || null,
  items: (order.items || []).map(item => ({ name: item.name, quantity: item.quantity })),
  total: order.total,
  paymentStatus: order.paymentStatus
});

router.get("/orders", async (req, res) => {
  try {
    const orders = await FoodOrder.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20)
      .select("_id orderStatus createdAt estimatedDelivery deliveryEstimate items.name items.quantity total paymentStatus").lean();
    res.json({ success: true, orders: orders.map(publicOrder) });
  } catch (error) {
    console.error("Support agent orders:", error);
    res.status(500).json({ success: false, message: "Unable to load your orders right now." });
  }
});

router.post("/cancel/:orderId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(404).json({ success: false, message: "Order not found." });
    const order = await FoodOrder.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (!["placed", "confirmed"].includes(order.orderStatus)) {
      return res.status(409).json({ success: false, message: "This order can no longer be cancelled from chat.", status: order.orderStatus });
    }
    order.orderStatus = "cancelled";
    await order.save();
    res.json({ success: true, message: "Your order has been cancelled.", order: publicOrder(order) });
  } catch (error) {
    console.error("Support agent cancellation:", error);
    res.status(500).json({ success: false, message: "Unable to cancel this order right now." });
  }
});

router.post("/message", async (req, res) => {
  const message = String(req.body.message || "").trim().slice(0, 1200);
  if (!message) return res.status(400).json({ success: false, message: "Enter a message." });
  try {
    const lower = message.toLowerCase();
    if (/\b(cancel|cancellation)\b/.test(lower)) {
      const orders = await FoodOrder.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10)
        .select("_id orderStatus createdAt items.name items.quantity total paymentStatus").lean();
      const eligible = orders.filter(o => ["placed", "confirmed"].includes(o.orderStatus));
      return res.json({ success: true, reply: eligible.length
        ? "I can help with cancellation. Select an order below; I’ll ask you to confirm before cancelling it."
        : "I couldn't find an order that is currently eligible for cancellation. Orders that are being prepared or delivered usually can't be cancelled here.",
        orders: eligible.map(publicOrder), action: "select-cancel-order" });
    }
    if (/\b(delivery|arriv|when.*order|eta|how long)\b/.test(lower)) {
      const orders = await FoodOrder.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10)
        .select("_id orderStatus createdAt estimatedDelivery deliveryEstimate items.name items.quantity total paymentStatus").lean();
      if (!orders.length) return res.json({ success: true, reply: "I couldn't find an order on your account yet." });
      const order = orders[0], estimate = order.estimatedDelivery || order.deliveryEstimate;
      return res.json({ success: true, reply: estimate
        ? "Your latest order's delivery estimate is " + new Date(estimate).toLocaleString("en-IN") + "."
        : "I can see your latest order, but a delivery estimate hasn't been provided yet. Your current order status is " + String(order.orderStatus).replace(/_/g, " ") + ".",
        orders: [publicOrder(order)] });
    }
    if (/\b(status|where.*order|track|my order)\b/.test(lower)) {
      const orders = await FoodOrder.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10)
        .select("_id orderStatus createdAt estimatedDelivery deliveryEstimate items.name items.quantity total paymentStatus").lean();
      return res.json({ success: true, reply: orders.length ? "Here are your recent orders and their current statuses." : "I couldn't find an order on your account yet.", orders: orders.map(publicOrder) });
    }

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch(process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are Goan Craving's concise, friendly customer support agent. Help with food delivery orders. Never invent order status, delivery estimates, refunds, or completed actions. For account-specific order data, ask the user to use the order buttons. You cannot perform actions directly. For unrelated requests, politely redirect to order support." },
            { role: "user", content: message }
          ],
          temperature: 0.2,
          max_tokens: 250
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "AI provider request failed");
      return res.json({ success: true, reply: data.choices?.[0]?.message?.content || "Sorry, I couldn't answer that. Please choose an order support option." });
    }
    return res.json({ success: true, reply: "I can help with order status, cancellation, and delivery estimates. Please choose one of the support options above, or ask me about one of your orders." });
  } catch (error) {
    console.error("Support agent message:", error.message);
    res.status(502).json({ success: false, message: "The support agent is temporarily unavailable. Please try again." });
  }
});

module.exports = router;
