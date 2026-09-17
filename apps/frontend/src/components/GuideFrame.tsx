import { WorkspaceNavigation } from './WorkspaceNavigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';

export function GuideFrame({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const check = () => api('/auth/guide-home').then(() => {
      if (active) { setReady(true); setError(''); }
    }).catch(() => {
      if (active) { setReady(false); setError('دسترسی قابل تأیید نیست. دوباره تلاش کنید.'); }
    });
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [retry]);
  async function leave() {
    if (busy) return;
    setBusy(true);
    try { await logout(); }
    catch { setError('خروج انجام نشد. دوباره تلاش کنید.'); }
    finally { setBusy(false); }
  }
  return <main className="home-layout guide-theme">
    <header className="home-header">
      <Link className="brand brand-link" to="/guide"><svg className="lotus-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 9C19 24 21 38 32 48C43 38 45 24 32 9Z" fill="#68a5cf"/><path d="M12 20C10 39 18 49 32 51C31 35 24 25 12 20ZM52 20C54 39 46 49 32 51C33 35 40 25 52 20Z" fill="#397cae"/><path d="M3 34C8 50 19 57 32 54C20 42 11 36 3 34ZM61 34C56 50 45 57 32 54C44 42 53 36 61 34Z" fill="#84b8d7"/></svg><span>همیاران لاهوت<small>سامانه مدیریت حمایت</small></span></Link>
      <div className="header-actions"><span className="role-badge">راهبر عالی</span><button className="secondary" disabled={busy} onClick={leave}>{busy ? 'در حال خروج…' : 'خروج از حساب'}</button></div>
    </header>
    <WorkspaceNavigation/>
    {error && <div className="error-banner frame-error" role="alert">{error} {!ready && <button className="secondary" onClick={() => setRetry(x => x + 1)}>تلاش دوباره</button>}</div>}
    {ready ? children : !error && <p role="status">در حال بررسی دسترسی…</p>}
  </main>;
}
