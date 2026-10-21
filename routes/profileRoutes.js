const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');

const { protect } = require('../middleware/authMiddleware');

const StudentProfile = require('../models/StudentProfile');
const ScoreBoosterTask = require('../models/ScoreBoosterTask');
const ScoreHistory = require('../models/ScoreHistory');
require('../models/College'); // Register College model in mongoose to avoid MissingSchemaError

const { parseResumeWithAI } = require('../services/aiParsingService');

const {
  extractSpatialText,
} = require('../services/spatialPdfService');

const {
  normalizeAndCategorizeSkills,
} = require('../services/skillNormalizer');

const {
  calculateInitialScore,
  generateInitialBoosterTasks,
} = require('../services/verificationService');

// --------------------------------------------------
// MULTER CONFIGURATION
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF resume files are accepted.'), false);
    }
  },
});

// --------------------------------------------------
// HELPER: VALIDATE DATABASE CONNECTION
// --------------------------------------------------

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

// --------------------------------------------------
// HELPER: NORMALIZE PROFILE DATA
// --------------------------------------------------

function formatProjects(projects) {
  return (Array.isArray(projects) ? projects : []).map((proj) => ({
    title: proj.title || 'Untitled Project',
    description: proj.description || '',
    githubUrl: proj.githubUrl || '',
    liveDemoUrl: proj.liveDemoUrl || '',

    techStack: Array.isArray(proj.techStack)
      ? proj.techStack
      : typeof proj.techStack === 'string'
        ? proj.techStack
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        : [],
  }));
}

function formatCertifications(certifications) {
  return (Array.isArray(certifications) ? certifications : []).map(
    (cert) => {
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
        issueDate: cert.issueDate || undefined,
        isVerified: Boolean(cert.isVerified),
      };
    }
  );
}

function formatStudentData(data) {
  const formattedProjects = formatProjects(data.projects);

  const formattedSkills = normalizeAndCategorizeSkills(
    data.skills || [],
    formattedProjects
  );

  const formattedCertifications = formatCertifications(
    data.certifications
  );

  // Normalize achievements — only keep entries with a non-empty title
  const formattedAchievements = (Array.isArray(data.achievements) ? data.achievements : []).map((a) => ({
    title: (a.title || '').trim(),
    description: (a.description || '').trim(),
    date: (a.date || '').trim(),
  })).filter((a) => a.title.length > 0);

  const scoreCalculation = calculateInitialScore({
    cgpa: data.cgpa,
    projects: formattedProjects,
    skills: formattedSkills,
    certifications: formattedCertifications,
  });

  return {
    collegeId:
      data.collegeId &&
        mongoose.Types.ObjectId.isValid(data.collegeId)
        ? data.collegeId
        : null,

    rollNumber: data.rollNumber || '',
    branch: data.branch || '',

    graduationYear:
      data.graduationYear &&
        !isNaN(data.graduationYear)
        ? Number(data.graduationYear)
        : new Date().getFullYear(),

    cgpa:
      data.cgpa !== undefined &&
        data.cgpa !== null &&
        !isNaN(data.cgpa)
        ? Number(data.cgpa)
        : 0,

    githubUsername: data.githubUsername || '',

    skills: formattedSkills,
    projects: formattedProjects,
    achievements: formattedAchievements,
    certifications: formattedCertifications,

    verificationScore: scoreCalculation.verificationScore,
    scoreBreakdown: scoreCalculation.scoreBreakdown,

    rawResumeText: data.rawResumeText || '',
    resumeFileName: data.resumeFileName || '',
  };
}

// --------------------------------------------------
// HELPER: SAVE A NEW PROFILE DOCUMENT
// --------------------------------------------------

