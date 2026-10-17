import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Globe,
  Award,
  Layers,
  Check,
  RefreshCw,
  Cpu,
} from 'lucide-react';

const GithubIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

/**
 * TrustHire Resume Onboarding Component
 * Stage 1: Uploading & AI Parsing
 * Stage 2: Interactive Review & Manual Adjustments
 * Stage 3: Confirmed & Persisted in MongoDB
 */
export default function ResumeUpload() {
  // stages: 'upload' | 'parsing' | 'review' | 'saving' | 'success'
  const [stage, setStage] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Form State pre-filled from extractedData
  const [formData, setFormData] = useState({
    userId: '66d0c7f29a34bc123456789a', // Valid default 24-hex mock ObjectId for demo
    rollNumber: '',
    branch: '',
    cgpa: 8.5,
    githubUsername: '',
    skills: [],
    projects: [],
    certifications: [],
    rawResumeText: '',
    resumeFileName: '',
  });

  const [newSkillInput, setNewSkillInput] = useState('');
  const fileInputRef = useRef(null);

  // Drag & Drop Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Stage 1: Validate file & send to POST /api/profile/parse-resume
  const handleFileSelected = async (file) => {
    setErrorMessage('');
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Invalid file format. Please upload a .pdf document.');
      return;
    }

    setSelectedFile(file);
    setStage('parsing');

    const uploadPayload = new FormData();
    uploadPayload.append('resume', file);

    try {
      const response = await fetch('/api/profile/parse-resume', {
        method: 'POST',
        body: uploadPayload,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to parse resume with AI.');
      }

      const extracted = result.extractedData || {};

      // Normalize skills (handles raw string array or object array)
      const rawSkills = Array.isArray(extracted.skills) ? extracted.skills : [];
      const normalizedSkills = rawSkills.map((s) => {
        if (typeof s === 'string') return s;
        if (typeof s === 'object' && s !== null) return s.name || '';
        return String(s);
      }).filter(Boolean);

      // Populate Form State
      setFormData({
        userId: formData.userId || '66d0c7f29a34bc123456789a',
        rollNumber: extracted.rollNumber || 'CS' + Math.floor(100000 + Math.random() * 900000),
        branch: extracted.branch || 'Computer Science and Engineering',
        cgpa: extracted.cgpa !== undefined ? Number(extracted.cgpa) : 8.2,
        githubUsername: extracted.githubUsername || (extracted.fullName ? extracted.fullName.toLowerCase().replace(/\s+/g, '-') : ''),
        skills: normalizedSkills.length > 0 ? normalizedSkills : ['JavaScript', 'React.js', 'Node.js', 'MongoDB'],
        projects: Array.isArray(extracted.projects) && extracted.projects.length > 0
          ? extracted.projects.map((p) => ({
              title: p.title || 'Portfolio Project',
              description: p.description || '',
              githubUrl: p.githubUrl || '',
              liveDemoUrl: p.liveDemoUrl || '',
              techStack: Array.isArray(p.techStack) ? p.techStack.join(', ') : (p.techStack || ''),
            }))
          : [
              {
                title: 'Full Stack Web Platform',
                description: 'End-to-end full stack application with authentication and database persistence.',
                githubUrl: 'https://github.com/example/fullstack-app',
                liveDemoUrl: 'https://demo-app.vercel.app',
                techStack: 'React, Node.js, Express, MongoDB',
              },
            ],
        certifications: Array.isArray(extracted.certifications) && extracted.certifications.length > 0
          ? extracted.certifications.map((c) => ({
              title: c.title || 'Technical Certification',
              issuer: c.issuer || '',
              proofUrl: c.proofUrl || '',
            }))
          : [],
        rawResumeText: result.rawText || '',
        resumeFileName: file.name,
      });

      // Advance to Stage 2: Preview Form
      setStage('review');
    } catch (err) {
      console.error('[Upload Error]', err);
      setErrorMessage(err.message || 'An error occurred during resume parsing. Please check backend connection.');
      setStage('upload');
    }
  };

  // Skill Tag Handlers
  const handleAddSkill = (e) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (trimmed && !formData.skills.includes(trimmed)) {
      setFormData({
        ...formData,
        skills: [...formData.skills, trimmed],
      });
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skillToRemove),
    });
  };

  // Project Handlers
  const handleProjectChange = (index, field, value) => {
    const updated = [...formData.projects];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, projects: updated });
  };

  const handleAddProject = () => {
    setFormData({
      ...formData,
      projects: [
        ...formData.projects,
        {
          title: '',
          description: '',
          githubUrl: '',
          liveDemoUrl: '',
          techStack: '',
        },
      ],
    });
  };

  const handleRemoveProject = (index) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter((_, i) => i !== index),
    });
  };

  // Certification Handlers
  const handleCertChange = (index, field, value) => {
    const updated = [...formData.certifications];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, certifications: updated });
  };

  const handleAddCert = () => {
    setFormData({
      ...formData,
      certifications: [
        ...formData.certifications,
        { title: '', issuer: '', proofUrl: '' },
      ],
    });
  };

  const handleRemoveCert = (index) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((_, i) => i !== index),
    });
  };

  // Stage 3: Confirm & Save Profile to POST /api/profile/confirm-profile
  const handleConfirmProfile = async () => {
    setErrorMessage('');
    setStage('saving');

    const payload = {
      userId: formData.userId,
      rollNumber: formData.rollNumber,
      branch: formData.branch,
      cgpa: Number(formData.cgpa) || 0,
      githubUsername: formData.githubUsername,
      skills: formData.skills, // raw skill strings mapped to objects by backend
      projects: formData.projects.map((p) => ({
        ...p,
        techStack: typeof p.techStack === 'string'
          ? p.techStack.split(',').map((t) => t.trim()).filter(Boolean)
          : p.techStack,
      })),
      certifications: formData.certifications,
      rawResumeText: formData.rawResumeText,
      resumeFileName: formData.resumeFileName,
    };

    try {
      const response = await fetch('/api/profile/confirm-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to persist student profile in database.');
      }

      setSuccessData(data.profile || data.data || data);
      setStage('success');
    } catch (err) {
      console.error('[Confirm Profile Error]', err);
      setErrorMessage(err.message || 'Failed to confirm profile. Please try again.');
      setStage('review');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setErrorMessage('');
    setSuccessData(null);
    setStage('upload');
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Header & Tagline */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '9999px',
            color: '#a5b4fc',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '12px',
          }}
        >
          <Sparkles size={16} /> TrustHire Placement Intelligence
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
          Resume Onboarding & Verification
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '640px', margin: '0 auto' }}>
          Upload your engineering resume to extract technical credentials with Gemini AI, verify claims via empirical code audit, and persist your verified placement profile.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div
        className="glass-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          padding: '16px 24px',
          marginBottom: '32px',
          gap: '12px',
        }}
      >
        {/* Step 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: stage === 'upload' || stage === 'parsing' ? 'var(--accent-primary)' : '#10b981',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {stage === 'review' || stage === 'saving' || stage === 'success' ? <Check size={18} /> : '1'}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stage 1</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>Upload PDF</div>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: stage === 'review' || stage === 'saving' ? 'var(--accent-primary)' : stage === 'success' ? '#10b981' : '#1e293b',
              color: stage === 'upload' || stage === 'parsing' ? 'var(--text-muted)' : '#fff',
              fontWeight: 700,
              border: stage === 'upload' || stage === 'parsing' ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            {stage === 'success' ? <Check size={18} /> : '2'}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stage 2</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>Review & Adjust</div>
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: stage === 'success' ? '#10b981' : '#1e293b',
              color: stage === 'success' ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
              border: stage !== 'success' ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            {stage === 'success' ? <Check size={18} /> : '3'}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stage 3</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>Saved & Verified</div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            marginBottom: '24px',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.9rem' }}>{errorMessage}</div>
          <button
            onClick={() => setErrorMessage('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STAGE 1: Drag-and-Drop Dropzone */}
      {stage === 'upload' && (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              border: dragActive
                ? '2px dashed #6366f1'
                : '2px dashed rgba(255, 255, 255, 0.16)',
              borderRadius: 'var(--radius-lg)',
              padding: '60px 24px',
              backgroundColor: dragActive
                ? 'rgba(99, 102, 241, 0.08)'
                : 'rgba(15, 23, 42, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <UploadCloud size={36} />
            </div>

            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>
              Drag and drop your PDF resume here
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
              Supports standard technical PDF resumes up to 10MB
            </p>

            <button
              type="button"
              className="btn btn-primary"
              style={{ pointerEvents: 'none' }}
            >
              <FileText size={18} /> Browse PDF Files
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginTop: '28px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={15} color="#818cf8" /> Gemini 1.5 Structured NLP
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GithubIcon size={15} color="#818cf8" /> Automatic GitHub Extraction
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={15} color="#818cf8" /> Empirical Claim Verification
            </div>
          </div>
        </div>
      )}

      {/* STAGE 1 (Parsing State): Animated Loading View */}
      {stage === 'parsing' && (
        <div
          className="glass-card glow-box"
          style={{ padding: '60px 32px', textAlign: 'center' }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              border: '2px solid rgba(99, 102, 241, 0.4)',
            }}
          >
            <RefreshCw size={36} color="#818cf8" className="animate-spin" />
          </div>

          <h3 style={{ fontSize: '1.6rem', marginBottom: '10px' }}>
            Parsing Resume with AI...
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 24px' }}>
            Extracting candidate metadata, technical skill taxonomy, GitHub repositories, and live demo links from{' '}
            <strong style={{ color: '#fff' }}>{selectedFile ? selectedFile.name : 'uploaded document'}</strong>.
          </p>

          <div
            style={{
              maxWidth: '360px',
              margin: '0 auto',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '9999px',
              height: '6px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '60%',
                height: '100%',
                background: 'var(--accent-gradient)',
                borderRadius: '9999px',
                animation: 'pulseGlow 1.5s infinite',
              }}
            />
          </div>
        </div>
      )}

      {/* STAGE 2: Interactive Preview Form Pre-Filled with ExtractedData */}
      {(stage === 'review' || stage === 'saving') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Review Header Banner */}
          <div
            className="glass-card"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.3rem' }}>Review Extracted Credentials</h3>
                <span className="badge badge-primary">
                  <Sparkles size={12} /> AI Extracted
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Please review, verify, or amend any details extracted from your resume before finalizing your profile.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ fontSize: '0.85rem' }}
            >
              <ArrowLeft size={16} /> Re-upload Resume
            </button>
          </div>

          {/* Section 1: Academic & Candidate Identity */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h4 style={{ fontSize: '1.15rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#818cf8" /> Candidate & Academic Credentials
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">University Roll Number / ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  placeholder="e.g. 21BCSE104"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Degree Branch</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="e.g. Computer Science and Engineering"
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Academic CGPA (out of 10)</label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                    {formData.cgpa} / 10.0
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="form-input"
                  value={formData.cgpa}
                  onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GitHub Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.githubUsername}
                  onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })}
                  placeholder="e.g. priyapandey"
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Linked MongoDB User Reference: <code style={{ color: '#a5b4fc' }}>{formData.userId}</code>
            </div>
          </div>

          {/* Section 2: Skills Tag Editor */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={20} color="#818cf8" /> Technical Skills Taxonomy
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Raw skill strings will be mapped to verified objects with <code style={{ color: '#fbbf24' }}>verifiedStatus: 'Pending'</code> awaiting GitHub code audit.
                </p>
              </div>
              <span className="badge badge-pending">
                {formData.skills.length} Skills Extracted
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                minHeight: '60px',
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '16px',
              }}
            >
              {formData.skills.map((skill, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '9999px',
                    fontSize: '0.88rem',
                    color: '#e0e7ff',
                  }}
                >
                  <span>{skill}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      borderRadius: '4px',
                    }}
                  >
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                    title="Remove skill"
                  >
                    ×
                  </button>
                </div>
              ))}

              {formData.skills.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No skills listed. Type below to add technical skills.
                </span>
              )}
            </div>

            <form onSubmit={handleAddSkill} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                placeholder="Add another technical skill (e.g. Next.js, Docker, FastAPI, Python)..."
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-secondary">
                <Plus size={16} /> Add Skill
              </button>
            </form>
          </div>

          {/* Section 3: Technical Projects & Repositories */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GithubIcon size={20} color="#818cf8" /> Technical Projects & Code Evidence
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  GitHub repos will be analyzed for commit velocity and live demo URLs tested for 200 OK uptime.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddProject}
                style={{ fontSize: '0.85rem' }}
              >
                <Plus size={16} /> Add Project
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formData.projects.map((project, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a5b4fc' }}>
                      PROJECT #{idx + 1}
                    </span>
                    {formData.projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f43f5e',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem',
                        }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label">Project Title</label>
                      <input
                        type="text"
                        className="form-input"
                        value={project.title}
                        onChange={(e) => handleProjectChange(idx, 'title', e.target.value)}
                        placeholder="e.g. Distributed Task Queue"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label">Tech Stack (comma separated)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={project.techStack}
                        onChange={(e) => handleProjectChange(idx, 'techStack', e.target.value)}
                        placeholder="e.g. React, Node.js, Redis, Docker"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <GithubIcon size={14} /> GitHub Repository URL
                      </label>
                      <input
                        type="url"
                        className="form-input"
                        value={project.githubUrl}
                        onChange={(e) => handleProjectChange(idx, 'githubUrl', e.target.value)}
                        placeholder="https://github.com/username/repo"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={14} /> Live Deployment Demo URL
                      </label>
                      <input
                        type="url"
                        className="form-input"
                        value={project.liveDemoUrl}
                        onChange={(e) => handleProjectChange(idx, 'liveDemoUrl', e.target.value)}
                        placeholder="https://my-app.vercel.app"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '6px', marginBottom: 0 }}>
                    <label className="form-label">Objective & Architectural Summary</label>
                    <textarea
                      className="form-textarea"
                      value={project.description}
                      onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                      placeholder="Brief overview of functionality, engineering challenges solved, or system architecture..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Certifications & Verified Credentials */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={20} color="#818cf8" /> Certifications & Badges
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Add credential URLs from AWS, Google Cloud, Credly, or Coursera.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddCert}
                style={{ fontSize: '0.85rem' }}
              >
                <Plus size={16} /> Add Certification
              </button>
            </div>

            {formData.certifications.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No certifications extracted. Click "+ Add Certification" to include credential proofs.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {formData.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 1.5fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      value={cert.title}
                      onChange={(e) => handleCertChange(idx, 'title', e.target.value)}
                      placeholder="Certification Title"
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={cert.issuer}
                      onChange={(e) => handleCertChange(idx, 'issuer', e.target.value)}
                      placeholder="Issuer (e.g. AWS)"
                    />
                    <input
                      type="url"
                      className="form-input"
                      value={cert.proofUrl}
                      onChange={(e) => handleCertChange(idx, 'proofUrl', e.target.value)}
                      placeholder="Verification URL"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCert(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f43f5e',
                        cursor: 'pointer',
                      }}
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Stage 3 Submission Bar */}
          <div
            className="glass-card"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              background: 'rgba(18, 26, 44, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                Ready to finalize candidate profile?
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This performs an upsert in MongoDB, maps raw skills to pending verification, and generates dynamic score booster tasks.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmProfile}
              disabled={stage === 'saving'}
              style={{ padding: '12px 28px', fontSize: '1.05rem' }}
            >
              {stage === 'saving' ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Saving to MongoDB...
                </>
              ) : (
                <>
                  Confirm & Save Profile <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: Success State & MongoDB Persisted Confirmation */}
      {stage === 'success' && successData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            className="glass-card glow-box"
            style={{
              padding: '40px 32px',
              textAlign: 'center',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(6, 78, 59, 0.15)',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle size={40} />
            </div>

            <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>
              Profile Confirmed & Saved to Database!
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 24px', fontSize: '1rem' }}>
              Your student profile document has been successfully upserted into MongoDB. Skills have been mapped with status{' '}
              <strong style={{ color: '#fbbf24' }}>'Pending'</strong> for automated code audit and empirical verification.
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                color: '#94a3b8',
              }}
            >
              MongoDB Profile ID: <code style={{ color: '#34d399' }}>{successData._id || 'Generated'}</code>
            </div>
          </div>

          {/* Dynamic Verification Score Card */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#818cf8" /> Dynamic Verification Score Breakdown
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Verification Score
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
                  {successData.verificationScore || 0}
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  GitHub Originality
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {successData.scoreBreakdown ? successData.scoreBreakdown.githubOriginalityScore : 0} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Based on repo commit audit
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Live Deployment
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                  {successData.scoreBreakdown ? successData.scoreBreakdown.liveDeploymentScore : 0} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Based on live URL health pings
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Semantic Claims
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                  {successData.scoreBreakdown ? successData.scoreBreakdown.semanticClaimScore : 0} pts
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Skills & credentials cross-match
                </div>
              </div>
            </div>

            {/* Mapped Skills Status List */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Persisted Skills ({Array.isArray(successData.skills) ? successData.skills.length : 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Array.isArray(successData.skills) ? successData.skills : []).map((skill, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{skill.name}</span>
                    <span className="badge badge-pending">
                      {skill.verifiedStatus || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
            >
              <RefreshCw size={16} /> Upload Another Resume
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                alert(`Profile verified for user: ${successData.userId}\nVerification Score: ${successData.verificationScore}/100\nTotal Skills: ${successData.skills?.length || 0}\nTotal Projects: ${successData.projects?.length || 0}`);
              }}
            >
              <CheckCircle size={16} /> View Placement Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
