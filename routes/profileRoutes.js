const express = require('express');
const router = express.Router();
const multer = require('multer');

const StudentProfile = require('../models/StudentProfile');
const ScoreBoosterTask = require('../models/ScoreBoosterTask');
const ScoreHistory = require('../models/ScoreHistory');
const { parseResumeWithAI } = require('../services/aiParsingService');
const { extractSpatialText, extractDeterministicAnchors } = require('../services/spatialPdfService');
const { normalizeAndCategorizeSkills } = require('../services/skillNormalizer');
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
 * @desc    Upload PDF resume, execute spatial layout & coordinate reconstruction,
 *          run regex deterministic filtering, and parse with Gemini 1.5 Flash / strict JSON schema
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

  // --- Guard: MIME type ---
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

  // --- Step 1: Spatial Text Extraction & Layout Pre-Processing ---
  let spatialResult;
  try {
    spatialResult = await extractSpatialText(req.file.buffer);
  } catch (extractErr) {
    console.error('[Spatial Extract Error]', extractErr.message);
    return res.status(422).json({
      success: false,
      message:
        'Failed to extract spatial text from the uploaded PDF. The file may be password-protected or corrupt.',
      error: extractErr.message,
    });
  }

  const rawText = spatialResult.spatiallyReconstructedText || '';
  if (rawText.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'The uploaded PDF contains no extractable text. Scanned image-based resumes are not supported — please upload a text-based PDF.',
    });
  }

  console.log(
    `[Resume Parse] Spatial layout analysis complete (${spatialResult.spatialMetadata.extractionMethod}, pages: ${spatialResult.spatialMetadata.numPages}, multi-column: ${spatialResult.spatialMetadata.hasMultiColumn}). Invoking AI parser...`
  );

  // --- Step 2: Contextual Entity Extraction via Gemini 1.5 Flash (with strict JSON schema & spatial anchors) ---
  let extractedData;
  try {
    extractedData = await parseResumeWithAI(rawText, spatialResult.anchors);
  } catch (aiErr) {
    console.error('[AI Parsing Fatal Error]', aiErr.message);
    return res.status(502).json({
      success: false,
      message: 'The AI parsing engine failed to process the resume.',
      error: aiErr.message,
    });
  }

  // --- Step 3: Canonical Skill Normalization & Empirical Project Cross-Referencing ---
  const normalizedSkills = normalizeAndCategorizeSkills(
    extractedData.skills || [],
    extractedData.projects || []
  );
  extractedData.skills = normalizedSkills;

  console.log(`[Resume Parse] Extraction and skill canonicalization complete for: ${req.file.originalname}`);

  // --- Step 4: Return Success Payload ---
  return res.status(200).json({
    success: true,
    message: 'Resume parsed successfully with spatial reconstruction and AI validation',
    spatialMetadata: spatialResult.spatialMetadata,
    anchors: spatialResult.anchors,
    rawText,
    extractedData,
  });
});

/**
 * @route   POST /api/profile/confirm-profile
 * @desc    Confirm reviewed student profile, canonicalize skills into taxonomy, and persist with upsert to MongoDB
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

    // Normalize and categorize skills into strict taxonomy with empirical cross-referencing
    const formattedSkills = normalizeAndCategorizeSkills(skills || [], formattedProjects);

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

    // Normalize and categorize skills into strict taxonomy with empirical cross-referencing
    const formattedSkills = normalizeAndCategorizeSkills(skills || [], formattedProjects);

    // 1. Calculate transparent dynamic verification score
    const scoreCalculation = calculateInitialScore({
      cgpa,
      projects: formattedProjects,
      skills: formattedSkills,
      certifications,
    });

    const updatePayload = {
      userId,
      collegeId: collegeId || null,
      rollNumber: rollNumber || '',
      branch: branch || '',
      cgpa: cgpa ? Number(cgpa) : 0,
      githubUsername: githubUsername || '',
      skills: formattedSkills,
      projects: formattedProjects,
      certifications: Array.isArray(certifications) ? certifications : [],
      verificationScore: scoreCalculation.verificationScore,
      scoreBreakdown: scoreCalculation.scoreBreakdown,
      rawResumeText: rawResumeText || '',
      resumeFileName: resumeFileName || '',
    };

    let savedProfile;
    let createdTasks = [];

    if (mongoose.connection.readyState === 1) {
      // 2. Upsert Student Profile in MongoDB
      const existingProfile = await StudentProfile.findOne({ userId });
      const previousScore = existingProfile ? existingProfile.verificationScore : 0;

      savedProfile = await StudentProfile.findOneAndUpdate(
        { userId },
        updatePayload,
        { new: true, upsert: true, runValidators: true }
      );

      // 3. Log initial score history
      try {
        await ScoreHistory.create({
          studentProfileId: savedProfile._id,
          previousScore: previousScore,
          newScore: savedProfile.verificationScore,
          triggerEvent: 'INITIAL_RESUME_PARSE',
          breakdownSnapshot: savedProfile.scoreBreakdown,
          rationale: `Initial profile confirmed with ${savedProfile.skills.length} skills, ${savedProfile.projects.length} projects, and CGPA ${savedProfile.cgpa}.`,
        });
      } catch (historyErr) {
        console.warn('[ScoreHistory Warning]', historyErr.message);
      }

      // 4. Generate initial Score Booster Tasks
      try {
        const initialTasks = generateInitialBoosterTasks(savedProfile._id, savedProfile);
        await ScoreBoosterTask.deleteMany({
          studentProfileId: savedProfile._id,
          status: 'Pending',
        });
        if (initialTasks.length > 0) {
          createdTasks = await ScoreBoosterTask.insertMany(initialTasks);
        }
      } catch (taskErr) {
        console.warn('[ScoreBoosterTask Warning]', taskErr.message);
      }
    } else {
      console.warn('[Confirm Profile] MongoDB not connected, returning in-memory validated document.');
      savedProfile = new StudentProfile(updatePayload);
      savedProfile._id = new mongoose.Types.ObjectId();
      createdTasks = generateInitialBoosterTasks(savedProfile._id, savedProfile);
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