async function createStudentProfile(data) {
  if (!isDatabaseConnected()) {
    const error = new Error(
      'MongoDB is not connected. Student profile was not saved.'
    );

    error.statusCode = 503;
    throw error;
  }

  if (!data.userId) {
    const error = new Error('userId is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(data.userId)) {
    const error = new Error('Invalid userId.');
    error.statusCode = 400;
    throw error;
  }

  const userId = new mongoose.Types.ObjectId(data.userId);

  const profileData = formatStudentData(data);

  // IMPORTANT:
  // create() inserts a new document.
  // It does not overwrite the student's previous profile.
  const savedProfile = await StudentProfile.create({
    ...profileData,
    userId,
  });

  console.log(
    '[MongoDB] New student profile created:',
    savedProfile._id.toString()
  );

  // Save score history for this specific profile.
  try {
    await ScoreHistory.create({
      studentProfileId: savedProfile._id,
      previousScore: 0,
      newScore: savedProfile.verificationScore,
      triggerEvent: 'INITIAL_RESUME_PARSE',
      breakdownSnapshot: savedProfile.scoreBreakdown,

      rationale:
        `New resume profile created. ` +
        `Skills: ${savedProfile.skills.length}, ` +
        `Projects: ${savedProfile.projects.length}, ` +
        `CGPA: ${savedProfile.cgpa}.`,
    });
  } catch (error) {
    console.warn('[ScoreHistory Warning]', error.message);
  }

  // Create tasks associated with this new profile.
  try {
    const tasks = generateInitialBoosterTasks(
      savedProfile._id,
      savedProfile
    );

    if (tasks.length > 0) {
      await ScoreBoosterTask.insertMany(tasks);
    }
  } catch (error) {
    console.warn('[ScoreBoosterTask Warning]', error.message);
  }

  return savedProfile;
}

// --------------------------------------------------
// ROUTE 1: PARSE RESUME
// POST /api/profile/parse-resume
// --------------------------------------------------

router.post(
  '/parse-resume',
  upload.single('resume'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'No resume uploaded. Upload a PDF using the resume field.',
        });
      }

      if (
        req.file.mimetype !== 'application/pdf' &&
        !req.file.originalname.toLowerCase().endsWith('.pdf')
      ) {
        return res.status(415).json({
          success: false,
          message: 'Only PDF resume files are accepted.',
        });
      }

      console.log(
        `[Resume Parse] Processing ${req.file.originalname}`
      );

      let spatialResult;

      try {
        spatialResult = await extractSpatialText(req.file.buffer);
      } catch (error) {
        console.error('[Spatial Extract Error]', error.message);

        return res.status(422).json({
          success: false,
          message: 'Failed to extract text from the uploaded PDF.',
          error: error.message,
        });
      }

      const rawText =
        spatialResult.spatiallyReconstructedText || '';

      if (!rawText.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'No extractable text found. Please upload a text-based PDF.',
        });
      }

      let extractedData;

      try {
        extractedData = await parseResumeWithAI(
          rawText,
          spatialResult.anchors
        );
      } catch (error) {
        console.error('[AI Parsing Error]', error.message);

        return res.status(502).json({
          success: false,
          message: 'The AI resume parser failed.',
          error: error.message,
        });
      }

      extractedData.skills = normalizeAndCategorizeSkills(
        extractedData.skills || [],
        extractedData.projects || []
      );

      return res.status(200).json({
        success: true,
        message: 'Resume parsed successfully.',
        spatialMetadata: spatialResult.spatialMetadata,
        anchors: spatialResult.anchors,
        rawText,
        extractedData,

        // Return the original filename to the frontend.
        resumeFileName: req.file.originalname,
      });
    } catch (error) {
      console.error('[Resume Parse Error]', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to process the resume.',
        error: error.message,
      });
    }
  }
);

// --------------------------------------------------
// ROUTE 2: CONFIRM PROFILE
// POST /api/profile/confirm-profile
// --------------------------------------------------

router.post('/confirm-profile', async (req, res) => {
  try {
    const savedProfile = await createStudentProfile(req.body);

    return res.status(201).json({
      success: true,
      message: 'New student resume profile saved successfully.',
      data: savedProfile,
      profile: savedProfile,
    });
  } catch (error) {
    console.error('[Confirm Profile Error]', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save student profile.',
    });
  }
});

// --------------------------------------------------
// ROUTE 3: CONFIRM PROFILE (ALTERNATIVE ENDPOINT)
// POST /api/profile/confirm
// --------------------------------------------------

router.post('/confirm', async (req, res) => {
  try {
    const savedProfile = await createStudentProfile(req.body);

    const boosterTasks = await ScoreBoosterTask.find({
      studentProfileId: savedProfile._id,
    });

    return res.status(201).json({
      success: true,
      message: 'New student resume profile saved successfully.',
      data: {
        profile: savedProfile,
        boosterTasks,
      },
    });
  } catch (error) {
    console.error('[Confirm Profile Error]', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save student profile.',
    });
  }
});

// --------------------------------------------------
// ROUTE 4: GET LATEST STUDENT PROFILE
// GET /api/profile/user/:userId
// --------------------------------------------------

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId.',
      });
    }

    // Return the latest profile for this student.
    const profile = await StudentProfile.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email role');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
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

// --------------------------------------------------
// ROUTE 5: STUDENT DASHBOARD — LIVE DATA
// GET /api/student/dashboard
// Protected: requires valid JWT in Authorization header or cookie
// --------------------------------------------------

