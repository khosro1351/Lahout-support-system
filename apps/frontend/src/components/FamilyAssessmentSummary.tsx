import {Link} from 'react-router-dom';
import {digits} from '../pages/vocabulary';
import {PersianDate} from './PersianDate';
const labels:Record<string,string>={VALID:'تأییدشده',PENDING:'ارسال‌شده؛ منتظر تأیید مدیر',DRAFT:'پیش‌نویس در حال تکمیل',READY:'آماده ارسال',RETURNED:'بازگشت برای اصلاح',MODEL_REVIEW_REQUIRED:'نیازمند بازنگری همه حوزه‌ها',NOT_RECORDED:'ارزیابی جامع ثبت نشده'};
export function FamilyAssessmentSummary({assessment:s}:{assessment:any}){
 if(!s)return null;
 const path='/workspace/families/'+s.familyId+'/assessment/review';
 return <section className="panel" aria-label="وضعیت ارزیابی جامع"><h2>ارزیابی جامع خانواده</h2><p role="status">{labels[s.status]} · مدل {digits(s.modelVersion)}</p>
 {s.approved?<p data-testid="approved-family-result">نتیجه تأییدشده: امتیاز {digits(s.approved.result.normalizedScore)} · سطح {s.approved.result.needLevel} · <PersianDate value={s.approved.decided_at}/><Link to={path+'?version='+s.approved.id}> مشاهده نسخه تأییدشده</Link></p>:<p data-testid="approved-family-result">ارزیابی تأییدشده‌ای موجود نیست؛ نتیجه نهایی نامشخص است.</p>}
 {s.pending&&<p>نسخه ارسالی {digits(s.pending.revision)} هنوز تأیید نشده است. <Link to={path+'?version='+s.pending.id}>مشاهده نسخه ارسالی</Link></p>}
 {s.warning&&<p role="note">{s.warning}</p>}
 <Link className="button" to={path}>{s.nextAction==='REVIEW'?'بررسی ارزیابی ارسالی':s.draft?'ادامه ارزیابی در حال تکمیل':s.requiresReview?'بازنگری همه حوزه‌ها با مدل جاری':'مشاهده ارزیابی جامع'}</Link>
 </section>;
}
