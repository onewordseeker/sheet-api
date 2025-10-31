/**
 * Utility functions for Horizon UI backend
 * With advanced anti-AI-detection measures
 */

/**
 * Apply humanization tricks to reduce AI detection
 */
function applyHumanizationTricks(text) {
  // 1. Replace AI-typical phrases
  const aiPhrases = {
    'Additionally,': ['Also,', 'Plus,', 'On top of that,', 'What\'s more,', 'And'],
    'Furthermore,': ['Also,', 'Plus,', 'Besides,', 'And', 'On top of this,'],
    'Moreover,': ['Also,', 'Plus,', 'What\'s more,', 'And', 'Beyond that,'],
    'In conclusion,': ['So overall,', 'To sum up,', 'Bottom line,', 'In short,'],
    'It is important to note that': ['Worth noting:', 'Thing is,', 'Key point:', 'Important:'],
    'It should be noted that': ['Note that', 'Keep in mind', 'Remember', 'Worth saying'],
    ' comprehensive ': [' thorough ', ' detailed ', ' complete ', ' full '],
    ' utilize ': [' use ', ' apply ', ' employ '],
    ' implement ': [' put in place ', ' set up ', ' start using ', ' roll out '],
    ' facilitate ': [' help ', ' enable ', ' make easier ', ' support '],
    ' demonstrate ': [' show ', ' prove ', ' illustrate ', ' indicate '],
    ' leverage ': [' use ', ' make use of ', ' take advantage of '],
    ' paradigm ': [' model ', ' approach ', ' way of doing things ']
  };
  
  let humanized = text;
  
  for (const [aiPhrase, humanAlternatives] of Object.entries(aiPhrases)) {
    const regex = new RegExp(aiPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    humanized = humanized.replace(regex, () => {
      return humanAlternatives[Math.floor(Math.random() * humanAlternatives.length)];
    });
  }
  
  // 2. Add contractions (60% of the time)
  const contractions = {
    ' do not ': ' don\'t ',
    ' does not ': ' doesn\'t ',
    ' cannot ': ' can\'t ',
    ' will not ': ' won\'t ',
    ' should not ': ' shouldn\'t ',
    ' would not ': ' wouldn\'t ',
    ' it is ': ' it\'s ',
    ' that is ': ' that\'s ',
    ' there is ': ' there\'s ',
    ' they are ': ' they\'re ',
    ' we are ': ' we\'re ',
    ' you are ': ' you\'re '
  };
  
  for (const [full, contracted] of Object.entries(contractions)) {
    const regex = new RegExp(full, 'gi');
    humanized = humanized.replace(regex, (match) => {
      return Math.random() < 0.6 ? contracted : match;
    });
  }
  
  // 3. Add natural transitions occasionally
  humanized = humanized.replace(/\.\s+([A-Z])/g, (match, letter) => {
    const rand = Math.random();
    if (rand < 0.10) return `. So ${letter.toLowerCase()}`;
    if (rand < 0.15) return `. Now, ${letter.toLowerCase()}`;
    if (rand < 0.18) return `. Well, ${letter.toLowerCase()}`;
    if (rand < 0.20) return `. Thing is, ${letter.toLowerCase()}`;
    return match;
  });
  
  // 4. British English spelling
  const britishSpelling = {
    'organize': 'organise',
    'organized': 'organised',
    'organization': 'organisation',
    'organizations': 'organisations',
    'realize': 'realise',
    'realized': 'realised',
    'analyze': 'analyse',
    'analyzed': 'analysed',
    'color': 'colour',
    'favor': 'favour'
  };
  
  for (const [american, british] of Object.entries(britishSpelling)) {
    const regex = new RegExp(`\\b${american}\\b`, 'gi');
    humanized = humanized.replace(regex, british);
  }
  
  return humanized;
}

/**
 * Format bullet points with bold topics
 */
function formatBulletPoints(text) {
  // Remove any existing HTML tags that might be malformed
  text = text.replace(/<\s*\/?\s*b\s*>/gi, '');
  
  // Split into lines
  const lines = text.split('\n');
  const formattedLines = [];
  
  for (let line of lines) {
    line = line.trim();
    
    // If line starts with bullet point
    if (line.startsWith('•')) {
      // Remove the bullet temporarily
      let content = line.substring(1).trim();
      
      // Find the first colon or period that could indicate end of topic
      const colonIndex = content.indexOf(':');
      const periodIndex = content.indexOf('.');
      
      // Determine split point (prefer colon, but use period if it comes first and is within reasonable length)
      let splitIndex = -1;
      
      if (colonIndex > 0 && colonIndex < 100) {
        splitIndex = colonIndex;
      } else if (periodIndex > 0 && periodIndex < 100) {
        // Check if there's a capital letter after the period (might be a sentence, not a topic)
        const afterPeriod = content.substring(periodIndex + 1).trim();
        if (afterPeriod.length > 0 && afterPeriod[0] === afterPeriod[0].toLowerCase()) {
          splitIndex = periodIndex;
        }
      }
      
      if (splitIndex > 0) {
        const topic = content.substring(0, splitIndex).trim();
        const rest = content.substring(splitIndex + 1).trim();
        formattedLines.push(`• <b>${topic}:</b> ${rest}`);
      } else {
        // No clear topic separator, just add bullet back
        formattedLines.push(`• ${content}`);
      }
    } else if (line.length > 0) {
      // Non-bullet line, keep as is
      formattedLines.push(line);
    }
  }
  
  return formattedLines.join('\n');
}

/**
 * Extract questions from PDF text with improved parsing
 */
function extractQuestionsFromText(text) {
  console.log('=== Extracting Questions from Text ===');
  console.log(`Text length: ${text.length} characters`);
  
  const questions = [];
  const taskMatches = [...text.matchAll(/Task\s+(\d+):\s*([^\n]+)/gi)];
  
  console.log(`Found ${taskMatches.length} tasks`);
  
  for (let taskIndex = 0; taskIndex < taskMatches.length; taskIndex++) {
    const taskMatch = taskMatches[taskIndex];
    const taskNumber = taskMatch[1];
    const taskTitle = taskMatch[2].trim();
    
    const taskStartIndex = taskMatch.index + taskMatch[0].length;
    const nextTaskIndex = taskIndex < taskMatches.length - 1 
      ? taskMatches[taskIndex + 1].index 
      : text.length;
    const taskSection = text.substring(taskStartIndex, nextTaskIndex);
    
    console.log(`\n=== Task ${taskNumber}: ${taskTitle} ===`);
    
    const questionMatches = [];
    
    // Pattern 1: "1 (a)"
    const pattern1 = new RegExp(`\\n\\s*${taskNumber}\\s+\\(\\s*([a-z])\\s*\\)`, 'gi');
    let match;
    while ((match = pattern1.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = `${taskNumber}(${subLetter})`;
      questionMatches.push({
        index: match.index,
        id: questionId,
        fullMatch: match[0],
        pattern: 'pattern1',
        isParentQuestion: true
      });
      console.log(`Found with pattern1: ${questionId} at index ${match.index}`);
    }
    
    // Pattern 3: "1(a)"
    const pattern3 = new RegExp(`\\n\\s*${taskNumber}\\(\\s*([a-z])\\s*\\)`, 'gi');
    while ((match = pattern3.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = `${taskNumber}(${subLetter})`;
      
      if (!questionMatches.find(q => q.id === questionId)) {
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: 'pattern3',
          isParentQuestion: true
        });
        console.log(`Found with pattern3: ${questionId} at index ${match.index}`);
      }
    }
    
    // Pattern 5: "4 (a) (i)"
    const pattern5 = new RegExp(`\\n\\s*${taskNumber}\\s+\\(\\s*([a-z])\\s*\\)\\s*\\(\\s*([ivxlcdm]+)\\s*\\)`, 'gi');
    while ((match = pattern5.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const romanNumeral = match[2];
      const questionId = `${taskNumber}(${subLetter})(${romanNumeral})`;
      
      if (!questionMatches.find(q => q.id === questionId)) {
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: 'pattern5',
          parentLetter: subLetter,
          isNested: true
        });
        console.log(`Found with pattern5: ${questionId} at index ${match.index}`);
      }
    }
    
    // Pattern 6: Continuations
    const pattern6 = new RegExp(`\\n\\s*\\(\\s*([a-z]+)\\s*\\)`, 'gi');
    while ((match = pattern6.exec(taskSection)) !== null) {
      const subItem = match[1];
      const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
      const isRomanNumeral = romanNumerals.includes(subItem.toLowerCase());
      
      if (isRomanNumeral) {
        let parentLetter = null;
        for (let i = questionMatches.length - 1; i >= 0; i--) {
          const prevMatch = questionMatches[i];
          if (prevMatch.isNested && prevMatch.parentLetter) {
            parentLetter = prevMatch.parentLetter;
            break;
          }
          if (prevMatch.isParentQuestion) {
            const letterMatch = prevMatch.id.match(new RegExp(`^${taskNumber}\\(([a-z])\\)$`));
            if (letterMatch) {
              parentLetter = letterMatch[1];
              break;
            }
          }
        }
        
        if (parentLetter) {
          const questionId = `${taskNumber}(${parentLetter})(${subItem})`;
          if (!questionMatches.find(q => q.id === questionId)) {
            questionMatches.push({
              index: match.index,
              id: questionId,
              fullMatch: match[0],
              pattern: 'pattern6-roman',
              parentLetter: parentLetter,
              isNested: true
            });
            console.log(`Found with pattern6-roman: ${questionId} at index ${match.index}`);
          }
        }
      } else if (subItem.length === 1 && /^[b-z]$/.test(subItem)) {
        const questionId = `${taskNumber}(${subItem})`;
        if (!questionMatches.find(q => q.id === questionId)) {
          questionMatches.push({
            index: match.index,
            id: questionId,
            fullMatch: match[0],
            pattern: 'pattern6-letter',
            isParentQuestion: true
          });
          console.log(`Found with pattern6-letter: ${questionId} at index ${match.index}`);
        }
      }
    }
    
    // Pattern 4: Standalone numbers
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
    
    questionMatches.sort((a, b) => a.index - b.index);
    console.log(`Total matches found for Task ${taskNumber}: ${questionMatches.length}`);
    
    for (let qIndex = 0; qIndex < questionMatches.length; qIndex++) {
      const currentQuestion = questionMatches[qIndex];
      const nextQuestion = questionMatches[qIndex + 1];
      
      const startIndex = currentQuestion.index + currentQuestion.fullMatch.length;
      const endIndex = nextQuestion ? nextQuestion.index : taskSection.length;
      
      let questionText = taskSection.substring(startIndex, endIndex).trim();
      
      let marks = 8;
      const marksMatch = questionText.match(/\((\d+)\)/);
      if (marksMatch) {
        marks = parseInt(marksMatch[1]);
        console.log(`Detected ${marks} marks for question ${currentQuestion.id}`);
      }
      
      questionText = questionText
        .replace(/\(\d+\)\s*$/gm, '')
        .replace(/Note:.*$/gims, '')
        .replace(/^\s*\n+/gm, '')
        .trim();
      
      if (questionText.length > 10) {
        questions.push({
          number: currentQuestion.id,
          taskNumber: parseInt(taskNumber),
          taskTitle: taskTitle,
          text: questionText,
          marks: marks,
          fullQuestion: `Task ${taskNumber}: ${taskTitle}\n${currentQuestion.id} ${questionText}`
        });
        
        console.log(`✓ Extracted question: Task ${taskNumber}, Question ${currentQuestion.id} (${marks} marks)`);
      } else {
        console.log(`✗ Skipped empty question: Task ${taskNumber}, Question ${currentQuestion.id}`);
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total extracted questions: ${questions.length}`);
  console.log('Question numbers:', questions.map(q => `${q.number}(${q.marks}m)`).join(', '));
  
  return questions;
}

/**
 * Generate answers with anti-AI-detection measures
 */
async function generateAnswersForQuestions(questions, documentText, openai, settings, sheetNumber) {
  console.log('=== Generating Answers with Anti-Detection ===');
  console.log(`Processing ${questions.length} questions for Sheet ${sheetNumber}`);
  
  const taskGroups = {};
  
  // Personal voices for variation
  const personas = [
    'Alex, a 27-year-old safety coordinator from Leeds who worked at a chemical plant',
    'Sarah, a 31-year-old HSE manager from Glasgow with 8 years experience',
    'Mike, a 29-year-old safety officer from Birmingham working in construction',
    'Emma, a 26-year-old environmental health officer from Liverpool',
    'David, a 33-year-old safety consultant from Manchester',
    'Rachel, a 28-year-old safety supervisor from Bristol',
    'Tom, a 30-year-old QHSE manager from Newcastle'
  ];
  
  const persona = personas[sheetNumber % personas.length];
  
  for (const question of questions) {
    try {
      console.log(`\nProcessing question: ${question.number} (${question.marks} marks)`);
      
      const extraPoints = 2 + Math.floor(Math.random() * 2);
      const targetBullets = question.marks + extraPoints;
      
      console.log(`Target: ${targetBullets} bullet points (${question.marks} marks + ${extraPoints} extra)`);
      
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      
      if (!taskGroups[taskKey]) {
        taskGroups[taskKey] = {};
      }
      
      const answerFormat = settings.answerFormat || 'bullet-points';
      const wordCountTarget = settings.wordCountTarget || 500;
      const includeExamples = settings.includeExamples !== false;
      
      const prompt = `You're ${persona}, writing your NEBOSH exam based on your real work experience.

Context: ${documentText.substring(0, 2000)}

${taskKey}
Question ${question.number}: ${question.text}
Marks: ${question.marks}

Write EXACTLY ${targetBullets} bullet points.

CRITICAL - Sound like a real person who's seen this stuff firsthand:
- Reference actual experiences: "At our site we..." or "I've seen..."
- Use British spelling: realise, organise, colour, behaviour
- Mix formal and casual: "basically," "thing is," "to be fair," "mind you"
- Vary sentence length wildly. Some short. Others with multiple clauses that flow naturally and conversationally.
- Use specific examples: actual companies (BP, Shell, Toyota), real incidents, concrete scenarios
- Include hedging: "generally," "tends to," "usually," "in most cases," "often"
- Use contractions naturally: don't, can't, it's, there's, they're, won't

AVOID these AI red flags:
- NEVER: "delve," "Moreover," "Furthermore," "Additionally," "In conclusion"
- NEVER start with: "It is important to note"
- NO perfect parallel structure in every point
- NO three-adjective lists: "comprehensive, thorough, and detailed"

Format each bullet point like this:
• Start with a topic/concept followed by a colon, then provide a natural explanation with examples. Write about ${Math.floor(wordCountTarget/targetBullets)} words per point.

DO NOT use any HTML tags or bold formatting - just write plain text bullet points.

This is Sheet ${sheetNumber} - make it completely unique!`;

      const baseTemperature = settings.temperature || 0.7;
      const tempVariation = 0.3 + (Math.random() * 0.3);
      const finalTemp = Math.min(baseTemperature + tempVariation, 1.3);
      
      const baseMaxTokens = settings.maxTokens || 800;
      const tokensVariation = Math.floor((Math.random() - 0.5) * 400);
      const variableMaxTokens = Math.max(baseMaxTokens + tokensVariation, 600);
      
      const presencePenalty = 0.6 + (Math.random() * 0.3);
      const frequencyPenalty = 0.6 + (Math.random() * 0.3);
      
      console.log(`AI Settings - Temp: ${finalTemp.toFixed(2)}, Tokens: ${variableMaxTokens}, Presence: ${presencePenalty.toFixed(2)}, Frequency: ${frequencyPenalty.toFixed(2)}`);
      
      const defaultSystem = `You're ${persona}. You're writing exam answers based on your practical experience.

HUMANIZATION RULES (CRITICAL):
1. Write with PERSONALITY - you've lived this stuff
2. Use British English (realise, organise, behaviour)
3. Mix formal and casual language naturally
4. Vary sentences: Some short. Others longer with natural flow.
5. Use contractions: don't, can't, it's, won't
6. Add personal touches: "I've seen," "at our plant," "in my experience"
7. Use real examples: actual companies, real incidents
8. Include natural transitions: "So," "Now," "Thing is," "Look,"
9. Add hedging: "usually," "tends to," "generally," "often"

AVOID AI PATTERNS:
- NO: "delve," "Moreover," "Furthermore," "Additionally"
- NO: "It is important to note that"
- NO generic corporate speak
- NO perfect balance in every answer
- NO three-adjective lists

Make EXACTLY ${targetBullets} bullet points. Count them!

Format: • Topic/concept: Natural explanation with real examples.

DO NOT use any HTML tags or formatting - just plain text.

Sheet ${sheetNumber} - completely unique from other versions.`;

      let systemContent = (settings.systemPrompt && settings.systemPrompt.trim().length > 0)
        ? settings.systemPrompt
        : defaultSystem;

      // Simple templating for custom prompts
      if (settings.systemPrompt && settings.systemPrompt.trim().length > 0) {
        const replacements = {
          '{{persona}}': persona,
          '{{targetBullets}}': String(targetBullets),
          '{{sheetNumber}}': String(sheetNumber),
          '{{answerFormat}}': answerFormat,
          '{{wordCountTarget}}': String(wordCountTarget),
          '{{documentContext}}': documentText.substring(0, 2000),
        };
        for (const key in replacements) {
          systemContent = systemContent.split(key).join(replacements[key]);
        }
      }

      const completion = await openai.chat.completions.create({
        model: settings.openaiModel || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemContent
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: variableMaxTokens,
        temperature: finalTemp,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        top_p: 0.95
      });

      let answer = completion.choices[0].message.content;
      
      // Apply humanization tricks
      answer = applyHumanizationTricks(answer);
      
      // Format bullet points with bold topics
      answer = formatBulletPoints(answer);
      
      taskGroups[taskKey][question.number] = answer;
      
      const bulletCount = (answer.match(/^•/gm) || []).length;
      console.log(`✓ Generated answer for ${question.number} - Target: ${targetBullets}, Got: ${bulletCount} bullets`);
      
    } catch (error) {
      console.error(`Error generating answer for question ${question.number}:`, error);
      
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) {
        taskGroups[taskKey] = {};
      }
      
      const fallbackBullets = question.marks + 3;
      let fallbackAnswer = '';
      for (let i = 1; i <= fallbackBullets; i++) {
        fallbackAnswer += `• <b>Key Point ${i}:</b> This answer would cover ${question.taskTitle} with practical examples and clear explanations.\n`;
      }
      
      taskGroups[taskKey][question.number] = fallbackAnswer;
      console.log(`Used fallback answer for ${question.number}`);
    }
  }
  
  console.log('=== Answer Generation Complete ===');
  console.log('Generated answers for tasks:', Object.keys(taskGroups));
  
  return taskGroups;
}

/**
 * Count words in answers
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