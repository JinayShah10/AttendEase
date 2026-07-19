import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sanitize from 'sanitize-filename';
import Faculty from '../models/Faculty.js';
import UploadedFile from '../models/UploadedFile.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import OpenElective, { getOpenElectiveModel } from '../models/OpenElective.js';
import Subject from '../models/Subject.js';
import ProgramElective from '../models/ProgramElective.js';
import { getStudentModel } from '../models/Student.js';
import { notFound, serverError } from '../utils/helpers.js';
import { logAction } from '../utils/auditLogger.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';

/**
 * Malware Scanner Hook (mock implementation).
 * Replace with ClamAV or VirusTotal integration for production.
 */
async function scanFileForMalware(buffer) {
  await new Promise(resolve => setTimeout(resolve, 50));
  const content = buffer.toString('utf8');
  if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
    throw new Error('Malware detected by scan engine.');
  }
  return true;
}

/**
 * POST /api/upload
 * Handles file upload with MIME validation, malware scanning, and sanitized filenames.
 */
export const createUpload = async (req, res) => {
  let storedFileName = null;

  try {
    const { subjectName, subjectCode, classYear, division, lectureType, facultyId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const buffer = req.file.buffer;

    // 1. Basic format validation (Multer handles most of this via fileFilter)
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Additional check for binary integrity in CSVs
    if (ext === '.csv') {
      if (buffer.includes(0x00)) {
        return res.status(400).json({ message: 'Invalid CSV format. Binary data detected.' });
      }
    }

    // 2. Malware Scan Hook
    try {
      await scanFileForMalware(buffer);
    } catch (scanErr) {
      console.warn(`[SECURITY] Malware scan failed for upload: ${scanErr.message}`);
      return res.status(403).json({ message: 'Upload rejected: File failed security scan.' });
    }

    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return notFound(res, 'Faculty not found');
    }

    // Check if this is an optional multi-division subject (OE, DE, PE)
    const normalizedType = (lectureType || '').toLowerCase();
    const cleanSubName = (subjectName || '').trim();

    const isPE = normalizedType.startsWith('pe') ||
      (await ProgramElective.exists({ subjectName: { $regex: new RegExp(`^${cleanSubName}$`, 'i') } }));

    const isDE = normalizedType.startsWith('de') ||
      (await Subject.exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') }, electiveCategory: 'DEPARTMENT_ELECTIVE' }));

    const isOESubject = normalizedType.startsWith('oe') ||
      (await getOpenElectiveModel(classYear).exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') } })) ||
      (await Subject.exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') }, isOE: true }));

    const isMultiDivOptional = isOESubject || isDE || isPE;

    let uploadDivision = division;
    let uploadClassYear = classYear;

    if (isMultiDivOptional) {
      uploadDivision = 'ALL';
      uploadClassYear = String(classYear).trim().split(/\s+/)[0];

      const DIVISIONS = ['D1', 'D2', 'D3'];
      let studentCount = 0;
      for (const div of DIVISIONS) {
        const Model = getStudentModel(div, uploadClassYear);
        studentCount += await Model.countDocuments();
      }

      if (studentCount === 0) {
        return res.status(400).json({ message: `Master Student Lists for ${uploadClassYear} have not been initialized.` });
      }
    } else {
      const Model = getStudentModel(uploadDivision, uploadClassYear);
      const studentCount = await Model.countDocuments();

      if (studentCount === 0) {
        return res.status(400).json({ message: `Master Student List for ${uploadClassYear} ${uploadDivision} has not been initialized.` });
      }
    }

    // Check for existing active upload for Core / Honours subjects (bypassed for multi-div optional OE/DE/PE)
    if (!isMultiDivOptional) {
      const existingUpload = await UploadedFile.findOne({
        facultyId,
        subjectName,
        classYear: uploadClassYear,
        division: uploadDivision,
        lectureType,
        status: { $in: ['pending', 'processed'] }
      });

      if (existingUpload) {
        return res.status(400).json({
          message: 'An upload already exists for this subject and class. Please delete the previous upload before uploading a new file.'
        });
      }
    }

    // 3. Sanitise Filename and Generate UUID-based stored name
    const cleanOriginalName = sanitize(req.file.originalname);
    const folder = ext === '.pdf' ? 'pdf' : 'excel';
    storedFileName = `${folder}/${uuidv4()}_${cleanOriginalName}`;

    // Extract batch (e.g. B1, B2) from original name
    const batchMatch = cleanOriginalName.match(/B(\d+)/i);
    const uploadBatch = batchMatch ? batchMatch[0].toUpperCase() : '';

    // 4. Upload buffer to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storedFileName, buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('[SUPABASE UPLOAD ERROR]', uploadError);
      return res.status(500).json({ message: 'Failed to upload file to storage: ' + uploadError.message });
    }

    // 5. Save to Database
    const newUpload = new UploadedFile({
      facultyId,
      facultyName: faculty.name,
      subjectName,
      subjectCode: subjectCode || '',
      classYear: uploadClassYear,
      division: uploadDivision,
      lectureType,
      batch: uploadBatch,
      originalFileName: cleanOriginalName,
      storedFilePath: storedFileName,
      uploadedAt: Date.now(),
      status: 'pending'
    });

    const savedUpload = await newUpload.save();
    return res.status(201).json(savedUpload);

  } catch (error) {
    // Clean up file if it was uploaded before the error
    if (storedFileName) {
      try {
        await supabase.storage.from(BUCKET_NAME).remove([storedFileName]);
      } catch (cleanupErr) {
        console.error('Error cleaning up file from Supabase Storage:', cleanupErr);
      }
    }
    if (error.message === 'Only Excel and CSV files are allowed' || error.message === 'Only Excel, CSV and PDF files are allowed') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error, 'Upload Error');
  }
};

/**
 * GET /api/upload
 * Returns all uploaded files, sorted newest first.
 */
export const getAllUploads = async (req, res) => {
  try {
    const files = await UploadedFile.find()
      .sort({ uploadedAt: -1 })
      .populate('facultyId', 'name email');
    return res.status(200).json(files);
  } catch (error) {
    return serverError(res, error, 'Fetch Uploads Error');
  }
};

/**
 * GET /api/upload/faculty/:facultyId
 * Returns uploads for a specific faculty member.
 */
export const getUploadsByFaculty = async (req, res) => {
  try {
    const { facultyId } = req.params;
    const files = await UploadedFile.find({ facultyId })
      .sort({ uploadedAt: -1 });
    return res.status(200).json(files);
  } catch (error) {
    return serverError(res, error, 'Fetch Faculty Uploads Error');
  }
};

/**
 * GET /api/upload/download/:id
 * Downloads a specific uploaded file from disk.
 */
export const downloadUpload = async (req, res) => {
  try {
    const file = await UploadedFile.findById(req.params.id);
    if (!file) {
      return notFound(res, 'File not found');
    }

    let buffer;
    let contentType = 'application/octet-stream';

    if (file.storedFilePath && file.storedFilePath.startsWith('backend/uploads/')) {
      const localPath = path.resolve(file.storedFilePath);
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
        if (file.storedFilePath.endsWith('.pdf')) {
          contentType = 'application/pdf';
        } else if (file.storedFilePath.endsWith('.xlsx')) {
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (file.storedFilePath.endsWith('.xls')) {
          contentType = 'application/vnd.ms-excel';
        }
      }
    }

    if (!buffer) {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(file.storedFilePath);

      if (error || !data) {
        console.error('Supabase download error:', error);
        return res.status(404).json({ message: 'File not found in storage' });
      }

      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = data.type || 'application/octet-stream';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalFileName}"`);
    return res.send(buffer);
  } catch (error) {
    return serverError(res, error, 'Download Error');
  }
};

/**
 * DELETE /api/upload/:id
 * Deletes an uploaded file from disk and its associated DB records.
 */
export const deleteUpload = async (req, res) => {
  try {
    const file = await UploadedFile.findById(req.params.id);
    if (!file) {
      return notFound(res, 'File not found');
    }

    // Authorization check
    if (file.facultyId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }

    // Delete from Supabase Storage
    if (file.storedFilePath) {
      try {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([file.storedFilePath]);
        if (deleteError) {
          console.error('Error deleting file from Supabase Storage:', deleteError);
        }
      } catch (err) {
        console.error('Error in Supabase remove operation:', err);
      }
    }

    // Delete associated AttendanceRecord if it exists
    if (file.attendanceRecordId) {
      await AttendanceRecord.findByIdAndDelete(file.attendanceRecordId);
    }

    // Delete the UploadedFile document
    await UploadedFile.findByIdAndDelete(req.params.id);

    // Audit: file deletion
    await logAction(req, 'DELETE_UPLOAD', {
      message: `Deleted upload: ${file.originalFileName} (subject: ${file.subjectName}, class: ${file.classYear})`,
      targetCollection: 'uploadedfiles',
      recordCount: 1
    });

    return res.status(200).json({ message: 'File and associated records deleted successfully' });
  } catch (error) {
    return serverError(res, error, 'Delete Error');
  }
};
