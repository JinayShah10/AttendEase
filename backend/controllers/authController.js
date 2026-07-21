import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import Faculty from '../models/Faculty.js';
import Admin from '../models/Admin.js';
import Class from '../models/Class.js';
import RefreshToken from '../models/RefreshToken.js';
import { serverError } from '../utils/helpers.js';
import { logAction } from '../utils/auditLogger.js';

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET is not defined in the environment variables.");
}

// --- Token Helpers ---

/**
 * Generates a short-lived access token (1 hour).
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Generates a cryptographically random refresh token,
 * stores it in MongoDB, and returns the raw string.
 */
async function generateRefreshToken(user) {
  const rawToken = crypto.randomBytes(40).toString('hex');

  const refreshToken = new RefreshToken({
    userId: user._id,
    userModel: user.role === 'admin' ? 'Admin' : 'Faculty',
    token: rawToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });

  await refreshToken.save();
  return rawToken;
}

/**
 * Sets the refresh token as an httpOnly cookie on the response.
 */
function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,       // Not accessible via JavaScript
    secure: true,         // HTTPS only
    sameSite: 'none',     // CSRF protection for cross-site
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/auth'     // Only sent to auth routes
  });
}

// --- Route Handlers ---

/**
 * POST /api/auth/register
 * Registers a new faculty or admin user.
 */
export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, phone, department, role, classId } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser;
    if (role === 'faculty') {
      newUser = new Faculty({
        name,
        email,
        password: hashedPassword,
        phone,
        department,
        role: 'faculty',
        subjects: []
      });
    } else if (role === 'admin') {
      let assignedClass = null;
      if (classId) {
        const classDoc = await Class.findById(classId);
        if (classDoc) {
          // Check if another admin is already assigned to this class
          const existingAdmin = await Admin.findOne({
            $or: [
              { 'assignedClass.classId': classDoc._id },
              { 'assignedClass.year': classDoc.year, 'assignedClass.division': classDoc.division }
            ]
          });

          if (existingAdmin) {
            const adminEmailStr = existingAdmin.email ? ` (${existingAdmin.email})` : '';
            return res.status(409).json({
              message: `An admin has already been assigned to this class.\n\nAssigned Admin: ${existingAdmin.name}${adminEmailStr}`
            });
          }

          assignedClass = {
            classId: classDoc._id,
            name: classDoc.name,
            year: classDoc.year,
            division: classDoc.division
          };
        }
      }
      newUser = new Admin({
        name,
        email,
        password: hashedPassword,
        phone,
        department,
        role: 'admin',
        assignedClass
      });
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await newUser.save();

    // Audit: new user registration
    await logAction(req, 'USER_REGISTERED', {
      userId: newUser._id,
      userEmail: newUser.email,
      message: `New ${role} registered: ${newUser.name} (${newUser.email})`
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    return serverError(res, error, 'Registration Error');
  }
};

/**
 * POST /api/auth/login
 * Authenticates a user, returns a short-lived access token
 * and sets an httpOnly refresh token cookie.
 */
export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    let user = await Faculty.findOne({ email });

    if (!user) {
      user = await Admin.findOne({ email });
    }

    if (!user) {
      // Audit: failed login (unknown email)
      await logAction(req, 'LOGIN_FAILED', {
        userEmail: email,
        message: `Login attempt with unknown email: ${email}`
      });
      return res.status(404).json({ message: 'incorrect username' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Audit: failed login (wrong password)
      await logAction(req, 'LOGIN_FAILED', {
        userId: user._id,
        userEmail: email,
        message: `Failed login attempt for: ${email} (wrong password)`
      });
      return res.status(401).json({ message: 'incorrect password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        department: user.department || '',
        subjects: user.subjects || [],
        assignedClass: user.assignedClass || null
      }
    });

  } catch (error) {
    return serverError(res, error, 'Login Error');
  }
};

/**
 * POST /api/auth/refresh
 * Uses the httpOnly refresh token cookie to issue a new access token.
 */
export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Look up the refresh token in the database
    const storedToken = await RefreshToken.findOne({ token });

    if (!storedToken) {
      return res.status(403).json({ message: 'Refresh token is invalid or has been revoked' });
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      await RefreshToken.findByIdAndDelete(storedToken._id);
      return res.status(403).json({ message: 'Refresh token has expired' });
    }

    // Find the user
    const Model = storedToken.userModel === 'Admin' ? Admin : Faculty;
    const user = await Model.findById(storedToken.userId);

    if (!user) {
      await RefreshToken.findByIdAndDelete(storedToken._id);
      return res.status(403).json({ message: 'User no longer exists' });
    }

    // Token rotation: delete old refresh token and issue a new one
    await RefreshToken.findByIdAndDelete(storedToken._id);
    const newRefreshToken = await generateRefreshToken(user);
    setRefreshCookie(res, newRefreshToken);

    // Issue a new access token
    const accessToken = generateAccessToken(user);

    return res.status(200).json({
      success: true,
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedClass: user.assignedClass || null
      }
    });

  } catch (error) {
    return serverError(res, error, 'Token Refresh Error');
  }
};

