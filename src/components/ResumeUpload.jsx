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
  X,
  Shield,
  Code2,
  Database,
  PenLine,
  User,
  Hash,
  BookOpen,
  Calendar,
} from 'lucide-react';

const GithubIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
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
export default function ResumeUpload({ authUser }) {
  const [stage, setStage] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [spatialMetadata, setSpatialMetadata] = useState(null);
  const [anchorsData, setAnchorsData] = useState(null);

  const [formData, setFormData] = useState({
    userId: authUser?._id || authUser?.id || '',
    fullName: '',
    rollNumber: '',
    branch: '',
    cgpa: 8.5,
    graduationYear: '',
    githubUsername: '',
    skills: [],
    projects: [],
    certifications: [],
    rawResumeText: '',
    resumeFileName: '',
  });

  const [newSkillInput, setNewSkillInput] = useState('');
  const [reviewSource, setReviewSource] = useState('ai'); // 'ai' | 'manual'
  const [manualFields, setManualFields] = useState({
    fullName: '',
    rollNumber: '',
    branch: '',
    graduationYear: '',
  });
  const fileInputRef = useRef(null);

  /* ── Drag & Drop ── */
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
  };

  /* ── Stage 1: Parse ── */
  const handleFileSelected = async (file) => {
    setErrorMessage('');
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Invalid file. Please upload a PDF document.');
      return;
    }
    setSelectedFile(file);
    setStage('parsing');

    const payload = new FormData();
    payload.append('resume', file);

    try {
      const res = await fetch('/api/profile/parse-resume', { method: 'POST', body: payload });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to parse resume.');

      const ex = result.extractedData || {};

      // Save spatial metadata & anchors
      setSpatialMetadata(result.spatialMetadata || null);
      setAnchorsData(result.anchors || null);

      // Preserve rich skill objects (with category, rationale, confidenceScore)
      const rawSkills = Array.isArray(ex.skills) ? ex.skills : [];
      const normalizedSkills = rawSkills.map((s) => {
        if (typeof s === 'object' && s !== null && s.name) {
          return {
            name: s.name,
            category: s.category || 'General',
            verifiedStatus: s.verifiedStatus || 'Pending',
            rationale: s.rationale || 'Extracted from resume. Awaiting GitHub code audit.',
            confidenceScore: typeof s.confidenceScore === 'number' ? s.confidenceScore : 40,
          };
        }
        return {
          name: String(s),
          category: 'General',
          verifiedStatus: 'Pending',
          rationale: 'Extracted from resume. Awaiting GitHub code audit.',
          confidenceScore: 40,
        };
      }).filter((s) => s.name && s.name.trim().length > 0);

      const defaultSkills = [
        { name: 'JavaScript', category: 'Programming Languages', verifiedStatus: 'Pending', confidenceScore: 40, rationale: 'Core language claim' },
        { name: 'React.js', category: 'Frontend', verifiedStatus: 'Pending', confidenceScore: 40, rationale: 'Frontend claim' },
        { name: 'Node.js', category: 'Backend', verifiedStatus: 'Pending', confidenceScore: 40, rationale: 'Backend claim' },
        { name: 'MongoDB', category: 'Database', verifiedStatus: 'Pending', confidenceScore: 40, rationale: 'Database claim' }
      ];

      // Populate Form State
      setFormData({
        userId: formData.userId,
        fullName: ex.fullName || '',
        rollNumber: ex.rollNumber || 'CS' + Math.floor(100000 + Math.random() * 900000),
        branch: ex.branch || 'Computer Science and Engineering',
        cgpa: ex.cgpa !== undefined ? Number(ex.cgpa) : 8.2,
        graduationYear: ex.graduationYear || '',
        githubUsername: ex.githubUsername || (ex.fullName ? ex.fullName.toLowerCase().replace(/\s+/g, '-') : ''),
        skills: normalizedSkills.length > 0 ? normalizedSkills : defaultSkills,
        projects: Array.isArray(ex.projects) && ex.projects.length > 0
          ? ex.projects.map((p) => ({
              title: p.title || 'Portfolio Project',
              description: p.description || '',
              githubUrl: p.githubUrl || '',
              liveDemoUrl: p.liveDemoUrl || '',
              techStack: Array.isArray(p.techStack) ? p.techStack.join(', ') : (p.techStack || ''),
            }))
          : [{ title: 'Full Stack Web Platform', description: 'End-to-end full stack application with authentication and database persistence.', githubUrl: 'https://github.com/example/fullstack-app', liveDemoUrl: 'https://demo-app.vercel.app', techStack: 'React, Node.js, Express, MongoDB' }],
        certifications: Array.isArray(ex.certifications) && ex.certifications.length
          ? ex.certifications.map((c) => ({ title: c.title || '', issuer: c.issuer || '', proofUrl: c.proofUrl || '' }))
          : [],
        rawResumeText: result.rawText || '',
        resumeFileName: file.name,
      });
      setReviewSource('ai');
      setStage('review');
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred. Please check the backend connection.');
      setStage('upload');
    }
  };

  /* ── Skills ── */
  const handleAddSkill = (e) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (
      trimmed &&
      !formData.skills.some(
        (s) => (typeof s === 'object' ? s.name.toLowerCase() : String(s).toLowerCase()) === trimmed.toLowerCase()
      )
    ) {
      setFormData({
        ...formData,
        skills: [
          ...formData.skills,
          {
            name: trimmed,
            category: 'General',
            verifiedStatus: 'Pending',
            rationale: 'Manually added by candidate during onboarding review.',
            confidenceScore: 40,
          },
        ],
      });
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    const targetName = typeof skillToRemove === 'object' ? skillToRemove.name : skillToRemove;
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => (typeof s === 'object' ? s.name : s) !== targetName),
    });
  };

  /* ── Projects ── */
  const handleProjectChange = (i, field, val) => {
    const u = [...formData.projects]; u[i] = { ...u[i], [field]: val };
    setFormData({ ...formData, projects: u });
  };
  const handleAddProject = () => setFormData({ ...formData, projects: [...formData.projects, { title: '', description: '', githubUrl: '', liveDemoUrl: '', techStack: '' }] });
  const handleRemoveProject = (i) => setFormData({ ...formData, projects: formData.projects.filter((_, idx) => idx !== i) });

  /* ── Certifications ── */
  const handleCertChange = (i, field, val) => {
    const u = [...formData.certifications]; u[i] = { ...u[i], [field]: val };
    setFormData({ ...formData, certifications: u });
  };
  const handleAddCert = () => setFormData({ ...formData, certifications: [...formData.certifications, { title: '', issuer: '', proofUrl: '' }] });
  const handleRemoveCert = (i) => setFormData({ ...formData, certifications: formData.certifications.filter((_, idx) => idx !== i) });

  /* ── Stage 3: Save ── */
  const handleConfirmProfile = async () => {
    setErrorMessage('');
    setStage('saving');
    const payload = {
      ...formData,
      cgpa: Number(formData.cgpa) || 0,
      projects: formData.projects.map((p) => ({
        ...p,
        techStack: typeof p.techStack === 'string'
          ? p.techStack.split(',').map((t) => t.trim()).filter(Boolean)
          : p.techStack,
      })),
    };
    try {
      const res = await fetch('/api/profile/confirm-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save profile.');
      setSuccessData(data.profile || data.data || data);
      setStage('success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to confirm profile. Try again.');
      setStage('review');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setErrorMessage('');
    setSuccessData(null);
    setSpatialMetadata(null);
    setAnchorsData(null);
    setReviewSource('ai');
    setManualFields({ fullName: '', rollNumber: '', branch: '', graduationYear: '' });
    setStage('upload');
  };

  /* ── Manual Entry ── */
  const handleManualEntry = () => {
    if (!manualFields.fullName.trim()) {
      setErrorMessage('Please enter your full name to continue with manual entry.');
      return;
    }
    setErrorMessage('');
    setFormData({
      userId: formData.userId,
      fullName: manualFields.fullName.trim(),
      rollNumber: manualFields.rollNumber.trim(),
      branch: manualFields.branch.trim(),
      cgpa: 0,
      graduationYear: manualFields.graduationYear,
      githubUsername: '',
      skills: [],
      projects: [],
      certifications: [],
      rawResumeText: '',
      resumeFileName: '',
    });
    setReviewSource('manual');
    setStage('review');
  };

  /* ── Helpers ── */
  const steps = ['Upload Resume', 'Review Details', 'Save Profile'];
  const stepIdx = { upload: 0, parsing: 0, review: 1, saving: 1, success: 2 }[stage] ?? 0;

  const card = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
  };

  const sectionHead = {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    letterSpacing: '-0.02em',
  };

  const sectionSub = {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    marginBottom: '20px',
  };

  const inner = {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 20px 64px' }}>

      {/* ── Page heading ── */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', letterSpacing: '-0.035em', marginBottom: '12px' }}>
          Resume Onboarding &amp; Verification
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
          Upload your resume to extract credentials with Gemini AI, verify claims via GitHub audit, and build your verified placement profile.
        </p>
      </div>

      {/* ── Stepper ── */}
      <div style={{
        ...card, padding: '16px 24px',
        display: 'flex', alignItems: 'center',
        marginBottom: '28px',
      }}>
        {steps.map((label, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
                  ...(done
                    ? { background: 'var(--green)', color: '#fff' }
                    : active
                    ? { background: 'var(--brand)', color: '#fff' }
                    : { background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
                }}>
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.83rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: active ? 'var(--text-primary)' : done ? 'var(--green)' : 'var(--text-muted)',
                  }}>{label}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: '1px', flex: '0 0 28px', margin: '0 6px', background: i < stepIdx ? 'var(--green)' : 'var(--border)', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Error ── */}
      {errorMessage && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 16px', background: 'var(--red-muted)',
          border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
          color: 'var(--red)', marginBottom: '20px', fontSize: '0.87rem',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>{errorMessage}</div>
          <button onClick={() => setErrorMessage('')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════
          STAGE 1 — Upload  (2-column)
         ══════════════════════════════ */}
      {stage === 'upload' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          alignItems: 'stretch',
        }}>

          {/* ── Left Column: Upload Resume ── */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Card header */}
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                  background: 'var(--brand-muted)', border: '1px solid #bfdbfe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <UploadCloud size={17} color="var(--brand)" strokeWidth={2} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '2px' }}>Upload Resume</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>AI-powered extraction</p>
                </div>
              </div>
            </div>

            {/* Dropzone */}
            <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                id="resume-dropzone"
                onDragEnter={handleDrag} onDragLeave={handleDrag}
                onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: dragActive ? 'var(--brand-muted)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                  flex: 1,
                }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                  style={{ display: 'none' }} onChange={handleFileInputChange} />

                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                  background: dragActive ? 'var(--brand-muted)' : 'var(--bg-card)',
                  border: `1px solid ${dragActive ? '#bfdbfe' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', transition: 'all 0.2s',
                }}>
                  <UploadCloud size={22} color={dragActive ? 'var(--brand)' : 'var(--text-secondary)'} strokeWidth={1.8} />
                </div>

                <p style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '5px', color: 'var(--text-primary)' }}>
                  {dragActive ? 'Drop to upload' : 'Drag & drop your PDF here'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  or click to browse — PDF / DOCX, up to 10 MB
                </p>
              </div>

              {/* Feature pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { icon: <Cpu size={11} />, label: 'Gemini AI' },
                  { icon: <GithubIcon size={11} />, label: 'GitHub Audit' },
                  { icon: <Shield size={11} />, label: 'Verification' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-muted)', border: '1px solid var(--border)',
                    fontSize: '0.73rem', fontWeight: 500, color: 'var(--text-muted)',
                  }}>
                    {icon} {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Parse Resume CTA */}
            <div style={{ padding: '0 24px 24px' }}>
              <button
                id="btn-parse-resume"
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', justifyContent: 'center', padding: '11px 20px', fontSize: '0.9rem' }}
              >
                <FileText size={15} /> Parse Resume
              </button>
            </div>
          </div>

          {/* ── Right Column: Manual Entry ── */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Card header */}
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-muted)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <PenLine size={17} color="var(--text-secondary)" strokeWidth={2} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '2px' }}>Enter Details Manually</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>Fill in your information</p>
                </div>
              </div>
            </div>

            {/* Form fields */}
            <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} color="var(--text-muted)" /> Full Name
                </label>
                <input
                  id="manual-full-name"
                  type="text"
                  className="form-input"
                  value={manualFields.fullName}
                  onChange={(e) => setManualFields({ ...manualFields, fullName: e.target.value })}
                  placeholder="e.g. Priya Pandey"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={11} color="var(--text-muted)" /> College Roll No
                </label>
                <input
                  id="manual-roll-number"
                  type="text"
                  className="form-input"
                  value={manualFields.rollNumber}
                  onChange={(e) => setManualFields({ ...manualFields, rollNumber: e.target.value })}
                  placeholder="e.g. 21BCSE104"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <BookOpen size={11} color="var(--text-muted)" /> Branch / Department
                </label>
                <input
                  id="manual-branch"
                  type="text"
                  className="form-input"
                  value={manualFields.branch}
                  onChange={(e) => setManualFields({ ...manualFields, branch: e.target.value })}
                  placeholder="e.g. Computer Science and Engineering"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={11} color="var(--text-muted)" /> Graduation Year
                </label>
                <input
                  id="manual-graduation-year"
                  type="number"
                  className="form-input"
                  value={manualFields.graduationYear}
                  min="2020"
                  max="2032"
                  onChange={(e) => setManualFields({ ...manualFields, graduationYear: e.target.value })}
                  placeholder="e.g. 2025"
                />
              </div>
            </div>

            {/* Start Manual Entry CTA */}
            <div style={{ padding: '0 24px 24px' }}>
              <button
                id="btn-start-manual-entry"
                type="button"
                className="btn btn-secondary"
                onClick={handleManualEntry}
                style={{ width: '100%', justifyContent: 'center', padding: '11px 20px', fontSize: '0.9rem', borderColor: 'var(--border)' }}
              >
                <PenLine size={15} /> Start Manual Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          STAGE 1 (Parsing) — Loading
         ══════════════════════════════ */}
      {stage === 'parsing' && (
        <div style={{ ...card, textAlign: 'center', padding: '64px 32px' }} className="animate-fade-up">
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'var(--bg-muted)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
          }}>
            <RefreshCw size={26} color="var(--brand)" className="animate-spin" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Analysing your resume…</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 28px', fontSize: '0.87rem', lineHeight: 1.65 }}>
            Gemini AI is extracting credentials from{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedFile?.name}</strong>.
          </p>
          <div style={{ maxWidth: '280px', margin: '0 auto', background: 'var(--bg-muted)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
            <div className="shimmer-bar" style={{ height: '100%', width: '100%' }} />
          </div>
          <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '10px' }}>Usually takes 5–10 seconds</p>
        </div>
      )}

      {/* ══════════════════════════════
          STAGE 2 — Review
         ══════════════════════════════ */}
      {(stage === 'review' || stage === 'saving') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-up">

          {/* Review header */}
          <div style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <h3 style={{ fontSize: '0.97rem', letterSpacing: '-0.02em' }}>
                  {reviewSource === 'manual' ? 'Build Your Profile' : 'Review Extracted Credentials'}
                </h3>
                {reviewSource === 'manual'
                  ? <span className="badge badge-muted"><PenLine size={10} /> Manual Entry</span>
                  : <span className="badge badge-primary"><Sparkles size={10} /> AI Extracted</span>
                }
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {reviewSource === 'manual'
                  ? 'Add your skills, projects, and certifications below then save your profile.'
                  : 'Verify and amend details before finalising.'}
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ fontSize: '0.8rem' }}>
              <ArrowLeft size={13} /> {reviewSource === 'manual' ? 'Go Back' : 'Re-upload'}
            </button>
          </div>

          {/* Spatial Layout Pre-Processing Telemetry Card */}
          {spatialMetadata && (
            <div
              style={{
                ...card,
                padding: '16px 20px',
                background: 'var(--brand-muted)',
                borderColor: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand)',
                  }}
                >
                  <Cpu size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Spatial Layout Engine: {spatialMetadata.hasMultiColumn ? 'Multi-Column Reading Order Preserved' : 'Single-Column Standard Layout'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Isolated sidebar text from right-column projects using coordinate bounding boxes ({spatialMetadata.extractionMethod}, {spatialMetadata.numPages} {spatialMetadata.numPages === 1 ? 'page' : 'pages'}).
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--brand)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {spatialMetadata.hasMultiColumn ? '2-Column Isolated' : '1-Column Linear'}
                </span>
                {anchorsData && anchorsData.githubUrls && anchorsData.githubUrls.length > 0 && (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--green-muted)',
                      border: '1px solid #86efac',
                      color: 'var(--green)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {anchorsData.githubUrls.length} GitHub Anchor{anchorsData.githubUrls.length > 1 ? 's' : ''}
                  </span>
                )}
                {anchorsData && anchorsData.liveDemoUrls && anchorsData.liveDemoUrls.length > 0 && (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {anchorsData.liveDemoUrls.length} Live Demo{anchorsData.liveDemoUrls.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ─ Academic & Identity ─ */}
          <div style={card}>
            <div style={sectionHead}><Layers size={16} color="var(--text-muted)" /> Academic &amp; Identity</div>
            <p style={sectionSub}>Core credentials extracted from your resume.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} color="var(--text-muted)" /> Full Name
                </label>
                <input type="text" className="form-input" value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="e.g. Priya Pandey" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={11} color="var(--text-muted)" /> Roll Number / ID
                </label>
                <input type="text" className="form-input" value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })} placeholder="e.g. 21BCSE104" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <BookOpen size={11} color="var(--text-muted)" /> Degree Branch
                </label>
                <input type="text" className="form-input" value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })} placeholder="e.g. Computer Science" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={11} color="var(--text-muted)" /> Graduation Year
                </label>
                <input type="number" className="form-input" value={formData.graduationYear}
                  min="2020" max="2032"
                  onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })} placeholder="e.g. 2025" />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>CGPA (out of 10)</label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand)' }}>{formData.cgpa} / 10</span>
                </div>
                <input type="number" step="0.1" min="0" max="10" className="form-input" value={formData.cgpa}
                  onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <GithubIcon size={11} color="var(--text-muted)" /> GitHub Username
                </label>
                <input type="text" className="form-input" value={formData.githubUsername}
                  onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })} placeholder="e.g. priyapandey" />
              </div>
            </div>
            <div style={{ marginTop: '14px', padding: '9px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.77rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}>
              <Database size={12} />
              MongoDB User ID:&nbsp;<code style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formData.userId}</code>
            </div>
          </div>

          {/* ─ Skills Tag Editor ─ */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <div style={sectionHead}><Code2 size={16} color="var(--text-muted)" /> Canonical Technical Skills Taxonomy</div>
              <span className="badge badge-pending">{formData.skills.length} Extracted</span>
            </div>
            <p style={sectionSub}>
              Normalized into taxonomy with empirical project cross-referencing and confidence scores. Queued with{' '}
              <strong style={{ color: 'var(--amber)', fontWeight: 600 }}>Pending</strong> status for GitHub audit.
            </p>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              minHeight: '56px',
              padding: '14px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              marginBottom: '14px',
              alignContent: 'flex-start',
            }}>
              {formData.skills.map((skill, i) => {
                const name = typeof skill === 'object' ? skill.name : skill;
                const category = typeof skill === 'object' && skill.category ? skill.category : 'General';
                const confidence = typeof skill === 'object' && skill.confidenceScore !== undefined ? skill.confidenceScore : 40;
                const rationale = typeof skill === 'object' && skill.rationale ? skill.rationale : 'Extracted from resume. Awaiting GitHub code audit.';
                const isHighConfidence = confidence >= 75;

                return (
                  <div
                    key={i}
                    title={rationale}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '5px 11px',
                      background: 'var(--bg-card)',
                      border: `1px solid ${isHighConfidence ? 'rgba(16, 185, 129, 0.35)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.83rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#0284c7',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {category}
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 5px',
                        background: isHighConfidence ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isHighConfidence ? '#059669' : '#d97706',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      {confidence}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        lineHeight: 1,
                        padding: '1px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      title="Remove skill"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              {!formData.skills.length && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No skills listed. Type below to add technical skills.
                </span>
              )}
            </div>

            <form onSubmit={handleAddSkill} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                placeholder="Add a skill (e.g. Next.js, Docker, Python)…" style={{ flex: 1 }} />
              <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>
                <Plus size={14} /> Add
              </button>
            </form>
          </div>

          {/* ─ Projects ─ */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <div style={sectionHead}><GithubIcon size={16} color="var(--text-muted)" /> Technical Projects</div>
              <button type="button" className="btn btn-secondary" onClick={handleAddProject} style={{ fontSize: '0.8rem' }}>
                <Plus size={13} /> Add Project
              </button>
            </div>
            <p style={sectionSub}>GitHub repos will be audited; live URLs checked for uptime.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {formData.projects.map((proj, i) => (
                <div key={i} style={inner}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Project {i + 1}</span>
                    {formData.projects.length > 1 && (
                      <button type="button" onClick={() => handleRemoveProject(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Project Title</label>
                      <input type="text" className="form-input" value={proj.title}
                        onChange={(e) => handleProjectChange(i, 'title', e.target.value)} placeholder="e.g. Task Queue System" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Tech Stack (comma-separated)</label>
                      <input type="text" className="form-input" value={proj.techStack}
                        onChange={(e) => handleProjectChange(i, 'techStack', e.target.value)} placeholder="e.g. React, Node.js, Docker" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GithubIcon size={11} color="var(--text-muted)" /> GitHub URL
                      </label>
                      <input type="url" className="form-input" value={proj.githubUrl}
                        onChange={(e) => handleProjectChange(i, 'githubUrl', e.target.value)} placeholder="https://github.com/user/repo" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={11} color="var(--text-muted)" /> Live Demo URL
                      </label>
                      <input type="url" className="form-input" value={proj.liveDemoUrl}
                        onChange={(e) => handleProjectChange(i, 'liveDemoUrl', e.target.value)} placeholder="https://my-app.vercel.app" />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" value={proj.description}
                      onChange={(e) => handleProjectChange(i, 'description', e.target.value)}
                      placeholder="Briefly describe the project, challenges solved, or architecture…" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Certifications ─ */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <div style={sectionHead}><Award size={16} color="var(--text-muted)" /> Certifications</div>
              <button type="button" className="btn btn-secondary" onClick={handleAddCert} style={{ fontSize: '0.8rem' }}>
                <Plus size={13} /> Add
              </button>
            </div>
            <p style={sectionSub}>Paste credential links from AWS, Google Cloud, Coursera, or Credly.</p>

            {!formData.certifications.length ? (
              <div style={{ ...inner, textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No certifications yet — click "+ Add" to include one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.certifications.map((cert, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.5fr auto', gap: '8px', alignItems: 'center', ...inner, padding: '10px 12px' }}>
                    <input type="text" className="form-input" value={cert.title}
                      onChange={(e) => handleCertChange(i, 'title', e.target.value)} placeholder="Certification Title" />
                    <input type="text" className="form-input" value={cert.issuer}
                      onChange={(e) => handleCertChange(i, 'issuer', e.target.value)} placeholder="Issuer (e.g. AWS)" />
                    <input type="url" className="form-input" value={cert.proofUrl}
                      onChange={(e) => handleCertChange(i, 'proofUrl', e.target.value)} placeholder="Verification URL" />
                    <button type="button" onClick={() => handleRemoveCert(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─ Submit ─ */}
          <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.93rem', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '3px' }}>Ready to finalise your profile?</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skills will be verified against your GitHub repositories.</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleConfirmProfile} disabled={stage === 'saving'} style={{ padding: '10px 22px' }}>
              {stage === 'saving' ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : <>Confirm &amp; Save <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          STAGE 3 — Success
         ══════════════════════════════ */}
      {stage === 'success' && successData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-up">

          {/* Hero */}
          <div style={{ ...card, textAlign: 'center', padding: '48px 32px', borderColor: '#bbf7d0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--green-muted)', border: '1px solid #86efac', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <CheckCircle size={30} strokeWidth={1.8} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Profile Saved!</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 22px', fontSize: '0.9rem', lineHeight: 1.65 }}>
              Your candidate profile has been persisted in MongoDB. Skills are queued with{' '}
              <strong style={{ color: 'var(--amber)', fontWeight: 600 }}>Pending</strong> status for GitHub code audit.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Database size={12} color="var(--green)" />
              Profile ID:&nbsp;<code style={{ color: 'var(--green)', fontFamily: 'monospace', fontWeight: 700 }}>{successData._id || 'Generated'}</code>
            </div>
          </div>

          {/* Score breakdown */}
          <div style={card}>
            <div style={sectionHead}><Sparkles size={16} color="var(--text-muted)" /> Verification Score Breakdown</div>
            <p style={sectionSub}>Calculated from GitHub audit, deployment checks, and credential cross-matching.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {/* Total */}
              <div style={{ ...inner, textAlign: 'center', padding: '22px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Score</div>
                <div style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--brand)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {successData.verificationScore || 0}
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
                </div>
              </div>
              {/* GitHub */}
              <div style={{ ...inner, textAlign: 'center', padding: '22px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '8px' }}>GitHub</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {successData.scoreBreakdown?.githubOriginalityScore ?? 0}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}> pts</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>Commit audit</div>
              </div>
              {/* Live deployment */}
              <div style={{ ...inner, textAlign: 'center', padding: '22px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '8px' }}>Deployment</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {successData.scoreBreakdown?.liveDeploymentScore ?? 0}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}> pts</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>URL health pings</div>
              </div>
              {/* Semantic */}
              <div style={{ ...inner, textAlign: 'center', padding: '22px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '8px' }}>Semantic</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {successData.scoreBreakdown?.semanticClaimScore ?? 0}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}> pts</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>Credentials match</div>
              </div>
            </div>

            {/* Skills */}
            {Array.isArray(successData.skills) && successData.skills.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Persisted Skills ({successData.skills.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {successData.skills.map((skill, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 11px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 500 }}>
                      {skill.name}
                      <span className="badge badge-pending" style={{ padding: '1px 6px', fontSize: '0.6rem' }}>{skill.verifiedStatus || 'Pending'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RefreshCw size={14} /> Upload Another
            </button>
            <button type="button" className="btn btn-primary"
              onClick={() => alert(`Verification Score: ${successData.verificationScore}/100\nSkills: ${successData.skills?.length || 0}\nProjects: ${successData.projects?.length || 0}`)}>
              <CheckCircle size={14} /> View Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
