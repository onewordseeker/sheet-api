/**
 * DOCX Generation for Horizon UI
 * Based on the existing generateAnswerSheetReal.js but optimized for horizon-ui
 */

const PizZip = require('pizzip');
const fs = require('fs');

/**
 * Count words in answers for word count calculation
 * @param {Object} answers - The answers object
 * @returns {number} Total word count
 */
function countWords(answers) {
  let totalWords = 0;
  for (const taskKey in answers) {
    for (const questionKey in answers[taskKey]) {
      const words = answers[taskKey][questionKey].trim().split(/\s+/).filter(w => w.length > 0);
      totalWords += words.length;
    }
  }
  return totalWords;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Parse bold text formatting from HTML-like tags
 * @param {string} text - Text with <b> tags
 * @returns {Array} Array of text parts with bold formatting
 */
function parseBoldText(text) {
  const parts = [];
  const boldRegex = /<b>(.*?)<\/b>/gs;
  let lastIndex = 0;
  
  boldRegex.lastIndex = 0;
  const matches = text.matchAll(boldRegex);
  
  for (const match of matches) {
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      if (normalText) {
        parts.push({ text: normalText, bold: false });
      }
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({ text: remainingText, bold: false });
    }
  }
  
  if (parts.length === 0) {
    parts.push({ text: text, bold: false });
  }
  
  return parts;
}

/**
 * Normalize incoming markup to expected bold tags, and strip stray markdown
 * without altering the bold mechanism (<b>..</b> parsing stays as-is).
 * - Fix spaced/uppercase tags like < b >, </ B > → <b>, </b>
 * - Convert **text** to <b>text</b>
 * - Convert __text__ to <b>text</b>
 * - Convert *text* to plain text (if not already handled by **)
 * - Remove [text] brackets while keeping inner text
 */
function normalizeBoldMarkup(text) {
  if (!text) return text;
  let out = text;
  // Collapse spaced/uppercase bold tags to canonical <b> </b>
  out = out.replace(/<\s*b\s*>/gi, '<b>');
  out = out.replace(/<\s*\/\s*b\s*>/gi, '</b>');

  // Convert <strong> to <b>
  out = out.replace(/<\s*strong\s*>/gi, '<b>');
  out = out.replace(/<\s*\/\s*strong\s*>/gi, '</b>');

  // Convert markdown strong to <b>
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  out = out.replace(/__(.+?)__/g, '<b>$1</b>');

  // Convert single-asterisk emphasis to plain text (avoid nesting conflicts)
  out = out.replace(/\*(?!\*)([^*]+)\*(?!\*)/g, '$1');

  // Remove square brackets while keeping content (e.g., [text] -> text)
  out = out.replace(/\[([^\]]+)\]/g, '$1');

  // Strip any remaining HTML tags except <b> and </b>
  out = out.replace(/<(?!\/?b\b)[^>]*>/gi, '');

  return out;
}

/**
 * Generate Word XML for answers with proper formatting
 * @param {Object} answers - The answers object with task-based structure
 * @returns {string} Word XML string
 */
