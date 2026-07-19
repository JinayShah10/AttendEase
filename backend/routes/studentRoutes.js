import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { uploadStudentList, getStudentsByClass, getStudentCount } from '../controllers/studentController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'backend/uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

router.post('/upload', adminOnly, upload.single('file'), uploadStudentList);
router.get('/list', protect, getStudentsByClass);
router.get('/count', protect, getStudentCount);

export default router;
