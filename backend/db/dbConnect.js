import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB Connection Error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB Disconnected. API requests may fail until reconnected.');
    });
    
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.error('Please verify your MONGODB_URI and internet connection.');
    process.exit(1);
  }
};
