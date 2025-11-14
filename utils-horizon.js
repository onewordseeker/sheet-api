/**
 * Utility functions for Horizon UI backend - FINAL WORKING VERSION
 */

const styleFilters = {
  concise: (text) => {
    let result = text;
    result = result.replace(/\b(basically|essentially|generally|typically|usually)\b/gi, "");
    result = result.replace(/\b(it is important to note that|it should be noted that)\b/gi, "");
    result = result.replace(/\s+/g, " ");
    result = result.replace(/\b(may|might|could|possibly|perhaps)\b/gi, "can");
    result = result.replace(/\btend to\b/gi, "");
    result = result.replace(/\bHowever,/gi, "But");
    result = result.replace(/\bTherefore,/gi, "So");
    result = result.replace(/\bAdditionally,/gi, "Also");
    return result;
  },

  detailed: (text) => {
    let result = text;
    result = result.replace(/\bPPE\b/g, "Personal Protective Equipment (PPE)");
    result = result.replace(/\bRisk assessment\b/gi, "Comprehensive risk assessment process");
    result = result.replace(/\bTraining\b/gi, "Thorough training and competency development");
    result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
      if (Math.random() < 0.3) return ". Furthermore, " + letter.toLowerCase();
      return match;
    });
    result = result.replace(/\b(critical|important|essential)\b/gi, (match) => {
      return "particularly " + match.toLowerCase();
    });
    return result;
  },

  conversational: (text) => {
    let result = text;
    result = result.replace(/\bThe organization\b/gi, "We");
    result = result.replace(/\bWorkers\b/gi, "Our team");
    result = result.replace(/\bManagement\b/gi, "Our management team");
    result = result.replace(/^(• <b>[^:]+:<\/b>)\s*/gm, (match) => {
      const phrases = [match, match.replace("</b>", "</b> In my experience,"), match.replace("</b>", "</b> From what I've seen,"), match.replace("</b>", "</b> At our site,"), match];
      return phrases[Math.floor(Math.random() * phrases.length)];
    });
    const contractions = {" do not ": " don't ", " does not ": " doesn't ", " cannot ": " can't ", " will not ": " won't ", " should not ": " shouldn't ", " would not ": " wouldn't ", " it is ": " it's ", " that is ": " that's ", " we are ": " we're ", " they are ": " they're "};
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
      const stepPrefixes = [`• <b>Step ${bulletIndex} - ${topic}:</b>`, `• <b>${topic} (Phase ${bulletIndex}):</b>`, match, `• <b>Action ${bulletIndex}: ${topic}:</b>`];
      return stepPrefixes[bulletIndex % 4];
    });
    result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
      const sequenceWords = ["Then", "Next", "Following this", "Subsequently", "After that"];
      if (Math.random() < 0.25) return ". " + sequenceWords[Math.floor(Math.random() * sequenceWords.length)] + ", " + letter.toLowerCase();
      return match;
    });
    return result;
  },

  exampleRich: (text) => {
    let result = text;
    const exampleStarters = ["For example,", "For instance,", "Such as", "Like when", "Including"];
    result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
      if (Math.random() < 0.2) return ". " + exampleStarters[Math.floor(Math.random() * exampleStarters.length)] + " " + letter.toLowerCase();
      return match;
    });
    result = result.replace(/^(• <b>[^:]+:<\/b>)\s*/gm, (match) => {
      if (Math.random() < 0.3) {
        const scenarios = [match.replace("</b>", "</b> In warehouse operations,"), match.replace("</b>", "</b> On construction sites,"), match.replace("</b>", "</b> During maintenance work,"), match];
        return scenarios[Math.floor(Math.random() * scenarios.length)];
      }
      return match;
    });
    return result;
  },

  formal: (text) => {
    let result = text;
    const expansions = {"don't": "do not", "doesn't": "does not", "can't": "cannot", "won't": "will not", "shouldn't": "should not", "wouldn't": "would not", "it's": "it is", "that's": "that is", "we're": "we are", "they're": "they are"};
    for (const [contracted, full] of Object.entries(expansions)) {
      result = result.replace(new RegExp(contracted, "gi"), full);
    }
    result = result.replace(/\bBut\b/gi, "However");
    result = result.replace(/\bSo\b/gi, "Therefore");
    result = result.replace(/\bAlso\b/gi, "Additionally");
    result = result.replace(/\bget\b/gi, "obtain");
    result = result.replace(/\bshow\b/gi, "demonstrate");
    result = result.replace(/\bhelp\b/gi, "assist");
    return result;
  },

  analytical: (text) => {
    let result = text;
    result = result.replace(/^(• <b>[^:]+:<\/b>)\s*/gm, (match) => {
      const analyticalStarters = [match, match.replace("</b>", "</b> Evidence indicates that"), match.replace("</b>", "</b> Research shows that"), match.replace("</b>", "</b> Analysis demonstrates that"), match];
      return analyticalStarters[Math.floor(Math.random() * analyticalStarters.length)];
    });
    result = result.replace(/\b(is|are)\b/g, (match) => {
      if (Math.random() < 0.2) return match + " typically";
      return match;
    });
    result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
      const connectors = ["Consequently", "As a result", "This indicates that", "This suggests that"];
      if (Math.random() < 0.15) return ". " + connectors[Math.floor(Math.random() * connectors.length)] + ", " + letter.toLowerCase();
      return match;
    });
    return result;
  },
};

