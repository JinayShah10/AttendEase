import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import UploadedFile from '../models/UploadedFile.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import Admin from '../models/Admin.js';
import { getStudentModel } from '../models/Student.js';
import OpenElective, { getOpenElectiveModel } from '../models/OpenElective.js';
import Subject from '../models/Subject.js';
import ProgramElective from '../models/ProgramElective.js';
import { serverError } from '../utils/helpers.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';

/**
 * Parses header strings into date/time objects.
 * @param {string[]} headers - Raw header strings from the Excel sheet.
 * @returns {object[]} Array of { date, time } objects.
 */
function parseHeaders(headers) {
  return headers.map(h => {
    const str = String(h).trim();
    
    // 1. ISO Date string containing 'T'
    if (str.includes('T')) {
      const parts = str.split('T');
      return {
        date: parts[0],
        time: parts[1] ? parts[1].split('.')[0] : ''
      };
    }

    // 2. Contains space (e.g. "30.01.2026 12:00")
    if (str.includes(' ')) {
      const parts = str.split(/\s+/);
      return {
        date: parts[0],
        time: parts.slice(1).join(' ')
      };
    }

    // 3. Contains dash (e.g. "30.01.2026-12:00" or "12-06-2025-10:30")
    const lastDashIdx = str.lastIndexOf('-');
    if (lastDashIdx !== -1) {
      const timePart = str.slice(lastDashIdx + 1);
      if (timePart.includes(':') || /^\d{2}\.\d{2}$/.test(timePart)) {
        return {
          date: str.slice(0, lastDashIdx),
          time: timePart
        };
      }
    }

    // Fallback: whole string is treated as date
    return { date: str, time: '' };
  });
}

/**
 * Normalizes different date formats (e.g. 12-06-2025, 12/06/2025, 2025-06-12) to standard YYYY-MM-DD.
 * It ignores time segments and handles both string dates and JS Date strings.
 * @param {string} dateStr
 * @returns {string} Normalized date in YYYY-MM-DD format.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).trim();
  let datePart = cleanStr;
  if (cleanStr.includes('T')) {
    datePart = cleanStr.split('T')[0];
  }
  datePart = datePart.trim();
  
  // Replace dots or slashes with dashes to normalize separators
  const standardDelim = datePart.replace(/[\/\.]/g, '-');
  const parts = standardDelim.split('-');
  
  if (parts.length === 3) {
    // Case 1: YYYY-MM-DD
    if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Case 2: DD-MM-YYYY
    if (parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  try {
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore and fallback
  }

  return standardDelim;
}

/**
 * Computes lab attendance counts based on unique normalized calendar dates.
 * @param {object[]} sessions - Array of { date, time } objects.
 * @param {object[]} studentAttendance - Array of { sessionIndex, status } objects.
 * @returns {{ attCount: number, totCount: number }} Counts of attended and conducted unique date sessions.
 */
function getLabAttendanceCounts(sessions, studentAttendance) {
  const indexToDate = sessions.map(s => normalizeDate(s.date));
  const uniqueDates = [...new Set(indexToDate.filter(Boolean))];
  
  const presentDates = new Set();
  studentAttendance.forEach(a => {
    if (a.status === 'P') {
      const normDate = indexToDate[a.sessionIndex];
      if (normDate) {
        presentDates.add(normDate);
      }
    }
  });

  return {
    attCount: presentDates.size,
    totCount: uniqueDates.length
  };
}

/**
 * Calculates attendance counts for a list of records for a specific student.
 * Uses the exact same underlying mechanism as SY (P-status count for theory, unique dates for labs).
 * @param {object[]} relevantRecords - Filtered AttendanceRecord documents.
 * @param {string} sapId - Student SAP ID.
 * @param {string} studentBatch - Student batch name (e.g. B1, B2).
 * @returns {{ th_att: number, th_tot: number, lab_att: number, lab_tot: number }}
 */
function calculateRecordsAttendance(relevantRecords, sapId, studentBatch = '') {
  let th_att = 0, th_tot = 0;
  let lab_att = 0, lab_tot = 0;
  
  const uniqueLabDatesConducted = new Set();
  const uniqueLabDatesPresent = new Set();

  for (const r of relevantRecords) {
    if (r.batch && studentBatch && r.batch.trim().toUpperCase() !== studentBatch.trim().toUpperCase()) {
      continue;
    }

    const isLab = (r.lectureType || '').toLowerCase().includes('lab');
    if (isLab) {
      r.sessions.forEach(s => {
        const normDate = normalizeDate(s.date);
        if (normDate) uniqueLabDatesConducted.add(normDate);
      });

      const stuRec = r.records.find(sr => sr.studentNumber === sapId);
      if (stuRec) {
        const indexToDate = r.sessions.map(s => normalizeDate(s.date));
        stuRec.attendance.forEach(a => {
          if (a.status === 'P') {
            const normDate = indexToDate[a.sessionIndex];
            if (normDate) uniqueLabDatesPresent.add(normDate);
          }
        });
      }
    } else {
      const colCount = r.sessions.length;
      const stuRec = r.records.find(sr => sr.studentNumber === sapId);
      if (stuRec) {
        th_att += stuRec.attendance.filter(a => a.status === 'P').length;
        th_tot += colCount;
      } else {
        th_tot += colCount;
      }
    }
  }

  if (uniqueLabDatesConducted.size > 0) {
    lab_tot = uniqueLabDatesConducted.size;
    lab_att = uniqueLabDatesPresent.size;
  }

  return { th_att, th_tot, lab_att, lab_tot };
}

