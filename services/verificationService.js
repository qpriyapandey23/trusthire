/**
 * Verification Engine Service
 * Computes dynamic verification scores (0-100), detailed category breakdowns,
 * and generates actionable Score Booster Tasks for students.
 */

function calculateInitialScore(profile) {
  let githubScore = 0;
  let liveScore = 0;
  let semanticScore = 0;
  let academicScore = 0;

  // 1. Academic baseline (max 15 points)
  if (profile.cgpa) {
    academicScore = Math.min(15, Math.round((profile.cgpa / 10) * 15));
  }

  // 2. Project GitHub links (max 35 points initially until audit completes)
  const projectsWithGithub = (profile.projects || []).filter(
    (p) => p.githubUrl && p.githubUrl.includes('github.com')
  );
  if (projectsWithGithub.length > 0) {
    githubScore += Math.min(30, projectsWithGithub.length * 15);
  }

  // 3. Live Deployment Links (max 25 points initially until ping test completes)
  const projectsWithLive = (profile.projects || []).filter(
    (p) => p.liveDemoUrl && p.liveDemoUrl.startsWith('http')
  );
  if (projectsWithLive.length > 0) {
    liveScore += Math.min(20, projectsWithLive.length * 10);
  }

  // 4. Skills & Certifications cross-match (max 25 points)
  const skillsCount = (profile.skills || []).length;
  if (skillsCount > 0) {
    semanticScore += Math.min(15, skillsCount * 2);
  }
  const certsCount = (profile.certifications || []).length;
  if (certsCount > 0) {
    semanticScore += Math.min(10, certsCount * 5);
  }

  const totalScore = Math.min(100, Math.round(academicScore + githubScore + liveScore + semanticScore));

  return {
    verificationScore: totalScore,
    scoreBreakdown: {
      githubOriginalityScore: githubScore,
      liveDeploymentScore: liveScore,
      semanticClaimScore: semanticScore,
      cgpaAcademicScore: academicScore,
      lastEvaluatedAt: new Date(),
    },
  };
}

/**
 * Generates initial actionable Score Booster Tasks tailored to the candidate's profile
 */
function generateInitialBoosterTasks(studentProfileId, profile) {
  const tasks = [];

  // Check if any projects lack GitHub URLs
  const missingGithubProjects = (profile.projects || []).filter(
    (p) => !p.githubUrl || !p.githubUrl.includes('github.com')
  );
  if (missingGithubProjects.length > 0) {
    tasks.push({
      studentProfileId,
      title: `Link GitHub Repository for "${missingGithubProjects[0].title}"`,
      description:
        'Provide a public GitHub repository link so TrustHire can verify your commit velocity, authorship percentage, and code originality.',
      category: 'github',
      potentialScoreGain: 12,
      status: 'Pending',
      verificationCheckType: 'GITHUB_REPO',
    });
  }

  // Check if any projects lack Live Demo URLs
  const missingLiveProjects = (profile.projects || []).filter(
    (p) => !p.liveDemoUrl || !p.liveDemoUrl.startsWith('http')
  );
  if (missingLiveProjects.length > 0) {
    tasks.push({
      studentProfileId,
      title: `Deploy Live Demo for "${missingLiveProjects[0].title}"`,
      description:
        'Deploy your project to Vercel, Netlify, Render, or AWS and link the live URL. An automated 200 OK ping audit will boost your score.',
      category: 'deployment',
      potentialScoreGain: 10,
      status: 'Pending',
      verificationCheckType: 'LIVE_PING',
    });
  }

  // Check if skills have unverified claims
  const unverifiedSkills = (profile.skills || []).filter(
    (s) => s.verifiedStatus === 'Pending' || s.verifiedStatus === 'Unverified'
  );
  if (unverifiedSkills.length > 0) {
    tasks.push({
      studentProfileId,
      title: `Verify Skills: ${unverifiedSkills.slice(0, 3).map((s) => s.name).join(', ')}`,
      description:
        'Commit code utilizing these technologies in your connected GitHub repositories to trigger automatic semantic verification.',
      category: 'evidence',
      potentialScoreGain: 8,
      status: 'Pending',
      verificationCheckType: 'CODE_ORIGINALITY',
    });
  }

  // Check certifications proof
  const certsWithoutProof = (profile.certifications || []).filter((c) => !c.proofUrl);
  if (certsWithoutProof.length > 0) {
    tasks.push({
      studentProfileId,
      title: `Upload Credential Link for "${certsWithoutProof[0].title}"`,
      description: 'Add a verifiable badge URL or credential link from Credly, AWS, or Coursera.',
      category: 'certification',
      potentialScoreGain: 5,
      status: 'Pending',
      verificationCheckType: 'CERTIFICATE_PROOF',
    });
  }

  return tasks;
}

module.exports = {
  calculateInitialScore,
  generateInitialBoosterTasks,
};
