import mongoose from 'mongoose';

const uploadedFileSchema = new mongoose.Schema({
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  facultyName: {
    type: String,
  },
  subjectName: {
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
  originalFileName: {
    type: String,
    required: true,
  },
  storedFilePath: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'error', 'overwritten'],
    default: 'pending',
  },
  processedDivisions: [{
    type: String
  }],
  attendanceRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceRecord',
  },
  batch: {
    type: String,
    default: '',
  }
}, {
  timestamps: true,
});

const UploadedFile = mongoose.model('UploadedFile', uploadedFileSchema);
export default UploadedFile;
