/**
 * Spatial PDF Pre-processing Service — TrustHire
 *
 * Implements Stage 1 of the TrustHire AI/ML Verification Pipeline:
 * 1. Spatial Coordinate Extraction (x, y, width, height) per text glyph/token.
 * 2. Dynamic Column & Gutter Detection (differentiates multi-column sidebars from main body text).
 * 3. Reading Order Reconstruction (prevents sidebar skills from interleaving into project descriptions).
 * 4. Hyphenation resolution & typography/line clustering.
 * 5. Deterministic Regex Filtering & Anchor Extraction (GitHub repos, live demos, emails, roll numbers, CGPA).
 */

const fs = require('fs');
const path = require('path');

/**
 * Stage 1: Deterministic regex patterns for profile anchors
 */
const REGEX_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  githubUrl: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/gi,
  githubUsername: /(?:github\.com\/|@)([A-Za-z0-9_-]{2,38})/i,
  liveDemoUrl: /https?:\/\/[A-Za-z0-9_.-]+\.(?:vercel\.app|netlify\.app|onrender\.com|pages\.dev|herokuapp\.com|firebaseapp\.com|amplifyapp\.com|surge\.sh|render\.com|fly\.dev)[^\s)>]*/gi,
  cgpa: /(?:cgpa|gpa|pointer|cumulative\s*grade)\s*[:=]?\s*([0-9](\.[0-9]{1,2})?)(?:\s*\/\s*(?:10|4))?/i,
  cgpaSlash: /([0-9]\.[0-9]{1,2})\s*\/\s*(?:10|4)/i,
  rollNumber: /\b(?:roll\s*(?:no\.?|number)?|student\s*id|registration\s*(?:no\.?|number)?|prn|usn|\bid)\s*[:=]\s*([A-Za-z0-9_-]+)/i,
  linkedIn: /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/gi,
};

const SECTION_HEADER_PATTERNS = [
  { type: 'SKILLS', regex: /^(?:technical\s+)?skills(?:\s+summary|\s+taxonomy)?$/i },
  { type: 'PROJECTS', regex: /^(?:academic\s+|technical\s+|key\s+)?projects$/i },
  { type: 'EXPERIENCE', regex: /^(?:work\s+|professional\s+)?experience|employment|internships?$/i },
  { type: 'EDUCATION', regex: /^(?:academic\s+background|education|qualifications?)$/i },
  { type: 'CERTIFICATIONS', regex: /^(?:certifications?|licenses?|credentials?|courses?)$/i },
  { type: 'ACHIEVEMENTS', regex: /^(?:achievements?|awards?|honors?|extracurricular)$/i },
  { type: 'SUMMARY', regex: /^(?:professional\s+summary|profile|about\s+me|objective)$/i },
];

/**
 * Extracts deterministic patterns from raw or reconstructed text.
 */
