import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, Check, ChevronDown, Download, ExternalLink, Filter, GitBranch,
  Grid2X2, List, Search, SlidersHorizontal, Sparkles, X, Zap,
  Trophy, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import './Dashboards.css';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const Github = GitBranch;

const API_BASE = ''; // Use relative URLs — Vite proxy forwards /api/* to the backend

function getAuthToken() {
  return localStorage.getItem('trusthire_token') || '';
}

// ---------------------------------------------------------------------------
// Static recruiter/admin mock candidates (admin panel is not live yet)
// ---------------------------------------------------------------------------

const candidates = [
  { initials: 'AS', name: 'Aarav Sharma', branch: 'Computer Science', college: 'IIT Delhi', score: 84, skills: ['React', 'Node.js', 'TypeScript'], github: 'aarav-sharma' },
  { initials: 'PM', name: 'Priya Mehta', branch: 'Information Technology', college: 'VIT Vellore', score: 91, skills: ['Python', 'ML/AI', 'SQL'], github: 'priya-mehta' },
  { initials: 'RV', name: 'Rohan Verma', branch: 'Electronics & Communication', college: 'BITS Pilani', score: 72, skills: ['C++', 'Embedded', 'React'], github: 'rohan-verma' },
  { initials: 'SI', name: 'Sneha Iyer', branch: 'Computer Science', college: 'NIT Trichy', score: 88, skills: ['Next.js', 'Node.js', 'AWS'], github: 'sneha-iyer' },
  { initials: 'MK', name: 'Mohit Kumar', branch: 'Mechanical Engineering', college: 'DTU', score: 78, skills: ['Python', 'DevOps', 'Docker'], github: 'mohit-kumar' },
  { initials: 'NK', name: 'Nisha Kapoor', branch: 'Information Technology', college: 'IIT Delhi', score: 86, skills: ['React', 'GraphQL', 'Node.js'], github: 'nisha-kapoor' },
  { initials: 'AK', name: 'Arjun Kulkarni', branch: 'Computer Science', college: 'VIT Vellore', score: 81, skills: ['Java', 'Spring', 'AWS'], github: 'arjun-kulkarni' },
  { initials: 'TG', name: 'Tanvi Gupta', branch: 'Artificial Intelligence', college: 'BITS Pilani', score: 93, skills: ['Python', 'ML/AI', 'TensorFlow'], github: 'tanvi-gupta' },
];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Modal({ children, onClose }) {
  return <div className="dash-modal-backdrop" onMouseDown={onClose}><div className="dash-modal" onMouseDown={(e) => e.stopPropagation()}>{children}<button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>;
}

function DashboardHeader({ user, label, onNavigate, onLogout }) {
  const isStudent = user?.role === 'student';
  const dashboardPath = isStudent ? '/dashboard/student' : '/dashboard/admin';

  return <header className="dash-topbar">
    <a className="dash-brand" href={dashboardPath} onClick={(event) => { event.preventDefault(); onNavigate?.(dashboardPath); }}>
      <span className="brand-mark">âœ“</span>
      <span>TrustHire<small>VERIFIED TALENT INTELLIGENCE</small></span>
    </a>
    <nav className="dash-nav" aria-label="Main navigation">
      <a href={dashboardPath} onClick={(event) => { event.preventDefault(); onNavigate?.(dashboardPath); }}>Dashboard</a>
      {isStudent && <a href="/resume-upload" onClick={(event) => { event.preventDefault(); onNavigate?.('/resume-upload'); }}>Upload Resume</a>}
    </nav>
    <div className="dash-user">
      <span className="dash-avatar">{(user?.name || label || 'U').slice(0, 2).toUpperCase()}</span>
      <span><strong>{user?.name || label}</strong><small>{user?.role === 'tpo_admin' ? 'TPO Admin' : user?.role === 'recruiter' ? 'Recruiter' : 'Student'}</small></span>
      <button type="button" className="dash-home" onClick={onLogout}>Sign out</button>
    </div>
  </header>;
}

