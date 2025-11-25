/**
 * Utility functions for Horizon UI backend - IMPROVED VERSION
 * Fixes: AI detection, repetitive bullets, better attachment integration
 */

const styleFilters = {
  concise: (text) => {
    let result = text;
    // Remove hedging words
    result = result.replace(/\b(basically|essentially|generally|typically|usually)\b/gi, "");
    result = result.replace(/\b(it is important to note that|it should be noted that)\b/gi, "");
    result = result.replace(/\s+/g, " ");
    // Simplify modal verbs randomly
    result = result.replace(/\b(may|might|could|possibly|perhaps)\b/gi, (match) => {
      return Math.random() < 0.7 ? "can" : match.toLowerCase();
    });
    result = result.replace(/\btend to\b/gi, "");
    // Casual connectors
    result = result.replace(/\bHowever,/gi, "But");
    result = result.replace(/\bTherefore,/gi, "So");
    result = result.replace(/\bAdditionally,/gi, "Also");
    return result;
  },

  detailed: (text) => {
    let result = text;
    // Expand acronyms occasionally
    result = result.replace(/\bPPE\b/g, (match) => {
      return Math.random() < 0.3 ? "Personal Protective Equipment (PPE)" : match;
    });
    // Add depth words
    result = result.replace(/\bRisk assessment\b/gi, (match) => {
      return Math.random() < 0.4 ? "Comprehensive risk assessment process" : match;
    });
    result = result.replace(/\bTraining\b/gi, (match) => {
      return Math.random() < 0.3 ? "Thorough training and competency development" : match;
    });
    return result;
  },

  conversational: (text) => {
    let result = text;
    // Make more personal
    result = result.replace(/\bThe organization\b/gi, "We");
    result = result.replace(/\bWorkers\b/gi, "Our team");
    result = result.replace(/\bManagement\b/gi, "Our management team");
    
    // Add conversational interjections to bullets
    result = result.replace(/^(• <b>[^:]+:<\/b>)\s*/gm, (match) => {
      const phrases = [
        match,
        match.replace("</b>", "</b> Look,"),
        match.replace("</b>", "</b> Thing is,"),
        match.replace("</b>", "</b> From my experience,"),
        match
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    });
    
    // Contractions
    const contractions = {
      " do not ": " don't ",
      " does not ": " doesn't ",
      " cannot ": " can't ",
      " will not ": " won't ",
      " should not ": " shouldn't ",
      " would not ": " wouldn't ",
      " it is ": " it's ",
      " that is ": " that's ",
      " we are ": " we're ",
      " they are ": " they're "
    };
    for (const [full, contracted] of Object.entries(contractions)) {
      result = result.replace(new RegExp(full, "gi"), contracted);
    }
    return result;
  },

  procedural: (text) => {
    let result = text;
    let bulletIndex = 0;
    result = result.replace(/^• <b>([^:]+):<\/b>/gm, (match, topic) => {
      bulletIndex++;
      if (Math.random() < 0.3) {
        const stepPrefixes = [
          `• <b>Step ${bulletIndex} - ${topic}:</b>`,
          `• <b>${topic} (Phase ${bulletIndex}):</b>`,
          `• <b>Action ${bulletIndex}: ${topic}:</b>`
        ];
        return stepPrefixes[bulletIndex % 3];
      }
      return match;
    });
    return result;
  },

  exampleRich: (text) => {
    let result = text;
    const exampleStarters = ["For example,", "For instance,", "Like when", "Such as"];
    result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
      if (Math.random() < 0.2) {
        return ". " + exampleStarters[Math.floor(Math.random() * exampleStarters.length)] + " " + letter.toLowerCase();
      }
      return match;
    });
    return result;
  },

  formal: (text) => {
    let result = text;
    // Expand contractions
    const expansions = {
      "don't": "do not",
      "doesn't": "does not",
      "can't": "cannot",
      "won't": "will not",
      "shouldn't": "should not",
      "wouldn't": "would not",
      "it's": "it is",
      "that's": "that is",
      "we're": "we are",
      "they're": "they are"
    };
    for (const [contracted, full] of Object.entries(expansions)) {
      result = result.replace(new RegExp(contracted, "gi"), full);
    }
    result = result.replace(/\bBut\b/gi, "However");
    result = result.replace(/\bSo\b/gi, "Therefore");
    result = result.replace(/\bAlso\b/gi, "Additionally");
    return result;
  },

  analytical: (text) => {
    let result = text;
    result = result.replace(/^(• <b>[^:]+:<\/b>)\s*/gm, (match) => {
      const analyticalStarters = [
        match,
        match.replace("</b>", "</b> Evidence suggests"),
        match.replace("</b>", "</b> Data shows"),
        match
      ];
      return analyticalStarters[Math.floor(Math.random() * analyticalStarters.length)];
    });
    return result;
  },
};