function extractDeterministicAnchors(text) {
  const emails = Array.from(new Set(text.match(REGEX_PATTERNS.email) || []));
  const phones = Array.from(new Set(text.match(REGEX_PATTERNS.phone) || []));
  const githubUrls = Array.from(new Set(text.match(REGEX_PATTERNS.githubUrl) || []));
  const liveDemoUrls = Array.from(new Set(text.match(REGEX_PATTERNS.liveDemoUrl) || []));
  const linkedInUrls = Array.from(new Set(text.match(REGEX_PATTERNS.linkedIn) || []));

  // Determine GitHub username
  let githubUsername = '';
  if (githubUrls.length > 0) {
    const match = githubUrls[0].match(/github\.com\/([A-Za-z0-9_.-]+)/i);
    if (match && match[1]) {
      githubUsername = match[1].replace(/\/.*$/, '');
    }
  }

  // Extract CGPA
  let cgpa = null;
  const cgpaMatch = text.match(REGEX_PATTERNS.cgpa) || text.match(REGEX_PATTERNS.cgpaSlash);
  if (cgpaMatch && cgpaMatch[1]) {
    const val = parseFloat(cgpaMatch[1]);
    if (!isNaN(val)) {
      // Normalize 4.0 scale to 10.0 scale if <= 4.0 and explicit /4 was present or < 4
      if (val <= 4.0 && text.includes('/4')) {
        cgpa = parseFloat((val * 2.5).toFixed(2));
      } else {
        cgpa = Math.min(10, Math.max(0, parseFloat(val.toFixed(2))));
      }
    }
  }

  // Extract Roll number
  let rollNumber = '';
  const rollMatch = text.match(REGEX_PATTERNS.rollNumber);
  if (rollMatch && rollMatch[1]) {
    rollNumber = rollMatch[1].trim();
  }

  // Branch heuristics
  let branch = '';
  if (/computer\s+science/i.test(text)) branch = 'Computer Science and Engineering';
  else if (/information\s+technology/i.test(text)) branch = 'Information Technology';
  else if (/data\s+science/i.test(text)) branch = 'Data Science & Artificial Intelligence';
  else if (/artificial\s+intelligence/i.test(text)) branch = 'Artificial Intelligence & Machine Learning';
  else if (/electronics\s+(?:and|&)\s+comm/i.test(text)) branch = 'Electronics & Communication Engineering';
  else if (/electrical/i.test(text)) branch = 'Electrical Engineering';
  else if (/mechanical/i.test(text)) branch = 'Mechanical Engineering';
  else if (/civil/i.test(text)) branch = 'Civil Engineering';

  return {
    emails,
    phones,
    githubUrls,
    githubUsername,
    liveDemoUrls,
    linkedInUrls,
    cgpa,
    rollNumber,
    branch,
  };
}

/**
 * Clusters text items on a page into horizontal lines based on vertical baseline proximity.
 */
function clusterItemsIntoLines(items, yTolerance = 3.5) {
  if (!items || items.length === 0) return [];

  // Sort primarily by Y descending (PDF top is max Y)
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item);
    } else {
      // Finalize current line
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Sort each line horizontally from left to right (X ascending) and join strings
  return lines.map((lineItems) => {
    lineItems.sort((a, b) => a.x - b.x);

    let lineStr = '';
    let lastRight = null;
    let minX = Infinity;
    let maxX = -Infinity;
    let avgY = 0;

    for (const it of lineItems) {
      minX = Math.min(minX, it.x);
      maxX = Math.max(maxX, it.x + (it.width || 0));
      avgY += it.y;

      if (lastRight === null) {
        lineStr += it.str;
      } else {
        const gap = it.x - lastRight;
        // If there is a perceptible gap (> 2.0pt), insert a space
        if (gap > 2.0) {
          lineStr += ' ' + it.str;
        } else {
          lineStr += it.str;
        }
      }
      lastRight = it.x + (it.width || 0);
    }

    avgY = avgY / lineItems.length;

    return {
      text: lineStr.trim(),
      x: minX,
      xEnd: maxX,
      y: avgY,
      items: lineItems,
    };
  }).filter((l) => l.text.length > 0);
}

/**
 * Detects multi-column layout by analyzing horizontal distribution (X-coordinates)
 * and searching for a distinct vertical channel / gutter across the page body.
 */
