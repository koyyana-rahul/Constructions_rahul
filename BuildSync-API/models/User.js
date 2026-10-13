import mongoose from "mongoose";
import { Schema } from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true, trim: true},
    email: {type: String, required: true, unique: true, trim: true, lowercase: true},
    password: {type: String, required: true},
    role: {type: String, enum: ["admin", "employee","client"], required: true},
    phone: {type: String, trim: true},
    // Disabled accounts cannot authenticate (authenticate middleware).
    isDisabled: {type: Boolean, default: false, index: true},
    profileImage: {type: String},
    // Invitation workflow: an admin creates the account, the invitee sets
    // their own password via a single-use token. Until then the account holds
    // an unguessable placeholder hash and cannot authenticate.
    isActivated: {type: Boolean, default: true, index: true},
    activationTokenHash: {type: String},
    activationTokenExpiry: {type: Date},
    activatedAt: {type: Date},
    invitedBy: {type: Schema.Types.ObjectId, ref: "User"},
    resetToken: {type: String},
    resetTokenExpiry: {type: Date},
    createAt: {type: Date, default: Date.now},
    updatedAt: {type: Date, default: Date.now},
})

const User = mongoose.model("User", userSchema)
export default User