const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

const StudentProfile = require('../models/StudentProfile');
const ScoreBoosterTask = require('../models/ScoreBoosterTask');
const ScoreHistory = require('../models/ScoreHistory');
const { parseResumeWithGemini } = require('../services/geminiParser');
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
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded. Please upload a PDF file.',
      });
    }

    console.log(`[Resume Parse] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);

    // 1. Extract text from uploaded PDF buffer
    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (parseErr) {
      console.error('[pdf-parse Error]', parseErr.message);
      return res.status(422).json({
        success: false,
        message: 'Failed to extract text from the PDF file. The file may be password-protected or corrupt.',
        error: parseErr.message,
      });
    }

    const rawText = pdfData.text || '';
    if (rawText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded PDF contains no readable text. (Scanned image resumes require OCR).',
      });
    }

    console.log(`[Resume Parse] Extracted ${rawText.length} characters of text. Invoking Gemini API...`);

    // 2. Pass text to Gemini API for entity extraction & claim structured mapping
    const structuredProfile = await parseResumeWithGemini(rawText);
    structuredProfile.resumeFileName = req.file.originalname;

    return res.status(200).json({
      success: true,
      message: 'Resume parsed and claims extracted successfully',
      data: structuredProfile,
    });
  } catch (error) {
    console.error('[Parse-Resume Error]', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while parsing the resume.',
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
