const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Temporary storage for generated answer sheets
const answerSheetStorage = new Map();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper function to extract text from DOCX
async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

// Helper function to extract questions from PDF text
function extractQuestions(text) {
  const questions = [];
  
  // First, find all task sections with their titles
  const taskMatches = [...text.matchAll(/Task\s+(\d+):\s*([^\n]+)/gi)];
  
  console.log(`Found ${taskMatches.length} tasks`);
  
  for (let taskIndex = 0; taskIndex < taskMatches.length; taskIndex++) {
    const taskMatch = taskMatches[taskIndex];
    const taskNumber = taskMatch[1];
    const taskTitle = taskMatch[2].trim();
    
    // Get the text for this task (from current task to next task or end)
    const taskStartIndex = taskMatch.index + taskMatch[0].length;
    const nextTaskIndex = taskIndex < taskMatches.length - 1 
      ? taskMatches[taskIndex + 1].index 
      : text.length;
    const taskSection = text.substring(taskStartIndex, nextTaskIndex);
    
    console.log(`\n=== Task ${taskNumber}: ${taskTitle} ===`);
    
    const questionMatches = [];
    
    // Pattern 1: "1 (a)" with space and parentheses - the FIRST sub-question
    const pattern1 = new RegExp(`\\n\\s*${taskNumber}\\s+\\(\\s*([a-z])\\s*\\)`, 'gi');
    let match;
    while ((match = pattern1.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = `${taskNumber}(${subLetter})`;
      questionMatches.push({
        index: match.index,
        id: questionId,
        fullMatch: match[0],
        pattern: 'pattern1'
      });
      console.log(`Found with pattern1: ${questionId} at index ${match.index}`);
    }
    
    // Pattern 2: " (b)", " (c)", etc. - SUBSEQUENT sub-questions without the number prefix
    // This catches cases where the PDF has just "(b)" instead of "1 (b)"
    const pattern2 = new RegExp(`\\n\\s+\\(\\s*([a-z])\\s*\\)`, 'gi');
    while ((match = pattern2.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = `${taskNumber}(${subLetter})`;
      
      // Check if we already have this question (avoid duplicates)
      if (!questionMatches.find(q => q.id === questionId)) {
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: 'pattern2'
        });
        console.log(`Found with pattern2: ${questionId} at index ${match.index}`);
      }
    }
    
    // Pattern 3: "1(a)" without space (alternative format)
    if (questionMatches.length === 0) {
      const pattern3 = new RegExp(`\\n\\s*${taskNumber}\\(\\s*([a-z])\\s*\\)`, 'gi');
      while ((match = pattern3.exec(taskSection)) !== null) {
        const subLetter = match[1];
        const questionId = `${taskNumber}(${subLetter})`;
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: 'pattern3'
        });
        console.log(`Found with pattern3: ${questionId} at index ${match.index}`);
      }
    }
    
    // Pattern 4: Look for standalone number at start of line (for questions without sub-parts)
    if (questionMatches.length === 0) {
      const pattern4 = new RegExp(`\\n\\s*${taskNumber}\\s+(?=[A-Z])`, 'gi');
      const standaloneMatch = pattern4.exec(taskSection);
      
      if (standaloneMatch) {
        questionMatches.push({
          index: standaloneMatch.index,
          id: taskNumber,
          fullMatch: standaloneMatch[0],
          pattern: 'pattern4'
        });
        console.log(`Found with pattern4: ${taskNumber} at index ${standaloneMatch.index}`);
      }
    }
    
    // Sort by index to get them in order
    questionMatches.sort((a, b) => a.index - b.index);
    
    console.log(`Total matches found for Task ${taskNumber}: ${questionMatches.length}`);
    
    // Extract the text for each question
    for (let qIndex = 0; qIndex < questionMatches.length; qIndex++) {
      const currentQuestion = questionMatches[qIndex];
      const nextQuestion = questionMatches[qIndex + 1];
      
      const startIndex = currentQuestion.index + currentQuestion.fullMatch.length;
      const endIndex = nextQuestion ? nextQuestion.index : taskSection.length;
      
      let questionText = taskSection.substring(startIndex, endIndex).trim();
      
      // Clean up the question text
      questionText = questionText
        .replace(/\(\d+\)\s*$/gm, '') // Remove marks notation at end
        .replace(/Note:.*$/gims, '') // Remove notes
        .replace(/^\s*\n+/gm, '') // Remove leading newlines
        .trim();
      
      // Only add if there's meaningful content
      if (questionText.length > 10) {
        questions.push({
          number: currentQuestion.id,
          taskNumber: parseInt(taskNumber),
          taskTitle: taskTitle,
          text: questionText,
          fullQuestion: `Task ${taskNumber}: ${taskTitle}\n${currentQuestion.id} ${questionText}`
        });
        
        console.log(`✓ Extracted question: Task ${taskNumber}, Question ${currentQuestion.id}`);
      } else {
        console.log(`✗ Skipped empty question: Task ${taskNumber}, Question ${currentQuestion.id}`);
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total extracted questions: ${questions.length}`);
  console.log('Question numbers:', questions.map(q => q.number).join(', '));
  
  return questions;
}

// Helper function to extract marks from question text
function extractMarks(questionText) {
  const markPatterns = [
    /\((\d+)\s*marks?\)/gi,
    /\[(\d+)\s*marks?\]/gi,
    /(\d+)\s*marks?/gi,
    /\((\d+)\)/gi
  ];
  
  for (const pattern of markPatterns) {
    const match = questionText.match(pattern);
    if (match) {
      const marks = parseInt(match[0].replace(/\D/g, ''));
      if (marks > 0) return marks;
    }
  }
  
  return 5; // Default to 5 marks if not specified
}

// Helper function to analyze answer sheet format
function analyzeAnswerFormat(answerSheetText) {
  const format = {
    hasBulletPoints: /^[\s]*[•\-\*\+]\s/.test(answerSheetText) || /^[\s]*\d+\.\s/.test(answerSheetText),
    bulletStyle: '•', // Default
    hasNumbering: /^[\s]*\d+\.\s/.test(answerSheetText),
    hasSubBullets: /^[\s]{2,}[•\-\*\+]\s/.test(answerSheetText),
    averageBulletsPerAnswer: 0
  };
  
  // Count bullet points in the answer sheet
  const bulletMatches = answerSheetText.match(/^[\s]*[•\-\*\+]\s/gm);
  const numberedMatches = answerSheetText.match(/^[\s]*\d+\.\s/gm);
  
  if (bulletMatches && bulletMatches.length > 0) {
    format.bulletStyle = bulletMatches[0].trim();
    format.averageBulletsPerAnswer = Math.ceil(bulletMatches.length / 10); // Rough estimate
  } else if (numberedMatches && numberedMatches.length > 0) {
    format.hasNumbering = true;
    format.averageBulletsPerAnswer = Math.ceil(numberedMatches.length / 10);
  }
  
  return format;
}

// Helper function to generate answers for questions using ChatGPT
async function generateAnswersForQuestions(questions, documentText, answerSheetNumber) {
  try {
    // Group questions by task
    const taskGroups = {};
    
    for (const question of questions) {
      const marks = extractMarks(question.text);
      const minBullets = Math.max(marks, 3); // At least as many bullets as marks, minimum 3
      
      // Create task key with proper title
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      
      if (!taskGroups[taskKey]) {
        taskGroups[taskKey] = {};
      }
      
      const prompt = `You are a student answering an academic question. Generate a natural, human-like answer in bullet point format with specific formatting.

Document Context: ${documentText.substring(0, 2000)}

Task: ${taskKey}
Question ${question.number}: ${question.text}

Instructions:
1. Answer in bullet points format using "•" style
2. Provide exactly ${minBullets} or more bullet points (${marks} marks available)
3. Making mostly bullet point starting words as making context/topic for example: "Manual handling training: Both shop and warehouse staff regularly move goods. Training in safe lifting techniques, use of handling equipment, and recognising their own physical limits would reduce risk of injury." Manual handling training: is the topic of the question. bold the topic with <b>topic</b>
4. Make the answer sound natural and human-written, not AI-generated
5. Use varied sentence structures and natural language
6. Include relevant examples and explanations and should be enough long to cover the topic of the question. 
7. Avoid overly formal or robotic language
8. Use contractions and natural expressions where appropriate
9. Each bullet point should be substantial and meaningful and should be related to the topic of the question. Do not include any other information in the answer. 
10. Make this answer unique from other versions while maintaining accuracy

Answer:`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are a student writing answers for an academic assessment. Write naturally and human-like, avoiding AI detection. Use varied vocabulary and sentence structures. Be conversational but informative. Format answers with '• <b>topic:</b> [explanation]' structure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7 + (answerSheetNumber * 0.1), // Vary temperature for uniqueness
      });

      // Store answer with the proper question number format (e.g., "1(a)", "1(b)", "2")
      taskGroups[taskKey][question.number] = completion.choices[0].message.content;
      
      console.log(`Generated answer for ${taskKey} - Question ${question.number}`);
    }
    
    return taskGroups;
  } catch (error) {
    console.error('Error generating answers:', error);
    throw new Error(`Failed to generate answers for answer sheet ${answerSheetNumber}: ${error.message}`);
  }
}

// Helper function to create DOCX document using reference document as template
async function createDocxFromTemplate(referenceDocxBuffer, answers, learnerName, learnerNumber) {
  try {
    const createReport = require('docx-templates').default;
    
    // Calculate total word count
    const totalWords = answers.reduce((count, answer) => {
      return count + answer.answer.split(/\s+/).length;
    }, 0);
    
    // Prepare template data
    const templateData = {
      learnerName: learnerName || "Generated Learner",
      learnerNumber: learnerNumber || "00000000",
      totalWordCount: totalWords.toString(),
      answers: answers.map(answer => ({
        taskNumber: answer.number,
        taskTitle: answer.question.split(':')[0] || `Task ${answer.number}`,
        answerNumber: answer.number.toString(),
        answerText: answer.answer,
        marks: answer.marks
      }))
    };
    
    // Create the document using the template
    const buffer = await createReport({
      template: referenceDocxBuffer,
      data: templateData,
      additionalJsContext: {
        // Helper functions for template
        formatAnswer: (answerText) => {
          return answerText.split('\n').filter(line => line.trim()).map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
              return trimmed;
            }
            return `• ${trimmed}`;
          }).join('\n');
        }
      }
    });
    
    return buffer;
  } catch (error) {
    console.error('Error creating DOCX from template:', error);
    // Fallback to simple DOCX creation
    return await createSimpleDocx(answers, learnerName, learnerNumber);
  }
}

// Fallback function to create simple DOCX if template fails
async function createSimpleDocx(answers, learnerName, learnerNumber) {
  const { Table, TableRow, TableCell, WidthType } = require('docx');
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header
        new Paragraph({
          children: [
            new TextRun({
              text: "NEBOSH International General Certificate in Occupational Health and Safety",
              bold: true,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 300 },
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: "IG1: Management of International Health and Safety",
              bold: true,
              size: 22,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: "Open Book Examination (OBE)",
              bold: true,
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        
        // Learner info table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "Learner name:",
                          bold: true,
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: learnerName || "Generated Learner",
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "Learner number:",
                          bold: true,
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: learnerNumber || "00000000",
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        
        // Page break
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        }),
        
        // Answers
        ...answers.flatMap(answer => [
          new Paragraph({
            children: [
              new TextRun({
                text: `Task ${answer.number}: ${answer.question.split(':')[0] || `Task ${answer.number}`}`,
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: answer.number.toString(),
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 100, after: 200 },
          }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      ...answer.answer.split('\n').filter(line => line.trim()).map(line => 
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: line.trim(),
                              size: 20,
                            }),
                          ],
                          spacing: { after: 100 },
                        })
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
          
          new Paragraph({ children: [], spacing: { after: 200 } }),
          new Paragraph({ children: [], spacing: { after: 200 } }),
          new Paragraph({ children: [], spacing: { after: 200 } }),
        ]),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

// Main endpoint for generating answer sheets
app.post('/api/generate-answers', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'docx', maxCount: 5 }
]), async (req, res) => {
  try {
    const { learnerName, learnerNumber } = req.body;
    
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (!req.files.docx || req.files.docx.length === 0) {
      return res.status(400).json({ error: 'No DOCX answer sheet files uploaded' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Processing PDF file...');
    
    // Extract text from PDF (questionnaire)
    const pdfData = await pdfParse(req.files.pdf[0].buffer);
    const documentText = pdfData.text;
    
    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from PDF. Please ensure the PDF contains readable text.' });
    }

    console.log('Processing DOCX answer sheets...');
    
    // Extract text from DOCX files (answer sheet formats)
    const answerSheets = [];
    for (let i = 0; i < req.files.docx.length; i++) {
      const docxText = await extractDocxText(req.files.docx[i].buffer);
      answerSheets.push({
        id: i + 1,
        text: docxText,
        format: analyzeAnswerFormat(docxText)
      });
    }

    console.log('Extracting questions from document...');
    
    // Extract questions from the document
    const questions = extractQuestions(documentText);
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in the document. Please ensure the PDF contains clearly formatted questions.' });
    }

    console.log(`Found ${questions.length} questions. Generating answer sheets...`);
    console.log('Questions extracted:', questions.map(q => ({ number: q.number, taskTitle: q.taskTitle })));

    // Define template path (now in backend directory)
    const templatePath = path.join(__dirname, 'template.docx');

    // Generate 1 answer sheet for testing (can be increased later)
    const generatedAnswerSheets = [];
    
    for (let sheetNumber = 1; sheetNumber <= 1; sheetNumber++) {
      console.log(`Generating answer sheet ${sheetNumber}...`);
      
      try {
        // Generate answers for questions using ChatGPT
        const answers = await generateAnswersForQuestions(questions, documentText, sheetNumber);
        
        console.log('Generated answers structure:', Object.keys(answers).map(taskKey => ({
          task: taskKey,
          questions: Object.keys(answers[taskKey])
        })));
        
        // Import the generateAnswerSheet module (same as sample function)
        const { createAnswerSheet, countWords } = require('./generateAnswerSheetReal.js');
        
        // Prepare data in the same format as sample function
        const answerSheetData = {
          name: learnerName,
          number: learnerNumber,
          wordCount: countWords(answers),
          answers: answers
        };
        
        // Create temporary output path
        const outputPath = path.join(__dirname, 'output', `answer-sheet-${sheetNumber}.docx`);
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Generate the answer sheet using the same function as sample
        const buffer = await createAnswerSheet(templatePath, outputPath, answerSheetData);
        
        const answerSheetId = `sheet_${Date.now()}_${sheetNumber}`;
        
        // Store the answer sheet data
        answerSheetStorage.set(answerSheetId, {
          id: sheetNumber,
          title: `Answer Sheet ${sheetNumber}`,
          buffer: buffer,
          answers: answers,
          questions: questions.map(q => ({
            number: q.number,
            question: q.text,
            marks: extractMarks(q.text)
          }))
        });
        
        // Return only the metadata, not the buffer
        generatedAnswerSheets.push({
          id: sheetNumber,
          title: `Answer Sheet ${sheetNumber}`,
          answers: answers,
          questions: questions.map(q => ({
            number: q.number,
            question: q.text,
            marks: extractMarks(q.text)
          })),
          storageId: answerSheetId
        });
      } catch (error) {
        console.error(`Error generating answer sheet ${sheetNumber}:`, error);
        // Create a fallback answer sheet with sample data
        const answerSheetId = `sheet_${Date.now()}_${sheetNumber}`;
        
        // Use sample data as fallback
        const fallbackAnswers = {
          "Task 1: Accident investigation and recommendations": {
            "1(a)": "• <b>How to secure scene:</b> Failure to secure scene properly\n• <b>How to collect evidence:</b> Evidence lost or contaminated\n• <b>How to maintain chain:</b> Chain of custody broken\n• <b>How to collect statements:</b> Witness statements not collected",
            "1(b)": "• <b>How to prevent:</b> Provide safety training to all staff\n• <b>How to implement:</b> Implement proper PPE protocols\n• <b>How to inspect:</b> Regular safety inspections\n• <b>How to respond:</b> Emergency response procedures"
          }
        };
        
        try {
          // Import the generateAnswerSheet module (same as sample function)
          const { createAnswerSheet, countWords } = require('./generateAnswerSheetReal.js');
          
          // Prepare fallback data
          const answerSheetData = {
            name: `Generated Learner ${sheetNumber}`,
            number: `${1000 + sheetNumber}`,
            wordCount: countWords(fallbackAnswers),
            answers: fallbackAnswers
          };
          
          // Create temporary output path
          const outputPath = path.join(__dirname, 'output', `fallback-answer-sheet-${sheetNumber}.docx`);
          
          // Ensure output directory exists
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Generate the answer sheet using the same function as sample
          const buffer = await createAnswerSheet(templatePath, outputPath, answerSheetData);
          
          const answerSheet = {
            id: sheetNumber,
            title: `Answer Sheet ${sheetNumber}`,
            buffer: buffer,
            answers: fallbackAnswers,
            questions: questions.map(q => ({
              number: q.number,
              question: q.text,
              marks: extractMarks(q.text)
            }))
          };
          
          // Store the answer sheet data
          answerSheetStorage.set(answerSheetId, answerSheet);
          
          // Return only the metadata, not the buffer
          generatedAnswerSheets.push({
            id: sheetNumber,
            title: `Answer Sheet ${sheetNumber}`,
            answers: fallbackAnswers,
            questions: questions.map(q => ({
              number: q.number,
              question: q.text,
              marks: extractMarks(q.text)
            })),
            storageId: answerSheetId
          });
        } catch (fallbackError) {
          console.error(`Error creating fallback answer sheet ${sheetNumber}:`, fallbackError);
          // Create minimal fallback
          const answerSheet = {
            id: sheetNumber,
            title: `Answer Sheet ${sheetNumber}`,
            buffer: null,
            answers: [],
            questions: questions.map(q => ({
              number: q.number,
              question: q.text,
              marks: extractMarks(q.text)
            }))
          };
          
          // Store the answer sheet data
          answerSheetStorage.set(answerSheetId, answerSheet);
          
          // Return only the metadata, not the buffer
          generatedAnswerSheets.push({
            id: sheetNumber,
            title: `Answer Sheet ${sheetNumber}`,
            answers: [],
            questions: questions.map(q => ({
              number: q.number,
              question: q.text,
              marks: extractMarks(q.text)
            })),
            storageId: answerSheetId
          });
        }
      }
    }

    console.log('Answer sheets generated successfully');
    
    res.json({
      success: true,
      message: `Successfully generated ${generatedAnswerSheets.length} answer sheet for ${questions.length} questions`,
      answerSheets: generatedAnswerSheets,
      totalQuestions: questions.length
    });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Endpoint to download individual answer sheet as DOCX
app.post('/api/download-answer-sheet', async (req, res) => {
  try {
    const { storageId, learnerName, learnerNumber } = req.body;
    
    if (!storageId) {
      return res.status(400).json({ error: 'Storage ID is required' });
    }

    // Retrieve the answer sheet data from storage
    const answerSheet = answerSheetStorage.get(storageId);
    
    if (!answerSheet) {
      return res.status(404).json({ error: 'Answer sheet not found' });
    }

    console.log(`Creating DOCX for ${answerSheet.title}...`);
    
    // Use the pre-generated buffer (already created with generateAnswerSheetReal.js)
    const docxBuffer = answerSheet.buffer;
    
    if (!docxBuffer) {
      return res.status(500).json({ error: 'Answer sheet buffer not available' });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${answerSheet.title.replace(/\s+/g, '_')}.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);
    
    res.end(docxBuffer);
    
  } catch (error) {
    console.error('Error creating DOCX:', error);
    res.status(500).json({ 
      error: 'Failed to create DOCX file', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Auto-Assessor AI Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Endpoint to download sample DOCX file using template system
app.get('/api/download-sample', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if template file exists (now in backend directory)
    const templatePath = path.join(__dirname, 'template.docx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ 
        error: 'Template file not found', 
        message: 'Please ensure template.docx is in the backend directory',
        expectedPath: templatePath
      });
    }
    
    // Sample data for testing the dynamic system
    const sampleData = {
      name: "Hamid Raza Khan",
      number: "1243",
      answers: {
        "Task 1: Accident investigation and recommendations": {
          "1(a)": "• <b>Why failure:</b> Failure to secure scene properly\n• <b>How to collect evidence:</b> Evidence lost or contaminated\n• <b>How to maintain chain of custody:</b> Chain of custody broken\n• <b>How to collect witness statements:</b> Witness statements not collected",
          "1(b)": "• <b>How to prevent:</b> Provide safety training to all staff\n• <b>How to implement:</b> Implement proper PPE protocols\n• <b>How to inspect:</b> Regular safety inspections\n• <b>How to respond:</b> Emergency response procedures"
        },
        "Task 2: Health and safety legislation": {
          "2": "• <b>How to comply:</b> Inspector can issue improvement notices\n• <b>How to enforce:</b> Inspector can issue prohibition notices\n• <b>How to prosecute:</b> Inspector can prosecute for breaches\n• <b>How to require immediate action:</b> Inspector can require immediate action"
        },
        "Task 3: Risk assessment": {
          "3(a)": "• <b>How to do:</b> Risk assessment must be completed\n• <b>How to implement:</b> Control measures must be implemented\n• <b>How to monitor:</b> Regular monitoring required\n• <b>How to document:</b> Documentation must be maintained",
          "3(b)": "• <b>How to record:</b> Training records must be kept\n• <b>How to assess:</b> Competency assessments required\n• <b>How to schedule:</b> Refresher training scheduled\n• <b>How to review:</b> Performance reviews conducted"
        }
      }
    };
    
    // Calculate word count
    const { countWords } = require('./generateAnswerSheetReal.js');
    sampleData.wordCount = countWords(sampleData.answers);
    
    // Import the generateAnswerSheet module (Stage 1 version)
    const { createAnswerSheet } = require('./generateAnswerSheetReal.js');
    
    // Create temporary output path
    const outputPath = path.join(__dirname, 'output', 'sample-answer-sheet.docx');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate the answer sheet using template system
    const buffer = await createAnswerSheet(templatePath, outputPath, sampleData);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="sample-answer-sheet.docx"');
    res.setHeader('Content-Length', buffer.length);
    
    // Send the file as binary data
    res.end(buffer);
    
  } catch (error) {
    console.error('Error generating sample file:', error);
    res.status(500).json({ 
      error: 'Failed to generate sample file',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  if (error.message === 'Only PDF and DOCX files are allowed') {
    return res.status(400).json({ error: 'Only PDF and DOCX files are allowed' });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Auto-Assessor AI Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});