function addHumanImperfections(text) {
  let result = text;
  
  // Natural interjections (less frequent)
  const naturalConnectors = [
    " — actually, ",
    " — to be honest, ",
    " (which matters) ",
    " — and this is key — "
  ];
  result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
    if (Math.random() < 0.06) {
      return naturalConnectors[Math.floor(Math.random() * naturalConnectors.length)] + letter.toLowerCase();
    }
    return match;
  });
  
  // Personal phrases (less frequent)
  const personalPhrases = [
    "From what I've seen, ",
    "In my view, ",
    "Honestly, ",
    "I believe ",
    "I've found that "
  ];
  result = result.replace(/^(• <b>[^:]+:<\/b>)\s+/gm, (match) => {
    if (Math.random() < 0.12) {
      return match + personalPhrases[Math.floor(Math.random() * personalPhrases.length)];
    }
    return match;
  });
  
  // Replace formal connectors with casual ones
  const connectorReplacements = {
    "Furthermore,": ["Also,", "Plus,", "And"],
    "Moreover,": ["Also,", "Plus,"],
    "Additionally,": ["Also,", "Plus,"],
    "Consequently,": ["So", "That's why"],
    "Therefore,": ["So", "That means"],
    "However,": ["But", "Still,", "That said,"],
    "Nevertheless,": ["Still,", "Even so,"],
  };
  
  for (const [formal, casual] of Object.entries(connectorReplacements)) {
    const regex = new RegExp("\\b" + formal, "gi");
    result = result.replace(regex, () => casual[Math.floor(Math.random() * casual.length)]);
  }
  
  // Simplify formal phrases
  result = result.replace(/\brequires improvement\b/gi, "could be better");
  result = result.replace(/\bis necessary\b/gi, "needs to happen");
  result = result.replace(/\bmust be implemented\b/gi, "should be put in place");
  
  return result;
}

function applySynonymVariations(text, intensity = 0.25) {
  const synonymGroups = {
    risk: ["risk", "hazard", "danger"],
    ensure: ["ensure", "make sure", "verify"],
    implement: ["implement", "put in place", "set up"],
    important: ["important", "critical", "key", "vital"],
    worker: ["worker", "employee", "staff member"],
    organization: ["organization", "company", "business"],
    procedure: ["procedure", "process", "system"],
    assess: ["assess", "evaluate", "check"],
    identify: ["identify", "spot", "find"],
    reduce: ["reduce", "cut", "lower"],
    improve: ["improve", "better", "strengthen"],
    monitor: ["monitor", "track", "check"],
    provide: ["provide", "give", "supply"],
    require: ["require", "need"],
  };
  
  let result = text;
  for (const [base, synonyms] of Object.entries(synonymGroups)) {
    const regex = new RegExp(`\\b${base}\\b`, "gi");
    result = result.replace(regex, (match) => {
      if (Math.random() < intensity) {
        const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
        if (match[0] === match[0].toUpperCase()) {
          return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        }
        return synonym;
      }
      return match;
    });
  }
  return result;
}

