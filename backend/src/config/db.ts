import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${MONGO_URI}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1); // Exit process on failure
  }
};