/**
 * POST /api/auth/logout
 * Invalidates the refresh token and clears the cookie.
 */
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      // Delete the token from the database to revoke it
      await RefreshToken.findOneAndDelete({ token });
    }

    // Clear the cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth'
    });

    return res.status(200).json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    return serverError(res, error, 'Logout Error');
  }
};

/**
 * GET /api/auth/profile/faculty/:id
 * Returns faculty profile by ID.
 */
export const getFacultyProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id).select('-password');
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    return res.status(200).json(faculty);
  } catch (error) {
    return serverError(res, error, 'Fetch Faculty Profile Error');
  }
};

/**
 * PUT /api/auth/profile
 * Updates user profile details based on role.
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'admin') {
      const admin = await Admin.findById(userId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin profile not found' });
      }
      admin.name = name || admin.name;
      admin.email = email || admin.email;
      await admin.save();
      
      await logAction(req, 'UPDATE_PROFILE', {
        userId,
        userRole: 'admin',
        message: `Admin ${admin.email} updated profile details`
      });

      const adminObj = admin.toObject();
      delete adminObj.password;
      return res.status(200).json(adminObj);
    } else if (role === 'faculty') {
      const faculty = await Faculty.findById(userId);
      if (!faculty) {
        return res.status(404).json({ message: 'Faculty profile not found' });
      }
      faculty.name = name || faculty.name;
      faculty.email = email || faculty.email;
      faculty.phone = phone || faculty.phone;
      await faculty.save();

      await logAction(req, 'UPDATE_PROFILE', {
        userId,
        userRole: 'faculty',
        message: `Faculty ${faculty.email} updated profile details`
      });

      const facultyObj = faculty.toObject();
      delete facultyObj.password;
      return res.status(200).json(facultyObj);
    } else {
      return res.status(400).json({ message: 'Invalid user role' });
    }
  } catch (error) {
    return serverError(res, error, 'Update Profile Error');
  }
};

/**
 * POST /api/auth/change-password
 * Changes the authenticated user's password.
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    let user;
    if (role === 'admin') {
      user = await Admin.findById(userId);
    } else if (role === 'faculty') {
      user = await Faculty.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAction(req, 'CHANGE_PASSWORD', {
      userId,
      userRole: role,
      message: `User ${user.email} changed password`
    });

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return serverError(res, error, 'Change Password Error');
  }
};

/**
 * POST /api/auth/forgot-password
 * Resets user password based on email and role.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email, role, newPassword } = req.body;

    if (!email || !role || !newPassword) {
      return res.status(400).json({ message: 'Email, role, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    let user;
    if (role === 'admin') {
      user = await Admin.findOne({ email });
    } else if (role === 'faculty') {
      user = await Faculty.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ message: 'No user found with this email address' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAction(req, 'RESET_PASSWORD_FORGOT', {
      userId: user._id,
      userRole: role,
      message: `Password reset via forgot password for ${email}`
    });

    return res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    return serverError(res, error, 'Forgot Password Error');
  }
};

/**
 * DELETE /api/auth/delete-account
 * Permanently deletes the currently logged-in user's account.
 */
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    let user = null;
    if (role === 'admin') {
      user = await Admin.findById(userId);
    } else if (role === 'faculty') {
      user = await Faculty.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Permanently delete user document
    if (role === 'admin') {
      await Admin.findByIdAndDelete(userId);
    } else if (role === 'faculty') {
      await Faculty.findByIdAndDelete(userId);
    }

    // Revoke all refresh tokens for this user
    await RefreshToken.deleteMany({ userId });

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth'
    });

    // Log the account deletion
    await logAction(req, 'DELETE_ACCOUNT', {
      userId,
      userEmail: user.email,
      message: `User ${user.email} permanently deleted their account.`
    });

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    return serverError(res, error, 'Delete Account Error');
  }
};
