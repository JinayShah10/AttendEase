import express from 'express';
import { register, login, refresh, logout, getFacultyProfile, updateProfile, changePassword, forgotPassword, deleteAccount } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation, paramIdValidation, handleValidationErrors } from '../middleware/validatorMiddleware.js';

const router = express.Router();

router.post('/register', registerValidation, handleValidationErrors, register);
router.post('/login', loginValidation, handleValidationErrors, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/profile/faculty/:id', paramIdValidation, handleValidationErrors, getFacultyProfile);
router.put('/profile', protect, updateProfile);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);
router.delete('/delete-account', protect, deleteAccount);

export default router;
