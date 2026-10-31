const express = require("express");
const mongoose = require("mongoose");
const FoodCart = require("../models/FoodCart");
const FoodOrder = require("../models/FoodOrder");
const CustomerAccount = require("../models/CustomerAccount");
const router = express.Router();
const requireUser = (req, res, next) => req.user ? next() : res.redirect("/user/signin?redirect=" + encodeURIComponent(req.originalUrl || "/checkout"));
const ownerKey = req => "user:" + String(req.user._id);

router.get("/checkout", requireUser, async (req, res) => {
  try {
    const cart = await FoodCart.findOne({ ownerKey: ownerKey(req) }).populate("items.product").lean();
    const items = (cart?.items || []).filter(i => i.product && i.product.isAvailable);
    if (!items.length) return res.redirect("/cart");
    const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    res.render("food/checkout", { title: "Checkout | Goan Craving", user: req.user, items, total, error: null });
  } catch (e) { console.error("Checkout:", e); res.status(500).send("Unable to open checkout."); }
});

router.post("/checkout", requireUser, async (req, res) => {
  try {
    const cart = await FoodCart.findOne({ ownerKey: ownerKey(req) }).populate("items.product");
    const items = (cart?.items || []).filter(i => i.product && i.product.isAvailable);
    if (!items.length) return res.redirect("/cart");
    const fields = ["fullName","phone","addressLine","area","city","state","postalCode"];
    const address = {};
    for (const field of fields) address[field] = String(req.body[field] || "").trim().slice(0, 180);
    if (fields.some(f => !address[f])) {
      const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return res.status(400).render("food/checkout", { title: "Checkout | Goan Craving", user: req.user, items, total, error: "Please complete every delivery address field." });
    }
    if (!/^\+?[0-9\s()-]{8,18}$/.test(address.phone) || !/^[0-9]{5,10}$/.test(address.postalCode)) {
      const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return res.status(400).render("food/checkout", { title: "Checkout | Goan Craving", user: req.user, items, total, error: "Enter a valid phone number and postal code." });
    }
    const paymentMethod = String(req.body.paymentMethod || "");
    if (!["cod","upi","card"].includes(paymentMethod)) return res.status(400).send("Select a valid payment method.");
    const orderItems = items.map(i => ({ product: i.product._id, seller: i.product.seller || null, sellerName: i.product.sellerName || "", name: i.product.name, imageURL: i.product.imageURL, unitPrice: i.product.price, quantity: i.quantity }));
    const total = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const order = await FoodOrder.create({ user: req.user._id, items: orderItems, deliveryAddress: address, paymentMethod, paymentStatus: "pending", total });
    cart.items = [];
    await cart.save();
    return res.redirect("/orders/" + order._id);
  } catch (e) { console.error("Place order:", e); res.status(500).send("Unable to place your order."); }
});

router.get("/orders", requireUser, async (req, res) => {
  try { const orders = await FoodOrder.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(); res.render("food/orders", { title: "My Orders | Goan Craving", user: req.user, orders }); }
  catch (e) { console.error("Orders:", e); res.status(500).send("Unable to load orders."); }
});
router.get("/orders/:id", requireUser, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await FoodOrder.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!order) return res.status(404).send("Order not found.");
  res.render("food/order-details", { title: "Order details | Goan Craving", user: req.user, order });
});
module.exports = router;