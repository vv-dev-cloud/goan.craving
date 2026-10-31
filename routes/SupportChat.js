const express = require("express");
const mongoose = require("mongoose");
const SupportChat = require("../models/SupportChat");
const FoodOrder = require("../models/FoodOrder");
const router = express.Router();

router.use((req, res, next) => req.user ? next() : res.status(401).json({ success: false, message: "Please sign in to contact support." }));

router.post("/start", async (req, res) => {
  try {
    const issue = String(req.body.issue || "Customer requested a human support agent").trim().slice(0, 300);
    const customerId = req.user._id;
    let chat = await SupportChat.findOne({ customerId, status: { $in: ["Waiting", "Active"] } }).sort({ updatedAt: -1 });
    if (!chat) {
      const user = req.user;
      chat = await SupportChat.create({
        customerId,
        customerName: String(user.fullName || user.name || "Customer").slice(0, 160),
        customerEmail: String(user.email || "").slice(0, 254),
        issue,
        status: "Waiting",
        messages: [{ sender: "ai", text: "A support agent has been requested. Please send your message here." }]
      });
    }
    res.json({ success: true, chatId: String(chat._id), status: chat.status, messages: chat.messages });
  } catch (error) {
    console.error("Support chat start failed:", error);
    res.status(500).json({ success: false, message: "Could not create a support request." });
  }
});

router.get("/:chatId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.chatId)) return res.status(404).json({ success: false, message: "Chat not found." });
  const chat = await SupportChat.findOne({ _id: req.params.chatId, customerId: req.user._id }).lean();
  if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });
  res.json({ success: true, chat });
});

router.post("/:chatId/messages", async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 1200);
  if (!text) return res.status(400).json({ success: false, message: "Enter a message." });
  if (!mongoose.isValidObjectId(req.params.chatId)) return res.status(404).json({ success: false, message: "Chat not found." });
  const chat = await SupportChat.findOne({ _id: req.params.chatId, customerId: req.user._id });
  if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });
  if (chat.status === "Resolved") return res.status(409).json({ success: false, message: "This conversation is resolved." });
  chat.messages.push({ sender: "customer", text });
  if (chat.status === "Waiting") chat.status = "Waiting";
  await chat.save();
  res.json({ success: true, chat });
});

module.exports = router;