function detectColumnLayout(items, pageWidth, pageHeight, headerCutoffY) {
  // Focus on body items below the header band
  const bodyItems = items.filter((it) => it.y < headerCutoffY);
  if (bodyItems.length < 4) {
    return { isMultiColumn: false, columnCount: 1, splitX: null };
  }

  // Evaluate candidate split points every 10 points between 25% and 75% of page width
  const minSplitX = pageWidth * 0.25;
  const maxSplitX = pageWidth * 0.75;
  let bestSplitX = null;
  let bestScore = -Infinity;

  for (let sx = minSplitX; sx <= maxSplitX; sx += 10) {
    let leftCount = 0;
    let rightCount = 0;
    let straddleCount = 0;
    let leftMinY = Infinity, leftMaxY = -Infinity;
    let rightMinY = Infinity, rightMaxY = -Infinity;

    for (const it of bodyItems) {
      const itLeft = it.x;
      const itRight = it.x + (it.width || 0);

      if (itRight <= sx + 5) {
        leftCount++;
        leftMinY = Math.min(leftMinY, it.y);
        leftMaxY = Math.max(leftMaxY, it.y);
      } else if (itLeft >= sx - 5) {
        rightCount++;
        rightMinY = Math.min(rightMinY, it.y);
        rightMaxY = Math.max(rightMaxY, it.y);
      } else {
        straddleCount++;
      }
    }

    // Must have items on both sides and very few straddling items
    if (leftCount >= 2 && rightCount >= 2) {
      // Calculate vertical overlap between left and right columns
      const overlapStart = Math.max(leftMinY, rightMinY);
      const overlapEnd = Math.min(leftMaxY, rightMaxY);
      const verticalOverlap = Math.max(0, overlapEnd - overlapStart);

      // Score: high counts on both sides, minimal straddles, high vertical overlap
      const balance = Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount);
      const score = (leftCount + rightCount) * balance + verticalOverlap * 0.5 - straddleCount * 15;

      if (score > bestScore && verticalOverlap > 20 && straddleCount <= Math.max(1, bodyItems.length * 0.12)) {
        bestScore = score;
        bestSplitX = sx;
      }
    }
  }

  if (bestSplitX !== null) {
    return {
      isMultiColumn: true,
      columnCount: 2,
      splitX: bestSplitX,
    };
  }

  return { isMultiColumn: false, columnCount: 1, splitX: null };
}

/**
 * Reconstructs a single page's text respecting spatial columns and reading order.
 */
function reconstructPageSpatialText(rawItems, pageIndex = 1) {
  if (!rawItems || rawItems.length === 0) {
    return { text: '', layout: { isMultiColumn: false } };
  }

  // Normalize text items
  const cleanItems = rawItems
    .map((it) => ({
      str: (it.str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''),
      x: it.transform ? it.transform[4] : it.x || 0,
      y: it.transform ? it.transform[5] : it.y || 0,
      width: it.width || 0,
      height: it.height || (it.transform ? Math.abs(it.transform[0]) : 10),
    }))
    .filter((it) => it.str.trim().length > 0);

  if (cleanItems.length === 0) {
    return { text: '', layout: { isMultiColumn: false } };
  }

  // Calculate page bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const it of cleanItems) {
    minX = Math.min(minX, it.x);
    maxX = Math.max(maxX, it.x + it.width);
    minY = Math.min(minY, it.y);
    maxY = Math.max(maxY, it.y);
  }

  const pageWidth = maxX - minX || 600;
  const pageHeight = maxY - minY || 800;

  // Header zone is typically top 18-22% of page content
  const headerCutoffY = maxY - pageHeight * 0.20;

  // Detect column layout on body text
  const layout = detectColumnLayout(cleanItems, maxX, maxY, headerCutoffY);

  const outputSections = [];

  // 1. HEADER SECTION (Full Width, Top of Page)
  const headerItems = cleanItems.filter((it) => it.y >= headerCutoffY);
  if (headerItems.length > 0) {
    const headerLines = clusterItemsIntoLines(headerItems);
    if (headerLines.length > 0) {
      outputSections.push({
        title: `PAGE ${pageIndex} - HEADER`,
        content: headerLines.map((l) => l.text).join('\n'),
      });
    }
  }

  // 2. BODY SECTION
  const bodyItems = cleanItems.filter((it) => it.y < headerCutoffY);

  if (layout.isMultiColumn && layout.splitX) {
    // Left column items (typically skills, education, contact info in sidebar resumes)
    const leftColItems = bodyItems.filter((it) => it.x + it.width * 0.5 < layout.splitX);
    // Right column items (typically experience, projects, summary)
    const rightColItems = bodyItems.filter((it) => it.x + it.width * 0.5 >= layout.splitX);

    const leftLines = clusterItemsIntoLines(leftColItems);
    const rightLines = clusterItemsIntoLines(rightColItems);

    if (leftLines.length > 0) {
      outputSections.push({
        title: `PAGE ${pageIndex} - COLUMN 1 (SIDEBAR / LEFT)`,
        content: leftLines.map((l) => l.text).join('\n'),
      });
    }

    if (rightLines.length > 0) {
      outputSections.push({
        title: `PAGE ${pageIndex} - COLUMN 2 (MAIN BODY / RIGHT)`,
        content: rightLines.map((l) => l.text).join('\n'),
      });
    }
  } else {
    // Single column reading order
    const bodyLines = clusterItemsIntoLines(bodyItems);
    if (bodyLines.length > 0) {
      outputSections.push({
        title: `PAGE ${pageIndex} - MAIN CONTENT`,
        content: bodyLines.map((l) => l.text).join('\n'),
      });
    }
  }

  // Format final page output with clear delimiters
  const formattedPageText = outputSections
    .map((sec) => `=== [${sec.title}] ===\n${sec.content}`)
    .join('\n\n');

  return {
    text: formattedPageText,
    layout: {
      ...layout,
      pageWidth: Math.round(pageWidth),
      pageHeight: Math.round(pageHeight),
    },
  };
}

