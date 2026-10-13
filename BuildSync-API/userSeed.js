import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcrypt';
import connectToDatabase from './db/db.js';

const userRegister = async () => {
    await connectToDatabase();
    try {
        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_NAME) {
            throw new Error("Missing required environment variables for admin creation");
        }

        const hashPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        const newUser = new User({
            name: process.env.ADMIN_NAME,
            email: process.env.ADMIN_EMAIL,
            password: hashPassword,
            role: "admin"
        });

        await newUser.save();
        console.log("✅ Admin user created successfully!");
    } catch (error) {
        console.error("❌ Error creating admin:", error);
    } finally {
        await mongoose.connection.close();
        console.log("🔒 Database connection closed.");
    }
};

userRegister();
