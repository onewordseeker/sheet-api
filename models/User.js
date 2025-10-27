const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['admin', 'user', 'viewer'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  department: {
    type: String,
    default: null
  },
  
  // Account Information
  accountCreated: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  
  // Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // API Usage Tracking
  apiUsage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    lastRequestAt: {
      type: Date,
      default: null
    },
    monthlyLimit: {
      type: Number,
      default: 1000
    },
    currentMonthUsage: {
      type: Number,
      default: 0
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
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastLogin: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// Method to increment API usage
userSchema.methods.incrementApiUsage = function() {
  this.apiUsage.totalRequests += 1;
  this.apiUsage.lastRequestAt = new Date();
  
  // Reset monthly usage if new month
  const now = new Date();
  const lastRequest = this.apiUsage.lastRequestAt;
  if (lastRequest && (now.getMonth() !== lastRequest.getMonth() || now.getFullYear() !== lastRequest.getFullYear())) {
    this.apiUsage.currentMonthUsage = 0;
  }
  
  this.apiUsage.currentMonthUsage += 1;
  return this.save();
};

// Virtual for user display name
userSchema.virtual('displayName').get(function() {
  return this.fullName || this.email.split('@')[0];
});

// Static method to create default admin user
userSchema.statics.createDefaultAdmin = async function() {
  const existingAdmin = await this.findOne({ email: 'admin@example.com' });
  
  if (!existingAdmin) {
    const admin = new this({
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      isActive: true
    });
    
    await admin.save();
    console.log('Default admin user created');
    return admin;
  }
  
  return existingAdmin;
};

module.exports = mongoose.model('User', userSchema);
