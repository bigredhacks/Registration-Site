import mongoose from "mongoose";



export const connectDB = async (uri: string) => {

  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${uri}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1); // Exit process on failure
  }
};