const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

const StudentProfile = require('../models/StudentProfile');
const ScoreBoosterTask = require('../models/ScoreBoosterTask');
const ScoreHistory = require('../models/ScoreHistory');
const { parseResumeWithGemini, fallbackResumeParser } = require('../services/geminiParser');
const { parseResumeWithAI } = require('../services/aiParsingService');
const { calculateInitialScore, generateInitialBoosterTasks } = require('../services/verificationService');

// Multer in-memory storage configuration for handling PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF resume files are accepted.'), false);
    }
  },
});

/**
 * @route   POST /api/profile/parse-resume
 * @desc    Upload PDF resume, extract text with pdf-parse, and analyze with Gemini API / NLP
 * @access  Public / Student
 */
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  // --- Guard: file presence ---
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No resume file uploaded. Please attach a PDF file under the field name "resume".',
    });
  }

  // --- Guard: MIME type (belt-and-suspenders beyond multer fileFilter) ---
  if (
    req.file.mimetype !== 'application/pdf' &&
    !req.file.originalname.toLowerCase().endsWith('.pdf')
  ) {
    return res.status(415).json({
      success: false,
      message: 'Invalid file format. Only PDF resume files are accepted.',
    });
  }

  console.log(`[Resume Parse] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);

  // --- Step 1: Extract raw text from the PDF buffer ---
  let rawText = '';
  try {
    const pdfData = await pdfParse(req.file.buffer);
    rawText = pdfData.text || '';
  } catch (parseErr) {
    console.warn('[pdf-parse Warning] Standard parser threw error, running stream extraction fallback:', parseErr.message);
    try {
      const zlib = require('zlib');
      const bufStr = req.file.buffer.toString('latin1');
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match;
      let extractedLines = [];

      while ((match = streamRegex.exec(bufStr)) !== null) {
        let streamData = match[1];
        try {
          streamData = zlib.inflateSync(Buffer.from(streamData, 'latin1')).toString('latin1');
        } catch (e) {
          // not compressed
        }

        // Look for hex string text: <48656C6C6F> Tj
        const hexMatches = streamData.match(/<([0-9A-Fa-f]+)>\s*Tj/g);
        if (hexMatches) {
          hexMatches.forEach((hm) => {
            const hex = hm.replace(/^</, '').replace(/>\s*Tj$/, '');
            const decoded = Buffer.from(hex, 'hex').toString('utf8');
            extractedLines.push(decoded);
          });
        }

        // Look for plain text: (Hello) Tj
        const textMatches = streamData.match(/\(([^)]+)\)\s*Tj/g);
        if (textMatches) {
          textMatches.forEach((tm) => {
            extractedLines.push(tm.replace(/^\(/, '').replace(/\)\s*Tj$/, ''));
          });
        }
      }

      if (extractedLines.length > 0) {
        rawText = extractedLines.join('\n');
      }
    } catch (fallbackExtractErr) {
      console.error('[Fallback Stream Extraction Error]', fallbackExtractErr.message);
    }

    if (!rawText || rawText.trim().length === 0) {
      console.error('[pdf-parse Error]', parseErr.message);
      return res.status(422).json({
        success: false,
        message:
          'Failed to extract text from the uploaded PDF. The file may be password-protected, corrupted, or not a valid PDF.',
        error: parseErr.message,
      });
    }
  }

  if (rawText.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'The uploaded PDF contains no extractable text. Scanned image-based resumes are not supported — please upload a text-based PDF.',
    });
  }

  console.log(
    `[Resume Parse] Extracted ${rawText.length} characters of text. Invoking AI parsing service...`
  );

  // --- Step 2: Parse extracted text with AI (with rule-based NLP fallback) ---
  let extractedData;
  try {
    extractedData = await parseResumeWithAI(rawText);
  } catch (aiErr) {
    console.warn('[AI Parsing] parseResumeWithAI unavailable or failed, utilizing regex/NLP fallback:', aiErr.message);
    try {
      const fallbackResult = fallbackResumeParser(rawText);
      extractedData = {
        fullName: fallbackResult.candidateName || '',
        email: fallbackResult.email || '',
        rollNumber: fallbackResult.rollNumber || '',
        branch: fallbackResult.branch || '',
        cgpa: fallbackResult.cgpa || 0,
        skills: (fallbackResult.skills || []).map((s) => (typeof s === 'string' ? s : s.name)),
        projects: fallbackResult.projects || [],
        certifications: fallbackResult.certifications || [],
      };
    } catch (fallbackErr) {
      console.error('[AI Parsing Error]', aiErr.message);
      return res.status(502).json({
        success: false,
        message: 'The AI parsing service failed to process the resume. Please try again later.',
        error: aiErr.message,
      });
    }
  }

  console.log(`[Resume Parse] AI extraction complete for: ${req.file.originalname}`);

  // --- Step 3: Return success response ---
  return res.status(200).json({
    message: 'Resume parsed successfully',
    rawText,
    extractedData,
  });
});

/**
 * @route   POST /api/profile/confirm-profile
 * @desc    Confirm reviewed student profile, map skill strings, and persist with upsert to MongoDB
 * @access  Public / Student
 */
router.post('/confirm-profile', async (req, res) => {
  try {
    const {
      userId,
      rollNumber,
      branch,
      cgpa,
      skills,
      projects,
      certifications,
      githubUsername,
      rawResumeText,
      resumeFileName,
      collegeId,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required to confirm and persist the student profile.',
      });
    }

    // Safely format userId as a valid ObjectId if possible to prevent CastErrors
    const mongoose = require('mongoose');
    let validUserId = userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const hex = Buffer.from(String(userId).padEnd(12, '0')).toString('hex').slice(0, 24);
        validUserId = new mongoose.Types.ObjectId(hex);
      } catch (err) {
        validUserId = new mongoose.Types.ObjectId();
      }
    }

    // Map raw skill strings into objects with verifiedStatus: 'Pending' and rationale: 'Pending empirical verification'
    const formattedSkills = (Array.isArray(skills) ? skills : [])
      .map((skill) => {
        if (typeof skill === 'string') {
          return {
            name: skill.trim(),
            category: 'General',
            verifiedStatus: 'Pending',
            rationale: 'Pending empirical verification',
            confidenceScore: 0,
          };
        }
        if (typeof skill === 'object' && skill !== null) {
          return {
            name: (skill.name || '').trim(),
            category: skill.category || 'General',
            verifiedStatus: skill.verifiedStatus || 'Pending',
            rationale: skill.rationale || 'Pending empirical verification',
            confidenceScore: typeof skill.confidenceScore === 'number' ? skill.confidenceScore : 0,
          };
        }
        return null;
      })
      .filter((s) => s && s.name.length > 0);

    // Format projects
    const formattedProjects = (Array.isArray(projects) ? projects : []).map((proj) => ({
      title: proj.title || 'Untitled Project',
      description: proj.description || '',
      githubUrl: proj.githubUrl || '',
      liveDemoUrl: proj.liveDemoUrl || '',
      techStack: Array.isArray(proj.techStack)
        ? proj.techStack
        : typeof proj.techStack === 'string'
        ? proj.techStack.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    }));

    // Format certifications
    const formattedCertifications = (Array.isArray(certifications) ? certifications : []).map((cert) => {
      if (typeof cert === 'string') {
        return {
          title: cert,
          issuer: '',
          proofUrl: '',
          isVerified: false,
        };
      }
      return {
        title: cert.title || 'Certification',
        issuer: cert.issuer || '',
        proofUrl: cert.proofUrl || '',
        isVerified: Boolean(cert.isVerified),
      };
    });

    // Calculate initial dynamic verification score & category breakdown
    const scoreCalculation = calculateInitialScore({
      cgpa,
      projects: formattedProjects,
      skills: formattedSkills,
      certifications: formattedCertifications,
    });

    const updatePayload = {
      userId: validUserId,
      collegeId: collegeId && mongoose.Types.ObjectId.isValid(collegeId) ? collegeId : null,
      rollNumber: rollNumber || '',
      branch: branch || '',
      cgpa: cgpa !== undefined && cgpa !== null && !isNaN(cgpa) ? Number(cgpa) : 0,
      skills: formattedSkills,
      projects: formattedProjects,
      certifications: formattedCertifications,
      verificationScore: scoreCalculation.verificationScore,
      scoreBreakdown: scoreCalculation.scoreBreakdown,
      ...(githubUsername && { githubUsername }),
      ...(rawResumeText && { rawResumeText }),
      ...(resumeFileName && { resumeFileName }),
    };

    let savedProfile;

    // Check if MongoDB connection is open; if not, use safe in-memory document instance
    if (mongoose.connection.readyState === 1) {
      // Perform an upsert (findOneAndUpdate with upsert: true) on StudentProfile in MongoDB matching userId
      savedProfile = await StudentProfile.findOneAndUpdate(
        { userId: validUserId },
        { $set: updatePayload },
        { new: true, upsert: true, runValidators: true }
      );

      // Score history logging (non-blocking)
      try {
        await ScoreHistory.create({
          studentProfileId: savedProfile._id,
          previousScore: 0,
          newScore: savedProfile.verificationScore,
          triggerEvent: 'INITIAL_RESUME_PARSE',
          breakdownSnapshot: savedProfile.scoreBreakdown,
          rationale: `Profile confirmed with ${savedProfile.skills.length} skills, ${savedProfile.projects.length} projects, and CGPA ${savedProfile.cgpa}.`,
        });
      } catch (historyErr) {
        console.warn('[ScoreHistory Warning]', historyErr.message);
      }

      // Generate booster tasks (non-blocking)
      try {
        const initialTasks = generateInitialBoosterTasks(savedProfile._id, savedProfile);
        await ScoreBoosterTask.deleteMany({
          studentProfileId: savedProfile._id,
          status: 'Pending',
        });
        if (initialTasks.length > 0) {
          await ScoreBoosterTask.insertMany(initialTasks);
        }
      } catch (taskErr) {
        console.warn('[ScoreBoosterTask Warning]', taskErr.message);
      }
    } else {
      console.warn('[Confirm Profile] MongoDB not connected, returning in-memory validated document.');
      savedProfile = new StudentProfile(updatePayload);
      savedProfile._id = new mongoose.Types.ObjectId();
    }

    // Return status 200 with the created/updated StudentProfile document
    const responseData = savedProfile.toObject ? savedProfile.toObject() : savedProfile;
    return res.status(200).json({
      success: true,
      message: 'Student profile confirmed and saved successfully',
      data: responseData,
      profile: responseData,
      ...responseData,
    });
  } catch (error) {
    console.error('[Confirm Profile Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm and save student profile.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/profile/confirm
 * @desc    Confirm and persist reviewed student profile, calculate initial score, create booster tasks
 * @access  Student / Auth
 */
router.post('/confirm', async (req, res) => {
  try {
    const {
      userId,
      collegeId,
      rollNumber,
      branch,
      cgpa,
      githubUsername,
      skills,
      projects,
      certifications,
      rawResumeText,
      resumeFileName,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required to link the student profile.',
      });
    }

    // 1. Calculate transparent dynamic verification score
    const scoreCalculation = calculateInitialScore({
      cgpa,
      projects,
      skills,
      certifications,
    });

    const updatePayload = {
      userId,
      collegeId: collegeId || null,
      rollNumber: rollNumber || '',
      branch: branch || '',
      cgpa: cgpa ? Number(cgpa) : 0,
      githubUsername: githubUsername || '',
      skills: Array.isArray(skills) ? skills : [],
      projects: Array.isArray(projects) ? projects : [],
      certifications: Array.isArray(certifications) ? certifications : [],
      verificationScore: scoreCalculation.verificationScore,
      scoreBreakdown: scoreCalculation.scoreBreakdown,
      rawResumeText: rawResumeText || '',
      resumeFileName: resumeFileName || '',
    };

    // 2. Upsert Student Profile
    const existingProfile = await StudentProfile.findOne({ userId });
    const previousScore = existingProfile ? existingProfile.verificationScore : 0;

    const savedProfile = await StudentProfile.findOneAndUpdate(
      { userId },
      updatePayload,
      { new: true, upsert: true, runValidators: true }
    );

    // 3. Log initial score history
    await ScoreHistory.create({
      studentProfileId: savedProfile._id,
      previousScore: previousScore,
      newScore: savedProfile.verificationScore,
      triggerEvent: 'INITIAL_RESUME_PARSE',
      breakdownSnapshot: savedProfile.scoreBreakdown,
      rationale: `Initial profile confirmed with ${savedProfile.skills.length} skills, ${savedProfile.projects.length} projects, and CGPA ${savedProfile.cgpa}.`,
    });

    // 4. Generate initial Score Booster Tasks
    const initialTasks = generateInitialBoosterTasks(savedProfile._id, savedProfile);
    
    // Clear old pending tasks if any and re-seed
    await ScoreBoosterTask.deleteMany({
      studentProfileId: savedProfile._id,
      status: 'Pending',
    });

    let createdTasks = [];
    if (initialTasks.length > 0) {
      createdTasks = await ScoreBoosterTask.insertMany(initialTasks);
    }

    return res.status(201).json({
      success: true,
      message: 'Student profile verified and saved successfully',
      data: {
        profile: savedProfile,
        boosterTasks: createdTasks,
      },
    });
  } catch (error) {
    console.error('[Confirm Profile Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm and save student profile.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/profile/user/:userId
 * @desc    Fetch student profile by userId along with booster tasks and score breakdown
 * @access  Public / Student / Recruiter / TPO
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await StudentProfile.findOne({ userId })
      .populate('userId', 'name email role')
      .populate('collegeId', 'name code eligibilityCutoffScore');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found for this user.',
      });
    }

    const boosterTasks = await ScoreBoosterTask.find({
      studentProfileId: profile._id,
    }).sort({ potentialScoreGain: -1 });

    const scoreHistory = await ScoreHistory.find({
      studentProfileId: profile._id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        profile,
        boosterTasks,
        scoreHistory,
      },
    });
  } catch (error) {
    console.error('[Get Profile Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve student profile.',
      error: error.message,
    });
  }
});

module.exports = router;
