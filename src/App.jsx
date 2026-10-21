import React, { useState, useEffect } from 'react';
import ResumeUpload from './components/ResumeUpload';
import AuthPage from './components/AuthPage';
import { ShieldCheck, LogOut, User } from 'lucide-react';
import { StudentDashboard, AdminDashboard } from './components/Dashboards';

export default function App() {
  // Auth state — persist token in sessionStorage (or localStorage if remember-me used)
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // On mount: restore auth from localStorage (remember-me)
  useEffect(() => {
    const storedToken = localStorage.getItem('trusthire_token');
    const storedUser = localStorage.getItem('trusthire_user');
    if (storedToken && storedUser) {
      try {
        setAuthToken(storedToken);
        setAuthUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('trusthire_token');
        localStorage.removeItem('trusthire_user');
      }
    }
    setAuthChecked(true);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleAuthSuccess = (user, token, isNewAccount = false) => {
    setAuthUser(user);
    setAuthToken(token);
    // Persist if remember-me was set (AuthPage sets this in localStorage already)
    localStorage.setItem('trusthire_user', JSON.stringify(user));

    const destination = isNewAccount && user.role === 'student'
      ? '/resume-upload'
      : user.role === 'student' ? '/dashboard/student' : '/dashboard/admin';
    navigate(destination);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) { /* ignore */ }
    localStorage.removeItem('trusthire_token');
    localStorage.removeItem('trusthire_user');
    setAuthUser(null);
    setAuthToken(null);
    navigate('/');
  };

  // Don't flash before we've checked stored auth
  if (!authChecked) return null;

  // ── Unauthenticated: Show Auth Page ───────────────────────────────────────
  if (!authUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (currentPath === '/dashboard/student') {
    return <StudentDashboard user={authUser} onNavigate={navigate} onLogout={handleLogout} />;
  }

  if (currentPath === '/dashboard/admin') {
    return <AdminDashboard user={authUser} onNavigate={navigate} onLogout={handleLogout} />;
  }

  // ── Authenticated: Show Main App ───────────────────────────────────────────
  const roleLabel = {
    student: 'Student',
    tpo_admin: 'TPO Admin',
    recruiter: 'Recruiter',
  }[authUser.role] || authUser.role;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav ── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--brand)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{
                fontSize: '1rem', fontWeight: 700,
                letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1.1,
              }}>TrustHire</div>
              <div style={{
                fontSize: '0.6rem', color: 'var(--brand)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 600, lineHeight: 1,
              }}>Verified Talent Intelligence</div>
            </div>
          </div>

          <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a
              href={authUser.role === 'student' ? '/dashboard/student' : '/dashboard/admin'}
              onClick={(event) => { event.preventDefault(); navigate(authUser.role === 'student' ? '/dashboard/student' : '/dashboard/admin'); }}
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}
            >
              Dashboard
            </a>
            {authUser.role === 'student' && (
              <a
                href="/resume-upload"
                onClick={(event) => { event.preventDefault(); navigate('/resume-upload'); }}
                style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}
              >
                Upload Resume
              </a>
            )}
          </nav>

          {/* User pill + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#f3f4f6', borderRadius: '999px',
              padding: '5px 12px 5px 8px',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'var(--brand)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={13} color="#fff" />
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111' }}>
                  {authUser.name || authUser.email}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {roleLabel}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              id="logout-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', border: '1px solid #e5e7eb',
                borderRadius: '7px', padding: '6px 10px', cursor: 'pointer',
                fontSize: '0.78rem', color: '#6b7280', fontFamily: 'inherit',
                fontWeight: 500, transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1 }}>
        <ResumeUpload authToken={authToken} authUser={authUser} />
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 24px', background: '#ffffff' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '8px',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} TrustHire &nbsp;·&nbsp; Evidence-Based Placement Intelligence
          </span>
        </div>
      </footer>
    </div>
  );
}
