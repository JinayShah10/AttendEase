import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  subjectName: {
    type: String,
  },
  subjectCode: {
    type: String,
  },
  classYear: {
    type: String,
  },
  division: {
    type: String,
  },
  lectureType: {
    type: String,
  }
});

const facultySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  department: {
    type: String,
  },
  role: {
    type: String,
    default: 'faculty',
  },
  subjects: [subjectSchema],
}, {
  timestamps: true,
});

const Faculty = mongoose.model('Faculty', facultySchema);
export default Faculty;
