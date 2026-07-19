import './loadEnv.js';

// Security check: ensure JWT_SECRET is set and not the default value
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'yoursecretkey') {
  console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: JWT_SECRET is not set or is using the insecure default value.');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB } from './db/dbConnect.js';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import fs from 'fs';
import { seedDatabase } from './seed.js';
import mongoose from 'mongoose';

const requiredEnvVars = ['MONGODB_URI', 'PORT', 'JWT_SECRET', 'ALLOWED_ORIGIN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_STORAGE_BUCKET'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Remove X-Powered-By header (Helmet also does this, but this is an extra layer)
app.disable('x-powered-by');

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // React often needs unsafe-inline for dev/builds
        connectSrc: ["'self'", ...(process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ['http://localhost:5173'])],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'no-referrer',
    },
  })
);

// CORS Configuration
const envOrigins = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : [];
const allowedOrigins = [...new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', ...envOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allow cookies to be sent with requests
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Database Connection Middleware
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Service Unavailable: Database connection lost. Please try again later.'
    });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/students', studentRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running correctly' });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./backend/uploads')) {
  fs.mkdirSync('./backend/uploads', { recursive: true });
}

// Serve uploads folder as static
app.use('/uploads', express.static('backend/uploads'));

// Connect to MongoDB and Seed Data
const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
