/**
 * HTTP End-to-End API Test for TrustHire
 * Uses native fetch and FormData (Node 22+)
 */

const { PDFDocument } = require('pdf-lib');
const app = require('../server');

const TEST_PORT = 5055;
let serverInstance;

async function generateTestPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);

  // Header
  page.drawText('Devansh Verma', { x: 50, y: 760, size: 20 });
  page.drawText('Full Stack Engineer | devansh@example.com | https://github.com/devanshverma', { x: 50, y: 735, size: 10 });
  page.drawText('Roll: 21BCE045 | Branch: Computer Science and Engineering | CGPA: 8.8/10', { x: 50, y: 715, size: 10 });

  // Sidebar (Column 1)
  page.drawText('TECHNICAL SKILLS', { x: 50, y: 670, size: 13 });
  page.drawText('React.js, Node.js, Express.js', { x: 50, y: 645, size: 9.5 });
  page.drawText('MongoDB, PostgreSQL, Redis', { x: 50, y: 625, size: 9.5 });
  page.drawText('Docker, AWS, Git', { x: 50, y: 605, size: 9.5 });
  page.drawText('Python, TypeScript, C++', { x: 50, y: 585, size: 9.5 });

  // Main Body (Column 2)
  page.drawText('PROJECTS', { x: 270, y: 670, size: 13 });
  page.drawText('TrustHire Platform', { x: 270, y: 645, size: 11 });
  page.drawText('AI verification platform evaluating GitHub commits and uptime probes.', { x: 270, y: 630, size: 9 });
  page.drawText('GitHub: https://github.com/devanshverma/trusthire', { x: 270, y: 615, size: 9 });
  page.drawText('Live Demo: https://trusthire-demo.vercel.app', { x: 270, y: 600, size: 9 });
  page.drawText('Tech Stack: React.js, Node.js, MongoDB, Express.js', { x: 270, y: 585, size: 9 });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function runTests() {
  console.log('--- STARTING HTTP API TEST ---');
  
  // Start server on isolated port
  serverInstance = app.listen(TEST_PORT, () => {
    console.log(`Test server running on port ${TEST_PORT}`);
  });

  try {
    const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

    // Test 1: Health
    console.log('[HTTP Test 1] Testing GET /api/health...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    console.log(' Health status:', healthData.status);
    if (healthRes.status !== 200 || healthData.status !== 'healthy') {
      throw new Error('Health check failed');
    }

    // Test 2: Parse Resume with PDF
    console.log('\n[HTTP Test 2] Testing POST /api/profile/parse-resume...');
    const pdfBuffer = await generateTestPdf();
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('resume', blob, 'devansh_verma_resume.pdf');

    const parseRes = await fetch(`${baseUrl}/api/profile/parse-resume`, {
      method: 'POST',
      body: formData,
    });

    const parseData = await parseRes.json();

    console.log(' Parse response status:', parseRes.status);
    console.log(' Spatial Metadata:', parseData.spatialMetadata);
    console.log(' Extracted Candidate Name:', parseData.extractedData.fullName);
    console.log(' Extracted Roll:', parseData.extractedData.rollNumber);
    console.log(' Extracted CGPA:', parseData.extractedData.cgpa);
    console.log(` Extracted Skills count: ${parseData.extractedData.skills.length}`);
    console.log(` Extracted Projects count: ${parseData.extractedData.projects.length}`);

    if (parseRes.status !== 200) {
      throw new Error(`Parse resume failed: ${parseData.message}`);
    }
    if (!parseData.spatialMetadata.hasMultiColumn) {
      throw new Error('Multi-column was not detected in HTTP parse');
    }

    // Test 3: Confirm Profile
    console.log('\n[HTTP Test 3] Testing POST /api/profile/confirm-profile...');
    const confirmPayload = {
      userId: '66d0c7f29a34bc123456789a',
      rollNumber: parseData.extractedData.rollNumber,
      branch: parseData.extractedData.branch,
      cgpa: parseData.extractedData.cgpa,
      githubUsername: parseData.extractedData.githubUsername,
      skills: parseData.extractedData.skills,
      projects: parseData.extractedData.projects,
      certifications: parseData.extractedData.certifications,
      rawResumeText: parseData.rawText,
      resumeFileName: 'devansh_verma_resume.pdf',
    };

    const confirmRes = await fetch(`${baseUrl}/api/profile/confirm-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(confirmPayload),
    });

    const confirmData = await confirmRes.json();

    console.log(' Confirm response status:', confirmRes.status);
    console.log(' Verification Score (TrustScore):', confirmData.data.verificationScore);
    console.log(' Score Breakdown:', confirmData.data.scoreBreakdown);
    console.log(` Persisted Skills count: ${confirmData.data.skills.length}`);

    if (confirmRes.status !== 200) {
      throw new Error(`Confirm profile failed: ${confirmData.message}`);
    }
    if (confirmData.data.verificationScore <= 0) {
      throw new Error('Verification score not calculated');
    }

    console.log('\n================================================================');
    console.log(' ALL HTTP API ENDPOINT TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runTests().catch((err) => {
  console.error('\nHTTP TEST FAILED:', err.message);
  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(1);
});
