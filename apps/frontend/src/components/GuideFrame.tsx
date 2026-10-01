import {BrandLogo} from './BrandLogo';
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
      <Link className="brand brand-link" to="/guide"><BrandLogo/><span>کانون مهربانی همیاران لاهوت<small>سامانه مدیریت حمایت</small></span></Link>
      <div className="header-actions"><span className="role-badge">همیار شاهد</span><button className="secondary" disabled={busy} onClick={leave}>{busy ? 'در حال خروج…' : 'خروج از حساب'}</button></div>
    </header>
    <WorkspaceNavigation/>
    {error && <div className="error-banner frame-error" role="alert">{error} {!ready && <button className="secondary" onClick={() => setRetry(x => x + 1)}>تلاش دوباره</button>}</div>}
    {ready ? children : !error && <p role="status">در حال بررسی دسترسی…</p>}
  </main>;
}
