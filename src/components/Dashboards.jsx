import React, { useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, Download, ExternalLink, Filter, GitBranch,
  Grid2X2, List, Search, SlidersHorizontal, Sparkles, X, Zap,
} from 'lucide-react';
import './Dashboards.css';

const Github = GitBranch;

const boosters = [
  { id: 'campus', points: 8, title: 'Add live URL for Campus Connect', action: 'Add URL', placeholder: 'https://campus-connect.example.com' },
  { id: 'cpp', points: 10, title: 'Take C++ Advanced Assessment', action: 'Start Test', placeholder: 'Assessment completed' },
  { id: 'python', points: 7, title: 'Link Python repository', action: 'Link Repo', placeholder: 'https://github.com/your-name/python-project' },
  { id: 'docker', points: 6, title: 'Add Docker project proof', action: 'Add Project', placeholder: 'Project name or repository URL' },
];

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

function Modal({ children, onClose }) {
  return <div className="dash-modal-backdrop" onMouseDown={onClose}><div className="dash-modal" onMouseDown={(e) => e.stopPropagation()}>{children}<button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>;
}

function DashboardHeader({ user, label, onNavigate, onLogout }) {
  const isStudent = user?.role === 'student';
  const dashboardPath = isStudent ? '/dashboard/student' : '/dashboard/admin';

  return <header className="dash-topbar">
    <a className="dash-brand" href={dashboardPath} onClick={(event) => { event.preventDefault(); onNavigate?.(dashboardPath); }}>
      <span className="brand-mark">✓</span>
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

export function StudentDashboard({ user, onNavigate, onLogout }) {
  const [score, setScore] = useState(82);
  const [selected, setSelected] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [input, setInput] = useState('');
  const task = boosters.find((item) => item.id === selected);
  const completeTask = () => { if (!input.trim()) return; setCompleted((items) => [...items, selected]); setScore((value) => Math.min(100, value + (task?.points || 0))); setSelected(null); setInput(''); };
  return <div className="dashboard-shell student-shell"><DashboardHeader user={user} label="Alex Johnson" onNavigate={onNavigate} onLogout={onLogout} /><main className="student-content">
    <section className="student-hero"><div className="score-wrap"><div className="score-ring"><strong>{score}</strong><span>/100</span></div><div><p className="eyebrow light">Your verified TrustScore</p><h1>Build a stronger profile.</h1><a href="#rationale">View Detailed Score Rationale <ArrowRight size={14} /></a></div></div><div className="resume-cta"><button className="white-button"><Download size={17} /> Download Verified Resume (PDF)</button><p>Generates a standardized resume containing only system-verified skills, projects, and credentials</p></div></section>
    <div className="student-grid"><div className="student-side"><section className="dashboard-card"><CardHeading eyebrow="Profile strength" title="Verified Skills" /><div className="skill-list">{[['React', 96], ['Node.js', 89], ['TypeScript', 82], ['C++', 74]].map(([name, value]) => <div className="skill-row" key={name}><div><span>{name}</span><b>{value}%</b></div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>)}</div></section><section className="dashboard-card academic-card"><CardHeading eyebrow="Verified education" title="Academic Details" /><div className="academic-grid"><div><small>Branch</small><strong>Computer Science</strong></div><div><small>Graduation Year</small><strong>2025</strong></div><div><small>CGPA</small><strong>8.7 / 10</strong></div><div><small>College</small><strong>VIT Vellore</strong></div></div></section></div><section className="dashboard-card boosters-card"><div className="boosters-heading"><div><CardHeading eyebrow="Next best actions" title="Recommended Score Boosters" /><p>Improve your profile strength</p></div><span className="sparkle"><Sparkles size={18} /></span></div><div className="booster-list">{boosters.map((item) => { const done = completed.includes(item.id); return <div className={`booster-item ${done ? 'is-done' : ''}`} key={item.id}><span className="point-badge">+{item.points}</span><div className="booster-copy"><strong>{item.title}</strong><small>{done ? 'Completed and added to your verified profile' : 'Verified evidence can increase your TrustScore'}</small></div>{done ? <span className="completed-label"><Check size={15} /> Done</span> : <button className="outline-button" onClick={() => setSelected(item.id)}>{item.action} <ArrowRight size={14} /></button>}</div>; })}</div><div className="booster-footer"><Zap size={16} /> Completing all recommended actions could raise your score to <strong>{Math.min(100, score + boosters.filter((x) => !completed.includes(x.id)).reduce((sum, x) => sum + x.points, 0))}/100</strong></div></section></div>
    </main>{selected && <Modal onClose={() => setSelected(null)}><span className="modal-kicker">+{task.points} TrustScore points</span><h2>{task.title}</h2><p>Provide a link or confirmation below. TrustHire will verify this evidence before adding it to your profile.</p><input autoFocus className="modal-input" placeholder={task.placeholder} value={input} onChange={(e) => setInput(e.target.value)} /><button className="primary-button" onClick={completeTask}>Submit for verification <ArrowRight size={16} /></button></Modal>}</div>;
}

function CardHeading({ eyebrow, title }) { return <><p className="eyebrow">{eyebrow}</p><h2 className="card-title">{title}</h2></>; }

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
  return <div className="dashboard-shell admin-shell"><DashboardHeader user={user} label="TPO Admin" onNavigate={onNavigate} onLogout={onLogout} /><main className="admin-content"><div className="admin-title-row"><div><p className="eyebrow">Placement intelligence</p><h1>Candidate Discovery</h1><p className="admin-subtitle">TPO Admin - VIT Vellore Placement Cell</p></div><button className="primary-button"><Download size={16} /> Export Shortlist {selected.length ? `(${selected.length})` : ''}</button></div><div className="admin-toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or skill..." /></label><div className="toolbar-right"><span className="count-indicator"><strong>{filtered.length}</strong> / 8 candidates</span><div className="view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div></div></div><div className="admin-layout"><aside className="filter-panel"><div className="filter-heading"><h2><SlidersHorizontal size={17} /> Advanced Filters</h2><button onClick={reset}>Reset</button></div><FilterField label="College"><select value={college} onChange={(e) => setCollege(e.target.value)}><option>All colleges</option><option>IIT Delhi</option><option>VIT Vellore</option><option>BITS Pilani</option><option>NIT Trichy</option><option>DTU</option></select></FilterField><FilterField label="Branch"><select value={branch} onChange={(e) => setBranch(e.target.value)}><option>All branches</option><option>Computer Science</option><option>Information Technology</option><option>Electronics & Communication</option><option>Mechanical Engineering</option><option>Artificial Intelligence</option></select></FilterField><FilterField label="Graduation Year"><select><option>2025 — 2026</option><option>2025</option><option>2026</option></select></FilterField><div className="filter-section"><label className="filter-label">CGPA Range <span>6.0 — 10.0</span></label><div className="fake-range"><span /></div></div><div className="filter-section"><label className="filter-label">Technical & Domain</label><div className="filter-pills">{['Frontend', 'Backend', 'ML/AI', 'Full Stack', 'DevOps'].map((item) => <button className={skill === item || (item === 'Frontend' && skill === 'React') ? 'selected' : ''} onClick={() => setSkill(skill === item ? '' : item === 'Frontend' ? 'React' : item)} key={item}>{item}</button>)}</div></div><div className="filter-section"><label className="filter-label">Evidence & Quality</label><label className="switch-row"><input type="checkbox" defaultChecked /><span className="switch" />Verified evidence only</label><label className="switch-row"><input type="checkbox" /><span className="switch" />Has live projects</label></div></aside><section className={`candidate-area ${view === 'list' ? 'list-view' : ''}`}><div className="candidate-area-heading"><div><h2>Shortlist candidates</h2><p>Ranked by TrustScore and verified evidence</p></div><span><Filter size={15} /> {filtered.length} matching</span></div><div className="candidate-grid">{filtered.map((candidate) => <article className="candidate-card" key={candidate.name}><div className="candidate-card-top"><label className="select-box"><input type="checkbox" checked={selected.includes(candidate.name)} onChange={() => toggle(candidate.name)} /><span /></label><div className="candidate-initials">{candidate.initials}</div><span className="trust-badge">{candidate.score}%</span></div><h3>{candidate.name}</h3><p className="candidate-meta">{candidate.branch}<br />{candidate.college}</p><div className="candidate-skills">{candidate.skills.map((item) => <span key={item}>{item}</span>)}</div><div className="candidate-footer"><a href={`https://github.com/${candidate.github}`} target="_blank" rel="noreferrer"><Github size={14} /> GitHub <ExternalLink size={11} /></a><button onClick={() => setAudit(candidate)}>Audit <ArrowRight size={14} /></button></div></article>)}</div>{filtered.length === 0 && <div className="empty-state">No candidates match these filters. <button onClick={reset}>Reset filters</button></div>}</section></div></main>{audit && <Modal onClose={() => setAudit(null)}><div className="audit-profile"><div className="candidate-initials large">{audit.initials}</div><div><span className="modal-kicker">Verified candidate</span><h2>{audit.name}</h2><p>{audit.branch} · {audit.college}</p></div><span className="trust-badge large-badge">{audit.score}%</span></div><div className="audit-row"><span>Evidence coverage</span><strong>92%</strong></div><div className="audit-row"><span>Skills verified</span><strong>{audit.skills.length} / {audit.skills.length}</strong></div><div className="audit-row"><span>Last profile audit</span><strong>Today, 10:24 AM</strong></div><button className="primary-button full-button">Open full candidate profile <ArrowRight size={16} /> </button></Modal>}</div>;
}

function FilterField({ label, children }) { return <label className="filter-field"><span>{label}</span><div>{children}<ChevronDown size={15} /></div></label>; }
