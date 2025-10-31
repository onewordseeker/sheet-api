const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // User Reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // OpenAI Configuration
  openaiApiKey: {
    type: String,
    default: ''
  },
  openaiModel: {
    type: String,
    default: 'gpt-4.1-mini',
    enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4.1-mini']
  },
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 2
  },
  maxTokens: {
    type: Number,
    default: 800,
    min: 100,
    max: 4000
  },
  
  // File Upload Settings
  maxFileSize: {
    type: Number,
    default: 10, // MB
    min: 1,
    max: 100
  },
  allowedFileTypes: {
    type: [String],
    default: ['pdf']
  },
  
  // Default Values
  defaultLearnerName: {
    type: String,
    default: ''
  },
  defaultLearnerNumber: {
    type: String,
    default: ''
  },
  
  // Answer Generation Settings
  numberOfSheets: {
    type: Number,
    default: 1,
    min: 1
  },
  answerFormat: {
    type: String,
    default: 'bullet-points',
    enum: ['bullet-points', 'paragraph', 'numbered', 'mixed']
  },
  wordCountTarget: {
    type: Number,
    default: 500,
    min: 100,
    max: 2000
  },
  includeExamples: {
    type: Boolean,
    default: true
  },
  includeReferences: {
    type: Boolean,
    default: false
  },
  // Prompt Settings
  systemPrompt: {
    type: String,
    default: ''
  },
  
  // Template Settings
  templatePath: {
    type: String,
    default: 'template.docx'
  },
  customTemplate: {
    type: String,
    default: null
  },
  
  // Notification Settings
  notifications: {
    onGenerationComplete: {
      type: Boolean,
      default: true
    },
    onError: {
      type: Boolean,
      default: true
    },
    weeklyReport: {
      type: Boolean,
      default: false
    }
  },
  
  // Analytics Settings
  analytics: {
    trackUsage: {
      type: Boolean,
      default: true
    },
    shareAnonymousData: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
settingsSchema.index({ userId: 1 }, { unique: true });

// Method to update settings
settingsSchema.methods.updateSettings = function(newSettings) {
  console.log('=== Settings Model Update ===');
  console.log('New settings received:', newSettings);
  console.log('Current settings before update:', this.toObject());
  
  Object.keys(newSettings).forEach(key => {
    if (this.schema.paths[key] && newSettings[key] !== undefined) {
      console.log(`Updating ${key}: ${this[key]} -> ${newSettings[key]}`);
      this[key] = newSettings[key];
    } else {
      console.log(`Skipping ${key}: ${!this.schema.paths[key] ? 'not in schema' : 'undefined value'}`);
    }
  });
  
  this.updatedAt = new Date();
  console.log('Settings after update (before save):', this.toObject());
  
  return this.save();
};

// Static method to get or create settings for user
settingsSchema.statics.getOrCreateSettings = async function(userId) {
  let settings = await this.findOne({ userId });
  
  if (!settings) {
    settings = new this({ userId });
    await settings.save();
  }
  
  return settings;
};

// Static method to get default settings
settingsSchema.statics.getDefaultSettings = function() {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: 'gpt-4.1-mini',
    temperature: 0.7,
    maxTokens: 800,
    maxFileSize: 10,
    allowedFileTypes: ['pdf'],
    defaultLearnerName: '',
    defaultLearnerNumber: '',
    answerFormat: 'bullet-points',
    wordCountTarget: 500,
    includeExamples: true,
    includeReferences: false,
    systemPrompt: '',
    templatePath: 'template.docx',
    customTemplate: null,
    notifications: {
      onGenerationComplete: true,
      onError: true,
      weeklyReport: false
    },
    analytics: {
      trackUsage: true,
      shareAnonymousData: false
    }
  };
};

module.exports = mongoose.model('Settings', settingsSchema);