function applyBritishSpelling(text) {
  const britishSpelling = {
    organize: "organise",
    organized: "organised",
    organizing: "organising",
    organization: "organisation",
    organizations: "organisations",
    realize: "realise",
    realized: "realised",
    realizes: "realises",
    analyze: "analyse",
    analyzed: "analysed",
    analyzes: "analyses",
    color: "colour",
    behavior: "behaviour",
    center: "centre",
    defense: "defence",
    labor: "labour"
  };
  
  let result = text;
  for (const [american, british] of Object.entries(britishSpelling)) {
    const regex = new RegExp(`\\b${american}\\b`, "gi");
    result = result.replace(regex, british);
  }
  return result;
}

function formatBulletPoints(text) {
  // If text already has proper formatting, return as-is
  if (text.includes("• <b>") && text.includes(":</b>")) {
    console.log("Text already properly formatted, skipping formatting");
    return text;
  }
  
  const lines = text.split("\n");
  const formattedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Check if line starts with bullet point
    if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line)) {
      // Remove bullet/number prefix
      let content = line.replace(/^[•\-*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
      
      // Check if already has <b> tags
      if (content.includes("<b>") && content.includes("</b>")) {
        formattedLines.push(`• ${content}`);
        continue;
      }
      
      // Find the topic separator (: or -)
      const colonIndex = content.indexOf(":");
      const dashIndex = content.indexOf(" - ");
      
      let splitIndex = -1;
      let separator = ":";
      
      if (colonIndex > 0 && colonIndex < 100) {
        splitIndex = colonIndex;
        separator = ":";
      } else if (dashIndex > 0 && dashIndex < 100) {
        splitIndex = dashIndex;
        separator = " -";
      } else {
        // Create a topic from first few words
        const words = content.split(" ");
        if (words.length > 3) {
          const topicWordCount = Math.min(Math.max(2, Math.floor(words.length * 0.25)), 5);
          const topic = words.slice(0, topicWordCount).join(" ");
          const rest = words.slice(topicWordCount).join(" ");
          formattedLines.push(`• <b>${topic}:</b> ${rest}`);
          continue;
        }
      }
      
      if (splitIndex > 0) {
        const topic = content.substring(0, splitIndex).trim();
        const rest = content.substring(splitIndex + separator.length).trim();
        formattedLines.push(`• <b>${topic}:</b> ${rest}`);
      } else {
        // No separator found, use whole content as-is
        formattedLines.push(`• ${content}`);
      }
    } else {
      // Not a bullet point, keep as-is
      formattedLines.push(line);
    }
  }
  
  console.log(`formatBulletPoints: Input lines: ${lines.length}, Output lines: ${formattedLines.length}`);
  return formattedLines.join("\n");
}

// IMPROVED: Smarter bullet count enforcement that generates contextual content
function enforceBulletCount(answer, targetBullets, question, documentContext, attachmentsContext) {
  const safeTarget = Math.max(1, parseInt(targetBullets, 10) || 1);
  const bulletLines = (answer.match(/^•.*$/gm) || []).map((line) => line.trim());
  
  // If we have enough bullets, just trim to target
  if (bulletLines.length >= safeTarget) {
    return bulletLines.slice(0, safeTarget).join("\n");
  }
  
  // If we're short on bullets, return what we have rather than adding generic filler
  // The API should generate the right count, so this is just a safety net
  console.log(`WARNING: Only ${bulletLines.length} bullets generated for target of ${safeTarget}`);
  return bulletLines.join("\n");
}