/**
 * Resolves hyphenation at line breaks (e.g., "microser- \n vices" -> "microservices")
 * and cleans up residual PDF glyph artifacts.
 */
function cleanAndDehyphenate(text) {
  return text
    // Replace hyphen followed by newline with joined word
    .replace(/([a-zA-Z]{2,})-\r?\n\s*([a-zA-Z]{2,})/g, '$1$2')
    // Standardize bullet points
    .replace(/[\u2022\u2023\u25E6\u2043\u2219▪■●◆]/g, '• ')
    // Collapse multiple consecutive spaces (not newlines)
    .replace(/[ \t]{2,}/g, ' ')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Primary Entry Point: Extracts text and spatial metadata from a PDF Buffer.
 * Uses modern pdfjs-dist legacy build with fallback to pdf-parse.
 *
 * @param {Buffer} pdfBuffer - Uploaded PDF file buffer
 * @returns {Promise<Object>} Reconstructed text, layout metadata, and pre-extracted anchors
 */
async function extractSpatialText(pdfBuffer) {
  let reconstructedText = '';
  let layouts = [];
  let numPages = 1;
  let extractionMethod = 'pdfjs-dist-spatial';

  try {
    // Primary engine: pdfjs-dist legacy build
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;

    const pageTexts = [];
    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      const { text, layout } = reconstructPageSpatialText(textContent.items, p);
      pageTexts.push(text);
      layouts.push(layout);
    }

    reconstructedText = pageTexts.join('\n\n');
  } catch (pdfjsErr) {
    console.warn('[SpatialPdfService] pdfjs-dist threw error, using fallback extractor:', pdfjsErr.message);
    extractionMethod = 'pdf-parse-fallback';

    // Fallback engine: pdf-parse with custom pagerender
    const pdfParse = require('pdf-parse');
    const parseResult = await pdfParse(pdfBuffer, {
      pagerender: async function (pageData) {
        try {
          const textContent = await pageData.getTextContent();
          const { text, layout } = reconstructPageSpatialText(
            textContent.items,
            pageData.pageIndex + 1
          );
          layouts.push(layout);
          return text;
        } catch (e) {
          return '';
        }
      },
    });

    reconstructedText = parseResult.text || '';
    numPages = parseResult.numpages || 1;
  }

  // Dehyphenate and normalize
  const cleanedText = cleanAndDehyphenate(reconstructedText);

  // Extract deterministic anchors (Stage 1 deterministic regex)
  const anchors = extractDeterministicAnchors(cleanedText);

  const hasMultiColumn = layouts.some((l) => l.isMultiColumn);

  return {
    spatiallyReconstructedText: cleanedText,
    rawText: cleanedText,
    spatialMetadata: {
      extractionMethod,
      numPages,
      hasMultiColumn,
      layouts,
    },
    anchors,
  };
}

module.exports = {
  extractSpatialText,
  extractDeterministicAnchors,
  cleanAndDehyphenate,
  reconstructPageSpatialText,
};