/**
 * Builds the consolidated report from attendance records.
 * Aggregates student attendance and subject totals across multiple records.
 * OE, DE, and PE records are excluded here — they are merged separately.
 * @param {object[]} records - Array of AttendanceRecord documents.
 * @returns {{ students: object[], subjects: object[] }}
 */
function buildConsolidatedReport(records, dbSubjectsMap = null, studentOEMap = null) {
  const studentMap = new Map();
  const subjectMap = new Map();

  for (const record of records) {
    // Skip OE, DE, and PE records — they are handled separately in getConsolidated
    if (
      (record.lectureType || '').toLowerCase().startsWith('oe') ||
      (record.lectureType || '').toLowerCase().startsWith('de') ||
      (record.lectureType || '').toLowerCase().startsWith('pe')
    ) continue;

    const subjectName = record.subjectName;
    let type = (record.lectureType || 'theory').toLowerCase();
    if (type.includes('theory')) {
      type = 'theory';
    } else if (type.includes('lab')) {
      type = 'lab';
    }
    let colCount = 0;
    if (type === 'lab') {
      const uniqueDates = [...new Set(record.sessions.map(s => normalizeDate(s.date)).filter(Boolean))];
      colCount = uniqueDates.length;
    } else {
      colCount = record.sessions.length;
    }

    if (!subjectMap.has(subjectName)) {
      const dbSub = dbSubjectsMap ? dbSubjectsMap.get(subjectName) : null;
      const isHonoursSub = dbSub ? (
        (dbSub.category || '').toLowerCase() === 'honours' || 
        (dbSub.type || '').toLowerCase() === 'honours'
      ) : [
        'CMPM', 'FMRA', 'EM', 'QPM'
      ].some(h => subjectName.toUpperCase().includes(h));

      subjectMap.set(subjectName, {
        key: subjectName,
        label: subjectName,
        th_tot: 0,
        lab_tot: 0,
        isOE: dbSub ? dbSub.isOE : false,
        isHonours: isHonoursSub
      });
    }

    const sub = subjectMap.get(subjectName);
    if (type === 'theory') sub.th_tot += colCount;
    else sub.lab_tot += colCount;

    for (const studentRec of record.records) {
      const sNum = studentRec.studentNumber;
      const dbStudent = studentOEMap ? studentOEMap.get(sNum) : null;
      const studentBatch = dbStudent ? dbStudent.batch : '';

      if (record.batch && studentBatch && record.batch.trim().toUpperCase() !== studentBatch.trim().toUpperCase()) {
        continue;
      }

      if (!studentMap.has(sNum)) {
        studentMap.set(sNum, {
          rollNo: studentRec.rollNumber,
          sapId: sNum,
          name: studentRec.studentName
        });
      }
      const stu = studentMap.get(sNum);

      // Count columns where status is 'P'
      let attCount = 0;
      if (type === 'lab') {
        const counts = getLabAttendanceCounts(record.sessions, studentRec.attendance);
        attCount = counts.attCount;
      } else {
        attCount = studentRec.attendance.filter(a => a.status === 'P').length;
      }

      if (!stu[subjectName]) {
        stu[subjectName] = { th_att: 0, th_tot: 0, lab_att: 0, lab_tot: 0 };
      }

      if (type === 'theory') {
        stu[subjectName].th_att += attCount;
        stu[subjectName].th_tot += colCount;
      } else {
        stu[subjectName].lab_att += attCount;
        stu[subjectName].lab_tot += colCount;
      }
    }
  }

  const allSubjects = Array.from(subjectMap.values());
  const allStudents = Array.from(studentMap.values());

  // Ensure every student has an entry for every subject
  allStudents.forEach(stu => {
    // Look up student in studentOEMap to get honoursSubject and OE
    const dbStudent = studentOEMap ? studentOEMap.get(stu.sapId) : null;
    const honoursSubject = dbStudent ? dbStudent.honoursSubject : '';
    const oeSubject = dbStudent ? dbStudent.OE : '';

    allSubjects.forEach(sub => {
      let notOpted = false;
      if (sub.isHonours) {
        notOpted = true;
        if (honoursSubject) {
          const studentHonours = honoursSubject.trim().toUpperCase();
          const subKey = sub.key.trim().toUpperCase();
          const baseStudentHonours = studentHonours.replace(/\s+LAB$/, '');
          const baseSubKey = subKey.replace(/\s+LAB$/, '');
          if (baseStudentHonours === baseSubKey) {
            notOpted = false;
          }
        }
      } else if (sub.isOE) {
        notOpted = true;
        if (oeSubject) {
          const studentOe = oeSubject.trim().toUpperCase();
          const subKey = sub.key.trim().toUpperCase();
          const baseStudentOe = studentOe.replace(/\s+LAB$/, '');
          const baseSubKey = subKey.replace(/\s+LAB$/, '');
          if (baseStudentOe === baseSubKey) {
            notOpted = false;
          }
        }
      }

      if (!stu[sub.key]) {
        stu[sub.key] = { 
          th_att: 0, 
          th_tot: sub.th_tot, 
          lab_att: 0, 
          lab_tot: sub.lab_tot,
          notOpted: notOpted,
          oeName: sub.key
        };
      } else {
        if (stu[sub.key].th_tot === 0) stu[sub.key].th_tot = sub.th_tot;
        if (stu[sub.key].lab_tot === 0) stu[sub.key].lab_tot = sub.lab_tot;
        stu[sub.key].notOpted = notOpted;
        stu[sub.key].oeName = sub.key;
      }
    });
  });

  return { students: allStudents, subjects: allSubjects };
}

