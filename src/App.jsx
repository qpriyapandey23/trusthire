import React from 'react';
import ResumeUpload from './components/ResumeUpload';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';

export default function App() {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheck size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}>
                TrustHire
              </div>
              <div style={{
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                lineHeight: 1,
              }}>
                Placement Intelligence
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1 }}>
        <ResumeUpload />
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '18px 24px',
        background: '#ffffff',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} TrustHire
          </span>
        </div>
      </footer>
    </div>
  );
}
