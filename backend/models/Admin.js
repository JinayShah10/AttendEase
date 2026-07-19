import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
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
    default: 'admin',
  },
  assignedClass: {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    name: {
      type: String,
    },
    year: {
      type: String,
    },
    division: {
      type: String,
    },
    academicYear: {
      type: String,
    }
  }
}, {
  timestamps: true,
});

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
