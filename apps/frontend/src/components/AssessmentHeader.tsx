import type {ReactNode} from 'react';
import {AssessmentDomainTabs} from './AssessmentDomainTabs';
import {familyStates} from './familyVocabulary';
export function AssessmentHeader({familyId,familyCode,familyStatus,status,mode,reason,children}:{familyId:string;familyCode?:string;familyStatus?:string;status:ReactNode;mode:string;reason?:string;children?:ReactNode}){
 return <><AssessmentDomainTabs familyId={familyId}/><section className="panel assessment-header"><div><bdi>{familyCode}</bdi><span className="leader-status">{status}</span><p className="quiet-state">{mode}</p></div>{reason&&<p className="error-banner">دلیل بازگشت: {reason}</p>}{familyStatus&&familyStatus!=='ACTIVE'&&<p className="family-edit-banner">وضعیت فعلی خانواده: {familyStates[familyStatus]??'غیرفعال'}؛ نسخه و سوابق محفوظ‌اند. نسخه ارسالی همچنان قابل بررسی مدیر اجرایی است.</p>}{children&&<div className="workspace-actions">{children}</div>}</section></>;
}
