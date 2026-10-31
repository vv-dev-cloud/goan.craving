const express = require("express");
const router = express.Router();
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");
const User = require("../models/user");
const FoodProduct = require("../models/FoodProduct");
const cloudinaryUpload = require("../middlewares/CloudinaryUploads");
const imageUpload = cloudinaryUpload.mediaUpload;

router.use(restrictToLoggedInUserOnly);

function sellerReady(user) { return Boolean(user?.sellerProfile?.showName); }
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
    if (!fullName || !showName) return renderRegister(res, req.user, "Enter your full name and seller display name.");
    if (fullName.length < 2 || showName.length < 2) return renderRegister(res, req.user, "Names must be at least 2 characters.");
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect("/user/signin");
    user.sellerProfile = { fullName, showName, registeredAt: new Date(), isActive: true };
    await user.save();
    return res.redirect("/seller/dashboard");
  } catch (error) {
    console.error("Seller registration:", error.message);
    return renderRegister(res, req.user, "Seller registration could not be completed. Please try again.");
  }
});

router.get("/dashboard", async (req, res) => {
  if (!sellerReady(req.user)) return res.redirect("/seller/register");
  try {
    const products = await FoodProduct.find({ seller: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.render("seller/dashboard", { title: "Seller Dashboard | Goan Craving", user: req.user, products });
  } catch (error) {
    console.error("Seller dashboard:", error.message);
    return res.status(500).send("Unable to load seller dashboard.");
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
