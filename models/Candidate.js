const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateList',
    required: true,
    index: true,
  },
  sequenceId: {
    type: Number,
    default: null,
  },
  learnerName: {
    type: String,
    required: true,
    trim: true,
  },
  learnerId: {
    type: String,
    required: true,
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

candidateSchema.index({ listId: 1, sequenceId: 1 });
candidateSchema.index({ listId: 1, learnerId: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);


