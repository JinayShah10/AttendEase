import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  date: {
    type: String,
  },
  time: {
    type: String,
  }
});

const attendanceStatusSchema = new mongoose.Schema({
  sessionIndex: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['P', 'A'],
  }
});

const recordSchema = new mongoose.Schema({
  studentNumber: {
    type: String,
  },
  rollNumber: {
    type: String,
  },
  studentName: {
    type: String,
  },
  attendance: [attendanceStatusSchema]
});

const attendanceRecordSchema = new mongoose.Schema({
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  subjectName: {
    type: String,
    required: true,
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
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  originalFileName: {
    type: String,
  },
  batch: {
    type: String,
    default: '',
  },
  sessions: [sessionSchema],
  records: [recordSchema]
}, {
  timestamps: true,
});

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);
export default AttendanceRecord;
