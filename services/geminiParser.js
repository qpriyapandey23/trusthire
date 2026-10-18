const { parseResumeWithAI, fallbackSpatialResumeParser } = require('./aiParsingService');
const { extractDeterministicAnchors } = require('./spatialPdfService');

/**
 * Legacy Adapter for Gemini Parser
 * Routes requests to the upgraded aiParsingService with strict JSON schema and spatial anchors.
 */
async function parseResumeWithGemini(rawText) {
  const anchors = extractDeterministicAnchors(rawText || '');
  return parseResumeWithAI(rawText, anchors);
}

function fallbackResumeParser(text) {
  const anchors = extractDeterministicAnchors(text || '');
  return fallbackSpatialResumeParser(text, anchors);
}

module.exports = {
  parseResumeWithGemini,
  fallbackResumeParser,
};
