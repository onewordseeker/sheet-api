const mongoose = require('mongoose');

const candidateListSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  entriesCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: String,
    default: 'admin@example.com',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

candidateListSchema.index({ title: 1 });

module.exports = mongoose.model('CandidateList', candidateListSchema);