/**
 * POST /api/report/generate/:uploadId
 * Parses an uploaded Excel file and creates an AttendanceRecord.
 */
export const generateReport = async (req, res) => {
  try {
    const upload = await UploadedFile.findById(req.params.uploadId);
    if (!upload) return res.status(404).json({ message: 'Upload not found' });

    // Authorization check: only the owner or an admin can process the upload
    if (upload.facultyId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to process this upload' });
    }

    let requestingAdminDiv = null;
    if (req.user && req.user.role === 'admin') {
      const adminDoc = await Admin.findById(req.user.id);
      if (adminDoc && adminDoc.assignedClass) {
        requestingAdminDiv = adminDoc.assignedClass.division;
      }
    }

    const isOEUpload = upload.division === 'ALL';

    if (isOEUpload && requestingAdminDiv) {
      if (upload.processedDivisions && upload.processedDivisions.includes(requestingAdminDiv)) {
        return res.status(400).json({ message: `Already processed for division ${requestingAdminDiv}` });
      }
    } else {
      if (upload.status === 'processed') {
        return res.status(400).json({ message: 'Already processed' });
      }
    }

    const normalizedType = (upload.lectureType || '').toLowerCase();
    const cleanSubName = (upload.subjectName || '').trim();

    const isDESubject = normalizedType.startsWith('de') ||
      (await Subject.exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') }, electiveCategory: 'DEPARTMENT_ELECTIVE' }));

    const isPESubject = normalizedType.startsWith('pe') ||
      (await ProgramElective.exists({ subjectName: { $regex: new RegExp(`^${cleanSubName}$`, 'i') } }));

    const isOESubject = normalizedType.startsWith('oe') ||
      (await getOpenElectiveModel(upload.classYear).exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') } })) ||
      (await Subject.exists({ name: { $regex: new RegExp(`^${cleanSubName}$`, 'i') }, isOE: true }));

    const isMultiDivUpload = upload.division === 'ALL' || isOESubject || isDESubject || isPESubject;

    // --- DE-DUPLICATION LOGIC ---
    // Check if an AttendanceRecord already exists for this exact same file/subject/class/div
    const targetDivision = isMultiDivUpload ? 'ALL' : upload.division;
    const targetLectureType = isOESubject
      ? (String(upload.lectureType).toLowerCase().includes('lab') ? 'oe lab' : 'oe')
      : upload.lectureType;

    const uploadBatch = upload.batch || (upload.originalFileName.match(/B(\d+)/i) ? upload.originalFileName.match(/B(\d+)/i)[0].toUpperCase() : '');

    const existingRecord = await AttendanceRecord.findOne({
      facultyId: upload.facultyId,
      subjectName: upload.subjectName,
      classYear: upload.classYear,
      division: targetDivision,
      lectureType: targetLectureType,
      batch: uploadBatch
    });

    if (existingRecord) {
      const isSameFileProcessing = isOEUpload && (
        upload.attendanceRecordId && upload.attendanceRecordId.toString() === existingRecord._id.toString()
      );

      if (!isSameFileProcessing) {
        // 1. If it's an OE record, we MUST subtract the old counts from the student models 
        //    because OE counts are denormalized (stored via $inc on student documents).
        if ((existingRecord.lectureType || '').toLowerCase().startsWith('oe')) {
          const OE_DIVISIONS = ['D1', 'D2', 'D3'];
          for (const div of OE_DIVISIONS) {
            const Model = getStudentModel(div, existingRecord.classYear);
            const subtractOps = existingRecord.records.map(rec => {
              const isLab = (existingRecord.lectureType || '').toLowerCase().includes('lab');
              let oldAtt = 0;
              let oldTot = 0;
              if (isLab) {
                const counts = getLabAttendanceCounts(existingRecord.sessions, rec.attendance);
                oldAtt = counts.attCount;
                oldTot = counts.totCount;
              } else {
                oldAtt = rec.attendance.filter(a => a.status === 'P').length;
                oldTot = rec.attendance.length;
              }
              return {
                updateOne: {
                  filter: { sapId: rec.studentNumber },
                  update: {
                    $inc: {
                      oeAttended: -oldAtt,
                      oeTotal: -oldTot
                    }
                  }
                }
              };
            });
            if (subtractOps.length > 0) await Model.bulkWrite(subtractOps);
          }
        }

        // 2. Delete the old record
        await AttendanceRecord.findByIdAndDelete(existingRecord._id);

        // 3. Mark the old UploadedFile as 'overwritten' so it doesn't appear as 'processed'
        await UploadedFile.updateOne(
          { attendanceRecordId: existingRecord._id, _id: { $ne: upload._id } },
          { $set: { status: 'overwritten', attendanceRecordId: null } }
        );
      }
    }
    // ----------------------------
    let buffer;
    if (upload.storedFilePath && upload.storedFilePath.startsWith('backend/uploads/')) {
      const localPath = path.resolve(upload.storedFilePath);
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
      }
    }

    if (!buffer) {
      const { data: storageData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(upload.storedFilePath);

      if (downloadError || !storageData) {
        console.error('[SUPABASE DOWNLOAD ERROR]', downloadError);
        return res.status(404).json({ message: 'Excel file not found in storage' });
      }

      const arrayBuffer = await storageData.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) {
      return res.status(400).json({ message: 'Excel file has no student data' });
    }

    // Dynamically find where attendance data (P/A) starts
    let dataStartCol = -1;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      for (let c = 1; c < row.length; c++) {
        const val = String(row[c] || '').trim().toUpperCase();
        if (val === 'P' || val === 'A') {
          if (dataStartCol === -1 || c < dataStartCol) {
            dataStartCol = c;
          }
          break;
        }
      }
    }

    const META_COLS = dataStartCol !== -1 ? dataStartCol : 4;
    const sessionHeaders = rows[0].slice(META_COLS);
    const sessions = parseHeaders(sessionHeaders);
    
    const dbSubDoc = await Subject.findOne({ name: upload.subjectName }).lean();
    const isHonoursSubject = dbSubDoc ? (
      (dbSubDoc.category || '').toLowerCase() === 'honours' || 
      (dbSubDoc.type || '').toLowerCase() === 'honours'
    ) : [
      'CMPM', 'FMRA', 'EM', 'QPM'
    ].some(h => upload.subjectName.toUpperCase().includes(h));
    const isOptional = isOESubject || isHonoursSubject;

    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const metaValues = [];
      for (let c = 0; c < META_COLS; c++) {
        const val = row[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          metaValues.push(val);
        }
      }

      const sapId = metaValues[0];
      if (!sapId) continue;

      const rollNumber = String(metaValues[1] || '').trim();
      const studentName = String(metaValues[2] || 'Unknown');

      // Filter: Only process students whose roll number starts with 'D'
      if (!rollNumber.toUpperCase().startsWith('D')) {
        continue;
      }

      let hasAttendance = false;
      const attendance = sessions.map((s, idx) => {
        const val = String(row[META_COLS + idx] || '').trim().toUpperCase();
        if (val === 'P' || val === 'A') hasAttendance = true;
        return {
          sessionIndex: idx,
          status: val === 'P' ? 'P' : 'A'
        };
      });

      if (isOptional && !hasAttendance) {
        continue; // Skip students who are completely blank in this OE or Honours sheet
      }

      records.push({
        studentNumber: String(sapId),
        rollNumber,
        studentName,
        attendance
      });
    }

    // --- Save students to the dynamic collection ---
    const classYearStr = String(upload.classYear).toUpperCase();
    const isOEApplicable = classYearStr.includes('SY') || classYearStr.includes('TY') || classYearStr.includes('SE') || classYearStr.includes('TE') || classYearStr.includes('2') || classYearStr.includes('3');

    if (isMultiDivUpload && isOEApplicable) {
      // ── Multi-division (OE/DE/PE) path: students come from ALL divisions ──
      // Build models for every division in this class year
      const OE_DIVISIONS = ['D1', 'D2', 'D3'];
      const divisionModels = {};
      for (const div of OE_DIVISIONS) {
        divisionModels[div] = getStudentModel(div, upload.classYear);
      }

      const dbSub = await Subject.findOne({ name: upload.subjectName }).lean();
      const isDE = (dbSub && dbSub.electiveCategory === 'DEPARTMENT_ELECTIVE') || isDESubject;
      const deSubjectName = isDE ? upload.subjectName.replace(/\s+Lab$/, '') : '';

      let isPE = false;
      let peSet = null;
      let peTheoryName = null;
      const isTY = classYearStr.includes('TY') || classYearStr.includes('TE');
      if (isTY) {
        const peOption = await ProgramElective.findOne({ subjectName: upload.subjectName }).lean();
        if (peOption) {
          isPE = true;
          peSet = peOption.set;
          peTheoryName = peOption.pairKey;
        }
      }

      // For each parsed student, find which division they actually belong to
      // and upsert them on that division's collection with OE/DE/PE set.
      const divisionBulkOps = {}; // { D1: [...], D2: [...], D3: [...] }
      for (const div of OE_DIVISIONS) divisionBulkOps[div] = [];
      
      const unmatchedStudents = [];

      for (const rec of records) {
        let foundDivision = null;

        // Search across all division collections to find the student's real division
        for (const div of OE_DIVISIONS) {
          const existing = await divisionModels[div].findOne({ sapId: rec.studentNumber }).lean();
          if (existing) {
            foundDivision = div;
            break;
          }
        }

        // If the student is not found in any division, it means the master list hasn't been uploaded for them.
        if (!foundDivision) {
          unmatchedStudents.push(rec.studentNumber);
          continue; // Safely skip to prevent polluting the database
        }

        const isLab = (upload.lectureType || '').toLowerCase().includes('lab');
        let attCount = 0;
        let totCount = 0;
        if (isLab) {
          const counts = getLabAttendanceCounts(sessions, rec.attendance);
          attCount = counts.attCount;
          totCount = counts.totCount;
        } else {
          attCount = rec.attendance.filter(a => a.status === 'P').length;
          totCount = rec.attendance.length;
        }

        divisionBulkOps[foundDivision].push({
          updateOne: {
            filter: { sapId: rec.studentNumber },
            update: {
              $set: {
                ...(isOESubject ? { OE: upload.subjectName } : {}),
                ...(isDE ? { DE: deSubjectName } : {}),
                ...(isPE && peSet === 'SET1' ? { PE1: peTheoryName } : {}),
                ...(isPE && peSet === 'SET2' ? { PE2: peTheoryName } : {})
              },
              ...(isOESubject && !isLab ? {
                $inc: {
                  oeAttended: attCount,
                  oeTotal: totCount
                }
              } : {})
            },
            upsert: false // Strictly do not create new students
          }
        });
      }

      // Error handling: If ALL students or a massive chunk are unmatched, the Master List was definitely not uploaded.
      if (unmatchedStudents.length > 0 && unmatchedStudents.length >= records.length * 0.8) {
        throw new Error(`Could not find ${unmatchedStudents.length} students in the database. Please ensure the Master Student Lists for D1, D2, and D3 are uploaded BEFORE processing multi-division sheets.`);
      }

      // Execute bulk writes per division
      for (const div of OE_DIVISIONS) {
        if (divisionBulkOps[div].length > 0) {
          await divisionModels[div].bulkWrite(divisionBulkOps[div]);
        }
      }
    } else {
      // ── Normal single division path ──
      const StudentModel = getStudentModel(upload.division, upload.classYear);

      // Identify which students from the sheet actually exist in the Master List
      const sapIdsInSheet = records.map(r => r.studentNumber);
      const existingStudents = await StudentModel.find({ sapId: { $in: sapIdsInSheet } }).select('sapId').lean();
      const existingSapIds = new Set(existingStudents.map(s => s.sapId));

      // Check if it is a Department Elective
      const dbSub = await Subject.findOne({ name: upload.subjectName }).lean();
      const isDE = dbSub && dbSub.electiveCategory === 'DEPARTMENT_ELECTIVE';
      const deSubjectName = isDE ? upload.subjectName.replace(/\s+Lab$/, '') : '';

      // Check if it is a Program Elective (PE) — sourced from TY_PE
      let isPE = false;
      let peSet = null;
      let peTheoryName = null;
      const isTY = String(upload.classYear).toUpperCase().includes('TY');
      if (isTY) {
        const peOption = await ProgramElective.findOne({
          subjectName: upload.subjectName
        }).lean();
        if (peOption) {
          isPE = true;
          peSet = peOption.set; // 'SET1' or 'SET2'
          peTheoryName = peOption.pairKey; // canonical theory name (pairKey) for the student field
        }
      }

      const studentBulkOps = records
        .filter(rec => existingSapIds.has(rec.studentNumber)) // Only process students who exist in Master List
        .map(rec => ({
          updateOne: {
            filter: { sapId: rec.studentNumber },
            update: {
              $set: {
                ...(isHonoursSubject ? { honoursSubject: upload.subjectName } : {}),
                ...(isDE ? { DE: deSubjectName } : {}),
                ...(isPE && peSet === 'SET1' ? { PE1: peTheoryName } : {}),
                ...(isPE && peSet === 'SET2' ? { PE2: peTheoryName } : {})
              }
            },
            upsert: false // Strictly do not create new students
          }
        }));

      if (studentBulkOps.length > 0) {
        await StudentModel.bulkWrite(studentBulkOps);
      }
    }
    // -----------------------------------------------------

    let savedRecord;
    if (isOEUpload && upload.attendanceRecordId) {
      const existing = await AttendanceRecord.findById(upload.attendanceRecordId);
      if (existing) {
        savedRecord = existing;
      }
    }

    if (!savedRecord) {
      savedRecord = await AttendanceRecord.create({
        facultyId: upload.facultyId,
        subjectName: upload.subjectName,
        subjectCode: upload.subjectCode || '',
        classYear: upload.classYear,
        division: isOESubject ? 'ALL' : upload.division,   // OE records span all divisions
        lectureType: isOESubject ? (String(upload.lectureType).toLowerCase().includes('lab') ? 'oe lab' : 'oe') : upload.lectureType,
        batch: uploadBatch,
        originalFileName: upload.originalFileName,
        sessions,
        records   // ALL students from the sheet, not filtered by division
      });
    }

    if (isOEUpload) {
      if (!upload.processedDivisions) upload.processedDivisions = [];
      if (requestingAdminDiv) {
        if (!upload.processedDivisions.includes(requestingAdminDiv)) {
          upload.processedDivisions.push(requestingAdminDiv);
        }
      } else {
        ['D1', 'D2', 'D3'].forEach(div => {
          if (!upload.processedDivisions.includes(div)) upload.processedDivisions.push(div);
        });
      }

      if (['D1', 'D2', 'D3'].every(div => upload.processedDivisions.includes(div))) {
        upload.status = 'processed';
      }
    } else {
      upload.status = 'processed';
    }

    upload.attendanceRecordId = savedRecord._id;
    await upload.save();

    return res.status(200).json({ 
      message: 'Report generated successfully', 
      recordId: savedRecord._id 
    });
  } catch (err) {
    return serverError(res, err, 'Generate error');
  }
};

