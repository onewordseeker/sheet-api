/**
 * Utility functions for Horizon UI backend
 * Contains question extraction and answer generation logic
 */

/**
 * Extract questions from PDF text with improved parsing
 * @param {string} text - The extracted text from PDF
 * @returns {Array} Array of question objects
 */
function extractQuestionsFromText(text) {
  console.log('=== Extracting Questions from Text ===');
  console.log(`Text length: ${text.length} characters`);
  
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

/**
 * Generate answers for questions using ChatGPT
 * @param {Array} questions - Array of question objects
 * @param {string} documentText - The full document text for context
 * @param {Object} openai - OpenAI client instance
 * @returns {Object} Object with task-based answer structure
 */
async function generateAnswersForQuestions(questions, documentText, openai, settings = {}, sheetNumber = 1) {
  console.log('=== Generating Answers with ChatGPT ===');
  console.log(`Processing ${questions.length} questions`);
  
  const taskGroups = {};
  
  for (const question of questions) {
    try {
      console.log(`\nProcessing question: ${question.number}`);
      
      // Calculate marks and minimum bullets based on question complexity
      const marks = question.text.includes('(25)') ? 25 : 
                   question.text.includes('(20)') ? 20 :
                   question.text.includes('(15)') ? 15 :
                   question.text.includes('(10)') ? 10 : 8;
      
      const minBullets = Math.max(marks, 3); // At least as many bullets as marks, minimum 3
      
      // Create task key with proper title
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      
      if (!taskGroups[taskKey]) {
        taskGroups[taskKey] = {};
      }
      
      // Create the prompt for ChatGPT using database settings
      const answerFormat = settings.answerFormat || 'bullet-points';
      const wordCountTarget = settings.wordCountTarget || 500;
      const includeExamples = settings.includeExamples !== false;
      const includeReferences = settings.includeReferences === true;
      
      // Add variation based on sheet number
      const variationInstructions = [
        'Focus on practical applications and real-world examples',
        'Emphasize theoretical knowledge and academic concepts',
        'Include detailed explanations with step-by-step processes',
        'Highlight key principles and fundamental concepts',
        'Provide comprehensive coverage with multiple perspectives'
      ];
      
      const variationInstruction = variationInstructions[(sheetNumber - 1) % variationInstructions.length];
      
      let formatInstructions = '';
      if (answerFormat === 'bullet-points') {
        formatInstructions = 'Use bullet points (•) to structure your response clearly';
      } else if (answerFormat === 'paragraph') {
        formatInstructions = 'Write in paragraph format with clear structure';
      } else if (answerFormat === 'numbered') {
        formatInstructions = 'Use numbered points (1., 2., 3.) to structure your response';
      } else if (answerFormat === 'mixed') {
        formatInstructions = 'Use a mix of bullet points and paragraphs for variety';
      }
      
      const prompt = `You are an expert academic writer helping a student create comprehensive answers for a NEBOSH assessment. 

Document Context: ${documentText.substring(0, 2000)}

Task: ${taskKey}
Question ${question.number}: ${question.text}

Instructions:
1. Write a comprehensive answer that demonstrates deep understanding of the topic
2. ${formatInstructions}
3. Include at least ${minBullets} substantial points
4. Target approximately ${wordCountTarget} words for comprehensive coverage
5. ${variationInstruction} - This is sheet ${sheetNumber} of multiple sheets, so make it unique
6. Make the answer sound natural and human-written, not AI-generated
7. Use varied sentence structures and natural language
8. Include relevant examples and explanations${includeExamples ? ' with practical examples' : ''}${includeReferences ? ' and references where appropriate' : ''}
9. Avoid overly formal or robotic language
10. Use contractions and natural expressions where appropriate
11. Each point should be substantial and meaningful and should be related to the topic of the question
12. Make this answer unique from other versions while maintaining accuracy

${answerFormat === 'bullet-points' ? 'Format your response with bullet points like this:\n• [First key point with detailed explanation]\n• [Second key point with examples and details]\n• [Continue with more substantial points...]' : ''}

Remember: This is for a professional assessment, so ensure accuracy and depth while maintaining a natural, human writing style.`;

      // Add variation to temperature and other parameters for each sheet
      const baseTemperature = settings.temperature || 0.7;
      const variationTemperature = baseTemperature + (sheetNumber * 0.1); // Increase temperature for each sheet
      const clampedTemperature = Math.min(variationTemperature, 1.5); // Cap at 1.5
      
      const completion = await openai.chat.completions.create({
        model: settings.openaiModel || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `You are a student writing answers for an academic assessment. Write naturally and human-like, avoiding AI detection. Use varied vocabulary and sentence structures. Be conversational but informative. Format answers with '• <b>topic:</b> [explanation]' structure. This is answer sheet ${sheetNumber}, so make it unique and different from other versions.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: settings.maxTokens || 800,
        temperature: clampedTemperature,
      });

      // Store answer with the proper question number format (e.g., "1(a)", "1(b)", "2")
      taskGroups[taskKey][question.number] = completion.choices[0].message.content;
      
      console.log(`Generated answer for ${taskKey} - Question ${question.number}`);
      
    } catch (error) {
      console.error(`Error generating answer for question ${question.number}:`, error);
      
      // Fallback answer if ChatGPT fails
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) {
        taskGroups[taskKey] = {};
      }
      
      taskGroups[taskKey][question.number] = `• This question requires a comprehensive answer covering the key aspects of ${question.taskTitle}\n• The answer should demonstrate understanding of relevant concepts and principles\n• Include practical examples and applications where appropriate\n• Ensure the response is well-structured and clearly written`;
      
      console.log(`Used fallback answer for ${taskKey} - Question ${question.number}`);
    }
  }
  
  console.log('=== Answer Generation Complete ===');
  console.log('Generated answers for tasks:', Object.keys(taskGroups));
  
  return taskGroups;
}

/**
 * Count words in answers for word count calculation
 * @param {Object} answers - The answers object
 * @returns {number} Total word count
 */
function countWords(answers) {
  let totalWords = 0;
  
  for (const taskKey in answers) {
    for (const questionKey in answers[taskKey]) {
      const answerText = answers[taskKey][questionKey];
      const words = answerText.split(/\s+/).filter(word => word.length > 0);
      totalWords += words.length;
    }
  }
  
  return totalWords;
}

module.exports = {
  extractQuestionsFromText,
  generateAnswersForQuestions,
  countWords
};
