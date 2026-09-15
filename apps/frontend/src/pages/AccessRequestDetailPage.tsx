import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GuideFrame } from '../components/GuideFrame';
import { api, ApiError } from '../api/client';
import { type AccessRequest, type Decision, statuses, types, dateLabel, scopeLabel } from './access-types';
type Detail = { request: AccessRequest; history: Decision[] };

export function AccessRequestDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let active = true;
    setData(null); setError(''); setSuccess(''); setMode(null); setReason(''); setReasonError('');
    api<Detail>('/access-requests/' + id).then(d => { if (active) setData(d); })
      .catch(e => { if (active) setError(e instanceof ApiError ? e.message : 'دریافت جزئیات انجام نشد.'); });
    return () => { active = false; };
  }, [id, retry]);
  async function decide() {
    if (!mode || lock.current) return;
    if (mode === 'REJECTED' && !reason.trim()) { setReasonError('برای رد درخواست، دلیل را وارد کنید.'); reasonRef.current?.focus(); return; }
    lock.current = true; setBusy(true); setError(''); setReasonError('');
    try {
      await api('/access-requests/' + id + '/decision', { method: 'POST', body: JSON.stringify({ decision: mode, ...(mode === 'REJECTED' ? { reason: reason.trim() } : {}) }) });
      setMode(null);
      setData(await api<Detail>('/access-requests/' + id));
      setSuccess('تصمیم شما ثبت شد.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'نتیجه عملیات دریافت نشد. وضعیت درخواست را دوباره بررسی کنید.');
      // A response can be lost after commit. Read the durable state before allowing a retry.
      try { const latest = await api<Detail>('/access-requests/' + id); setData(latest); if (latest.request.status !== 'PENDING_GUIDE_APPROVAL') setMode(null); } catch { /* Show the original error and keep retry available. */ }
    } finally { lock.current = false; setBusy(false); }
  }
  const r = data?.request;
  return <GuideFrame><section className="guide-content detail-content">
    <Link className="back-link" to="/guide/access-requests">بازگشت به درخواست‌های دسترسی</Link>
    {error && <div className="error-banner" role="alert">{error} {!data && <button className="secondary" onClick={() => setRetry(x => x + 1)}>تلاش دوباره</button>}</div>}
    {success && <div className="success-banner" role="status">{success}</div>}
    {!data && !error && <p role="status">در حال دریافت جزئیات…</p>}
    {r && <>
      <div className="page-heading"><div><span className="eyebrow form-eyebrow">جزئیات درخواست دسترسی</span><h1>{r.person_name}</h1><p>{types[r.request_type]}</p></div><span className={'status-badge status-' + r.status}>{statuses[r.status]}</span></div>
      {r.is_development && <div className="dev-notice">Development/Test — این درخواست صرفاً داده آزمایشی توسعه است.</div>}
      <div className="detail-card"><dl className="request-meta"><div><dt>نوع درخواست</dt><dd>{types[r.request_type]}</dd></div><div><dt>نقش پیشنهادی</dt><dd>{r.role_label || '—'}</dd></div><div><dt>دامنه دسترسی</dt><dd>{scopeLabel(r)}</dd></div><div><dt>درخواست‌کننده</dt><dd>{r.requester_name} <bdi>({r.requester_username})</bdi></dd></div><div><dt>تاریخ · تهران</dt><dd>{dateLabel(r.requested_at)}</dd></div></dl><h2>دلیل درخواست</h2><p className="reason-full">{r.reason}</p></div>
      {r.status === 'PENDING_GUIDE_APPROVAL' ? <section className="decision-card" aria-label="تصمیم راهبر">
        <h2>تصمیم راهبر</h2><p>تأیید شما درخواست را برای اجرای فنی آماده می‌کند. حساب یا نقش جدیدی ایجاد نمی‌شود. تصمیم نهایی قابل ویرایش نیست.</p>
        {!mode ? <div className="decision-actions"><button className="primary compact" onClick={() => setMode('APPROVED')}>تأیید درخواست</button><button className="danger-button" onClick={() => setMode('REJECTED')}>رد درخواست</button></div> : <div className="decision-confirm">
          {mode === 'APPROVED' ? <p>تأیید نهایی این درخواست ثبت شود؟</p> : <div className="field"><label htmlFor="rejection-reason">دلیل رد (الزامی)</label><textarea ref={reasonRef} id="rejection-reason" maxLength={2000} value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setReasonError(''); }} aria-invalid={!!reasonError} aria-describedby="reason-error"/><span className="field-error" id="reason-error" role={reasonError ? 'alert' : undefined}>{reasonError}</span></div>}
          <div className="decision-actions"><button className={mode === 'APPROVED' ? 'primary compact' : 'danger-button'} disabled={busy} onClick={decide}>{busy ? 'در حال ثبت…' : mode === 'APPROVED' ? 'ثبت تأیید نهایی' : 'ثبت رد درخواست'}</button><button className="secondary" disabled={busy} onClick={() => { setMode(null); setReasonError(''); }}>انصراف</button></div>
        </div>}
      </section> : <div className="notice final-notice">تصمیم نهایی ثبت شده و این درخواست قابل تأیید یا رد مجدد نیست.{r.status === 'APPROVED_PENDING_TECHNICAL_IMPLEMENTATION' && ' اجرای فنی هنوز انجام نشده است.'}</div>}
      <section className="detail-card"><h2>تاریخچه تصمیم راهبر</h2>{data.history.length === 0 ? <p className="muted">هنوز تصمیمی ثبت نشده است.</p> : data.history.map(h => <div className="history-entry" key={h.id}><strong>{h.decision === 'APPROVED' ? 'تأیید درخواست' : 'رد درخواست'}</strong><p>{h.actor_name} <bdi>({h.actor_username})</bdi> · {dateLabel(h.decided_at)}</p>{h.reason && <p className="reason-full">دلیل رد: {h.reason}</p>}</div>)}</section>
    </>}
  </section></GuideFrame>;
}
