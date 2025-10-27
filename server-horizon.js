require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

// Import database connection
const connectDB = require('./config/database');

// Import MongoDB models
const AnswerSheet = require('./models/AnswerSheet');
const User = require('./models/User');
const Settings = require('./models/Settings');

// Import our new utility functions
const { extractQuestionsFromText } = require('./utils-horizon');
const { generateAnswersForQuestions } = require('./utils-horizon');
const { createAnswerSheet } = require('./generateAnswerSheetHorizon');

const app = express();
const PORT = process.env.PORT || 5001; // Different port to avoid conflicts

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Storage for generated answer sheets (temporary file storage)
const answerSheetStorage = new Map();

// CORS configuration for horizon-ui - supports both development and production
const corsOptions = {
  origin: function (origin, callback) {
    // Get allowed origins from environment variable or use defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',  // Development
          'https://localhost:3000', // Development with HTTPS
          'https://*.vercel.app',   // Vercel deployments
          'https://*.netlify.app',  // Netlify deployments
          'https://*.railway.app'   // Railway deployments
        ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};

app.use(cors(corsOptions));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'horizon-ui-backend', 
    timestamp: new Date().toISOString(),
    cors: {
      origin: req.headers.origin,
      allowedOrigins: process.env.ALLOWED_ORIGINS || 'default'
    }
  });
});

// CORS debug endpoint
app.get('/api/cors-debug', (req, res) => {
  res.json({
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent'],
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'default',
    timestamp: new Date().toISOString()
  });
});