function CardHeading({ eyebrow, title }) { return <><p className="eyebrow">{eyebrow}</p><h2 className="card-title">{title}</h2></>; }

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton({ user, onNavigate, onLogout }) {
  return (
    <div className="dashboard-shell student-shell">
      <DashboardHeader user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="student-content">
        <div className="db-loading-state">
          <Loader2 size={36} className="db-spinner" />
          <p>Loading your verified profileâ€¦</p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function DashboardError({ user, onNavigate, onLogout, message, onRetry }) {
  return (
    <div className="dashboard-shell student-shell">
      <DashboardHeader user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="student-content">
        <div className="db-error-state">
          <AlertCircle size={36} />
          <p>{message || 'Something went wrong loading your dashboard.'}</p>
          <button className="outline-button" onClick={onRetry}><RefreshCw size={14} /> Retry</button>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (no resume uploaded yet)
// ---------------------------------------------------------------------------

function DashboardEmpty({ user, onNavigate, onLogout }) {
  return (
    <div className="dashboard-shell student-shell">
      <DashboardHeader user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="student-content">
        <div className="db-empty-state">
          <span className="db-empty-icon">ðŸ“„</span>
          <h2>No resume uploaded yet</h2>
          <p>Upload your resume to generate a verified TrustScore and unlock your personalized dashboard.</p>
          <button className="primary-button" onClick={() => onNavigate?.('/resume-upload')}>
            Upload Resume <ArrowRight size={15} />
          </button>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STUDENT DASHBOARD â€” Live data
// ---------------------------------------------------------------------------

export function StudentDashboard({ user, onNavigate, onLogout }) {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [noProfile, setNoProfile] = useState(false);

  // Booster UI state
  const [selected, setSelected]   = useState(null);
  const [completed, setCompleted] = useState([]);
  const [input, setInput]         = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoProfile(false);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/profile/student/dashboard`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 404) {
        setNoProfile(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Server error (${res.status})`);
      }

      const json = await res.json();
      setDashData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // â”€â”€ Guard: loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) return <DashboardSkeleton user={user} onNavigate={onNavigate} onLogout={onLogout} />;

  // â”€â”€ Guard: error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error) return <DashboardError user={user} onNavigate={onNavigate} onLogout={onLogout} message={error} onRetry={fetchDashboard} />;

  // â”€â”€ Guard: no profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (noProfile) return <DashboardEmpty user={user} onNavigate={onNavigate} onLogout={onLogout} />;

  // â”€â”€ Live data ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const {
    name,
    branch,
    graduationYear,
    cgpa,
    college,
    verificationScore,
    skills = [],
    projects = [],
    achievements = [],
    certifications = [],
    scoreBoosterTasks: boosters = [],
    githubUsername,
  } = dashData;

  const score = verificationScore;

  // Local score increment from completed booster tasks (optimistic UI)
  const completedPointsGain = boosters
    .filter((b) => completed.includes(b.id))
    .reduce((sum, b) => sum + (b.points || 0), 0);
  const displayScore = Math.min(100, score + completedPointsGain);

  const task = boosters.find((item) => item.id === selected);
  const completeTask = () => {
    if (!input.trim()) return;
    setCompleted((prev) => [...prev, selected]);
    setSelected(null);
    setInput('');
  };

  // Top skills to show in sidebar (max 6)
  const topSkills = skills.slice(0, 6);

  return (
    <div className="dashboard-shell student-shell">
      <DashboardHeader user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="student-content">

        {/* â”€â”€ Hero â”€â”€ */}
        <section className="student-hero">
          <div className="score-wrap">
            <div className="score-ring">
              <strong>{displayScore}</strong>
              <span>/100</span>
            </div>
            <div>
              <p className="eyebrow light">Your verified TrustScore</p>
              <h1>Build a stronger profile.</h1>
              <a href="#rationale">View Detailed Score Rationale <ArrowRight size={14} /></a>
            </div>
          </div>
          <div className="resume-cta">
            <button className="white-button"><Download size={17} /> Download Verified Resume (PDF)</button>
            <p>Generates a standardized resume containing only system-verified skills, projects, and credentials</p>
          </div>
        </section>

        <div className="student-grid">
          {/* â”€â”€ Sidebar â”€â”€ */}
          <div className="student-side">

            {/* Verified Skills */}
            <section className="dashboard-card">
              <CardHeading eyebrow="Profile strength" title="Verified Skills" />
              {topSkills.length > 0 ? (
                <div className="skill-list">
                  {topSkills.map(({ name: skillName, percentage, verifiedStatus }) => (
                    <div className="skill-row" key={skillName}>
                      <div>
                        <span>
                          {skillName}
                          {verifiedStatus === 'Verified' && (
                            <span className="skill-verified-badge" title="Verified via GitHub">âœ“</span>
                          )}
                        </span>
                        <b>{percentage}%</b>
                      </div>
                      <div className="progress"><span style={{ width: `${percentage}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="db-no-data">No skills extracted yet. Upload a resume to get started.</p>
              )}
            </section>

            {/* Academic Details */}
            <section className="dashboard-card academic-card">
              <CardHeading eyebrow="Verified education" title="Academic Details" />
              <div className="academic-grid">
                <div>
                  <small>Branch</small>
                  <strong>{branch || <span className="db-missing">â€”</span>}</strong>
                </div>
                <div>
                  <small>Graduation Year</small>
                  <strong>{graduationYear || <span className="db-missing">â€”</span>}</strong>
                </div>
                <div>
                  <small>CGPA</small>
                  <strong>{cgpa != null ? `${cgpa} / 10` : <span className="db-missing">â€”</span>}</strong>
                </div>
                <div>
                  <small>College</small>
                  <strong>{college || <span className="db-missing">Not linked</span>}</strong>
                </div>
              </div>
            </section>

            {/* Achievements (only shown when non-empty) */}
            {achievements.length > 0 && (
              <section className="dashboard-card achievements-card">
                <CardHeading eyebrow="Honors & awards" title="Achievements" />
                <div className="achievement-list">
                  {achievements.map((ach, idx) => (
                    <div className="achievement-item" key={idx}>
                      <Trophy size={15} className="achievement-icon" />
                      <div>
                        <strong>{ach.title}</strong>
                        {ach.date && <small className="achievement-date">{ach.date}</small>}
                        {ach.description && <p className="achievement-desc">{ach.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* â”€â”€ Main Column â”€â”€ */}
          <section className="dashboard-card boosters-card">
            <div className="boosters-heading">
              <div>
                <CardHeading eyebrow="Next best actions" title="Recommended Score Boosters" />
                <p>Improve your profile strength</p>
              </div>
              <span className="sparkle"><Sparkles size={18} /></span>
            </div>

            {boosters.length > 0 ? (
              <>
                <div className="booster-list">
                  {boosters.map((item) => {
                    const done = completed.includes(item.id);
                    return (
                      <div className={`booster-item ${done ? 'is-done' : ''}`} key={item.id}>
                        <span className="point-badge">+{item.points}</span>
                        <div className="booster-copy">
                          <strong>{item.title}</strong>
                          <small>{done ? 'Completed and added to your verified profile' : 'Verified evidence can increase your TrustScore'}</small>
                        </div>
                        {done
                          ? <span className="completed-label"><Check size={15} /> Done</span>
                          : <button className="outline-button" onClick={() => setSelected(item.id)}>{item.action} <ArrowRight size={14} /></button>
                        }
                      </div>
                    );
                  })}
                </div>
                <div className="booster-footer">
                  <Zap size={16} />
                  {' '}Completing all actions could raise your score to{' '}
                  <strong>
                    {Math.min(100, displayScore + boosters.filter((x) => !completed.includes(x.id)).reduce((sum, x) => sum + x.points, 0))}/100
                  </strong>
                </div>
              </>
            ) : (
              <div className="db-boosters-complete">
                <Check size={22} />
                <p>Your profile looks great! No pending actions at this time.</p>
              </div>
            )}
          </section>
        </div>

        {/* â”€â”€ Projects (below grid) â”€â”€ */}
        {projects.length > 0 && (
          <section className="dashboard-card projects-section" id="rationale">
            <CardHeading eyebrow="Evidence-backed work" title="Verified Projects" />
            <div className="projects-grid">
              {projects.map((proj) => (
                <article className="project-card" key={proj._id || proj.title}>
                  <h3>{proj.title}</h3>
                  {proj.description && <p className="project-desc">{proj.description}</p>}
                  {proj.techStack?.length > 0 && (
                    <div className="project-tech">
                      {proj.techStack.map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}
                  <div className="project-links">
                    {proj.githubUrl && (
                      <a href={proj.githubUrl} target="_blank" rel="noreferrer">
                        <Github size={13} /> GitHub <ExternalLink size={10} />
                      </a>
                    )}
                    {proj.liveDemoUrl && (
                      <a href={proj.liveDemoUrl} target="_blank" rel="noreferrer">
                        Live <ExternalLink size={10} />
                      </a>
                    )}
                    {!proj.githubUrl && !proj.liveDemoUrl && (
                      <span className="project-no-links">No links added</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* â”€â”€ Booster Modal â”€â”€ */}
      {selected && task && (
        <Modal onClose={() => setSelected(null)}>
          <span className="modal-kicker">+{task.points} TrustScore points</span>
          <h2>{task.title}</h2>
          <p>Provide a link or confirmation below. TrustHire will verify this evidence before adding it to your profile.</p>
          <input
            autoFocus
            className="modal-input"
            placeholder={task.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="primary-button" onClick={completeTask}>Submit for verification <ArrowRight size={16} /></button>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD
// ---------------------------------------------------------------------------

export function AdminDashboard({ user, onNavigate, onLogout }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [branch, setBranch] = useState('All branches');
  const [college, setCollege] = useState('All colleges');
  const [skill, setSkill] = useState('');
  const [selected, setSelected] = useState([]);
  const [audit, setAudit] = useState(null);
  const filtered = useMemo(() => candidates.filter((candidate) => (!query || `${candidate.name} ${candidate.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase())) && (branch === 'All branches' || candidate.branch === branch) && (college === 'All colleges' || candidate.college === college) && (!skill || candidate.skills.includes(skill))), [query, branch, college, skill]);
  const toggle = (name) => setSelected((items) => items.includes(name) ? items.filter((x) => x !== name) : [...items, name]);
  const reset = () => { setQuery(''); setBranch('All branches'); setCollege('All colleges'); setSkill(''); };
  return <div className="dashboard-shell admin-shell"><DashboardHeader user={user} label="TPO Admin" onNavigate={onNavigate} onLogout={onLogout} /><main className="admin-content"><div className="admin-title-row"><div><p className="eyebrow">Placement intelligence</p><h1>Candidate Discovery</h1><p className="admin-subtitle">TPO Admin - VIT Vellore Placement Cell</p></div><button className="primary-button"><Download size={16} /> Export Shortlist {selected.length ? `(${selected.length})` : ''}</button></div><div className="admin-toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or skill..." /></label><div className="toolbar-right"><span className="count-indicator"><strong>{filtered.length}</strong> / 8 candidates</span><div className="view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div></div></div><div className="admin-layout"><aside className="filter-panel"><div className="filter-heading"><h2><SlidersHorizontal size={17} /> Advanced Filters</h2><button onClick={reset}>Reset</button></div><FilterField label="College"><select value={college} onChange={(e) => setCollege(e.target.value)}><option>All colleges</option><option>IIT Delhi</option><option>VIT Vellore</option><option>BITS Pilani</option><option>NIT Trichy</option><option>DTU</option></select></FilterField><FilterField label="Branch"><select value={branch} onChange={(e) => setBranch(e.target.value)}><option>All branches</option><option>Computer Science</option><option>Information Technology</option><option>Electronics & Communication</option><option>Mechanical Engineering</option><option>Artificial Intelligence</option></select></FilterField><FilterField label="Graduation Year"><select><option>2025 â€” 2026</option><option>2025</option><option>2026</option></select></FilterField><div className="filter-section"><label className="filter-label">CGPA Range <span>6.0 â€” 10.0</span></label><div className="fake-range"><span /></div></div><div className="filter-section"><label className="filter-label">Technical & Domain</label><div className="filter-pills">{['Frontend', 'Backend', 'ML/AI', 'Full Stack', 'DevOps'].map((item) => <button className={skill === item || (item === 'Frontend' && skill === 'React') ? 'selected' : ''} onClick={() => setSkill(skill === item ? '' : item === 'Frontend' ? 'React' : item)} key={item}>{item}</button>)}</div></div><div className="filter-section"><label className="filter-label">Evidence & Quality</label><label className="switch-row"><input type="checkbox" defaultChecked /><span className="switch" />Verified evidence only</label><label className="switch-row"><input type="checkbox" /><span className="switch" />Has live projects</label></div></aside><section className={`candidate-area ${view === 'list' ? 'list-view' : ''}`}><div className="candidate-area-heading"><div><h2>Shortlist candidates</h2><p>Ranked by TrustScore and verified evidence</p></div><span><Filter size={15} /> {filtered.length} matching</span></div><div className="candidate-grid">{filtered.map((candidate) => <article className="candidate-card" key={candidate.name}><div className="candidate-card-top"><label className="select-box"><input type="checkbox" checked={selected.includes(candidate.name)} onChange={() => toggle(candidate.name)} /><span /></label><div className="candidate-initials">{candidate.initials}</div><span className="trust-badge">{candidate.score}%</span></div><h3>{candidate.name}</h3><p className="candidate-meta">{candidate.branch}<br />{candidate.college}</p><div className="candidate-skills">{candidate.skills.map((item) => <span key={item}>{item}</span>)}</div><div className="candidate-footer"><a href={`https://github.com/${candidate.github}`} target="_blank" rel="noreferrer"><Github size={14} /> GitHub <ExternalLink size={11} /></a><button onClick={() => setAudit(candidate)}>Audit <ArrowRight size={14} /></button></div></article>)}</div>{filtered.length === 0 && <div className="empty-state">No candidates match these filters. <button onClick={reset}>Reset filters</button></div>}</section></div></main>{audit && <Modal onClose={() => setAudit(null)}><div className="audit-profile"><div className="candidate-initials large">{audit.initials}</div><div><span className="modal-kicker">Verified candidate</span><h2>{audit.name}</h2><p>{audit.branch} Â· {audit.college}</p></div><span className="trust-badge large-badge">{audit.score}%</span></div><div className="audit-row"><span>Evidence coverage</span><strong>92%</strong></div><div className="audit-row"><span>Skills verified</span><strong>{audit.skills.length} / {audit.skills.length}</strong></div><div className="audit-row"><span>Last profile audit</span><strong>Today, 10:24 AM</strong></div><button className="primary-button full-button">Open full candidate profile <ArrowRight size={16} /> </button></Modal>}</div>;
}

function FilterField({ label, children }) { return <label className="filter-field"><span>{label}</span><div>{children}<ChevronDown size={15} /></div></label>; }
