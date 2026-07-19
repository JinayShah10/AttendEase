import mongoose from 'mongoose';

/**
 * TY Program Elective schema.
 * Each document represents one elective option (a theory+lab pair) in either SET1 or SET2.
 *
 * Example:
 *   { set: "SET1", theory: "TSA", lab: "TSA Lab", ... }
 *   { set: "SET2", theory: "CV",  lab: "CV Lab",  ... }
 */
const programElectiveSchema = new mongoose.Schema({
  set: {
    type: String,
    required: true,
    enum: ['SET1', 'SET2']
  },
  subjectName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['THEORY', 'LAB']
  },
  pairKey: {
    type: String,
    required: true
  },
  code: {
    type: String
  },
  fullName: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Compound unique index: prevent duplicate subjects of a set and type
programElectiveSchema.index({ set: 1, subjectName: 1, type: 1 }, { unique: true });

const ProgramElective = mongoose.models.ProgramElective ||
  mongoose.model('ProgramElective', programElectiveSchema, 'TY_PE');

export default ProgramElective;
