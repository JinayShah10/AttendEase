import Admin from '../models/Admin.js';
import Faculty from '../models/Faculty.js';
import UploadedFile from '../models/UploadedFile.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import AuditLog from '../models/AuditLog.js';
import { getStudentModel } from '../models/Student.js';
import { notFound, serverError } from '../utils/helpers.js';
import { logAction } from '../utils/auditLogger.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { performDatabaseReset } from '../resetDatabase.js';

/**
 * Builds the $or query for matching uploads to an admin's assigned class.
 * Reused by getFacultyCount and getAdminUploads.
 * Also includes OE uploads (division = 'ALL') for the admin's class year.
 * @param {object} assignedClass - The admin's assignedClass subdocument.
 * @returns {object[]} Array of conditions for $or.
 */
function buildClassMatchQuery(assignedClass) {
  const conditions = [
    { classYear: assignedClass.name },
    { classYear: assignedClass.year, division: assignedClass.division }
  ];

  // Include OE uploads: classYear matches the bare year (e.g. 'SY') and division is 'ALL'
  if (assignedClass.year) {
    conditions.push({ classYear: assignedClass.year, division: 'ALL' });
  }

  return conditions;
}

/**
 * GET /api/admin/faculty-count
 * Returns count of distinct faculty who uploaded files for the admin's class.
 */
export const getFacultyCount = async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId) {
      const count = await Faculty.countDocuments();
      return res.status(200).json({ count });
    }

    const admin = await Admin.findById(adminId);
    if (!admin || !admin.assignedClass) {
      return res.status(200).json({ count: 0 });
    }

    const distinctFaculties = await UploadedFile.distinct('facultyId', {
      $or: buildClassMatchQuery(admin.assignedClass)
    });

    return res.status(200).json({ count: distinctFaculties.length });
  } catch (error) {
    return serverError(res, error, 'Error fetching faculty count');
  }
};

/**
 * GET /api/admin/faculty-all
 * Returns all faculty members, optionally filtered by admin's assigned class.
 */
export const getAllFaculty = async (req, res) => {
  try {
    const { adminId } = req.query;
    let query = {};

    if (adminId) {
      const admin = await Admin.findById(adminId);
      if (admin && admin.assignedClass && admin.assignedClass.year) {
        query = {
          "subjects": {
            $elemMatch: {
              classYear: admin.assignedClass.year,
              division: admin.assignedClass.division
            }
          }
        };
      } else if (admin && admin.assignedClass && admin.assignedClass.name) {
        query = {
          "subjects": {
            $elemMatch: {
              classYear: admin.assignedClass.name
            }
          }
        };
      }
    }

    const faculties = await Faculty.find(query).sort({ name: 1 });
    return res.status(200).json({ faculties });
  } catch (error) {
    return serverError(res, error, 'Error fetching all faculties');
  }
};

/**
 * GET /api/admin/profile/:adminId
 * Returns the admin's profile.
 */
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.adminId);
    if (!admin) {
      return notFound(res, 'Admin not found');
    }

    return res.status(200).json({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      department: admin.department,
      assignedClass: admin.assignedClass
    });
  } catch (error) {
    return serverError(res, error, 'Error fetching admin profile');
  }
};

/**
 * GET /api/admin/:adminId/uploads
 * Returns uploads for the admin's assigned class, including cross-division OE uploads.
 */
export const getAdminUploads = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.adminId);
    if (!admin) {
      return notFound(res, 'Admin not found');
    }

    const assignedClass = admin.assignedClass || null;

    if (!assignedClass || !assignedClass.name) {
      return res.status(200).json({
        uploads: [],
        assignedClass: assignedClass
      });
    }

    const uploads = await UploadedFile.find({
      $or: buildClassMatchQuery(assignedClass)
    })
      .sort({ uploadedAt: -1 })
      .populate('facultyId', 'name email');

    const adminDiv = assignedClass.division;
    const transformedUploads = uploads.map(u => {
      const uObj = u.toObject ? u.toObject() : { ...u };
      if (uObj.division === 'ALL') {
        const processedDivs = uObj.processedDivisions || [];
        uObj.status = processedDivs.includes(adminDiv) ? 'processed' : 'pending';
      }
      return uObj;
    });

    // Fetch student count for the assigned class
    const StudentModel = getStudentModel(assignedClass.division, assignedClass.year);
    const studentCount = await StudentModel.countDocuments();

    return res.status(200).json({
      uploads: transformedUploads,
      assignedClass,
      studentCount
    });
  } catch (error) {
    return serverError(res, error, 'Error fetching admin uploads');
  }
};

/**
 * Archives a collection's documents to a timestamped archive collection
 * before dropping the original. Archives are kept for 30 days via TTL index.
 * @param {string} collectionName - The name of the collection to archive.
 * @returns {number} Number of documents archived.
 */
