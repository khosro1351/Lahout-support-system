export const statuses: Record<string, string> = {
  PENDING_GUIDE_APPROVAL: 'در انتظار تصمیم راهبر',
  APPROVED_PENDING_TECHNICAL_IMPLEMENTATION: 'تأیید شده؛ در انتظار اجرای فنی',
  REJECTED: 'رد شده',
};
export const types: Record<string, string> = {
  CREATE_ACCOUNT: 'ایجاد حساب جدید', ADD_ROLE: 'افزودن نقش', END_ROLE: 'حذف / پایان نقش',
  CHANGE_SCOPE: 'تغییر دامنه دسترسی', REACTIVATE_ACCOUNT: 'فعال‌سازی مجدد حساب',
};
export type AccessRequest = {
  id: string; person_name: string; request_type: string; proposed_role: string | null;
  role_label: string | null; scope_type: string | null; scope_label: string | null;
  reason: string; requester_name: string; requester_username: string;
  requested_at: string; status: string; is_development: boolean;
};
export type Decision = { id: string; decision: string; reason: string | null; decided_at: string; actor_name: string; actor_username: string };
export const dateLabel = (date: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(date));
export const scopeLabel = (r: AccessRequest) => r.scope_label || (r.scope_type === 'ORGANIZATION' ? 'کل سازمان' : r.scope_type === 'GROUP' ? 'گروه' : '—');
