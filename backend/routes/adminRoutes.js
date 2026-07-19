import express from 'express';
import { adminOnly } from '../middleware/authMiddleware.js';
import {
  getFacultyCount,
  getAllFaculty,
  getAdminProfile,
  getAdminUploads,
  clearAllStudentData,
  getAuditLogs,
  resetDatabaseApi
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require admin authentication
router.use(adminOnly);

router.get('/faculty-count', getFacultyCount);
router.get('/faculty-all', getAllFaculty);
router.get('/profile/:adminId', getAdminProfile);
router.get('/:adminId/uploads', getAdminUploads);
router.post('/clear-data', clearAllStudentData);
router.post('/reset-database', resetDatabaseApi);
router.get('/audit-log', getAuditLogs);

export default router;
