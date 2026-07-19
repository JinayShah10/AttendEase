import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  sapId: {
    type: String,
    required: true,
    unique: true
  },
  rollNumber: {
    type: String
  },
  studentName: {
    type: String
  },
  classYear: {
    type: String
  },
  division: {
    type: String
  },
  academicYear: {
    type: String
  },
  OE: {
    type: String,
    default: '',
    index: true
  },
  DE: {
    type: String,
    default: '',
    index: true
  },
  PE1: {
    type: String,
    default: '',
    index: true
  },
  PE2: {
    type: String,
    default: '',
    index: true
  },
  oeAttended: {
    type: Number,
    default: 0
  },
  oeTotal: {
    type: Number,
    default: 0
  },
  honoursSubject: {
    type: String,
    default: '',
    index: true
  },
  batch: {
    type: String,
    default: '',
    index: true
  }
}, {
  timestamps: true
});

export const getStudentModel = (division, classYear) => {
  if (!division || !classYear || String(division).toLowerCase() === 'undefined' || String(classYear).toLowerCase() === 'undefined') {
    throw new Error(`Cannot instantiate student model: division (${division}) and classYear (${classYear}) must be defined and valid.`);
  }

  // Calculate academic year
  const now = new Date();
  const month = now.getMonth();
  let startYear = now.getFullYear();
  if (month < 5) startYear -= 1;
  const academicYear = `${startYear}-${(startYear + 1).toString().slice(-2)}`;

  // Smartly extract only the year acronym (FE, SE, SY, TE, TY, BE) from the classYear string
  const rawClassYear = String(classYear).toUpperCase();
  let safeYear = rawClassYear.replace(/[^A-Z]/g, '');
  
  if (safeYear.includes('SY') || safeYear.includes('SE')) safeYear = 'SY';
  else if (safeYear.includes('TY') || safeYear.includes('TE')) safeYear = 'TY';
  else if (safeYear.includes('FE')) safeYear = 'FE';
  else if (safeYear.includes('BE')) safeYear = 'BE';
  else safeYear = safeYear.substring(0, 2); // Fallback to first two letters if unknown

  const safeDivision = String(division).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (safeDivision === 'ALL') {
    throw new Error("Cannot instantiate student model for division 'ALL'");
  }
  
  // Format: SY_D1_2025-26
  const collectionName = `${safeYear}_${safeDivision}_${academicYear}`;
  
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  
  return mongoose.model(collectionName, studentSchema, collectionName);
};
