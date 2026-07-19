import { body, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Standardised error response middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));
    return res.status(400).json({ errors: formattedErrors });
  }
  next();
};

// POST /api/auth/login — only check presence, not strength (existing users may have short passwords)
export const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required')
];

// POST /api/auth/register
export const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
];

// POST /api/upload
export const uploadValidation = [
  body('subjectName').notEmpty().withMessage('Subject Name is required'),
  body('classYear').notEmpty().withMessage('Class Year is required'),
  body('division').notEmpty().withMessage('Division is required'),
  body('lectureType')
    .notEmpty().withMessage('Lecture Type is required')
    .isIn([
      'theory', 'lab', 'oe', 'Theory', 'Lab', 'OE Theory', 'OE Lab',
      'oe theory', 'oe lab', 'DE Theory', 'DE Lab', 'de theory', 'de lab',
      'PE Theory', 'PE Lab', 'pe theory', 'pe lab'
    ]).withMessage("Lecture Type must be one of 'Theory', 'Lab', 'OE Theory', 'OE Lab', 'DE Theory', 'DE Lab', 'PE Theory', 'PE Lab'")
];

// Any route with :id or :facultyId param
export const paramIdValidation = [
  param(['id', 'facultyId']).optional().custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid ID format');
    }
    return true;
  })
];
