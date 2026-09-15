import { Link } from 'react-router-dom';
import { GuideFrame } from '../components/GuideFrame';
const later = [
  ['گروه‌ها و سرگروه‌ها', 'ساختار گروه‌ها و مسئولیت سرگروه‌ها'],
  ['مجوزها و دستورات راهبری', 'مجوزها و دستورات راهبر عالی'],
  ['اقدامات فوری', 'پیگیری اقدام‌های ضروری'],
  ['مصوبات و بازنگری', 'مرور مصوبات و درخواست‌های بازنگری'],
  ['هشدارهای مهم', 'موارد مهم نیازمند توجه راهبر'],
];
export function GuidePage() {
  return <GuideFrame><section className="guide-content">
    <div className="page-heading"><div><span className="eyebrow form-eyebrow">میز کار راهبر</span><h1>صفحه اصلی راهبر عالی</h1><p>به لاهوت خوش آمدید. مسیر مورد نظر را انتخاب کنید.</p></div><span className="workspace-label">کانون مهربانی همیاران لاهوت</span></div>
    <div className="guide-menu">
      <Link className="menu-card active-menu" to="/guide/access-requests"><span className="menu-icon" aria-hidden="true">۱</span><span className="menu-state">فعال</span><h2>درخواست‌های دسترسی</h2><p>بررسی و تصمیم‌گیری درباره ایجاد یا تغییر دسترسی سازمانی</p><span className="menu-open">مشاهده درخواست‌ها <span aria-hidden="true">←</span></span></Link>
      {later.map(([title, description], i) => <div className="menu-card disabled-menu" aria-disabled="true" key={title}><span className="menu-icon" aria-hidden="true">{(i + 2).toLocaleString('fa-IR')}</span><span className="menu-state">در مراحل بعد</span><h2>{title}</h2><p>{description}</p><span className="menu-open">فعلاً غیرفعال</span></div>)}
    </div>
  </section></GuideFrame>;
}
