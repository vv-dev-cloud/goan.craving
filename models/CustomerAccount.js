const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const AddressSchema = new Schema({
  label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 18 },
  addressLine: { type: String, required: true, trim: true, maxlength: 180 },
  area: { type: String, required: true, trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  state: { type: String, required: true, trim: true, maxlength: 80 },
  postalCode: { type: String, required: true, trim: true, maxlength: 10 },
  instructions: { type: String, trim: true, maxlength: 250, default: "" },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const BankAccountSchema = new Schema({
  label: { type: String, trim: true, maxlength: 40, default: "Refund account" },
  accountHolder: { type: String, required: true, trim: true, maxlength: 100 },
  bankName: { type: String, required: true, trim: true, maxlength: 100 },
  encryptedAccountNumber: { type: String, required: true, select: false },
  accountNumberLast4: { type: String, required: true },
  ifsc: { type: String, required: true, uppercase: true, trim: true, maxlength: 11 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const PaymentMethodSchema = new Schema({
  provider: { type: String, required: true, trim: true },
  providerToken: { type: String, required: true, select: false },
  brand: { type: String, required: true, trim: true, maxlength: 30 },
  last4: { type: String, required: true, match: /^\\d{4}$/ },
  expiryMonth: { type: Number, min: 1, max: 12 },
  expiryYear: { type: Number, min: 2025, max: 2100 },
  label: { type: String, trim: true, maxlength: 40, default: "Card" },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const CustomerAccountSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "user", required: true, unique: true, index: true },
  addresses: { type: [AddressSchema], default: [] },
  bankAccounts: { type: [BankAccountSchema], default: [] },
  paymentMethods: { type: [PaymentMethodSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.models.CustomerAccount || model("CustomerAccount", CustomerAccountSchema);