async function archiveCollection(collectionName) {
  const db = mongoose.connection.db;
  const sourceCollection = db.collection(collectionName);
  const docCount = await sourceCollection.countDocuments();

  if (docCount === 0) return 0;

  const archiveName = `_archive_${collectionName}_${Date.now()}`;
  const archiveCollection = db.collection(archiveName);

  // Copy all documents with an archivedAt timestamp
  const docs = await sourceCollection.find({}).toArray();
  const archivedDocs = docs.map(doc => ({
    ...doc,
    _originalCollection: collectionName,
    _archivedAt: new Date()
  }));

  await archiveCollection.insertMany(archivedDocs);

  // Create a TTL index on _archivedAt so MongoDB auto-deletes after 30 days
  await archiveCollection.createIndex(
    { _archivedAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
  );

  return docCount;
}

/**
 * POST /api/admin/clear-data
 * Authenticates admin, archives data, then clears all student-related data.
 */
export const clearAllStudentData = async (req, res) => {
  try {
    const { email, password, confirmPhrase } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (confirmPhrase !== 'DELETE ALL DATA') {
      return res.status(400).json({ 
        message: 'Invalid confirmation phrase. Please type "DELETE ALL DATA" exactly to proceed.' 
      });
    }

    // Role guard: ensure only admins can perform this action
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can perform this action' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let totalArchived = 0;
    const archivedCollections = [];

    // 1. Archive and clear AttendanceRecord and UploadedFile collections
    const arCount = await archiveCollection('attendancerecords');
    totalArchived += arCount;
    if (arCount > 0) archivedCollections.push(`attendancerecords (${arCount})`);
    await AttendanceRecord.deleteMany({});

    const ufCount = await archiveCollection('uploadedfiles');
    totalArchived += ufCount;
    if (ufCount > 0) archivedCollections.push(`uploadedfiles (${ufCount})`);
    await UploadedFile.deleteMany({});

    // 2. Identify and archive dynamic student collections, then drop them
    const collections = await mongoose.connection.db.listCollections().toArray();
    const studentDataPattern = /^(FE|SE|SY|TE|TY|BE|FY|LY)_?D[1-3]|^(FE|SE|SY|TE|TY|BE|FY|LY)_?ALL/i;
    
    for (const col of collections) {
      const name = col.name;
      const isStudentData = studentDataPattern.test(name);
      const isOEList = name.toUpperCase() === 'SY_OE';
      
      if (isStudentData && !isOEList) {
        const count = await archiveCollection(name);
        totalArchived += count;
        if (count > 0) archivedCollections.push(`${name} (${count})`);
        console.log(`Archived and dropping collection: ${name}`);
        await mongoose.connection.db.dropCollection(name);
      }
      
      if (isOEList) {
        const count = await archiveCollection(name);
        totalArchived += count;
        if (count > 0) archivedCollections.push(`${name} (${count})`);
        console.log(`Archived and dropping master OE list: ${name}`);
        await mongoose.connection.db.dropCollection(name);
      }
    }

    // 3. Audit Log
    await logAction(req, 'CLEAR_ALL_DATA', {
      userId: admin._id,
      userEmail: admin.email,
      message: `Cleared all student data. Archived ${totalArchived} documents across ${archivedCollections.length} collections: [${archivedCollections.join(', ')}]. Archives retained for 30 days.`,
      targetCollection: 'multiple',
      recordCount: totalArchived
    });

    return res.status(200).json({ 
      success: true, 
      message: 'All student-related data has been archived and cleared.',
      archived: {
        totalDocuments: totalArchived,
        collections: archivedCollections,
        retentionDays: 30
      }
    });
  } catch (error) {
    return serverError(res, error, 'Error clearing database');
  }
};

/**
 * GET /api/admin/audit-log
 * Returns audit logs. Restricted to admin users.
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { limit = 50, page = 1, action } = req.query;

    const filter = {};
    if (action) {
      filter.action = action;
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(filter);

    return res.status(200).json({
      logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return serverError(res, error, 'Error fetching audit logs');
  }
};

/**
 * POST /api/admin/reset-database
 * Authenticates admin, then performs standard database reset (clean transactional, sync seed).
 */
export const resetDatabaseApi = async (req, res) => {
  try {
    const { email, password, confirmPhrase } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (confirmPhrase !== 'RESET DATABASE') {
      return res.status(400).json({ 
        message: 'Invalid confirmation phrase. Please type "RESET DATABASE" exactly to proceed.' 
      });
    }

    // Role guard: ensure only admins can perform this action
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can perform this action' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Perform database reset
    const summary = await performDatabaseReset();

    // Clean assigned admin class folder on disk if present
    if (admin.assignedClass && admin.assignedClass.year && admin.assignedClass.division) {
      try {
        const currentYear = new Date().getFullYear();
        const academicSession = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        const targetFolder = `${admin.assignedClass.year}_${admin.assignedClass.division}_${academicSession}`;
        const targetPath = path.join(process.cwd(), 'backend', 'uploads', targetFolder);
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Error removing assigned admin class folder:', err);
      }
    }

    // Audit Log
    await logAction(req, 'RESET_DATABASE', {
      userId: admin._id,
      userEmail: admin.email,
      message: `Database Reset completed: Cleared ${summary.arCount} attendance records, ${summary.ufCount} uploaded files, ${summary.alCount} audit logs, ${summary.rtCount} refresh tokens, and ${summary.studentColsCount || 0} dynamic student collections.`,
      targetCollection: 'multiple',
      recordCount: summary.arCount + summary.ufCount
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Database reset completed successfully. All dynamic student collections were cleared and user accounts were preserved.' 
    });
  } catch (error) {
    return serverError(res, error, 'Error resetting database');
  }
};
