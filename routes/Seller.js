const express = require("express");
const router = express.Router();
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");
const User = require("../models/user");
const FoodProduct = require("../models/FoodProduct");
const FoodOrder = require("../models/FoodOrder");
const cloudinaryUpload = require("../middlewares/CloudinaryUploads");
const imageUpload = cloudinaryUpload.mediaUpload;

router.use(restrictToLoggedInUserOnly);

function sellerReady(user) { return Boolean(user?.sellerProfile?.showName && user?.sellerProfile?.restaurantName && user?.sellerProfile?.city); }
function renderRegister(res, user, error = null) {
  return res.status(error ? 400 : 200).render("seller/register", { title: "Register as a Seller | Goan Craving", user, error });
}

router.get("/register", (req, res) => {
  if (sellerReady(req.user)) return res.redirect("/seller/dashboard");
  return renderRegister(res, req.user);
});

router.post("/register", async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim().slice(0, 100);
    const showName = String(req.body.showName || "").trim().slice(0, 80);
    const restaurantName = String(req.body.restaurantName || "").trim().slice(0, 120);
    const city = String(req.body.city || "").trim().slice(0, 100);
    const address = String(req.body.address || "").trim().slice(0, 240);
    const latitude = req.body.latitude === "" ? undefined : Number(req.body.latitude);
    const longitude = req.body.longitude === "" ? undefined : Number(req.body.longitude);
    if (!fullName || !showName || !restaurantName || !city || !address) return renderRegister(res, req.user, "Complete your seller name, restaurant name, city and exact address.");
    if ([fullName, showName, restaurantName, city].some(value => value.length < 2)) return renderRegister(res, req.user, "Names and city must be at least 2 characters.");
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return renderRegister(res, req.user, "Location coordinates are invalid.");
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect("/user/signin");
    user.sellerProfile = { ...(user.sellerProfile?.toObject?.() || user.sellerProfile || {}), fullName, showName, restaurantName, city, address, latitude, longitude, registeredAt: user.sellerProfile?.registeredAt || new Date(), isActive: true };
    await user.save();
    return res.redirect("/seller/dashboard");
  } catch (error) {
    console.error("Seller registration:", error.message);
    return renderRegister(res, req.user, "Seller registration could not be completed. Please try again.");
  }
});


router.get("/profile", (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  return res.render("seller/profile", { title: "Seller Profile | Goan Craving", user: req.user, error: null, notice: req.query.updated ? "Profile saved." : null });
});
router.post("/profile", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect("/user/signin");
    const fields = ["fullName", "showName", "restaurantName", "city", "address"];
    const values = fields.map((key, i) => String(req.body[key] || "").trim().slice(0, [100,80,120,100,240][i]));
    if (values.some(value => value.length < 2)) return res.status(400).render("seller/profile", { title: "Seller Profile | Goan Craving", user, error: "Complete every field with at least 2 characters.", notice: null });
    const latitude = req.body.latitude === "" || req.body.latitude == null ? undefined : Number(req.body.latitude);
    const longitude = req.body.longitude === "" || req.body.longitude == null ? undefined : Number(req.body.longitude);
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) || ((latitude === undefined) !== (longitude === undefined))) return res.status(400).render("seller/profile", { title: "Seller Profile | Goan Craving", user, error: "Please choose a valid map location.", notice: null });
    [user.sellerProfile.fullName,user.sellerProfile.showName,user.sellerProfile.restaurantName,user.sellerProfile.city,user.sellerProfile.address] = values;
    user.sellerProfile.latitude = latitude;
    user.sellerProfile.longitude = longitude;
    await user.save();
    return res.redirect("/seller/profile?updated=1");
  } catch (error) {
    console.error("Seller profile update:", error.message);
    return res.status(500).send("Unable to update seller profile.");
  }
});
router.post("/profile/remove-location", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const user = await User.findById(req.user._id);
    user.sellerProfile.city = "";
    user.sellerProfile.address = "";
    user.sellerProfile.latitude = undefined;
    user.sellerProfile.longitude = undefined;
    await user.save();
    return res.redirect("/seller/register");
  } catch (error) {
    console.error("Seller location removal:", error.message);
    return res.status(500).send("Unable to remove restaurant location.");
  }
});
router.get("/settings", (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  return res.redirect("/seller/profile#settings");
});

