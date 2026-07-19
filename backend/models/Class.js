import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  year: {
    type: String
  },
  division: {
    type: String
  }
}, { timestamps: true });

const Class = mongoose.model('Class', classSchema);
export default Class;
