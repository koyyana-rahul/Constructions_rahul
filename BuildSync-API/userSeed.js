import dotenv from "dotenv";
dotenv.config({ quiet: true });

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./models/User.js";
import connectToDatabase from "./db/db.js";
import { bcryptSaltRounds } from "./config/security.js";

const STRONG_PASSWORD = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

/**
 * Create the first administrator.
 *
 * Idempotent: running it again after the account exists is a successful no-op
 * and never resets a password. That means `npm run seed` is safe in a deploy
 * script on every release instead of failing with a duplicate-key error.
 */
const userRegister = async () => {
  try {
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const name = String(process.env.ADMIN_NAME || "").trim();
    const password = String(process.env.ADMIN_PASSWORD || "");

    if (!name || !email) {
      throw new Error("ADMIN_NAME and ADMIN_EMAIL are required to create the first administrator");
    }

    await connectToDatabase();

    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await User.findOne({
      email: { $regex: new RegExp(`^${escaped}$`, "i") },
    });

    if (existing) {
      if (existing.role !== "admin") {
        throw new Error(
          `The configured ADMIN_EMAIL already belongs to a ${existing.role} account. Choose a different address.`
        );
      }
      console.log(`✅ Administrator already exists: ${existing.email} (no changes made)`);
      return;
    }

    if (!STRONG_PASSWORD.test(password)) {
      throw new Error(
        "ADMIN_PASSWORD must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number and one special character"
      );
    }

    const hashPassword = await bcrypt.hash(password, bcryptSaltRounds());
    const newUser = new User({
      name,
      email,
      password: hashPassword,
      role: "admin",
      isActivated: true,
      activatedAt: new Date(),
    });

    await newUser.save();
    console.log(`✅ Administrator created: ${newUser.email}`);
  } catch (error) {
    console.error("❌ Error creating administrator:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close().catch(() => {});
      console.log("🔒 Database connection closed.");
    }
  }
};

userRegister();
