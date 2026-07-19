import mongoose from 'mongoose';

const openElectiveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  shortName: {
    type: String
  },
  code: {
    type: String
  },
  fullName: {
    type: String
  },
  category: {
    type: String,
    default: 'Open Elective'
  },
  type: {
    type: String,
    default: 'Theory'
  },
  isOE: {
    type: Boolean,
    default: true
  },
  year: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  electiveCategory: {
    type: String,
    enum: ['NONE', 'OE', 'DEPARTMENT_ELECTIVE'],
    default: 'OE'
  }
}, { timestamps: true });

// Helper to get the correct OpenElective model dynamically (SY_OE or TY_OE)
export const getOpenElectiveModel = (classYear) => {
  const rawClassYear = String(classYear).toUpperCase();
  let safeYear = 'SY';
  if (rawClassYear.includes('TY') || rawClassYear.includes('TE')) safeYear = 'TY';
  const collectionName = `${safeYear}_OE`;
  
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return mongoose.model(collectionName, openElectiveSchema, collectionName);
};

// Specifically use the collection name 'SY_OE' as requested by default
const OpenElective = mongoose.models.OpenElective || mongoose.model('OpenElective', openElectiveSchema, 'SY_OE');
export default OpenElective;