function addHumanImperfections(text) {
  let result = text;
  const naturalConnectors = [" — actually, ", " — mind you, ", " (though to be fair) ", " — which is important — ", " — and this matters — "];
  result = result.replace(/\.\s+([A-Z])/g, (match, letter) => {
    if (Math.random() < 0.08) return naturalConnectors[Math.floor(Math.random() * naturalConnectors.length)] + letter.toLowerCase();
    return match;
  });
  const personalPhrases = ["From what I've seen, ", "In my view, ", "Honestly, ", "Looking back, ", "To be fair, ", "I believe ", "It seems ", "I've found that "];
  result = result.replace(/^(• <b>[^:]+:<\/b>)\s+/gm, (match) => {
    if (Math.random() < 0.15) return match + personalPhrases[Math.floor(Math.random() * personalPhrases.length)];
    return match;
  });
  const emotionPairs = [{pattern: /\b(problem|issue)\b/gi, emotion: "frustrating problem"}, {pattern: /\b(result|outcome)\b/gi, emotion: "surprising result"}, {pattern: /\b(important|critical)\b/gi, emotion: "particularly important"}, {pattern: /\b(effective|successful)\b/gi, emotion: "encouragingly effective"}];
  emotionPairs.forEach(({pattern, emotion}) => {
    result = result.replace(pattern, (match) => {
      if (Math.random() < 0.1) return emotion;
      return match;
    });
  });
  const connectorReplacements = {"Furthermore,": ["Also,", "Plus,", "Thing is,", "Mind you,"], "Moreover,": ["Also,", "Plus,", "Actually,"], "Additionally,": ["Also,", "Plus,", "On top of that,"], "Consequently,": ["So", "That's why", "Because of this,"], "Therefore,": ["So", "That means", "Which is why"], "However,": ["But", "Still,", "That said,", "Even so,"], "Nevertheless,": ["Still,", "Even so,", "But"], "In conclusion,": ["Overall,", "So basically,", "To sum up,"]};
  for (const [formal, casual] of Object.entries(connectorReplacements)) {
    const regex = new RegExp(formal, "gi");
    result = result.replace(regex, () => casual[Math.floor(Math.random() * casual.length)]);
  }
  result = result.replace(/\b(critical|essential|important)\s+(point|factor|aspect|element)/gi, (match) => {
    if (Math.random() < 0.12) return match + " — really";
    return match;
  });
  const lines = result.split("\n");
  const newLines = [];
  let bulletCount = 0;
  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);
    if (lines[i].trim().startsWith("•")) {
      bulletCount++;
      if (bulletCount % 4 === 0 && Math.random() < 0.2) {
        const reflections = ["\nThese points together show why this matters in practice.", "\nThat's basically the core of it.", "\nAll of this connects back to building a proper safety culture.", "\nThese factors really do make a difference on site."];
        newLines.push(reflections[Math.floor(Math.random() * reflections.length)]);
      }
    }
  }
  result = newLines.join("\n");
  result = result.replace(/\brequires improvement\b/gi, "could be better");
  result = result.replace(/\bis necessary\b/gi, "needs to happen");
  result = result.replace(/\bmust be implemented\b/gi, "should be put in place");
  result = result.replace(/(• <b>[^:]+:<\/b> This (?:allows|enables|ensures)[^•]+)(• <b>[^:]+:<\/b> This (?:allows|enables|ensures))/gi, (match, first, second) => {
    const variations = [second.replace("This allows", "Which means"), second.replace("This enables", "So we can"), second.replace("This ensures", "That keeps")];
    return first + variations[Math.floor(Math.random() * variations.length)];
  });
  return result;
}