router.get('/student/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch the most recent StudentProfile for the logged-in student
    const profile = await StudentProfile.findOne({ userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email role');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'No resume profile found. Please upload your resume first.',
      });
    }

    // ── Dynamic Skill Percentage Derivation ──────────────────────────────────
    // Compute each skill's verification strength based on project tech stack coverage
    // and individual confidenceScore from AI parser.
    const allProjectTech = new Set(
      (profile.projects || []).flatMap((p) =>
        (p.techStack || []).map((t) => t.toLowerCase().trim())
      )
    );

    const verifiedSkills = (profile.skills || []).map((skill) => {
      const inProject = allProjectTech.has(skill.name.toLowerCase().trim());
      // Base: confidenceScore (0-100). Boost +15 if skill appears in actual project tech stack.
      const rawPct = Math.min(100, (skill.confidenceScore || 50) + (inProject ? 15 : 0));
      return {
        name: skill.name,
        category: skill.category,
        verifiedStatus: skill.verifiedStatus,
        percentage: rawPct,
      };
    }).sort((a, b) => b.percentage - a.percentage);

    // ── Dynamic Score Booster Tasks ──────────────────────────────────────────
    // Generate tasks based on actual missing fields in DB records,
    // rather than relying only on stored ScoreBoosterTask documents.
    const dynamicBoosters = [];

    (profile.projects || []).forEach((project) => {
      if (!project.liveDemoUrl || !project.liveDemoUrl.startsWith('http')) {
        dynamicBoosters.push({
          id: `live-${project._id}`,
          points: 8,
          title: `Add live URL for "${project.title}"`,
          action: 'Add URL',
          category: 'deployment',
          placeholder: 'https://your-project.vercel.app',
        });
      }
      if (!project.githubUrl || !project.githubUrl.includes('github.com')) {
        dynamicBoosters.push({
          id: `github-${project._id}`,
          points: 12,
          title: `Link GitHub repo for "${project.title}"`,
          action: 'Link Repo',
          category: 'github',
          placeholder: 'https://github.com/your-username/project',
        });
      }
    });

    const unverifiedSkills = (profile.skills || []).filter(
      (s) => s.verifiedStatus === 'Pending' || s.verifiedStatus === 'Unverified'
    );
    if (unverifiedSkills.length > 0) {
      dynamicBoosters.push({
        id: 'verify-skills',
        points: 8,
        title: `Verify ${unverifiedSkills.slice(0, 3).map((s) => s.name).join(', ')} via GitHub`,
        action: 'Start Verification',
        category: 'evidence',
        placeholder: 'Commit code using these technologies',
      });
    }

    const certsWithoutProof = (profile.certifications || []).filter((c) => !c.proofUrl);
    if (certsWithoutProof.length > 0) {
      dynamicBoosters.push({
        id: `cert-${certsWithoutProof[0]._id}`,
        points: 5,
        title: `Add credential link for "${certsWithoutProof[0].title}"`,
        action: 'Add Link',
        category: 'certification',
        placeholder: 'https://www.credly.com/badges/...',
      });
    }

    // Also include stored (manually saved) booster tasks not already covered
    const storedTasks = await ScoreBoosterTask.find({
      studentProfileId: profile._id,
      status: 'Pending',
    }).sort({ potentialScoreGain: -1 }).limit(5);

    // ── College name resolution (hardcoded default as college module is not live yet) ──
    const collegeName = req.user?.college || 'VIT Vellore';

    return res.status(200).json({
      success: true,
      data: {
        // Identity
        name: profile.userId?.name || req.user.name || '',
        email: profile.userId?.email || req.user.email || '',
        avatarInitials: (profile.userId?.name || req.user.name || 'U').slice(0, 2).toUpperCase(),

        // Academic
        branch: profile.branch || '',
        graduationYear: profile.graduationYear || null,
        cgpa: profile.cgpa || null,
        college: collegeName,
        rollNumber: profile.rollNumber || '',
        githubUsername: profile.githubUsername || '',

        // Score
        verificationScore: profile.verificationScore || 0,
        scoreBreakdown: profile.scoreBreakdown || {},

        // Content
        skills: verifiedSkills,
        projects: (profile.projects || []).map((p) => ({
          _id: p._id,
          title: p.title,
          description: p.description,
          githubUrl: p.githubUrl,
          liveDemoUrl: p.liveDemoUrl,
          techStack: p.techStack,
          githubAudit: p.githubAudit,
          liveDemoAudit: p.liveDemoAudit,
        })),
        achievements: profile.achievements || [],
        certifications: profile.certifications || [],

        // Score Boosters (dynamic + stored, deduped by priority)
        scoreBoosterTasks: dynamicBoosters,
        storedBoosterTasks: storedTasks,

        // Meta
        profileId: profile._id,
        resumeFileName: profile.resumeFileName || '',
        lastUpdated: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Student Dashboard Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load student dashboard.',
      error: error.message,
    });
  }
});

module.exports = router;