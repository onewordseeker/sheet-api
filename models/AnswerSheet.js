const mongoose = require('mongoose');

const answerSheetSchema = new mongoose.Schema({
  // Basic Information
  learnerName: {
    type: String,
    required: true,
    trim: true
  },
  learnerNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // File Information
  originalPdfName: {
    type: String,
    required: true
  },
  originalPdfPath: {
    type: String,
    required: true
  },
  generatedDocxPath: {
    type: String,
    required: true
  },
  generatedDocxName: {
    type: String,
    required: true
  },
  
  // Content Analysis
  extractedText: {
    type: String,
    required: true
  },
  questionsCount: {
    type: Number,
    required: true,
    default: 0
  },
  tasksCount: {
    type: Number,
    required: true,
    default: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    default: 0
  },
  totalTasks: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Generated Content
  answers: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  wordCount: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Processing Information
  processingTime: {
    type: Number, // in milliseconds
    required: true
  },
  aiModel: {
    type: String,
    required: true,
    default: 'GPT-4'
  },
  temperature: {
    type: Number,
    required: true,
    default: 0.7
  },
  maxTokens: {
    type: Number,
    required: true,
    default: 800
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'deleted'],
    default: 'completed'
  },
  errorMessage: {
    type: String,
    default: null
  },
  
  // File Storage
  storageId: {
    type: String,
    required: true,
    unique: true
  },
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // User Information
  createdBy: {
    type: String,
    default: 'admin@example.com'
  },
  
  // Analytics
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
answerSheetSchema.index({ createdAt: -1 });
answerSheetSchema.index({ learnerName: 1 });
answerSheetSchema.index({ learnerNumber: 1 });
answerSheetSchema.index({ status: 1 });
answerSheetSchema.index({ createdBy: 1 });

// Virtual for formatted date
answerSheetSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Virtual for file size in MB
answerSheetSchema.virtual('fileSizeMB').get(function() {
  return (this.fileSize / (1024 * 1024)).toFixed(2);
});

// Method to increment download count
answerSheetSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Static method to get analytics
answerSheetSchema.statics.getAnalytics = function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $facet: {
        totalSheets: [{ $count: "count" }],
        todaySheets: [
          { $match: { createdAt: { $gte: today } } },
          { $count: "count" }
        ],
        weekSheets: [
          { $match: { createdAt: { $gte: weekAgo } } },
          { $count: "count" }
        ],
        monthSheets: [
          { $match: { createdAt: { $gte: monthAgo } } },
          { $count: "count" }
        ],
        totalQuestions: [
          { $group: { _id: null, total: { $sum: "$totalQuestions" } } }
        ],
        totalTasks: [
          { $group: { _id: null, total: { $sum: "$totalTasks" } } }
        ]
      }
    }
  ]);
};

// Static method to get recent sheets
answerSheetSchema.statics.getRecentSheets = function(limit = 5) {
  return this.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('learnerName learnerNumber questionsCount tasksCount createdAt status storageId generatedDocxName');
};

// Static method to get weekly chart data
answerSheetSchema.statics.getWeeklyChartData = function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
    }
  ]);
};

module.exports = mongoose.model('AnswerSheet', answerSheetSchema);