function extractQuestionsFromText(text) {
  console.log("=== Extracting Questions from Text ===");
  console.log(`Text length: ${text.length} characters`);
  
  const questions = [];
  const taskMatches = [...text.matchAll(/Task\s+(\d+):\s*([^\n]+)/gi)];
  
  console.log(`Found ${taskMatches.length} tasks`);
  
  for (let taskIndex = 0; taskIndex < taskMatches.length; taskIndex++) {
    const taskMatch = taskMatches[taskIndex];
    const taskNumber = taskMatch[1];
    const taskTitle = taskMatch[2].trim();
    
    const taskStartIndex = taskMatch.index + taskMatch[0].length;
    const nextTaskIndex = taskIndex < taskMatches.length - 1 ? taskMatches[taskIndex + 1].index : text.length;
    const taskSection = text.substring(taskStartIndex, nextTaskIndex);
    
    console.log(`\n=== Task ${taskNumber}: ${taskTitle} ===`);
    
    const questionMatches = [];
    
    // Match main question patterns
    const mainPattern = new RegExp(`\\n\\s*${taskNumber}\\s*(?:\\(\\s*([a-z])\\s*\\))?\\s*(?![a-z])`, "gi");
    let match;
    while ((match = mainPattern.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = subLetter ? `${taskNumber}(${subLetter})` : taskNumber;
      
      if (!questionMatches.find((q) => q.id === questionId)) {
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: "main",
          isParentQuestion: true
        });
        console.log(`Found main pattern: ${questionId} at index ${match.index}`);
      }
    }
    
    // Match nested patterns (e.g., 2(a)(i))
    const nestedPattern = new RegExp(`\\n\\s*${taskNumber}\\s*\\(\\s*([a-z])\\s*\\)\\s*\\(\\s*([ivxlcdm]+)\\s*\\)`, "gi");
    while ((match = nestedPattern.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const romanNumeral = match[2];
      const questionId = `${taskNumber}(${subLetter})(${romanNumeral})`;
      
      if (!questionMatches.find((q) => q.id === questionId)) {
        questionMatches.push({
          index: match.index,
          id: questionId,
          fullMatch: match[0],
          pattern: "nested",
          parentLetter: subLetter,
          isNested: true
        });
        console.log(`Found nested pattern: ${questionId} at index ${match.index}`);
      }
    }
    
    // Match continuation patterns
    const continuationPattern = /\n\s*\(\s*([a-z]+)\s*\)/gi;
    while ((match = continuationPattern.exec(taskSection)) !== null) {
      const subItem = match[1];
      const romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
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
          if (!questionMatches.find((q) => q.id === questionId)) {
            questionMatches.push({
              index: match.index,
              id: questionId,
              fullMatch: match[0],
              pattern: "continuation-roman",
              parentLetter: parentLetter,
              isNested: true
            });
            console.log(`Found continuation roman: ${questionId} at index ${match.index}`);
          }
        }
      } else if (subItem.length === 1 && /^[a-z]$/.test(subItem)) {
        const questionId = `${taskNumber}(${subItem})`;
        if (!questionMatches.find((q) => q.id === questionId)) {
          questionMatches.push({
            index: match.index,
            id: questionId,
            fullMatch: match[0],
            pattern: "continuation-letter",
            isParentQuestion: true
          });
          console.log(`Found continuation letter: ${questionId} at index ${match.index}`);
        }
      }
    }
    
    // Clean up: if we have sub-letters, remove the bare task number
    const hasSubLetters = questionMatches.some((m) => /\(\s*[a-z]\s*\)/i.test(m.id));
    if (hasSubLetters) {
      for (let i = questionMatches.length - 1; i >= 0; i--) {
        if (questionMatches[i].id === String(taskNumber)) {
          questionMatches.splice(i, 1);
        }
      }
    }
    
    questionMatches.sort((a, b) => a.index - b.index);
    
    const taskPreamble = questionMatches.length > 0 ? taskSection.substring(0, questionMatches[0].index).trim() : "";
    
    console.log(`Total matches found for Task ${taskNumber}: ${questionMatches.length}`);
    
    for (let qIndex = 0; qIndex < questionMatches.length; qIndex++) {
      const currentQuestion = questionMatches[qIndex];
      const nextQuestion = questionMatches[qIndex + 1];
      
      const startIndex = currentQuestion.index + currentQuestion.fullMatch.length;
      const endIndex = nextQuestion ? nextQuestion.index : taskSection.length;
      
      let questionText = taskSection.substring(startIndex, endIndex).trim();
      
      // Extract marks
      let marks = 8;
      const marksMatch = questionText.match(/\((\d+)\)/);
      if (marksMatch) {
        marks = parseInt(marksMatch[1]);
        console.log(`Detected ${marks} marks for question ${currentQuestion.id}`);
      }
      
      // Clean question text
      questionText = questionText
        .replace(/\(\d+\)\s*$/gm, "")
        .replace(/Note:.*$/gims, "")
        .replace(/^\s*\n+/gm, "")
        .trim();
      
      if (questionText.length > 10) {
        questions.push({
          number: currentQuestion.id,
          taskNumber: parseInt(taskNumber),
          taskTitle: taskTitle,
          text: questionText,
          preamble: taskPreamble,
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
  console.log("Question numbers:", questions.map((q) => `${q.number}(${q.marks}m)`).join(", "));
  
  return questions;
}

async function generateAnswersForQuestions(questions, documentText, openai, settings, sheetNumber, options = {}) {
  console.log("=== Generating Answers ===");
  console.log(`Processing ${questions.length} questions for Sheet ${sheetNumber}`);
  console.log(`Will apply filter: ${Object.keys(styleFilters)[sheetNumber % 7]}`);
  
  // Verify OpenAI instance
  if (!openai || !openai.apiKey) {
    console.error(`❌ CRITICAL: OpenAI instance or API key is missing!`);
    throw new Error('OpenAI client not properly initialized');
  }
  
  console.log(`✓ OpenAI API key configured: ${openai.apiKey.substring(0, 20)}...`);
  
  const { bulletConfig = {}, promptOverrides = {}, attachmentsContext = "" } = options || {};
  const taskGroups = {};
  
  // IMPROVED PROMPTS - More natural, less AI-like
  const defaultSystemPrompt = `You're a NEBOSH-qualified safety professional writing exam answers under time pressure. Write naturally like you're explaining to a colleague — mix short punchy sentences with longer thoughtful ones. Use British English. Be direct and practical.

FORMAT RULE: Every single bullet point MUST follow this exact format:
• <b>Clear Topic Name:</b> Your explanation here

The topic should describe what you're about to explain (e.g., "Risk Assessment Gaps", "PPE Requirements", "Noise Control Failures"). Always bold it with <b></b> tags and follow with a colon.`;

  const defaultUserTemplate = `Context from exam paper:
{documentContext}

${attachmentsContext ? 'ATTACHMENT EVIDENCE:\n{attachmentsContext}\n' : ''}

QUESTION:
Task: {taskTitle}
{preamble}

{questionNumber}: {questionText}
Marks: {marks}

Write EXACTLY {targetBullets} bullet points answering this question.

CRITICAL: Every bullet must be formatted as:
• <b>Descriptive Topic:</b> Your answer

Guidelines:
- Mix sentence lengths (some 8 words, some 35 words)
- Use "I believe", "From what I've seen", "Honestly" occasionally
- Write like you're under exam pressure — natural, not perfect
- Reference attachments explicitly if provided
- British English (organise, realise, behaviour)
- Use contractions (don't, can't, I've)

Answer now with {targetBullets} bullets:`;

  const combinedContext = attachmentsContext 
    ? `${documentText}\n\nATTACHMENT CONTEXT:\n${attachmentsContext}` 
    : documentText;
  const truncatedContext = combinedContext.substring(0, 5000);
  
  for (const question of questions) {
    try {
      console.log(`\nProcessing question: ${question.number} (${question.marks} marks)`);
      
      // Calculate target bullets
      const extraPoints = 2 + Math.floor(Math.random() * 2);
      const suggestedTarget = Math.max(question.marks + extraPoints, 4);
      const manualTargetRaw = bulletConfig[question.number];
      const manualTarget = manualTargetRaw !== undefined ? parseInt(manualTargetRaw, 10) : undefined;
      const targetBullets = Math.max(1, Number.isFinite(manualTarget) ? manualTarget : suggestedTarget);
      
      console.log(`Target: ${targetBullets} bullet points`);
      
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) taskGroups[taskKey] = {};
      
      const wordCountTarget = settings.wordCountTarget || 500;
      
      const userPrompt = (promptOverrides.userPrompt || settings.attachmentUserPrompt || settings.userPrompt || defaultUserTemplate)
        .replace(/{targetBullets}/g, targetBullets)
        .replace(/{wordCountPerBullet}/g, Math.floor(wordCountTarget / targetBullets))
        .replace(/{documentContext}/g, truncatedContext)
        .replace(/{taskTitle}/g, taskKey)
        .replace(/{preamble}/g, question.preamble && question.preamble.length > 0 ? `Context: ${question.preamble}` : "")
        .replace(/{questionNumber}/g, question.number)
        .replace(/{questionText}/g, question.text)
        .replace(/{marks}/g, question.marks)
        .replace(/{attachmentsContext}/g, attachmentsContext || "");
      
      // Validate and fix model name
      let model = settings.openaiModel || "gpt-4o-mini";
      
      // Fix common typos/invalid models
      if (model.includes("gpt-5")) {
        console.warn(`Invalid model "${model}" detected, switching to gpt-4o-mini`);
        model = "gpt-4o-mini";
      }
      
      const isO1Model = model.includes("o1") || model.includes("o3");
      const isGPT5 = false; // GPT-5 doesn't exist yet
      const isGPT3 = model.includes("gpt-3.5") || model.includes("gpt-3");
      
      const apiParams = {
        model: model,
        messages: [
          {
            role: "system",
            content: promptOverrides.systemPrompt || settings.attachmentSystemPrompt || settings.systemPrompt || defaultSystemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      };
      
      // Set token limits
      if (isGPT3) {
        apiParams.max_tokens = settings.maxTokens || 1000;
      } else {
        apiParams.max_completion_tokens = settings.maxTokens || 1000;
      }
      
      // Set temperature and other params
      if (!isO1Model && !isGPT5) {
        apiParams.temperature = settings.temperature || 0.9; // Higher for more variety
        apiParams.presence_penalty = 0.5; // Increased to reduce repetition
        apiParams.frequency_penalty = 0.5; // Increased to reduce repetition
        apiParams.top_p = 0.95;
      }
      
      console.log(`Using model: ${model}`);
      console.log(`API params:`, JSON.stringify({
        model: apiParams.model,
        messageCount: apiParams.messages.length,
        temperature: apiParams.temperature,
        maxTokens: apiParams.max_completion_tokens || apiParams.max_tokens
      }));
      
      console.log(`System prompt length: ${apiParams.messages[0].content.length}`);
      console.log(`User prompt length: ${apiParams.messages[1].content.length}`);
      
      let completion;
      let answer = '';
      
      try {
        completion = await openai.chat.completions.create(apiParams);
        console.log(`✓ API call successful`);
        console.log(`Response object:`, {
          id: completion.id,
          model: completion.model,
          choices: completion.choices?.length,
          hasContent: !!completion.choices?.[0]?.message?.content
        });
        
        answer = completion.choices[0].message.content || '';
        console.log(`API response content length: ${answer.length}`);
        
        if (answer.length === 0) {
          console.error(`❌ EMPTY RESPONSE from OpenAI API`);
          console.error(`Full completion object:`, JSON.stringify(completion, null, 2));
        }
        
      } catch (apiError) {
        console.error(`❌ OpenAI API Error for ${question.number}:`, {
          message: apiError.message,
          type: apiError.type,
          code: apiError.code,
          status: apiError.status
        });
        
        // Log the full error for debugging
        console.error(`Full API error:`, apiError);
        
        throw apiError; // Re-throw to be caught by outer try-catch
      }
      
      // Apply post-processing
      console.log(`Applying post-processing filter: ${Object.keys(styleFilters)[sheetNumber % 7]}`);
      console.log(`Raw answer preview (first 500 chars):`, answer.substring(0, 500));
      
      answer = formatBulletPoints(answer);
      console.log(`After formatBulletPoints (first 500 chars):`, answer.substring(0, 500));
      
      answer = addHumanImperfections(answer);
      
      const filterName = Object.keys(styleFilters)[sheetNumber % 7];
      const filterFunction = styleFilters[filterName];
      answer = filterFunction(answer);
      
      const synonymIntensity = 0.15 + (sheetNumber % 7) * 0.08; // Reduced intensity
      answer = applySynonymVariations(answer, synonymIntensity);
      answer = applyBritishSpelling(answer);
      
      // IMPROVED: Don't add filler bullets, just use what we got
      let normalizedAnswer = enforceBulletCount(answer, targetBullets, question, documentText, attachmentsContext);
      // NOW remove tags for DOCX
      normalizedAnswer = removeHtmlTags(normalizedAnswer); // ← HERE
      normalizedAnswer = removeHtmlTags(normalizedAnswer); // ← AGAIN for safety

      taskGroups[taskKey][question.number] = normalizedAnswer;
      
      const bulletCount = (normalizedAnswer.match(/^•/gm) || []).length;
      console.log(`✓ Generated answer for ${question.number} - Target: ${targetBullets}, Got: ${bulletCount} bullets`);
      console.log(`Applied style: ${filterName}`);
      
    } catch (error) {
      console.error(`Error generating answer for question ${question.number}:`, error);
      
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) taskGroups[taskKey] = {};
      
      // Simple fallback
      const fallbackAnswer = `• <b>Error Generating Answer:</b> Unable to generate response for this question. Please try again.`;
      taskGroups[taskKey][question.number] = fallbackAnswer;
      console.log(`Used fallback answer for ${question.number}`);
    }
  }
  
  console.log("=== Answer Generation Complete ===");
  console.log("Generated answers for tasks:", Object.keys(taskGroups));
  
  return taskGroups;
}

function removeHtmlTags(text) {
  // Fix DOUBLE bold tags: <b><b>Topic</b></b> → <b>Topic</b>
  let result = text;
  
  // Remove nested/double bold tags
  while (result.includes('<b><b>') || result.includes('</b></b>')) {
    result = result.replace(/<b><b>/gi, '<b>');
    result = result.replace(/<\/b><\/b>/gi, '</b>');
  }
  
  // Remove any stray opening tags that aren't paired
  result = result.replace(/<b>\s*<b>/gi, '<b>');
  
  // Remove any stray closing tags that aren't paired  
  result = result.replace(/<\/b>\s*<\/b>/gi, '</b>');
  
  // CRITICAL FIX: Move colon OUTSIDE bold tags
  // <b>Topic:</b> → <b>Topic</b>:
  result = result.replace(/<b>([^<]+):<\/b>/gi, '<b>$1</b>:');
  
  // Also fix cases with semicolons inside bold
  result = result.replace(/<b>([^<]+);<\/b>/gi, '<b>$1</b>;');
  // Remove Markdown bold markers (**text** → text)
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  return result.trim();
}

function countWords(answers) {
  let totalWords = 0;
  for (const taskKey in answers) {
    for (const questionKey in answers[taskKey]) {
      const answerText = answers[taskKey][questionKey];
      const words = answerText.split(/\s+/).filter((word) => word.length > 0);
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