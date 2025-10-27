const PizZip = require('pizzip');
const fs = require('fs');

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

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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

function generateAnswersXml(answers) {
  let xml = '';
  for (const taskKey in answers) {
    xml += `<w:p><w:pPr><w:spacing w:before="400" w:after="200"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(taskKey)}</w:t></w:r></w:p>`;
    for (const questionKey in answers[taskKey]) {
      const answerText = answers[taskKey][questionKey];
      
      const formattedQuestionKey = questionKey.replace(/(\d+)\(([a-z])\)/gi, '$1 ($2)');
      
      xml += `<w:p><w:pPr><w:spacing w:before="200" w:after="200"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(formattedQuestionKey)}</w:t></w:r></w:p>`;
      
      xml += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/></w:tcPr>`;
      
      const lines = answerText.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const cleanLine = line.trim().replace(/^[•\-\*]\s*/, '');
        if (cleanLine) {
          xml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>`;
          
          const parts = parseBoldText(cleanLine);
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
      xml += `</w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;
    }
  }
  return xml;
}

async function createAnswerSheet(templatePath, outputPath, data) {
  try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const wordCount = data.wordCount || countWords(data.answers);
    
    // Read as UTF-8 string to properly handle all characters including tabs
    let documentXml = zip.file('word/document.xml').asText();
    const answersXml = generateAnswersXml(data.answers);
    
    console.log('Replacing placeholders in document...');
    
    // Store original length for verification
    const originalLength = documentXml.length;
    
    // Replace placeholders with exact string matching - no regex complications
    // This preserves ALL characters including tabs, spaces, and special whitespace
    if (documentXml.includes('{{LEARNER_NAME}}')) {
      documentXml = documentXml.split('{{LEARNER_NAME}}').join(escapeXml(data.name || 'Generated Learner'));
      console.log('Replaced LEARNER_NAME');
    }
    
    if (documentXml.includes('{{LEARNER_NUMBER}}')) {
      documentXml = documentXml.split('{{LEARNER_NUMBER}}').join(escapeXml(data.number || '00000000'));
      console.log('Replaced LEARNER_NUMBER');
    }
    
    if (documentXml.includes('{{WORD_COUNT}}')) {
      documentXml = documentXml.split('{{WORD_COUNT}}').join(wordCount.toString());
      console.log('Replaced WORD_COUNT');
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
        console.log('Replaced {{content}} successfully');
      } else {
        // Simple split-join to preserve everything
        documentXml = documentXml.split('{{content}}').join('');
        console.log('Removed {{content}} placeholder');
      }
    }
    
    console.log(`XML length change: ${originalLength} -> ${documentXml.length}`);
    
    // Write back with UTF-8 encoding explicitly
    zip.file('word/document.xml', documentXml);
    
    // Generate with settings that preserve structure
    const buf = zip.generate({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9  // Maximum compression to match original file structure
      }
    });
    
    fs.writeFileSync(outputPath, buf);
    console.log('Document generated successfully');
    return buf;
  } catch (error) {
    console.error('Error creating answer sheet:', error);
    throw error;
  }
}

module.exports = { createAnswerSheet, countWords };