function generateAnswersXml(answers) {
  let xml = '';
  
  for (const taskKey in answers) {
    // Add task header
    xml += `<w:p><w:pPr><w:spacing w:before="400" w:after="200"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(taskKey)}</w:t></w:r></w:p>`;
    
    // Add questions for this task
    for (const questionKey in answers[taskKey]) {
      const answerText = answers[taskKey][questionKey];
      
      // Format question key (e.g., "1(a)" -> "1 (a)")
      const formattedQuestionKey = questionKey.replace(/(\d+)\(([a-z])\)/gi, '$1 ($2)');
      
      // Add question header
      xml += `<w:p><w:pPr><w:spacing w:before="200" w:after="200"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(formattedQuestionKey)}</w:t></w:r></w:p>`;
      
      // Add bordered table for answer
      xml += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/></w:tcPr>`;
      
      // Process answer text line by line
      const lines = answerText.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const cleanLine = line.trim().replace(/^[•\-\*]\s*/, '');
        if (cleanLine) {
          // Add bullet point with proper formatting
          xml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>`;
          
          // Parse bold text formatting
          const normalized = normalizeBoldMarkup(cleanLine);
          const parts = parseBoldText(normalized);
          for (const part of parts) {
            if (part.bold) {
              xml += `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(part.text)}</w:t></w:r>`;
            } else {
              xml += `<w:r><w:t xml:space="preserve">${escapeXml(part.text)}</w:t></w:r>`;
            }
          }
          
          xml += `</w:p>`;
        }
      }
      
      // Close table and add spacing
      xml += `</w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;
    }
  }
  
  return xml;
}

/**
 * Create answer sheet document from template
 * @param {string} templatePath - Path to the DOCX template
 * @param {string} outputPath - Path where to save the generated document
 * @param {Object} data - Data object with name, number, answers, and wordCount
 * @returns {Buffer} Generated document buffer
 */
async function createAnswerSheet(templatePath, outputPath, data) {
  try {
    console.log(`Creating answer sheet from template: ${templatePath}`);
    console.log(`Output path: ${outputPath}`);
    
    // Read template file
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Calculate word count if not provided
    const wordCount = data.wordCount || countWords(data.answers);
    console.log(`Word count: ${wordCount}`);
    
    // Read document XML
    let documentXml = zip.file('word/document.xml').asText();
    const answersXml = generateAnswersXml(data.answers);
    
    console.log('Replacing placeholders in document...');
    
    // Store original length for verification
    const originalLength = documentXml.length;
    
    // Replace placeholders with exact string matching
    if (documentXml.includes('{{LEARNER_NAME}}')) {
      documentXml = documentXml.split('{{LEARNER_NAME}}').join(escapeXml(data.name || 'Generated Learner'));
      console.log('✓ Replaced LEARNER_NAME');
    }
    
    if (documentXml.includes('{{LEARNER_NUMBER}}')) {
      documentXml = documentXml.split('{{LEARNER_NUMBER}}').join(escapeXml(data.number || '00000000'));
      console.log('✓ Replaced LEARNER_NUMBER');
    }
    
    if (documentXml.includes('{{WORD_COUNT}}')) {
      documentXml = documentXml.split('{{WORD_COUNT}}').join(wordCount.toString());
      console.log('✓ Replaced WORD_COUNT');
    }
    
    // Handle {{content}} placeholder
    if (documentXml.includes('{{content}}')) {
      console.log('Found {{content}} placeholder');
      
      // Find the exact position and replace carefully
      const contentPattern = /(<w:t[^>]*>)([^<]*)\{\{content\}\}([^<]*)(<\/w:t>)/;
      const contentMatch = documentXml.match(contentPattern);
      
      if (contentMatch) {
        const beforeText = contentMatch[2];
        const afterText = contentMatch[3];
        const replacement = `${contentMatch[1]}${beforeText}${contentMatch[4]}</w:r></w:p>${answersXml}<w:p><w:r>${contentMatch[1]}${afterText}${contentMatch[4]}`;
        documentXml = documentXml.replace(contentPattern, replacement);
        console.log('✓ Replaced {{content}} successfully');
      } else {
        // Simple split-join to preserve everything
        documentXml = documentXml.split('{{content}}').join('');
        console.log('✓ Removed {{content}} placeholder');
      }
    }
    
    console.log(`XML length change: ${originalLength} -> ${documentXml.length}`);
    
    // Write back the modified XML
    zip.file('word/document.xml', documentXml);
    
    // Generate document with proper compression
    const buf = zip.generate({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9  // Maximum compression to match original file structure
      }
    });
    
    // Save to file
    fs.writeFileSync(outputPath, buf);
    console.log(`✓ Document generated successfully: ${outputPath}`);
    
    return buf;
  } catch (error) {
    console.error('Error creating answer sheet:', error);
    throw error;
  }
}

module.exports = { 
  createAnswerSheet, 
  countWords 
};
