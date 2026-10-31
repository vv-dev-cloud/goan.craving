const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const FoodProduct = require("../models/FoodProduct");
const FoodCart = require("../models/FoodCart");
const router = express.Router();

const starterMenu = [
  { name: "Chicken Cafreal", category: "Goan classics", description: "Goan-style chicken marinated with green herbs, spices and citrus.", price: 249, imageURL: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80", ingredients: ["Chicken", "Coriander", "Green chilli", "Citrus", "Spices"] },
  { name: "Goan Fish Curry Rice", category: "Coastal favourites", description: "A coastal favourite with tangy coconut fish curry and steamed rice.", price: 199, imageURL: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80", ingredients: ["Fish", "Coconut", "Kokum", "Rice", "Spices"] },
  { name: "Chicken Xacuti", category: "Goan classics", description: "A rich Goan curry with roasted spices and coconut.", price: 269, imageURL: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80", ingredients: ["Chicken", "Coconut", "Roasted spices"] },
  { name: "Prawn Balchao", category: "Coastal favourites", description: "Tangy, spicy Goan prawns inspired by a traditional coastal pickle.", price: 299, imageURL: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80", ingredients: ["Prawns", "Vinegar", "Chilli", "Spices"] },
  { name: "Bebinca", category: "Sweet cravings", description: "Traditional layered Goan dessert with a soft caramelised finish.", price: 99, imageURL: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80", ingredients: ["Coconut milk", "Egg", "Sugar", "Ghee"] }
];

async function ensureStarterMenu() {
  if (await FoodProduct.estimatedDocumentCount() === 0) {
    try { await FoodProduct.insertMany(starterMenu, { ordered: false }); }
    catch (error) { if (error.code !== 11000) console.error("Starter menu seed:", error.message); }
  }
}
function ownerKey(req) {
  if (req.user?._id) return "user:" + String(req.user._id);
  let key = req.cookies?.gc_cart_key;
  if (!key || !/^[a-f0-9-]{36}$/i.test(key)) {
    key = crypto.randomUUID();
    req.res.cookie("gc_cart_key", key, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: 1000 * 60 * 60 * 24 * 90 });
  }
  return "guest:" + key;
}
async function loadCart(req) {
  const cart = await FoodCart.findOne({ ownerKey: ownerKey(req) }).populate("items.product").lean();
  const items = (cart?.items || []).filter(item => item.product && item.product.isAvailable);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  return { items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) };
}
async function getOrCreateCart(req) {
  return FoodCart.findOneAndUpdate({ ownerKey: ownerKey(req) }, { $setOnInsert: { ownerKey: ownerKey(req), items: [] } }, { upsert: true, new: true });
}

router.get("/search", async (req, res) => {
  try {
    await ensureStarterMenu();
    const search = String(req.query.q || "").trim().slice(0, 100);
    const query = { isAvailable: true };
    if (search) query.$or = [
      { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { category: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    ];
    const products = await FoodProduct.find(query).sort({ name: 1 }).limit(60).lean();
    const cart = await loadCart(req);
    res.render("food/search-results", { title: "Search food | Goan Craving", user: req.user || null, search, products, cartCount: cart.count });
  } catch (error) { console.error("Food search:", error); res.status(500).send("Unable to search food right now."); }
});

router.get("/products/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send("Food item not found");
    const product = await FoodProduct.findOne({ _id: req.params.id, isAvailable: true }).lean();
    if (!product) return res.status(404).send("Food item not found");
    const cart = await loadCart(req);
    res.render("food/product-details", { title: product.name + " | Goan Craving", user: req.user || null, product, cartCount: cart.count });
  } catch (error) { console.error("Food details:", error); res.status(500).send("Unable to load this food item."); }
});

router.get("/cart", async (req, res) => {
  try {
    const cart = await loadCart(req);
    res.render("food/cart", { title: "Your cart | Goan Craving", user: req.user || null, ...cart });
  } catch (error) { console.error("Food cart:", error); res.status(500).send("Unable to load your cart."); }
});

router.post("/cart/add", async (req, res) => {
  try {
    const id = String(req.body.productId || "");
    const quantity = Math.max(1, Math.min(99, parseInt(req.body.quantity, 10) || 1));
    if (!mongoose.isValidObjectId(id)) return res.status(400).send("Invalid food item.");
    const product = await FoodProduct.findOne({ _id: id, isAvailable: true }).select("_id");
    if (!product) return res.status(404).send("Food item is unavailable.");
    const cart = await getOrCreateCart(req);
    const existing = cart.items.find(item => String(item.product) === id);
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else cart.items.push({ product: product._id, quantity });
    await cart.save();
    return res.redirect(req.body.buyNow === "1" ? "/cart" : "/cart?added=1");
  } catch (error) { console.error("Add food to cart:", error); res.status(500).send("Unable to add this item to your cart."); }
});

router.post("/cart/update", async (req, res) => {
  try {
    const id = String(req.body.productId || "");
    const quantity = parseInt(req.body.quantity, 10);
    const cart = await getOrCreateCart(req);
    const item = cart.items.find(row => String(row.product) === id);
    if (item) {
      if (!Number.isFinite(quantity) || quantity < 1) cart.items = cart.items.filter(row => String(row.product) !== id);
      else item.quantity = Math.min(99, quantity);
      await cart.save();
    }
    res.redirect("/cart");
  } catch (error) { console.error("Update cart:", error); res.status(500).send("Unable to update cart."); }
});

router.post("/cart/remove", async (req, res) => {
  try {
    const cart = await getOrCreateCart(req);
    cart.items = cart.items.filter(row => String(row.product) !== String(req.body.productId || ""));
    await cart.save();
    res.redirect("/cart");
  } catch (error) { console.error("Remove cart item:", error); res.status(500).send("Unable to remove item."); }
});

module.exports = router;