/**
 * GET /api/report/consolidated?classYear=TY&division=D1
 * Returns aggregated attendance data for a class, including per-student OE data.
 */
export const getConsolidated = async (req, res) => {
  try {
    const { classYear, division } = req.query;

    // Fetch student data first so we can map OEs and check opt-ins
    const StudentModel = getStudentModel(division, classYear);
    const dbStudents = await StudentModel.find({}).sort({ rollNumber: 1 }).lean();
    
    const studentOEMap = new Map();
    dbStudents.forEach(s => studentOEMap.set(s.sapId, s));

    // Fetch all subject metadata from Subject model to set isOE, etc.
    const dbSubjects = await Subject.find({}).lean();
    const dbSubjectsMap = new Map(dbSubjects.map(s => [s.name, s]));

    // 1. Fetch non-OE records for this classYear + division (existing logic)
    const divisionRecords = await AttendanceRecord.find({
      $or: [
        { classYear, division },
        { classYear: `${classYear} ${division}` },
        { classYear: new RegExp(`^${classYear}\\s+${division}$`, 'i') },
        { classYear: classYear, division: 'ALL' } // OE records that span all divisions (e.g. TY program electives)
      ],
      lectureType: { $ne: 'oe' }
    });

    const report = buildConsolidatedReport(divisionRecords, dbSubjectsMap, studentOEMap);
    const existingSubjects = report.subjects;

    // Merge: start with report students, then add any DB students not in report
    const reportStudentMap = new Map();
    for (const s of report.students) {
      reportStudentMap.set(s.sapId, s);
    }

    const studentsWithOE = [];
    // First: include all DB students (ensures correct order and completeness)
    for (const sDb of dbStudents) {
      let stu = reportStudentMap.get(sDb.sapId);
      if (!stu) {
        // Student has no attendance records yet - create placeholder
        stu = {
          rollNo: sDb.rollNumber,
          sapId: sDb.sapId,
          name: sDb.studentName
        };
        for (const sub of existingSubjects) {
          let notOpted = false;
          if (sub.isHonours) {
            notOpted = true;
            if (sDb.honoursSubject) {
              const studentHonours = sDb.honoursSubject.trim().toUpperCase();
              const subKey = sub.key.trim().toUpperCase();
              const baseStudentHonours = studentHonours.replace(/\s+LAB$/, '');
              const baseSubKey = subKey.replace(/\s+LAB$/, '');
              if (baseStudentHonours === baseSubKey) {
                notOpted = false;
              }
            }
          } else if (sub.isOE) {
            notOpted = true;
            if (sDb.OE) {
              const studentOe = sDb.OE.trim().toUpperCase();
              const subKey = sub.key.trim().toUpperCase();
              const baseStudentOe = studentOe.replace(/\s+LAB$/, '');
              const baseSubKey = subKey.replace(/\s+LAB$/, '');
              if (baseStudentOe === baseSubKey) {
                notOpted = false;
              }
            }
          }

          stu[sub.key] = { 
            th_att: 0, 
            th_tot: sub.th_tot, 
            lab_att: 0, 
            lab_tot: sub.lab_tot,
            notOpted: notOpted,
            oeName: sub.key
          };
        }
      }
      reportStudentMap.delete(sDb.sapId); // mark as handled
      studentsWithOE.push(stu);
    }
    // Then: include any report-only students not in DB (edge case safety)
    for (const [, stu] of reportStudentMap) {
      studentsWithOE.push(stu);
    }

    const oeRecords = await AttendanceRecord.find({
      lectureType: { $regex: /^oe/i },
      classYear: classYear
    });

    const oeSubjectsMap = new Map();
    for (const r of oeRecords) {
      if (!oeSubjectsMap.has(r.subjectName)) {
        oeSubjectsMap.set(r.subjectName, {
          key: r.subjectName,
          label: r.subjectName,
          th_tot: 0,
          lab_tot: 0
        });
      }
      const isLab = (r.lectureType || '').toLowerCase().includes('lab');
      let colCount = 0;
      if (isLab) {
        const uniqueDates = [...new Set(r.sessions.map(s => normalizeDate(s.date)).filter(Boolean))];
        colCount = uniqueDates.length;
        oeSubjectsMap.get(r.subjectName).lab_tot += colCount;
      } else {
        colCount = r.sessions ? r.sessions.length : 0;
        oeSubjectsMap.get(r.subjectName).th_tot += colCount;
      }
    }
    const oeSubjectsArray = Array.from(oeSubjectsMap.values());

    const deRecords = await AttendanceRecord.find({
      $or: [
        { classYear, division },
        { classYear: `${classYear} ${division}` },
        { classYear: new RegExp(`^${classYear}\\s+${division}$`, 'i') },
        { classYear, division: 'ALL' }
      ],
      lectureType: { $regex: /^de/i }
    });

    const deSubjectsMap = new Map();
    const deLabDatesMap = new Map();
    for (const r of deRecords) {
      if (!deSubjectsMap.has(r.subjectName)) {
        deSubjectsMap.set(r.subjectName, {
          key: r.subjectName,
          label: r.subjectName,
          th_tot: 0,
          lab_tot: 0
        });
      }
      const isLab = (r.lectureType || '').toLowerCase().includes('lab');
      if (isLab) {
        if (!deLabDatesMap.has(r.subjectName)) {
          deLabDatesMap.set(r.subjectName, new Set());
        }
        r.sessions.forEach(s => {
          const normDate = normalizeDate(s.date);
          if (normDate) {
            deLabDatesMap.get(r.subjectName).add(normDate);
          }
        });
      } else {
        const colCount = r.sessions ? r.sessions.length : 0;
        deSubjectsMap.get(r.subjectName).th_tot += colCount;
      }
    }
    for (const [subjectName, datesSet] of deLabDatesMap.entries()) {
      if (deSubjectsMap.has(subjectName)) {
        deSubjectsMap.get(subjectName).lab_tot = datesSet.size;
      }
    }
    const deSubjectsArray = Array.from(deSubjectsMap.values());

    // 3b. Fetch PE (Program Elective) records
    const peRecords = await AttendanceRecord.find({
      $or: [
        { classYear, division },
        { classYear: `${classYear} ${division}` },
        { classYear: new RegExp(`^${classYear}\\s+${division}$`, 'i') },
        { classYear, division: 'ALL' }
      ],
      lectureType: { $regex: /^pe/i }
    });

    // Build peSubjectsMap — one entry per set (SET1 theory and SET2 theory each get their own slot)
    const peSubjectsMap = new Map(); // key = subjectName (theory or lab)
    for (const r of peRecords) {
      if (!peSubjectsMap.has(r.subjectName)) {
        peSubjectsMap.set(r.subjectName, {
          key: r.subjectName,
          label: r.subjectName,
          th_tot: 0,
          lab_tot: 0
        });
      }
      const isLab = (r.lectureType || '').toLowerCase().includes('lab');
      let colCount = 0;
      if (isLab) {
        const uniqueDates = [...new Set(r.sessions.map(s => normalizeDate(s.date)).filter(Boolean))];
        colCount = uniqueDates.length;
        peSubjectsMap.get(r.subjectName).lab_tot += colCount;
      } else {
        colCount = r.sessions ? r.sessions.length : 0;
        peSubjectsMap.get(r.subjectName).th_tot += colCount;
      }
    }
    const peSubjectsArray = Array.from(peSubjectsMap.values());

    // Preload all PE options to resolve set membership by subject name
    const allPEOptions = await ProgramElective.find({}).lean();
    
    // Separate into theory and lab documents
    const theoryOptions = allPEOptions.filter(p => p.type === 'THEORY');
    const labOptions = allPEOptions.filter(p => p.type === 'LAB');

    // Create lookup maps to group them by pairKey
    const pairKeyToLab = new Map(labOptions.map(p => [p.pairKey, p.subjectName]));
    const pairKeyToTheory = new Map(theoryOptions.map(p => [p.pairKey, p.subjectName]));

    // Construct maps formatted like the legacy structures to avoid breaking down-stream logic
    const peByTheory = new Map(
      theoryOptions.map(t => [
        t.subjectName,
        {
          set: t.set,
          theory: t.subjectName,
          lab: pairKeyToLab.get(t.pairKey) || (t.subjectName + ' Lab')
        }
      ])
    );
    const peByLab = new Map(
      labOptions.map(l => [
        l.subjectName,
        {
          set: l.set,
          theory: pairKeyToTheory.get(l.pairKey) || l.pairKey,
          lab: l.subjectName
        }
      ])
    );

    for (const student of studentsWithOE) {
      const dbStudent = studentOEMap.get(student.sapId);
      const studentBatch = dbStudent ? dbStudent.batch : '';

      if (dbStudent && dbStudent.OE) {
        student.oeSubject = dbStudent.OE;
        
        // Aggregate live OE attendance from all AttendanceRecords for this subject
        const normOe = (dbStudent.OE || '').trim().toLowerCase();
        const relevantOeRecords = oeRecords.filter(r => {
          const rSub = (r.subjectName || '').trim().toLowerCase();
          return rSub === normOe || rSub === (normOe + ' lab') || rSub.replace(/\s+lab$/, '') === normOe;
        });
        if (relevantOeRecords.length > 0) {
          const oeCounts = calculateRecordsAttendance(relevantOeRecords, student.sapId, studentBatch);
          student.oe_att = oeCounts.th_att;
          student.oe_tot = oeCounts.th_tot;
          student.oe_lab_att = oeCounts.lab_att;
          student.oe_lab_tot = oeCounts.lab_tot;
        } else {
          // Fall back to denormalized values stored on the student document
          student.oe_att = Number(dbStudent.oeAttended || 0);
          student.oe_tot = Number(dbStudent.oeTotal || 0);
          student.oe_lab_att = 0;
          student.oe_lab_tot = 0;
        }
      } else {
        student.oeSubject = '';
        student.oe_att = 0;
        student.oe_tot = 0;
      }

      if (dbStudent && dbStudent.DE) {
        student.deSubject = dbStudent.DE;
        student.deLabSubject = dbStudent.DE + ' Lab';
        
        const normDe = (dbStudent.DE || '').trim().toLowerCase();
        const relevantDeRecords = deRecords.filter(r => {
          const rSub = (r.subjectName || '').trim().toLowerCase();
          return rSub === normDe || rSub === (normDe + ' lab') || rSub.replace(/\s+lab$/, '') === normDe;
        });
        const deCounts = calculateRecordsAttendance(relevantDeRecords, student.sapId, studentBatch);
        student.de_att = deCounts.th_att;
        student.de_tot = deCounts.th_tot;
        student.de_lab_att = deCounts.lab_att;
        student.de_lab_tot = deCounts.lab_tot;
      } else {
        student.deSubject = '';
        student.deLabSubject = '';
        student.de_att = 0;
        student.de_tot = 0;
        student.de_lab_att = 0;
        student.de_lab_tot = 0;
      }

      // ── Program Elective (PE) aggregation ──
      const pe1TheoryName = dbStudent?.PE1 || '';
      const pe2TheoryName = dbStudent?.PE2 || '';

      // Helper: aggregate attendance for a PE option (theory + lab)
      const aggregatePE = (theoryName) => {
        if (!theoryName) return { th_att: 0, th_tot: 0, lab_att: 0, lab_tot: 0 };
        const normTheory = theoryName.trim().toLowerCase();
        const peOpt = peByTheory.get(theoryName.trim());
        const labName = (peOpt ? peOpt.lab : (theoryName.trim() + ' Lab')).trim().toLowerCase();
        const relevantPeRecords = peRecords.filter(r => {
          const rSub = (r.subjectName || '').trim().toLowerCase();
          return rSub === normTheory || rSub === labName || rSub === (normTheory + ' lab') || rSub.replace(/\s+lab$/, '') === normTheory;
        });
        return calculateRecordsAttendance(relevantPeRecords, student.sapId, studentBatch);
      };

      student.pe1Subject    = pe1TheoryName;
      student.pe1LabSubject = pe1TheoryName ? (peByTheory.get(pe1TheoryName)?.lab || (pe1TheoryName + ' Lab')) : '';
      student.pe2Subject    = pe2TheoryName;
      student.pe2LabSubject = pe2TheoryName ? (peByTheory.get(pe2TheoryName)?.lab || (pe2TheoryName + ' Lab')) : '';

      const pe1Data = aggregatePE(pe1TheoryName);
      student.pe1_att     = pe1Data.th_att;
      student.pe1_tot     = pe1Data.th_tot;
      student.pe1_lab_att = pe1Data.lab_att;
      student.pe1_lab_tot = pe1Data.lab_tot;

      const pe2Data = aggregatePE(pe2TheoryName);
      student.pe2_att     = pe2Data.th_att;
      student.pe2_tot     = pe2Data.th_tot;
      student.pe2_lab_att = pe2Data.lab_att;
      student.pe2_lab_tot = pe2Data.lab_tot;
    }

    return res.status(200).json({ 
      students: studentsWithOE, 
      subjects: existingSubjects,
      oeSubjects: oeSubjectsArray,
      deSubjects: deSubjectsArray,
      peSubjects: peSubjectsArray
    });
  } catch (err) {
    return serverError(res, err, 'Consolidated error');
  }
};

/**
 * GET /api/report/oe-summary?classYear=SY&division=D1
 * Returns OE assignments grouped by subject and indexed by student.
 */
export const getOESummary = async (req, res) => {
  try {
    const { classYear, division } = req.query;

    if (!classYear || !division) {
      return res.status(400).json({ message: 'classYear and division are required' });
    }

    const StudentModel = getStudentModel(division, classYear);
    const students = await StudentModel.find(
      {},
      { sapId: 1, studentName: 1, rollNumber: 1, OE: 1, _id: 0 }
    ).lean();

    const bySubject = {};
    const byStudent = {};

    for (const s of students) {
      const oe = s.OE || '';
      byStudent[s.sapId] = oe;

      if (oe) {
        if (!bySubject[oe]) bySubject[oe] = [];
        bySubject[oe].push({
          sapId: s.sapId,
          studentName: s.studentName,
          rollNumber: s.rollNumber,
          division: s.division
        });
      }
    }

    return res.status(200).json({ bySubject, byStudent });
  } catch (err) {
    return serverError(res, err, 'OE summary error');
  }
};
