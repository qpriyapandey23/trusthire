const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Parsing Service — TrustHire
 * Uses Google Gemini API to extract structured candidate data from raw resume text.
 */

/**
 * Strict JSON schema expected from Gemini:
 * {
 *   "fullName": string,
 *   "email": string,
 *   "rollNumber": string,
 *   "branch": string,
 *   "cgpa": number,
 *   "skills": [string],
 *   "projects": [{ "title": string, "description": string, "githubUrl": string, "liveDemoUrl": string, "techStack": [string] }],
 *   "certifications": [{ "title": string, "issuer": string }]
 * }
 */

const RESUME_PARSE_PROMPT = (rawText) => `
You are an expert resume parser. Your only task is to extract structured information from the resume text provided below and return it as a single, valid JSON object.

Return ONLY the JSON object — no markdown, no code fences, no explanation.

The JSON must strictly conform to this schema (do not add or rename any fields):

{
  "fullName": "string — candidate's full name, or empty string if not found",
  "email": "string — candidate's email address, or empty string if not found",
  "rollNumber": "string — university/college roll number or student ID, or empty string if not found",
  "branch": "string — degree branch or specialization (e.g. Computer Science and Engineering), or empty string if not found",
  "cgpa": "number — CGPA or GPA on a 10-point scale. Convert 4-point scale to 10-point by multiplying by 2.5. Use 0 if not found",
  "skills": ["string — array of individual skill names mentioned in the resume"],
  "projects": [
    {
      "title": "string — project title",
      "description": "string — brief project description or objective",
      "githubUrl": "string — GitHub repository URL for this project, or empty string",
      "liveDemoUrl": "string — live deployment URL (Vercel, Netlify, Render, etc.) for this project, or empty string",
      "techStack": ["string — technologies used in this project"]
    }
  ],
  "certifications": [
    {
      "title": "string — certification or course title",
      "issuer": "string — issuing organization (e.g. Google, Coursera, AWS), or empty string"
    }
  ]
}

Rules:
- Extract every project mentioned; do not skip any.
- Extract every skill listed; do not skip any.
- Extract every certification or course completion mentioned.
- If a field is genuinely not present in the resume, use an empty string "" for string fields, 0 for number fields, or an empty array [] for array fields.
- Do NOT invent or hallucinate any data not present in the resume.
- Return ONLY the JSON object. Any text outside the JSON will cause a critical failure.

Resume Text:
---
${rawText.slice(0, 9000)}
---
`;

/**
 * Sends raw resume text to the Google Gemini API and parses the JSON response.
 *
 * @param {string} rawText - Raw text extracted from the candidate's PDF resume.
 * @returns {Promise<Object>} Structured resume data matching the specified schema.
 * @throws {Error} If the Gemini API key is missing, the API call fails, or the response is not valid JSON.
 */
async function parseResumeWithAI(rawText) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please set a valid API key in your .env file.'
    );
  }

  let responseText = '';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        // Force JSON output at the model level for reliability
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temperature for deterministic structured output
      },
    });

    console.log('[aiParsingService] Sending resume text to Gemini API...');

    const result = await model.generateContent(RESUME_PARSE_PROMPT(rawText));
    responseText = result.response.text();

    console.log('[aiParsingService] Gemini response received. Parsing JSON...');

    const parsed = JSON.parse(responseText);

    // Validate and normalize the parsed output to guarantee schema compliance
    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      rollNumber: typeof parsed.rollNumber === 'string' ? parsed.rollNumber : '',
      branch: typeof parsed.branch === 'string' ? parsed.branch : '',
      cgpa: typeof parsed.cgpa === 'number' ? parsed.cgpa : Number(parsed.cgpa) || 0,
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s) => typeof s === 'string')
        : [],
      projects: Array.isArray(parsed.projects)
        ? parsed.projects.map((p) => ({
            title: typeof p.title === 'string' ? p.title : '',
            description: typeof p.description === 'string' ? p.description : '',
            githubUrl: typeof p.githubUrl === 'string' ? p.githubUrl : '',
            liveDemoUrl: typeof p.liveDemoUrl === 'string' ? p.liveDemoUrl : '',
            techStack: Array.isArray(p.techStack)
              ? p.techStack.filter((t) => typeof t === 'string')
              : [],
          }))
        : [],
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.map((c) => ({
            title: typeof c.title === 'string' ? c.title : '',
            issuer: typeof c.issuer === 'string' ? c.issuer : '',
          }))
        : [],
    };
  } catch (error) {
    // Distinguish JSON parse failures from API/network errors
    if (error instanceof SyntaxError) {
      console.error('[aiParsingService] Gemini returned invalid JSON:', responseText.slice(0, 500));
      throw new Error(
        'Gemini API returned a non-JSON response. The model output could not be parsed as structured data.'
      );
    }

    console.error('[aiParsingService] Gemini API call failed:', error.message);
    throw new Error(`AI parsing failed: ${error.message}`);
  }
}

module.exports = { parseResumeWithAI };