// Generate answer sheets endpoint for horizon-ui
app.post('/api/generate-answers', upload.single('pdf'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('=== Horizon UI Generate Answers Request ===');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { learnerName, learnerNumber } = req.body;
    
    if (!learnerName || !learnerNumber) {
      return res.status(400).json({ error: 'Learner name and number are required' });
    }

    console.log(`Processing PDF: ${req.file.originalname}`);
    console.log(`Learner: ${learnerName} (${learnerNumber})`);

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const documentText = pdfData.text;

    console.log(`PDF text length: ${documentText.length} characters`);

    // Extract questions from the PDF text
    const questions = extractQuestionsFromText(documentText);
    console.log(`Extracted ${questions.length} questions`);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in the PDF' });
    }

    // Get settings from database
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    const settings = await Settings.getOrCreateSettings(adminUser._id);
    
    // Create OpenAI instance with database settings
    const openaiWithSettings = new OpenAI({
      apiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
    });
    
    // Get number of sheets to generate from settings
    const numberOfSheets = settings.numberOfSheets || 1;
    console.log(`Generating ${numberOfSheets} answer sheet(s)`);

    // Create output directory if it doesn't exist
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const templatePath = path.join(__dirname, '..', 'template.docx');
    const generatedSheets = [];
    const storageIds = [];

    // Generate multiple answer sheets with variation
    for (let sheetNumber = 1; sheetNumber <= numberOfSheets; sheetNumber++) {
      console.log(`=== Generating Answer Sheet ${sheetNumber}/${numberOfSheets} ===`);
      
      try {
        // Generate answers with variation for each sheet
        const answers = await generateAnswersForQuestions(questions, documentText, openaiWithSettings, settings, sheetNumber);
        console.log(`Generated answers for sheet ${sheetNumber}:`, Object.keys(answers));

        // Prepare data for document generation
        const answerSheetData = {
          name: learnerName,
          number: learnerNumber,
          answers: answers,
          wordCount: 0 // Will be calculated in the generation function
        };

        // Generate unique output path for each sheet
        const outputPath = path.join(outputDir, `horizon-answer-sheet-${Date.now()}-${sheetNumber}.docx`);
        
        console.log(`Generating document ${sheetNumber} with template: ${templatePath}`);
        const docxBuffer = await createAnswerSheet(templatePath, outputPath, answerSheetData);

        // Store the buffer for download with unique ID
        const storageId = `horizon-${Date.now()}-${sheetNumber}`;
        answerSheetStorage.set(storageId, {
          buffer: docxBuffer,
          filename: `answer-sheet-${learnerName.replace(/\s+/g, '-')}-${sheetNumber}-${Date.now()}.docx`,
          timestamp: new Date().toISOString()
        });

        generatedSheets.push({
          id: storageId,
          name: `Answer Sheet ${sheetNumber} for ${learnerName}`,
          questions: questions.length,
          tasks: Object.keys(answers).length,
          timestamp: new Date().toISOString()
        });

        storageIds.push(storageId);

        console.log(`✓ Answer sheet ${sheetNumber} generated successfully`);
        
        // Save to MongoDB for this sheet
        const answerSheetRecord = new AnswerSheet({
          learnerName: learnerName,
          learnerNumber: learnerNumber,
          originalPdfName: req.file.originalname,
          originalPdfPath: req.file.path,
          generatedDocxPath: outputPath,
          generatedDocxName: `answer-sheet-${learnerName.replace(/\s+/g, '-')}-${sheetNumber}-${Date.now()}.docx`,
          extractedText: documentText,
          questionsCount: questions.length,
          tasksCount: Object.keys(answers).length,
          totalQuestions: questions.length,
          totalTasks: Object.keys(answers).length,
          answers: answers,
          wordCount: answerSheetData.wordCount,
          processingTime: Date.now() - startTime,
          aiModel: settings.openaiModel || 'GPT-4',
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 800,
          status: 'completed',
          storageId: storageId,
          fileSize: docxBuffer.length,
          createdBy: adminUser.email
        });
        
        await answerSheetRecord.save();
        console.log(`Answer sheet ${sheetNumber} saved to MongoDB:`, answerSheetRecord._id);
        
      } catch (error) {
        console.error(`Error generating answer sheet ${sheetNumber}:`, error);
        
        // Create fallback sheet
        const fallbackData = {
          name: learnerName,
          number: learnerNumber,
          answers: {
            'Task 1: Sample Task': {
              '1': '• This is a sample answer for question 1\n• It demonstrates the format\n• Multiple bullet points are supported',
              '2': '• This is a sample answer for question 2\n• It shows how answers are structured\n• Each answer is properly formatted'
            }
          }
        };

        const outputPath = path.join(outputDir, `horizon-fallback-${Date.now()}-${sheetNumber}.docx`);
        const docxBuffer = await createAnswerSheet(templatePath, outputPath, fallbackData);
        
        const storageId = `horizon-fallback-${Date.now()}-${sheetNumber}`;
        answerSheetStorage.set(storageId, {
          buffer: docxBuffer,
          filename: `fallback-answer-sheet-${learnerName.replace(/\s+/g, '-')}-${sheetNumber}-${Date.now()}.docx`,
          timestamp: new Date().toISOString()
        });

        generatedSheets.push({
          id: storageId,
          name: `Fallback Answer Sheet ${sheetNumber}`,
          questions: 2,
          tasks: 1,
          timestamp: new Date().toISOString()
        });

        storageIds.push(storageId);
      }
    }

    // MongoDB save is now handled inside the loop for each sheet

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Return success response with multiple sheets
    res.json({
      success: true,
      message: `${numberOfSheets} answer sheet(s) generated successfully`,
      questionsCount: questions.length,
      tasksCount: Object.keys(generatedSheets[0]?.answers || {}).length,
      answerSheets: generatedSheets
    });

  } catch (error) {
    console.error('Error generating answer sheet:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Return fallback response with sample data
    const storageId = `horizon-fallback-${Date.now()}`;
    const { createAnswerSheet } = require('./generateAnswerSheetHorizon');
    
    try {
      const sampleData = {
        name: req.body.learnerName || 'Sample Learner',
        number: req.body.learnerNumber || '00000000',
        answers: {
          'Task 1: Sample Task': {
            '1': '• This is a sample answer for question 1\n• It demonstrates the format\n• Multiple bullet points are supported',
            '2': '• This is a sample answer for question 2\n• It shows how answers are structured\n• Each answer is properly formatted'
          }
        }
      };

      const templatePath = path.join(__dirname, '..', 'template.docx');
      const outputPath = path.join('output', `horizon-fallback-${Date.now()}.docx`);
      
      const docxBuffer = await createAnswerSheet(templatePath, outputPath, sampleData);
      
      answerSheetStorage.set(storageId, {
        buffer: docxBuffer,
        filename: `fallback-answer-sheet-${Date.now()}.docx`,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Answer sheet generated with fallback data due to processing error',
        storageId: storageId,
        questionsCount: 2,
        tasksCount: 1,
        warning: 'Generated with sample data due to processing error',
        answerSheets: [{
          id: storageId,
          name: `Fallback Answer Sheet`,
          questions: 2,
          tasks: 1,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (fallbackError) {
      console.error('Fallback generation also failed:', fallbackError);
      res.status(500).json({ 
        error: 'Failed to generate answer sheet',
        details: error.message 
      });
    }
  }
});

// Download answer sheet endpoint for horizon-ui
app.post('/api/download-answer-sheet', async (req, res) => {
  try {
    console.log('Download request body:', req.body);
    const { storageId } = req.body;
    
    if (!storageId) {
      console.log('No storageId provided in request body');
      return res.status(400).json({ error: 'Storage ID is required' });
    }

    // Find the answer sheet in MongoDB
    const answerSheet = await AnswerSheet.findOne({ storageId: storageId, status: 'completed' });
    
    if (!answerSheet) {
      return res.status(404).json({ error: 'Answer sheet not found or deleted' });
    }

    // Check if file exists in temporary storage
    const storedData = answerSheetStorage.get(storageId);
    
    if (!storedData) {
      // Try to read from file system
      try {
        const fileBuffer = fs.readFileSync(answerSheet.generatedDocxPath);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${answerSheet.generatedDocxName}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        
        res.send(fileBuffer);
        
        // Update download count in MongoDB
        await answerSheet.incrementDownload();
        
        return;
      } catch (fileError) {
        console.error('File not found:', fileError);
        return res.status(404).json({ error: 'Answer sheet file not found' });
      }
    }

    const { buffer, filename } = storedData;
    
    if (!buffer) {
      return res.status(404).json({ error: 'Answer sheet buffer not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
    
    // Update download count in MongoDB
    await answerSheet.incrementDownload();
    
    // Clean up after download (optional - you might want to keep for a while)
    // answerSheetStorage.delete(storageId);
    
  } catch (error) {
    console.error('Error downloading answer sheet:', error);
    res.status(500).json({ error: 'Failed to download answer sheet' });
  }
});

// Download sample answer sheet endpoint for horizon-ui
app.get('/api/download-sample', async (req, res) => {
  try {
    console.log('=== Horizon UI Download Sample Request ===');
    
    const { createAnswerSheet } = require('./generateAnswerSheetHorizon');
    
    // Sample data for demonstration
    const sampleData = {
      name: 'Sample Learner',
      number: '12345678',
      answers: {
        'Task 1: Health and Safety Management': {
          '1(a)': '• Identify potential hazards in the workplace\n• Assess the risks associated with each hazard\n• Implement control measures to minimize risks\n• Monitor and review the effectiveness of controls',
          '1(b)': '• Conduct regular safety inspections\n• Provide appropriate training to employees\n• Maintain safety equipment and procedures\n• Report and investigate incidents promptly'
        },
        'Task 2: Risk Assessment': {
          '2': '• Define the scope of the risk assessment\n• Identify all potential hazards\n• Evaluate the likelihood and severity of risks\n• Implement appropriate control measures\n• Review and update the assessment regularly'
        },
        'Task 3: Emergency Procedures': {
          '3(a)': '• Develop comprehensive emergency response plans\n• Train all staff on emergency procedures\n• Conduct regular emergency drills\n• Maintain emergency equipment and supplies',
          '3(b)': '• Establish clear communication protocols\n• Designate emergency response team members\n• Create evacuation routes and assembly points\n• Coordinate with local emergency services'
        }
      }
    };

    // Create output directory if it doesn't exist
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate sample document
    const templatePath = path.join(__dirname, '..', 'template.docx');
    const outputPath = path.join(outputDir, `horizon-sample-${Date.now()}.docx`);
    
    console.log(`Generating sample document with template: ${templatePath}`);
    const docxBuffer = await createAnswerSheet(templatePath, outputPath, sampleData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="sample-answer-sheet.docx"');
    res.setHeader('Content-Length', docxBuffer.length);
    
    res.send(docxBuffer);
    
    console.log('Sample answer sheet generated and sent successfully');
    
  } catch (error) {
    console.error('Error generating sample answer sheet:', error);
    res.status(500).json({ 
      error: 'Failed to generate sample answer sheet',
      details: error.message 
    });
  }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);
    
    // Find user in database
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate token (in production, use JWT)
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update last login
    await user.updateLastLogin();
    
    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    // In a real app, you would invalidate the token
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    // For now, use default admin user ID (in production, get from JWT token)
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    const settings = await Settings.getOrCreateSettings(adminUser._id);
    
    // Map backend field names to frontend field names
    const frontendSettings = {
      ...settings.toObject(),
      // Map backend field names to frontend field names
      chatgptModel: settings.openaiModel,
      numberOfSheets: settings.numberOfSheets || 1, // Use database value
      // Add frontend-specific fields with defaults
      customPrompt: '',
      apiKeyVisible: false,
      autoSave: true,
      darkMode: false,
    };
    
    res.json({
      success: true,
      settings: frontendSettings
    });
  } catch (error) {
    console.error('Settings load error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    console.log('=== Settings Update Request ===');
    console.log('Request body:', req.body);
    
    // Extract settings from the request body (frontend sends { settings: {...} })
    const rawSettings = req.body.settings || req.body;
    
    // Map frontend field names to backend field names
    const newSettings = {
      ...rawSettings,
      // Map frontend field names to backend field names
      openaiModel: rawSettings.chatgptModel || rawSettings.openaiModel,
      numberOfSheets: rawSettings.numberOfSheets, // Keep numberOfSheets from frontend
      // Remove frontend-specific fields that don't exist in backend schema
      customPrompt: undefined,
      apiKeyVisible: undefined,
      autoSave: undefined,
      darkMode: undefined,
    };
    
    // Remove undefined values
    Object.keys(newSettings).forEach(key => {
      if (newSettings[key] === undefined) {
        delete newSettings[key];
      }
    });
    
    // For now, use default admin user ID (in production, get from JWT token)
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    if (!adminUser) {
      console.log('Admin user not found');
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    console.log('Admin user found:', adminUser._id);
    
    const settings = await Settings.getOrCreateSettings(adminUser._id);
    console.log('Current settings before update:', settings);
    
    const updatedSettings = await settings.updateSettings(newSettings);
    console.log('Settings after update:', updatedSettings);
    
    res.json({
      success: true,
      message: 'Settings saved successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Settings save error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.post('/api/test-openai-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Test the API key by making a simple request
    const testOpenai = new OpenAI({ apiKey: apiKey });
    
    const completion = await testOpenai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5,
    });
    
    res.json({
      success: true,
      message: 'API key is valid',
      testResponse: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('OpenAI key test error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid API key or OpenAI service error',
      error: error.message
    });
  }
});

// Dashboard analytics endpoints
app.get('/api/dashboard/analytics', async (req, res) => {
  try {
    // Get analytics from database
    const analyticsResult = await AnswerSheet.getAnalytics();
    const analytics = analyticsResult[0];
    
    // Get recent sheets
    const recentSheets = await AnswerSheet.getRecentSheets(5);
    
    // Get current settings
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    const settings = await Settings.getOrCreateSettings(adminUser._id);
    
    // Get weekly chart data
    const weeklyChartData = await AnswerSheet.getWeeklyChartData();
    
    // Format weekly data
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weeklyData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayData = weeklyChartData.find(item => 
        item._id.year === date.getFullYear() &&
        item._id.month === date.getMonth() + 1 &&
        item._id.day === date.getDate()
      );
      
      weeklyData.push({
        date: date.toISOString().split('T')[0],
        count: dayData ? dayData.count : 0
      });
    }
    
    res.json({
      success: true,
      analytics: {
        overview: {
          totalSheets: analytics.totalSheets[0]?.count || 0,
          todaySheets: analytics.todaySheets[0]?.count || 0,
          weekSheets: analytics.weekSheets[0]?.count || 0,
          monthSheets: analytics.monthSheets[0]?.count || 0,
          totalQuestions: analytics.totalQuestions[0]?.total || 0,
          totalTasks: analytics.totalTasks[0]?.total || 0
        },
        currentModel: {
          name: settings.openaiModel || 'GPT-4',
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 800,
          apiKeyConfigured: !!settings.openaiApiKey
        },
        recentSheets: recentSheets.map(sheet => ({
          id: sheet.storageId,
          learnerName: sheet.learnerName,
          learnerNumber: sheet.learnerNumber,
          questionsCount: sheet.questionsCount,
          tasksCount: sheet.tasksCount,
          createdAt: sheet.createdAt,
          status: sheet.status,
          filename: sheet.generatedDocxName
        })),
        charts: {
          weekly: weeklyData,
          monthly: [] // TODO: Implement monthly chart data
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Answer sheets history endpoints
app.get('/api/answer-sheets/history', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { status: 'completed' };
    if (search) {
      query.$or = [
        { learnerName: { $regex: search, $options: 'i' } },
        { learnerNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get answer sheets with pagination
    const answerSheets = await AnswerSheet.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('learnerName learnerNumber questionsCount tasksCount createdAt status storageId generatedDocxName fileSize');
    
    // Get total count
    const total = await AnswerSheet.countDocuments(query);
    
    res.json({
      success: true,
      answerSheets: answerSheets.map(sheet => ({
        id: sheet.storageId,
        learnerName: sheet.learnerName,
        learnerNumber: sheet.learnerNumber,
        questionsCount: sheet.questionsCount,
        tasksCount: sheet.tasksCount,
        createdAt: sheet.createdAt,
        status: sheet.status,
        filename: sheet.generatedDocxName,
        fileSize: sheet.fileSize
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('History load error:', error);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

app.delete('/api/answer-sheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and update the answer sheet status to deleted
    const answerSheet = await AnswerSheet.findOne({ storageId: id });
    
    if (!answerSheet) {
      return res.status(404).json({ error: 'Answer sheet not found' });
    }
    
    // Update status to deleted (soft delete)
    answerSheet.status = 'deleted';
    await answerSheet.save();
    
    // Remove from temporary storage
    answerSheetStorage.delete(id);
    
    res.json({
      success: true,
      message: 'Answer sheet deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete answer sheet' });
  }
});

// User profile endpoints
app.get('/api/user/profile', async (req, res) => {
  try {
    const user = await User.findOne({ email: 'admin@example.com' });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountCreated: user.accountCreated,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount
      }
    });
  } catch (error) {
    console.error('Profile load error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/user/profile', async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const user = await User.findOne({ email: 'admin@example.com' });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user fields
    if (fullName) user.fullName = fullName;
    if (email && email !== user.email) {
      // Check if new email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      user.email = email.toLowerCase();
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountCreated: user.accountCreated,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/user/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findOne({ email: 'admin@example.com' });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Create default admin user if it doesn't exist
    await User.createDefaultAdmin();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Horizon UI Backend Server running on port ${PORT}`);
      console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
      console.log(`📄 Output directory: ${path.join(__dirname, 'output')}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🗄️ MongoDB connected and ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
