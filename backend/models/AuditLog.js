import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  userEmail: {
    type: String,
    default: 'unknown'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CLEAR_ALL_DATA',
      'DELETE_UPLOAD',
      'USER_REGISTERED',
      'LOGIN_FAILED',
      'LOGIN_SUCCESS',
      'LOGOUT',
      'OTHER'
    ]
  },
  details: {
    type: String,
    default: ''
  },
  targetCollection: {
    type: String,
    default: null
  },
  recordCount: {
    type: Number,
    default: 0
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
