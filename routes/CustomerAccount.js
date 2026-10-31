const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");
const CustomerAccount = require("../models/CustomerAccount");
const FoodOrder = require("../models/FoodOrder");
const NotificationService = require("../services/notificationService");

const router = express.Router();
router.use(restrictToLoggedInUserOnly);

function encryptionKey() {
  const raw = String(process.env.ACCOUNT_DATA_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try { const decoded = Buffer.from(raw, "base64"); return decoded.length === 32 ? decoded : null; }
  catch (_) { return null; }
}
function encryptAccountNumber(value) {
  const key = encryptionKey();
  if (!key) throw new Error("ACCOUNT_DATA_ENCRYPTION_KEY is not configured as a 32-byte key.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}
function clean(value, max = 180) { return String(value || "").trim().slice(0, max); }
async function accountFor(userId) {
  return CustomerAccount.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
function validAddress(body) {
  const fields = ["fullName", "phone", "addressLine", "area", "city", "state", "postalCode"];
  const address = {};
  for (const field of fields) address[field] = clean(body[field], field === "addressLine" ? 180 : 100);
  address.label = ["Home", "Work", "Other"].includes(body.label) ? body.label : "Home";
  address.instructions = clean(body.instructions, 250);
  if (fields.some(field => !address[field])) return null;
  if (!/^\\+?[0-9\\s()-]{8,18}$/.test(address.phone) || !/^[0-9]{5,10}$/.test(address.postalCode)) return null;
  return address;
}

router.get("/", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const user = { _id: req.user._id, fullName: req.user.fullName, email: req.user.email, profileImageURL: req.user.profileImageURL };
    res.render("food/account", { title: "My Account | Goan Craving", user, account, error: null, success: null });
  } catch (error) {
    console.error("Customer account:", error);
    res.status(500).send("Unable to load your account right now.");
  }
});

router.post("/addresses", async (req, res) => {
  try {
    const address = validAddress(req.body);
    if (!address) return res.status(400).json({ success: false, message: "Complete all address fields and enter a valid phone number and PIN code." });
    const account = await accountFor(req.user._id);
    if (req.body.isDefault === "true" || account.addresses.length === 0) account.addresses.forEach(item => { item.isDefault = false; });
    account.addresses.push({ ...address, isDefault: req.body.isDefault === "true" || account.addresses.length === 0 });
    await account.save();
    res.json({ success: true, message: "Address saved.", address: account.addresses[account.addresses.length - 1] });
  } catch (error) { console.error("Save address:", error); res.status(500).json({ success: false, message: "Unable to save this address." }); }
});

router.put("/addresses/:addressId", async (req, res) => {
  try {
    const address = validAddress(req.body);
    if (!address || !mongoose.isValidObjectId(req.params.addressId)) return res.status(400).json({ success: false, message: "Check the address details and try again." });
    const account = await accountFor(req.user._id);
    const target = account.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ success: false, message: "Address not found." });
    if (req.body.isDefault === "true") account.addresses.forEach(item => { item.isDefault = false; });
    Object.assign(target, address);
    if (req.body.isDefault === "true") target.isDefault = true;
    await account.save();
    res.json({ success: true, message: "Address updated." });
  } catch (error) { console.error("Update address:", error); res.status(500).json({ success: false, message: "Unable to update this address." }); }
});

router.delete("/addresses/:addressId", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const target = account.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ success: false, message: "Address not found." });
    const wasDefault = target.isDefault;
    target.deleteOne();
    if (wasDefault && account.addresses.length) account.addresses[0].isDefault = true;
    await account.save();
    res.json({ success: true, message: "Address removed." });
  } catch (error) { console.error("Delete address:", error); res.status(500).json({ success: false, message: "Unable to remove this address." }); }
});

router.post("/addresses/:addressId/default", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const target = account.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ success: false, message: "Address not found." });
    account.addresses.forEach(item => { item.isDefault = String(item._id) === String(target._id); });
    await account.save();
    res.json({ success: true, message: "Default address updated." });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to set the default address." }); }
});