function applySynonymVariations(text, intensity = 0.3) {
  const synonymGroups = {risk: ["risk", "hazard", "danger", "threat"], ensure: ["ensure", "make sure", "guarantee", "verify"], implement: ["implement", "put in place", "establish", "set up", "introduce"], important: ["important", "critical", "essential", "vital", "crucial"], worker: ["worker", "employee", "staff member", "personnel"], organization: ["organization", "company", "business", "organisation"], procedure: ["procedure", "process", "protocol", "system"], assess: ["assess", "evaluate", "examine", "review", "analyse"], identify: ["identify", "recognise", "spot", "detect", "find"], reduce: ["reduce", "minimize", "decrease", "lower", "cut"], improve: ["improve", "enhance", "better", "upgrade", "strengthen"], monitor: ["monitor", "track", "check", "observe", "watch"], provide: ["provide", "supply", "offer", "give", "deliver"], require: ["require", "need", "demand", "call for", "necessitate"]};
  let result = text;
  for (const [base, synonyms] of Object.entries(synonymGroups)) {
    const regex = new RegExp(`\\b${base}\\b`, "gi");
    result = result.replace(regex, (match) => {
      if (Math.random() < intensity) {
        const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
        if (match[0] === match[0].toUpperCase()) return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        return synonym;
      }
      return match;
    });
  }
  return result;
}

function varyTopicStyle(text, sheetNumber) {
  let result = text;
  const topicStyles = [(topic) => topic, (topic) => {const adjectives = ["Key", "Critical", "Essential", "Important", "Primary"]; return adjectives[Math.floor(Math.random() * adjectives.length)] + " " + topic;}, (topic) => "Why " + topic + "?", (topic) => {const actions = ["Understanding", "Implementing", "Managing", "Controlling", "Monitoring"]; return actions[Math.floor(Math.random() * actions.length)] + " " + topic;}, (topic) => {const contexts = ["Workplace", "Site", "Facility", "Operational"]; return contexts[Math.floor(Math.random() * contexts.length)] + " " + topic;}, (topic) => topic.split(" ").slice(0, 2).join(" "), (topic) => topic + " Process"];
  const styleFunction = topicStyles[sheetNumber % 7];
  result = result.replace(/<b>([^<:]+):<\/b>/g, (match, topic) => {
    if (Math.random() < 0.4) return "<b>" + styleFunction(topic.trim()) + ":</b>";
    return match;
  });
  return result;
}

function applyBritishSpelling(text) {
  const britishSpelling = {organize: "organise", organized: "organised", organizing: "organising", organization: "organisation", organizations: "organisations", realize: "realise", realized: "realised", realizes: "realises", analyze: "analyse", analyzed: "analysed", analyzes: "analyses", color: "colour", colors: "colours", favor: "favour", favors: "favours", behavior: "behaviour", behaviors: "behaviours", center: "centre", centers: "centres", defense: "defence", defenses: "defences", labor: "labour", labors: "labours"};
  let result = text;
  for (const [american, british] of Object.entries(britishSpelling)) {
    const regex = new RegExp(`\\b${american}\\b`, "gi");
    result = result.replace(regex, british);
  }
  return result;
}

