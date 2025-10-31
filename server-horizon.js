require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

// Import database connection
const connectDB = require('./config/database');

// Import MongoDB models
const AnswerSheet = require('./models/AnswerSheet');
const User = require('./models/User');
const Settings = require('./models/Settings');
const CandidateList = require('./models/CandidateList');
const Candidate = require('./models/Candidate');

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

// Configure multer for file uploads (PDF)
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

// Separate multer instance for CSV uploads
const csvStorage = multer.diskStorage({
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

const uploadCsv = multer({
  storage: csvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Minimal CSV parser: expects header with sequence id, learner name, learner id
function parseCsvSimple(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines.shift();
  const cols = header.split(',').map(h => h.trim().toLowerCase());
  const idxSeq = cols.findIndex(c => c.includes('sequence'));
  const idxName = cols.findIndex(c => c.includes('name'));
  const idxId = cols.findIndex(c => c.includes('id') || c.includes('number'));
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    const sequenceId = idxSeq >= 0 ? (parseInt(parts[idxSeq], 10) || null) : null;
    const learnerName = idxName >= 0 ? parts[idxName] : parts[0];
    const learnerId = idxId >= 0 ? parts[idxId] : parts[1] || '';
    if (learnerName && learnerId) {
      rows.push({ sequenceId, learnerName, learnerId });
    }
  }
  return rows;
}

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

// Candidate Lists: upload CSV and manage lists
app.post('/api/candidate-lists/upload', uploadCsv.single('file'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const csvBuffer = fs.readFileSync(req.file.path);
    const text = csvBuffer.toString('utf-8');
    const rows = parseCsvSimple(text);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No valid rows found in CSV' });
    }

    const adminUser = await User.findOne({ email: 'admin@example.com' });
    const list = new CandidateList({ title, description: description || '', createdBy: adminUser?.email || 'admin@example.com', entriesCount: rows.length });
    await list.save();

    const docs = rows.map(r => ({ listId: list._id, sequenceId: r.sequenceId, learnerName: r.learnerName, learnerId: r.learnerId }));
    await Candidate.insertMany(docs);

    fs.unlinkSync(req.file.path);

    res.json({ success: true, listId: list._id, title: list.title, entriesCount: rows.length });
  } catch (error) {
    console.error('CSV upload error:', error);
    return res.status(500).json({ error: 'Failed to upload CSV list' });
  }
});

app.get('/api/candidate-lists', async (req, res) => {
  try {
    const lists = await CandidateList.find().sort({ createdAt: -1 });
    res.json({ success: true, lists: lists.map(l => ({ id: l._id, title: l.title, description: l.description, entriesCount: l.entriesCount, createdAt: l.createdAt })) });
  } catch (error) {
    console.error('List fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

app.get('/api/candidate-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const list = await CandidateList.findById(id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    const candidates = await Candidate.find({ listId: id }).sort({ sequenceId: 1, learnerName: 1 });
    res.json({ success: true, list: { id: list._id, title: list.title, description: list.description, entriesCount: list.entriesCount, createdAt: list.createdAt }, candidates: candidates.map(c => ({ id: c._id, sequenceId: c.sequenceId, learnerName: c.learnerName, learnerId: c.learnerId })) });
  } catch (error) {
    console.error('List detail error:', error);
    res.status(500).json({ error: 'Failed to fetch list details' });
  }
});

app.patch('/api/candidate-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const list = await CandidateList.findById(id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    if (title !== undefined) list.title = title;
    if (description !== undefined) list.description = description;
    await list.save();
    res.json({ success: true, list: { id: list._id, title: list.title, description: list.description } });
  } catch (error) {
    console.error('List update error:', error);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

app.delete('/api/candidate-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const list = await CandidateList.findById(id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    await Candidate.deleteMany({ listId: id });
    await list.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('List delete error:', error);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

app.patch('/api/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sequenceId, learnerName, learnerId } = req.body;
    const c = await Candidate.findById(id);
    if (!c) return res.status(404).json({ error: 'Candidate not found' });
    if (sequenceId !== undefined) c.sequenceId = sequenceId;
    if (learnerName !== undefined) c.learnerName = learnerName;
    if (learnerId !== undefined) c.learnerId = learnerId;
    await c.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Candidate update error:', error);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

app.delete('/api/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const c = await Candidate.findById(id);
    if (!c) return res.status(404).json({ error: 'Candidate not found' });
    await c.deleteOne();
    await CandidateList.findByIdAndUpdate(c.listId, { $inc: { entriesCount: -1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Candidate delete error:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
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

    const templatePath = path.join(__dirname, 'template.docx');
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

      const templatePath = path.join(__dirname, 'template.docx');
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

// Batch generation: one answer sheet per candidate
app.post('/api/generate-answers/batch', upload.single('pdf'), async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    const { listId, candidateIds, generateAll } = req.body;
    if (!listId) return res.status(400).json({ error: 'listId is required' });

    const list = await CandidateList.findById(listId);
    if (!list) return res.status(404).json({ error: 'List not found' });

    let selectedCandidates = [];
    if (generateAll === 'true' || generateAll === true) {
      selectedCandidates = await Candidate.find({ listId }).sort({ sequenceId: 1, learnerName: 1 });
    } else {
      const ids = Array.isArray(candidateIds) ? candidateIds : (candidateIds ? [candidateIds] : []);
      if (ids.length === 0) return res.status(400).json({ error: 'candidateIds are required unless generateAll=true' });
      selectedCandidates = await Candidate.find({ _id: { $in: ids } });
    }

    if (selectedCandidates.length === 0) {
      return res.status(400).json({ error: 'No candidates to generate' });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const documentText = pdfData.text;

    const questions = extractQuestionsFromText(documentText);
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in the PDF' });
    }

    const adminUser = await User.findOne({ email: 'admin@example.com' });
    const settings = await Settings.getOrCreateSettings(adminUser._id);
    const openaiWithSettings = new OpenAI({ apiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY });

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const templatePath = path.join(__dirname, 'template.docx');

    const results = [];

    for (const cand of selectedCandidates) {
      try {
        const answers = await generateAnswersForQuestions(questions, documentText, openaiWithSettings, settings, 1);
        const answerSheetData = { name: cand.learnerName, number: cand.learnerId, answers, wordCount: 0 };
        const outputPath = path.join(outputDir, `horizon-answer-sheet-${Date.now()}-${cand._id}.docx`);
        const docxBuffer = await createAnswerSheet(templatePath, outputPath, answerSheetData);

        const storageId = `horizon-${Date.now()}-${cand._id}`;
        answerSheetStorage.set(storageId, {
          buffer: docxBuffer,
          filename: `answer-sheet-${cand.learnerName.replace(/\s+/g, '-')}-${Date.now()}.docx`,
          timestamp: new Date().toISOString()
        });

        const record = new AnswerSheet({
          learnerName: cand.learnerName,
          learnerNumber: cand.learnerId,
          originalPdfName: req.file.originalname,
          originalPdfPath: req.file.path,
          generatedDocxPath: outputPath,
          generatedDocxName: `answer-sheet-${cand.learnerName.replace(/\s+/g, '-')}-${Date.now()}.docx`,
          extractedText: documentText,
          questionsCount: questions.length,
          tasksCount: Object.keys(answers).length,
          totalQuestions: questions.length,
          totalTasks: Object.keys(answers).length,
          answers: answers,
          wordCount: 0,
          processingTime: Date.now() - startTime,
          aiModel: settings.openaiModel || 'GPT-4',
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 800,
          status: 'completed',
          storageId: storageId,
          fileSize: docxBuffer.length,
          createdBy: adminUser.email
        });
        await record.save();

        results.push({ id: storageId, candidateId: cand._id, name: cand.learnerName });
      } catch (err) {
        console.error('Batch generation error for candidate', cand._id, err);
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({ success: true, generated: results, count: results.length });
  } catch (error) {
    console.error('Batch generation error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to generate batch answer sheets' });
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

// Download multiple answer sheets as a ZIP
app.post('/api/download-answer-sheets-zip', async (req, res) => {
  try {
    const { storageIds } = req.body || {};
    if (!Array.isArray(storageIds) || storageIds.length === 0) {
      return res.status(400).json({ error: 'storageIds array is required' });
    }

    // Prepare response headers for zip streaming
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="answer-sheets.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      try { res.status(500).end(); } catch (e) {}
    });
    archive.pipe(res);

    for (const id of storageIds) {
      try {
        const answerSheet = await AnswerSheet.findOne({ storageId: id, status: 'completed' });
        if (!answerSheet) {
          continue;
        }

        // Try in-memory buffer first
        const storedData = answerSheetStorage.get(id);
        let buffer = storedData?.buffer;
        let filename = storedData?.filename || answerSheet.generatedDocxName || `answer-sheet-${id}.docx`;

        if (!buffer && answerSheet.generatedDocxPath && fs.existsSync(answerSheet.generatedDocxPath)) {
          buffer = fs.readFileSync(answerSheet.generatedDocxPath);
        }

        if (buffer) {
          archive.append(buffer, { name: filename });
        }
      } catch (err) {
        console.error('Error adding file to zip:', id, err);
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('ZIP download error:', error);
    res.status(500).json({ error: 'Failed to create ZIP file' });
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
    const templatePath = path.join(__dirname, 'template.docx');
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
