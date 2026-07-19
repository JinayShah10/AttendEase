import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect } from '../middleware/authMiddleware.js';
import RefreshToken from '../models/RefreshToken.js';
import jwt from 'jsonwebtoken';
import {
  createUpload,
  getAllUploads,
  getUploadsByFaculty,
  downloadUpload,
  deleteUpload
} from '../controllers/uploadController.js';
import { uploadValidation, paramIdValidation, handleValidationErrors } from '../middleware/validatorMiddleware.js';

const router = express.Router();

// Multer configuration (Memory Storage for pre-upload validation and Supabase upload)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // Basic extension check here, true MIME validation happens in the controller
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only Excel, CSV and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Download-specific auth check supporting Bearer header OR httpOnly refreshToken cookie fallback
const protectDownload = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return protect(req, res, next);
  }

  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const storedToken = await RefreshToken.findOne({ token });
      if (storedToken && storedToken.expiresAt >= new Date()) {
        req.user = { id: storedToken.userId, role: storedToken.userModel.toLowerCase() };
        return next();
      }
    } catch (err) {
      console.error('Download auth cookie verification failed:', err);
    }
  }

  return res.status(401).json({ message: 'Not authorized, token failed' });
};

router.post('/', protect, upload.single('file'), uploadValidation, handleValidationErrors, createUpload);
router.get('/', protect, getAllUploads);
router.get('/faculty/:facultyId', protect, paramIdValidation, handleValidationErrors, getUploadsByFaculty);
router.get('/download/:id', protectDownload, paramIdValidation, handleValidationErrors, downloadUpload);
router.delete('/:id', protect, paramIdValidation, handleValidationErrors, deleteUpload);

export default router;
