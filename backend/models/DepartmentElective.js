import mongoose from 'mongoose';

const departmentElectiveSchema = new mongoose.Schema({
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
    default: 'Department Elective'
  },
  type: {
    type: String,
    default: 'Theory'
  },
  isOE: {
    type: Boolean,
    default: false
  },
  year: {
    type: String,
    default: 'TY'
  },
  active: {
    type: Boolean,
    default: true
  },
  electiveCategory: {
    type: String,
    enum: ['NONE', 'OE', 'DEPARTMENT_ELECTIVE'],
    default: 'DEPARTMENT_ELECTIVE'
  }
}, { timestamps: true });

const DepartmentElective = mongoose.models.DepartmentElective || mongoose.model('DepartmentElective', departmentElectiveSchema, 'TY_DE');
export default DepartmentElective;
