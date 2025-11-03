/**
 * Utility functions for Horizon UI backend
 * With advanced anti-AI-detection measures
 */

/**
 * Apply natural humanization to reduce AI detection (balanced approach)
 */
function applyHumanizationTricks(text) {
  // 1. Replace AI-typical phrases with natural alternatives
  const aiPhrases = {
    'Additionally,': ['Also,', 'Plus,', 'And', 'Right,'],
    'Furthermore,': ['Also,', 'Plus,', 'And', 'Thing is,'],
    'Moreover,': ['Also,', 'Plus,', 'And', 'Actually,'],
    'In conclusion,': ['So overall,', 'To sum up,', 'Bottom line,', 'So'],
    'It is important to note that': ['Worth noting:', 'Thing is,', 'Important:', 'Remember:'],
    'It should be noted that': ['Note that', 'Keep in mind', 'Remember'],
    ' comprehensive ': [' thorough ', ' detailed ', ' complete ', ' full '],
    ' utilize ': [' use ', ' apply ', ' employ '],
    ' implement ': [' put in place ', ' set up ', ' start ', ' do '],
    ' facilitate ': [' help ', ' enable ', ' support ', ' allow '],
    ' demonstrate ': [' show ', ' prove ', ' illustrate ', ' indicate '],
    ' leverage ': [' use ', ' make use of ', ' take advantage of '],
    ' paradigm ': [' model ', ' approach ', ' way ', ' method '],
    'In order to': ['To', 'So we can'],
    'In the event that': ['If', 'When'],
    'With regard to': ['About', 'For'],
  };
  
  let humanized = text;
  
  for (const [aiPhrase, humanAlternatives] of Object.entries(aiPhrases)) {
    const regex = new RegExp(aiPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    humanized = humanized.replace(regex, () => {
      return humanAlternatives[Math.floor(Math.random() * humanAlternatives.length)];
    });
  }
  
  // 2. Add contractions naturally (60-65% of the time)
  const contractions = {
    ' do not ': ' don\'t ',
    ' does not ': ' doesn\'t ',
    ' cannot ': ' can\'t ',
    ' will not ': ' won\'t ',
    ' should not ': ' shouldn\'t ',
    ' would not ': ' wouldn\'t ',
    ' could not ': ' couldn\'t ',
    ' it is ': ' it\'s ',
    ' that is ': ' that\'s ',
    ' there is ': ' there\'s ',
    ' they are ': ' they\'re ',
    ' we are ': ' we\'re ',
    ' you are ': ' you\'re ',
    ' I am ': ' I\'m ',
    ' you have ': ' you\'ve ',
    ' we have ': ' we\'ve '
  };
  
  for (const [full, contracted] of Object.entries(contractions)) {
    const regex = new RegExp(full, 'gi');
    humanized = humanized.replace(regex, (match) => {
      return Math.random() < 0.62 ? contracted : match;
    });
  }
  
  // 3. Add natural transitions occasionally (not too frequently)
  humanized = humanized.replace(/\.\s+([A-Z])/g, (match, letter) => {
    const rand = Math.random();
    if (rand < 0.08) return `. So ${letter.toLowerCase()}`;
    if (rand < 0.12) return `. Now, ${letter.toLowerCase()}`;
    if (rand < 0.15) return `. Well, ${letter.toLowerCase()}`;
    if (rand < 0.18) return `. Thing is, ${letter.toLowerCase()}`;
    return match;
  });
  
  // 4. British English spelling (more comprehensive)
  const britishSpelling = {
    'organize': 'organise',
    'organized': 'organised',
    'organization': 'organisation',
    'organizations': 'organisations',
    'realize': 'realise',
    'realized': 'realised',
    'realizes': 'realises',
    'analyze': 'analyse',
    'analyzed': 'analysed',
    'analyzes': 'analyses',
    'color': 'colour',
    'colors': 'colours',
    'favor': 'favour',
    'favors': 'favours',
    'behavior': 'behaviour',
    'behaviors': 'behaviours',
    'center': 'centre',
    'centers': 'centres',
    'defense': 'defence',
    'defenses': 'defences'
  };
  
  for (const [american, british] of Object.entries(britishSpelling)) {
    const regex = new RegExp(`\\b${american}\\b`, 'gi');
    humanized = humanized.replace(regex, british);
  }
  
  // 5. Replace formal transitions with natural alternatives (subtle)
  const casualPhrases = [
    { pattern: /\bTherefore\b/gi, replacements: ['So', 'That means', 'This means'] },
    { pattern: /\bHowever\b/gi, replacements: ['But', 'Mind you,', 'Having said that,'] },
    { pattern: /\bConsequently\b/gi, replacements: ['So', 'Because of that', 'As a result'] },
    { pattern: /\bNevertheless\b/gi, replacements: ['Still', 'Even so', 'But'] }
  ];
  
  for (const { pattern, replacements } of casualPhrases) {
    humanized = humanized.replace(pattern, (match) => {
      if (Math.random() < 0.25) {
        return replacements[Math.floor(Math.random() * replacements.length)];
      }
      return match;
    });
  }
  
  // 6. Vary sentence structures - convert some passive to active voice naturally
  humanized = humanized.replace(/\bIt is ([a-z]+ed)\s+that/gi, (match, verb) => {
    if (Math.random() < 0.15) {
      return `We ${verb} that`;
    }
    return match;
  });
  
  // 7. Break repetitive sentence patterns (addresses AI detector issue #4)
  // Change repetitive "This allows...", "The system is designed to..." patterns
  const repetitivePatterns = [
    { pattern: /\bThis allows\b/gi, alternatives: ['This means', 'This lets', 'So we can', 'Which means'] },
    { pattern: /\bThe system is designed to\b/gi, alternatives: ['The system helps', 'We designed it to', 'It\'s meant to', 'It works to'] },
    { pattern: /\bThis ensures\b/gi, alternatives: ['This means', 'This keeps', 'So that', 'Which keeps'] },
    { pattern: /\bIt is important\b/gi, alternatives: ['Key point:', 'Worth noting:', 'Remember:', 'Important:'] }
  ];
  
  for (const { pattern, alternatives } of repetitivePatterns) {
    humanized = humanized.replace(pattern, (match, offset, string) => {
      // Check if this pattern appears multiple times - if so, vary it
      const occurrences = (string.match(new RegExp(pattern.source, 'gi')) || []).length;
      if (occurrences > 1 && Math.random() < 0.4) {
        return alternatives[Math.floor(Math.random() * alternatives.length)];
      }
      return match;
    });
  }
  
  // 8. Add thinking indicators - show thought progression (addresses issue #5)
  // Add "However," "On the other hand," "That's why," etc. naturally
  humanized = humanized.replace(/\.\s+([A-Z][a-z]+ is)/g, (match, start) => {
    const thinkingIndicators = ['However, ', 'On the other hand, ', 'That\'s why ', 'So ', 'Now, ', 'But '];
    if (Math.random() < 0.12) {
      const indicator = thinkingIndicators[Math.floor(Math.random() * thinkingIndicators.length)];
      return '. ' + indicator.toLowerCase() + start.toLowerCase();
    }
    return match;
  });
  
  // 9. Vary sentence beginnings to break uniformity (addresses issue #1)
  // Occasionally start sentences with different structures
  humanized = humanized.replace(/^([•]\s*)([A-Z][a-z]+)\s+(is|are|can|should|must|will)/gm, (match, bullet, subject, verb) => {
    const variations = [
      `${bullet}${subject} ${verb}`,
      `${bullet}When it comes to ${subject.toLowerCase()}, it ${verb}`,
      `${bullet}For ${subject.toLowerCase()}, we ${verb === 'is' ? 'have' : verb}`,
    ];
    if (Math.random() < 0.15) {
      return variations[Math.floor(Math.random() * variations.length)];
    }
    return match;
  });
  
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
  let bulletCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // If line starts with bullet point
    if (line.startsWith('•')) {
      bulletCount++;
      
      // Randomize formatting rhythm (addresses "randomize formatting rhythm" feedback)
      // Occasionally add blank line before a bullet (10% chance, not too often)
      if (bulletCount > 1 && Math.random() < 0.10 && formattedLines.length > 0) {
        formattedLines.push(''); // Blank line for natural spacing variation
      }
      
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
 * Add subtle natural variations to text (addresses AI detector issues #2 and #3)
 */
function addSubtleHumanImperfections(text) {
  let result = text;
  
  // 1. Very occasionally add natural comma variation (humans sometimes pause mid-thought)
  result = result.replace(/\s+and\s+([a-z])/gi, (match, letter, offset, str) => {
    // Only in longer phrases where comma feels natural
    if (Math.random() < 0.05 && match.length > 12) {
      return ', and ' + letter;
    }
    return match;
  });
  
  // 2. Add slight imperfections in transitions (addresses issue #2 - perfect grammar)
  // Occasionally use slightly imperfect but natural transitions
  result = result.replace(/\b(However|Therefore|Additionally|Furthermore)\s*,/gi, (match, word) => {
    if (Math.random() < 0.08) {
      // Occasionally drop the comma or change structure
      const variations = {
        'However': ['But', 'Though', 'Mind you'],
        'Therefore': ['So', 'That\'s why', 'Because of this'],
        'Additionally': ['Also', 'Plus'],
        'Furthermore': ['Also', 'And']
      };
      const alt = variations[word];
      return alt ? alt[Math.floor(Math.random() * alt.length)] + ' ' : match;
    }
    return match;
  });
  
  // 3. Occasionally break up long perfectly structured sentences (addresses issue #1 - uniformity)
  // Split very long sentences with good flow into two shorter ones
  result = result.replace(/([^.!?]{80,120})\.\s+([A-Z])/g, (match, firstPart, secondPart) => {
    if (Math.random() < 0.10 && firstPart.includes(',')) {
      // Find a good break point (comma near the middle)
      const commaIndex = firstPart.lastIndexOf(',');
      if (commaIndex > 30 && commaIndex < firstPart.length - 30) {
        const part1 = firstPart.substring(0, commaIndex);
        const part2 = firstPart.substring(commaIndex + 1).trim();
        return `${part1}. ${part2.charAt(0).toUpperCase() + part2.slice(1)}. ${secondPart}`;
      }
    }
    return match;
  });
  
  // 4. Add subtle emotion/stress indicators (addresses issue #3 - lack of emotion/bias)
  // Very occasionally add slight emphasis or concern
  result = result.replace(/\b(critical|important|essential)\s+(point|factor|aspect)/gi, (match, adj, noun) => {
    if (Math.random() < 0.06) {
      return `really ${adj} ${noun}`; // Adds slight emphasis
    }
    return match;
  });
  
  // 5. Add mid-thought connectors - natural hesitations and thinking (addresses "think aloud" feedback)
  result = result.replace(/\.\s+([A-Z][a-z]+)/g, (match, word) => {
    if (Math.random() < 0.05) { // 5% chance for natural hesitation
      const fillers = [' Actually, ', ' To be fair, ', ' I guess ', ' You know, ', ' Mind you, '];
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      return `.${filler}${word.toLowerCase()}`;
    }
    return match;
  });
  
  return result;
}

/**
 * Generate answers with anti-AI-detection measures
 */
async function generateAnswersForQuestions(questions, documentText, openai, settings, sheetNumber) {
  console.log('=== Generating Answers with Anti-Detection ===');
  console.log(`Processing ${questions.length} questions for Sheet ${sheetNumber}`);
  
  const taskGroups = {};
  
  // Personal voices with lived details for realism
  const personas = [
    'Alex, 27, started as a warehouse operative before moving into safety after seeing an accident firsthand at a chemical plant in Leeds',
    'Sarah, 31, an HSE manager from Glasgow with 8 years experience - she worked her way up from a junior role after completing night school',
    'Mike, 29, a safety officer from Birmingham working in construction - he switched from site work after a close call with a crane',
    'Emma, 26, an environmental health officer from Liverpool who got into safety after helping with a major incident investigation',
    'David, 33, a safety consultant from Manchester who started in operations and transitioned after realising how important safety really is',
    'Rachel, 28, a safety supervisor from Bristol - she joined the field after witnessing poor safety practices that led to a colleague getting hurt',
    'Tom, 30, a QHSE manager from Newcastle who came up through the ranks after beginning as a technician and seeing too many near-misses'
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
      
      const prompt = `You're ${persona}, writing your NEBOSH exam answer right now based on your real workplace experience.

Context: ${documentText.substring(0, 2000)}

${taskKey}
Question ${question.number}: ${question.text}
Marks: ${question.marks}

Write EXACTLY ${targetBullets} bullet points.

Write naturally, as if reflecting from your own workplace experience - no need to sound perfect. Think aloud as you write. Some bullets can be full sentences, others can be fragments or short notes (like quick reminders). Don't over-polish. It should read like notes written by a real professional under time pressure.

Write like someone genuinely reasoning through their own experience - you don't need to sound perfect. Occasional self-correction or reflective tone is fine, like 'I remember once... actually, that's not quite the same, but similar.' It's fine if two bullets slightly overlap or even contradict - it shows personal reasoning, not memorisation.

About ${Math.floor(wordCountTarget/targetBullets)} words per point on average, but vary it. Plain text only, no HTML/bold. Make sheet #${sheetNumber} completely unique.`;

      // Balanced temperature for natural variation without losing quality
      const baseTemperature = settings.temperature || 0.8; // Slightly increased from default
      const tempVariation = 0.2 + (Math.random() * 0.3); // Moderate variation
      const finalTemp = Math.min(baseTemperature + tempVariation, 1.2); // Cap at 1.2
      
      const baseMaxTokens = settings.maxTokens || 800;
      const tokensVariation = Math.floor((Math.random() - 0.5) * 300); // Moderate variation
      const variableMaxTokens = Math.max(baseMaxTokens + tokensVariation, 600);
      
      // Balanced penalties to encourage variation without over-randomization
      const presencePenalty = 0.65 + (Math.random() * 0.25); // 0.65-0.9 range
      const frequencyPenalty = 0.65 + (Math.random() * 0.25); // 0.65-0.9 range
      
      console.log(`AI Settings - Temp: ${finalTemp.toFixed(2)}, Tokens: ${variableMaxTokens}, Presence: ${presencePenalty.toFixed(2)}, Frequency: ${frequencyPenalty.toFixed(2)}`);
      
      const defaultSystem = `You are ${persona}, writing NEBOSH exam answers based on your real workplace experience.

WRITE LIKE YOU'RE THINKING ALOUD:
- Write like someone genuinely reasoning through their own experience - you don't need to sound perfect
- Occasional self-correction or reflective tone is fine: "I remember once... actually, that's not quite the same, but similar"
- Show thought progression naturally - it's okay if ideas build on each other or slightly overlap
- It's fine if two bullets slightly overlap or even contradict - it shows personal reasoning, not memorisation

STRUCTURED CHAOS IN BULLETS:
- Some bullets can be full sentences, others can be fragments or short notes (like quick reminders)
- Don't over-polish - it should read like notes written by a real professional under time pressure
- Mix sentence lengths dramatically: some very short (5-8 words), others longer (20-30 words)
- Vary how you start each bullet - mix concepts, examples, questions, observations
- Change sentence rhythm constantly - humans don't use identical patterns

VARY YOUR WRITING STYLE CONSTANTLY:
- Never repeat "The [X] is..." or "This allows..." patterns
- Vary your phrasing constantly - mix up sentence structures completely
- Use thinking indicators naturally: "However," "On the other hand," "That's why," "So," "But," "Now," "Actually"
- Add subtle emphasis occasionally: "really important," "absolutely critical," "particularly"

WRITE NATURALLY FROM YOUR EXPERIENCE:
- Draw from actual incidents - reference real situations, sites, companies you've worked with
- Mix formal and casual naturally: "basically," "thing is," "to be fair" alongside proper technical terms
- British English spelling: organise, realise, colour, behaviour
- Personal references: "At our site...", "I've seen...", "In my experience...", "When we..."
- Real examples: Use actual company names, real incidents, concrete scenarios
- Practical hedging: "usually," "tends to," "generally," "often," "in most cases"
- Use contractions naturally: don't, can't, it's, won't, they're, we've

AVOID REPETITIVE AI PATTERNS:
- Never repeat the same sentence structure pattern
- Don't use "This allows..." or "The system is designed to..." repeatedly
- Avoid "delve," "Moreover," "Furthermore," "Additionally," "In conclusion"
- No three-adjective lists: "comprehensive, thorough, and detailed"
- No corporate jargon: "leverage," "utilize," "facilitate," "paradigm"
- Avoid overly perfect parallel structures

REQUIREMENTS:
- Write EXACTLY ${targetBullets} bullet points
- Format: • Topic/concept: Clear explanation with practical examples
- Plain text only - no HTML or formatting
- Make sheet #${sheetNumber} unique - vary structure, examples, and phrasing completely`;

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
      
      // Additional subtle human imperfections (very light touch)
      answer = addSubtleHumanImperfections(answer);
      
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