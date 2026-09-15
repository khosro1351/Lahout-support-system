import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GuideFrame } from '../components/GuideFrame';
import { api, ApiError } from '../api/client';
import { type AccessRequest, statuses, types, dateLabel, scopeLabel } from './access-types';

export function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api<{ requests: AccessRequest[] }>('/access-requests').then(data => { if (active) setRequests(data.requests); })
      .catch(e => { if (active) setError(e instanceof ApiError ? e.message : 'دریافت درخواست‌ها انجام نشد. دوباره تلاش کنید.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const visible = requests.filter(r => filter === 'ALL' || r.status === filter);
  return <GuideFrame><section className="guide-content">
    <Link className="back-link" to="/guide">صفحه اصلی راهبر</Link>
    <div className="page-heading"><div><span className="eyebrow form-eyebrow">بررسی و تصمیم‌گیری</span><h1>درخواست‌های دسترسی</h1><p>درخواست‌های سازمانی ایجاد و تغییر دسترسی را بررسی کنید.</p></div></div>
    <div className="notice">تأیید راهبر به معنی ایجاد حساب یا اعمال دسترسی نیست؛ اجرای فنی در مرحله بعد انجام می‌شود.</div>
    <div className="list-toolbar"><label htmlFor="status-filter">وضعیت درخواست</label><select id="status-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">همه وضعیت‌ها</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{!loading && !error && <span>{visible.length.toLocaleString('fa-IR')} درخواست</span>}</div>
    {loading ? <p role="status">در حال دریافت درخواست‌ها…</p> : error ? <div className="error-banner" role="alert">{error} <button className="secondary" onClick={() => setRetry(x => x + 1)}>تلاش دوباره</button></div> : visible.length === 0 ? <div className="empty-state">درخواستی با این وضعیت وجود ندارد.</div> :
      <div className="request-list">{visible.map(r => <article className="request-row" key={r.id}>
        <div className="request-title"><div><h2><Link to={'/guide/access-requests/' + r.id}>{r.person_name}</Link></h2><span className="request-type">{types[r.request_type]}</span></div><div className="badges">{r.is_development && <span className="dev-badge">آزمایشی · Development/Test</span>}<span className={'status-badge status-' + r.status}>{statuses[r.status]}</span></div></div>
        <dl className="request-meta"><div><dt>نقش پیشنهادی</dt><dd>{r.role_label || '—'}</dd></div><div><dt>دامنه دسترسی</dt><dd>{scopeLabel(r)}</dd></div><div><dt>درخواست‌کننده</dt><dd>{r.requester_name} <bdi>({r.requester_username})</bdi></dd></div><div><dt>تاریخ · تهران</dt><dd>{dateLabel(r.requested_at)}</dd></div></dl>
        <p className="request-reason">{r.reason}</p><Link className="detail-link" to={'/guide/access-requests/' + r.id}>مشاهده جزئیات <span aria-hidden="true">←</span></Link>
      </article>)}</div>}
  </section></GuideFrame>;
}