router.post("/bank-accounts", async (req, res) => {
  try {
    const accountHolder = clean(req.body.accountHolder, 100), bankName = clean(req.body.bankName, 100);
    const accountNumber = clean(req.body.accountNumber, 34).replace(/\\s/g, "");
    const ifsc = clean(req.body.ifsc, 11).toUpperCase();
    if (accountHolder.length < 2 || bankName.length < 2 || !/^[0-9]{6,34}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return res.status(400).json({ success: false, message: "Enter a valid account holder, bank name, account number and IFSC code." });
    const encryptedAccountNumber = encryptAccountNumber(accountNumber);
    const account = await accountFor(req.user._id);
    account.bankAccounts.push({ label: clean(req.body.label, 40) || "Refund account", accountHolder, bankName, encryptedAccountNumber, accountNumberLast4: accountNumber.slice(-4), ifsc });
    await account.save();
    res.json({ success: true, message: "Refund bank account saved securely." });
  } catch (error) {
    console.error("Save refund bank account:", error);
    res.status(error.message.includes("ENCRYPTION_KEY") ? 503 : 500).json({ success: false, message: error.message.includes("ENCRYPTION_KEY") ? error.message : "Unable to save bank details." });
  }
});

router.delete("/bank-accounts/:bankId", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const target = account.bankAccounts.id(req.params.bankId);
    if (!target) return res.status(404).json({ success: false, message: "Bank account not found." });
    target.deleteOne();
    await account.save();
    res.json({ success: true, message: "Refund bank account removed." });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to remove bank details." }); }
});

router.put("/payment-methods/:paymentId", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const method = account.paymentMethods.id(req.params.paymentId);
    if (!method) return res.status(404).json({ success: false, message: "Saved payment method not found." });
    method.label = clean(req.body.label, 40) || "Card";
    await account.save();
    res.json({ success: true, message: "Payment method label updated." });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to update this payment method." }); }
});

router.delete("/payment-methods/:paymentId", async (req, res) => {
  try {
    const account = await accountFor(req.user._id);
    const method = account.paymentMethods.id(req.params.paymentId);
    if (!method) return res.status(404).json({ success: false, message: "Saved payment method not found." });
    method.deleteOne();
    await account.save();
    res.json({ success: true, message: "Payment method removed." });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to remove this payment method." }); }
});

router.post("/orders/:orderId/cancel", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(404).json({ success: false, message: "Order not found." });
    const order = await FoodOrder.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (!["placed", "confirmed"].includes(order.orderStatus)) return res.status(409).json({ success: false, message: "This order can no longer be cancelled online. Please contact support." });
    order.orderStatus = "cancelled";
    if (order.paymentStatus === "paid") {
      order.refundStatus = "requested";
      order.refundRequestedAt = new Date();
      order.refundAmount = order.total;
      order.refundNote = "Cancellation refund requires payment-provider or admin processing.";
    }
    await order.save();
    await NotificationService.createNotification(req.user._id, "order_status", { title: "Order cancelled", message: order.paymentStatus === "paid" ? "Your order was cancelled. A refund request has been recorded for processing." : "Your order was cancelled successfully.", order: order._id, url: `/orders/${order._id}`, pushTitle: "Goan Craving · Order cancelled", pushMessage: `Your order #${String(order._id).slice(-6)} was cancelled.` });
    if (order.paymentStatus === "paid") await NotificationService.createNotification(req.user._id, "refund", { title: "Refund requested", message: `Your refund request for order #${String(order._id).slice(-6)} is recorded.`, order: order._id, url: `/orders/${order._id}`, pushTitle: "Goan Craving · Refund requested", pushMessage: "Your refund request has been recorded." });
    res.json({ success: true, message: order.paymentStatus === "paid" ? "Order cancelled. Your refund request is recorded for processing." : "Order cancelled successfully.", refundStatus: order.refundStatus || "not_required" });
  } catch (error) { console.error("Cancel customer order:", error); res.status(500).json({ success: false, message: "Unable to cancel this order." }); }
});

module.exports = router;
