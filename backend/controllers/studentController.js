import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { getStudentModel } from '../models/Student.js';
import { serverError } from '../utils/helpers.js';

export const uploadStudentList = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { classYear, division: targetDivision } = req.body;
    if (!classYear || !targetDivision) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, message: 'classYear and division are required' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Use header: 1 to get array of arrays where row 0 is headers
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, message: 'Excel file has no student data' });
    }

    const headers = data[0].map(h => String(h || '').trim().toLowerCase());
    
    // Find column indexes based on common name variations
    const sapIdx = headers.findIndex(h => h.includes('sap') || h.includes('id') || (h.includes('no') && !h.includes('roll')));
    const rollIdx = headers.findIndex(h => h.includes('roll'));
    const nameIdx = headers.findIndex(h => (h.includes('name') || h.includes('student')) && !h.includes('id') && !h.includes('sap') && !h.includes('no') && !h.includes('num'));
    const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('class'));
    const divIdx = headers.findIndex(h => h.includes('div') || h.includes('division'));
    const batchIdx = headers.findIndex(h => h.includes('batch'));

    // Set fallback indices if they are not detected
    const finalSapIdx = sapIdx !== -1 ? sapIdx : 0;
    const finalRollIdx = rollIdx !== -1 ? rollIdx : 1;
    const finalNameIdx = nameIdx !== -1 ? nameIdx : 2;

    const students = data.slice(1);
    const groups = {}; // key: "classYear|division" -> array of students
    
    for (const row of students) {
      if (!row || !row[finalSapIdx]) continue;
      
      const sapId = String(row[finalSapIdx]).trim();
      const rollNumber = String(row[finalRollIdx] || '').trim();
      
      // Filter: Only import students whose roll number starts with 'D'
      if (!rollNumber.toUpperCase().startsWith('D')) {
        continue;
      }

      const studentName = String(row[finalNameIdx] || '').trim();
      
      // Determine the class year and division from row or fall back to request parameters
      const studentYear = yearIdx !== -1 && row[yearIdx] ? String(row[yearIdx]).trim() : classYear;
      const studentDiv = divIdx !== -1 && row[divIdx] ? String(row[divIdx]).trim() : targetDivision;
      const studentBatch = batchIdx !== -1 && row[batchIdx] ? String(row[batchIdx]).trim() : '';

      if (!studentYear || !studentDiv) continue;

      const groupKey = `${studentYear.toUpperCase()}|${studentDiv.toUpperCase()}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push({
        sapId,
        rollNumber,
        studentName,
        division: studentDiv.toUpperCase(),
        classYear: studentYear.toUpperCase(),
        batch: studentBatch.toUpperCase()
      });
    }
    
    let totalStudentsSaved = 0;
    const currentYear = new Date().getFullYear();
    const academicSession = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

    for (const [groupKey, groupStudents] of Object.entries(groups)) {
      const [gYear, gDiv] = groupKey.split('|');
      const StudentModel = getStudentModel(gDiv, gYear);
      
      const bulkOps = groupStudents.map(student => ({
        updateOne: {
          filter: { sapId: student.sapId },
          update: { $set: student },
          upsert: true
        }
      }));
      
      if (bulkOps.length > 0) {
        await StudentModel.bulkWrite(bulkOps);
        totalStudentsSaved += bulkOps.length;

        // Automatically create dynamic student class folder if it doesn't exist
        const folderName = `${gYear.toUpperCase()}_${gDiv.toUpperCase()}_${academicSession}`;
        const folderPath = path.join(process.cwd(), 'backend', 'uploads', folderName);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
      }
    }
    
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(200).json({ success: true, count: totalStudentsSaved });
    
  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
    }
    return serverError(res, error, 'Upload student list error');
  }
};

export const getStudentsByClass = async (req, res) => {
  try {
    const { classYear, division } = req.query;
    if (!classYear || !division) {
      return res.status(400).json({ success: false, message: 'classYear and division are required' });
    }
    
    const StudentModel = getStudentModel(division, classYear);
    const students = await StudentModel.find().collation({ locale: "en", numericOrdering: true }).sort({ rollNumber: 1 });
    
    return res.status(200).json({ students });
  } catch (error) {
    return serverError(res, error, 'Fetch students by class error');
  }
};

export const getStudentCount = async (req, res) => {
  try {
    const { classYear, division } = req.query;
    if (!classYear || !division) {
      return res.status(400).json({ success: false, message: 'classYear and division are required' });
    }
    
    const StudentModel = getStudentModel(division, classYear);
    const count = await StudentModel.countDocuments();
    
    return res.status(200).json({ count });
  } catch (error) {
    return serverError(res, error, 'Fetch student count error');
  }
};
