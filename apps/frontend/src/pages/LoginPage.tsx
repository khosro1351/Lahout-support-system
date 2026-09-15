import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';
export function LoginPage() {
 const { login } = useAuth();
 const [username,setUsername] = useState(''); const [password,setPassword] = useState('');
 const [visible,setVisible] = useState(false); const [error,setError] = useState('');
 const [validation,setValidation] = useState(false); const [busy,setBusy] = useState(false);
 const lock=useRef(false); const usernameRef=useRef<HTMLInputElement>(null); const passwordRef=useRef<HTMLInputElement>(null);
 async function submit(e:FormEvent) {
  e.preventDefault(); if(lock.current) return; setError(''); setValidation(true);
  if(!username.trim()){usernameRef.current?.focus();return;} if(!password){passwordRef.current?.focus();return;}
  lock.current=true;setBusy(true);
  try { await login(username.trim(),password); }
  catch(e){setError(e instanceof ApiError ? e.message : 'ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.');setPassword('');setValidation(false);}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className="login-layout"><aside className="brand-panel" aria-label="سامانه حمایت لاهوت"><div className="brand"><span className="brand-mark" aria-hidden="true">ل</span><span>همیاران لاهوت<small>کانون مهربانی</small></span></div><div className="brand-copy"><span className="eyebrow">همراهِ هم، برای مهربانی</span><h1>هر همراهی،<br/>آغاز یک امید.</h1><p>سامانه مدیریت حمایت<br/>کانون مهربانی همیاران لاهوت</p></div><span className="brand-foot">با هم، در مسیر حمایت</span><div className="arc"/><div className="arc arc-two"/></aside>
 <section className="form-panel"><div className="login-card"><span className="eyebrow form-eyebrow">سامانه حمایت لاهوت</span><h2>خوش آمدید</h2><p className="intro">برای ورود، اطلاعات حساب خود را وارد کنید.</p>
 <form onSubmit={submit} noValidate aria-busy={busy}>{error && <div className="error-banner" role="alert">{error}</div>}
 <div className="field"><label htmlFor="username">نام کاربری یا موبایل</label><input ref={usernameRef} id="username" name="username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={80} value={username} onChange={e=>setUsername(e.target.value)} aria-invalid={validation&&!username.trim()} aria-describedby="username-help" placeholder="نام کاربری یا شماره موبایل" readOnly={busy}/><span id="username-help" className={validation&&!username.trim()?'field-error':'field-help'}>{validation&&!username.trim()?'نام کاربری یا موبایل را وارد کنید.':'از اطلاعات حساب ثبت‌شده خود استفاده کنید.'}</span></div>
 <div className="field"><label htmlFor="password">رمز عبور</label><div className="password-wrap"><input ref={passwordRef} id="password" name="password" dir="ltr" type={visible?'text':'password'} autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={validation&&!password} aria-describedby="password-help" readOnly={busy}/><button type="button" className="show-password" aria-label={visible?'پنهان کردن رمز عبور':'نمایش رمز عبور'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'پنهان':'نمایش'}</button></div><span id="password-help" className="field-error">{validation&&!password?'رمز عبور را وارد کنید.':' '}</span></div>
 <button className="primary" type="submit" disabled={busy}>{busy?'در حال ورود…':'ورود به سامانه'}<span aria-hidden="true">←</span></button><p className="privacy">دسترسی به سامانه ویژه کاربران مجاز است.</p></form></div><footer>کانون مهربانی همیاران لاهوت</footer></section></main>;
}