router.get("/dashboard", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const products = await FoodProduct.find({ seller: req.user._id }).sort({ createdAt: -1 }).lean();
    const records = await FoodOrder.find({ "items.seller": req.user._id }).sort({ createdAt: -1 }).lean();
    const sellerOrders = records.map(order => ({ ...order, items: order.items.filter(item => String(item.seller) === String(req.user._id)) })).filter(order => order.items.length);
    const activeOrders = sellerOrders.filter(order => order.orderStatus !== "cancelled");
    const unitsSold = activeOrders.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0), 0);
    const salesTotal = activeOrders.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.unitPrice * item.quantity, 0), 0);
    const itemSales = products.map(product => {
      const matching = activeOrders.flatMap(order => order.items).filter(item => String(item.product) === String(product._id));
      const productOrders = activeOrders.filter(order => order.items.some(item => String(item.product) === String(product._id)));
      return { name: product.name, orders: productOrders.length, units: matching.reduce((sum, item) => sum + item.quantity, 0), total: matching.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) };
    });
    return res.render("seller/dashboard", { title: "Seller Dashboard | Goan Craving", user: req.user, products, sellerOrderCount: sellerOrders.length, unitsSold, salesTotal, itemSales });
  } catch (error) {
    console.error("Seller dashboard:", error.message);
    return res.status(500).send("Unable to load seller dashboard.");
  }
});

router.get("/orders", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const records = await FoodOrder.find({ "items.seller": req.user._id }).sort({ createdAt: -1 }).lean();
    const orders = records.map(order => ({ ...order, items: order.items.filter(item => String(item.seller) === String(req.user._id)) })).filter(order => order.items.length);
    return res.render("seller/orders", { title: "Seller Orders | Goan Craving", user: req.user, orders });
  } catch (error) {
    console.error("Seller orders:", error.message);
    return res.status(500).send("Unable to load seller orders.");
  }
});

router.get("/products/new", (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  return res.render("seller/food-form", { title: "Add Food | Goan Craving", user: req.user, product: null, error: null });
});

router.post("/products", imageUpload.single("foodImage"), async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const name = String(req.body.name || "").trim().slice(0, 120);
    const description = String(req.body.description || "").trim().slice(0, 2000);
    const category = String(req.body.category || "Goan favourites").trim().slice(0, 80);
    const price = Number(req.body.price);
    if (name.length < 2 || !Number.isFinite(price) || price <= 0) {
      return res.status(400).render("seller/food-form", { title: "Add Food | Goan Craving", user: req.user, product: req.body, error: "Enter a food name and a price greater than zero." });
    }
    let imageURL = String(req.body.imageURL || "").trim();
    if (req.file) {
      if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) return res.status(400).render("seller/food-form", { title: "Add Food | Goan Craving", user: req.user, product: req.body, error: "Please upload an image file." });
      const uploaded = await cloudinaryUpload.uploadBuffer(req.file.buffer, { folder: "goan_craving_food", resource_type: "image", transformation: [{ width: 1400, height: 1400, crop: "limit" }] });
      imageURL = uploaded.secure_url;
    }
    if (!imageURL) return res.status(400).render("seller/food-form", { title: "Add Food | Goan Craving", user: req.user, product: req.body, error: "Upload a food photo or provide an image URL." });
    await FoodProduct.create({ name, description, category, price, imageURL, seller: req.user._id, sellerName: req.user.sellerProfile.showName, isAvailable: req.body.isAvailable === "on" });
    return res.redirect("/seller/dashboard");
  } catch (error) {
    console.error("Seller food create:", error.message);
    return res.status(500).render("seller/food-form", { title: "Add Food | Goan Craving", user: req.user, product: req.body, error: "Could not publish this food item. Please try again." });
  }
});

router.post("/products/:id/delete", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    await FoodProduct.deleteOne({ _id: req.params.id, seller: req.user._id });
    return res.redirect("/seller/dashboard");
  } catch (error) {
    console.error("Seller food delete:", error.message);
    return res.status(500).send("Unable to delete this food item.");
  }
});

module.exports = router;
