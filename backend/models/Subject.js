import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
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
    type: String
  },
  year: {
    type: String, // 'SY' or 'TY'
    required: true
  },
  type: {
    type: String,
    required: true
  },
  isOE: {
    type: Boolean,
    default: false
  },
  electiveCategory: {
    type: String,
    enum: ['NONE', 'OE', 'DEPARTMENT_ELECTIVE'],
    default: 'NONE'
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Subject = mongoose.model('Subject', subjectSchema);
export default Subject;