function formatBulletPoints(text) {
  text = text.replace(/<\s*\/?\s*b\s*>/gi, "");
  const lines = text.split("\n");
  const formattedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("•")) {
      let content = line.substring(1).trim();
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
        const words = content.split(" ");
        if (words.length > 3) {
          const topicWordCount = Math.min(Math.max(3, Math.floor(words.length * 0.3)), 6);
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
        formattedLines.push(`• ${content}`);
      }
    } else if (line.length > 0) {
      formattedLines.push(line);
    }
  }
  return formattedLines.join("\n");
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
    const mainPattern = new RegExp(`\\n\\s*${taskNumber}\\s*(?:\\(\\s*([a-z])\\s*\\))?\\s*(?![a-z])`, "gi");
    let match;
    while ((match = mainPattern.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const questionId = subLetter ? `${taskNumber}(${subLetter})` : taskNumber;
      if (!questionMatches.find((q) => q.id === questionId)) {
        questionMatches.push({index: match.index, id: questionId, fullMatch: match[0], pattern: "main", isParentQuestion: true});
        console.log(`Found main pattern: ${questionId} at index ${match.index}`);
      }
    }
    const nestedPattern = new RegExp(`\\n\\s*${taskNumber}\\s*\\(\\s*([a-z])\\s*\\)\\s*\\(\\s*([ivxlcdm]+)\\s*\\)`, "gi");
    while ((match = nestedPattern.exec(taskSection)) !== null) {
      const subLetter = match[1];
      const romanNumeral = match[2];
      const questionId = `${taskNumber}(${subLetter})(${romanNumeral})`;
      if (!questionMatches.find((q) => q.id === questionId)) {
        questionMatches.push({index: match.index, id: questionId, fullMatch: match[0], pattern: "nested", parentLetter: subLetter, isNested: true});
        console.log(`Found nested pattern: ${questionId} at index ${match.index}`);
      }
    }
    const continuationPattern = /\n\s*\(\s*([a-z]+)\s*\)/gi;
    while ((match = continuationPattern.exec(taskSection)) !== null) {
      const subItem = match[1];
      const romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"];
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
            questionMatches.push({index: match.index, id: questionId, fullMatch: match[0], pattern: "continuation-roman", parentLetter: parentLetter, isNested: true});
            console.log(`Found continuation roman: ${questionId} at index ${match.index}`);
          }
        }
      } else if (subItem.length === 1 && /^[a-z]$/.test(subItem)) {
        const questionId = `${taskNumber}(${subItem})`;
        if (!questionMatches.find((q) => q.id === questionId)) {
          questionMatches.push({index: match.index, id: questionId, fullMatch: match[0], pattern: "continuation-letter", isParentQuestion: true});
          console.log(`Found continuation letter: ${questionId} at index ${match.index}`);
        }
      }
    }
    const hasSubLetters = questionMatches.some((m) => /\(\s*[a-z]\s*\)/i.test(m.id));
    if (hasSubLetters) {
      for (let i = questionMatches.length - 1; i >= 0; i--) {
        if (questionMatches[i].id === String(taskNumber)) questionMatches.splice(i, 1);
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
      let marks = 8;
      const marksMatch = questionText.match(/\((\d+)\)/);
      if (marksMatch) {
        marks = parseInt(marksMatch[1]);
        console.log(`Detected ${marks} marks for question ${currentQuestion.id}`);
      }
      questionText = questionText.replace(/\(\d+\)\s*$/gm, "").replace(/Note:.*$/gims, "").replace(/^\s*\n+/gm, "").trim();
      if (questionText.length > 10) {
        questions.push({number: currentQuestion.id, taskNumber: parseInt(taskNumber), taskTitle: taskTitle, text: questionText, preamble: taskPreamble, marks: marks, fullQuestion: `Task ${taskNumber}: ${taskTitle}\n${currentQuestion.id} ${questionText}`});
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

async function generateAnswersForQuestions(questions, documentText, openai, settings, sheetNumber) {
  console.log("=== Generating Answers ===");
  console.log(`Processing ${questions.length} questions for Sheet ${sheetNumber}`);
  console.log(`Will apply filter: ${Object.keys(styleFilters)[sheetNumber % 7]}`);
  const taskGroups = {};
  for (const question of questions) {
    try {
      console.log(`\nProcessing question: ${question.number} (${question.marks} marks)`);
      const extraPoints = 2 + Math.floor(Math.random() * 2);
      const targetBullets = question.marks + extraPoints;
      console.log(`Target: ${targetBullets} bullet points`);
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) taskGroups[taskKey] = {};
      const wordCountTarget = settings.wordCountTarget || 500;
      
      // BUILD USER PROMPT FROM settings.userPrompt (NOT systemPrompt!)
      const userPrompt = (settings.userPrompt || `EXAM QUESTION:

Task: {taskTitle}
{preamble}

Question {questionNumber}: {questionText}

Marks: {marks}
Required Bullets: {targetBullets}

Write EXACTLY {targetBullets} bullet points answering this question.

Use this context: {documentContext}

FORMAT: • <b>Topic:</b> Explanation

DO NOT say "Understood" or acknowledge instructions.
ANSWER THE QUESTION DIRECTLY NOW.`)
        .replace(/{targetBullets}/g, targetBullets)
        .replace(/{wordCountPerBullet}/g, Math.floor(wordCountTarget/targetBullets))
        .replace(/{documentContext}/g, documentText.substring(0, 2000))
        .replace(/{taskTitle}/g, taskKey)
        .replace(/{preamble}/g, question.preamble && question.preamble.length > 0 ? `Context: ${question.preamble}` : "")
        .replace(/{questionNumber}/g, question.number)
        .replace(/{questionText}/g, question.text)
        .replace(/{marks}/g, question.marks);

      const model = settings.openaiModel || "gpt-4o-mini";
      const isO1Model = model.includes("o1") || model.includes("o3");
      const isGPT5 = model.includes("gpt-5") || model.includes("gpt5");
      const isGPT3 = model.includes("gpt-3.5") || model.includes("gpt-3");

      const apiParams = {
        model: model,
        messages: [
          {
            role: "system",
            content: settings.systemPrompt || "You are a NEBOSH-qualified health and safety professional. Write naturally with varied sentence lengths. Use British English. Format: • <b>Topic:</b> Explanation"
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      };

      if (isGPT3) {
        apiParams.max_tokens = settings.maxTokens || 800;
      } else {
        apiParams.max_completion_tokens = settings.maxTokens || 800;
      }

      if (!isO1Model && !isGPT5) {
        apiParams.temperature = settings.temperature || 0.85;
        apiParams.presence_penalty = 0.4;
        apiParams.frequency_penalty = 0.4;
        apiParams.top_p = 0.92;
      }

      console.log(`Using model: ${model}`);
      const completion = await openai.chat.completions.create(apiParams);
      let answer = completion.choices[0].message.content;

      console.log(`Applying post-processing filter: ${Object.keys(styleFilters)[sheetNumber % 7]}`);
      answer = formatBulletPoints(answer);
      answer = addHumanImperfections(answer);
      const filterName = Object.keys(styleFilters)[sheetNumber % 7];
      const filterFunction = styleFilters[filterName];
      answer = filterFunction(answer);
      const synonymIntensity = 0.2 + (sheetNumber % 7) * 0.1;
      answer = applySynonymVariations(answer, synonymIntensity);
      answer = varyTopicStyle(answer, sheetNumber);
      answer = applyBritishSpelling(answer);
      taskGroups[taskKey][question.number] = answer;

      const bulletCount = (answer.match(/^•/gm) || []).length;
      console.log(`✓ Generated answer for ${question.number} - Target: ${targetBullets}, Got: ${bulletCount} bullets`);
      console.log(`Applied style: ${filterName}`);
    } catch (error) {
      console.error(`Error generating answer for question ${question.number}:`, error);
      const taskKey = `Task ${question.taskNumber}: ${question.taskTitle}`;
      if (!taskGroups[taskKey]) taskGroups[taskKey] = {};
      const fallbackBullets = question.marks + 3;
      let fallbackAnswer = "";
      for (let i = 1; i <= fallbackBullets; i++) {
        fallbackAnswer += `• <b>Key Point ${i}:</b> This answer would cover ${question.taskTitle} with practical examples and clear explanations.\n`;
      }
      taskGroups[taskKey][question.number] = fallbackAnswer;
      console.log(`Used fallback answer for ${question.number}`);
    }
  }
  console.log("=== Answer Generation Complete ===");
  console.log("Generated answers for tasks:", Object.keys(taskGroups));
  return taskGroups;
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

module.exports = {extractQuestionsFromText, generateAnswersForQuestions, countWords};