# اصلاح نهایی Pilot — ۱۴۰۵/۰۷/۰۶

## مبنا
Repository: khosro1351/Lahout-support-system
Branch: staging
HEAD قبل: f61a139ad98bc1e0eca9ae80a356b8436520b27a
مرجع: docs/MASTER-SPECIFICATION-FA.md

## تغییرات
- PersianDateInput: تفکیک مقدار تأییدشده والد از انتخاب محلی سال/ماه/روز؛ دریافت مجدد همان مقدار، انتخاب جزئی جدید را بازنشانی نمی‌کند. تبدیل ISO و محاسبه روزهای شمسی موجود reuse شد.
- آزمون مرورگر متصل به PostgreSQL برای شروع از تاریخ خالی، اسفند کبیسه، تغییر تاریخ موجود، رد اسفند نامعتبر، پاک‌کردن و Save/Refresh اضافه شد.
- اقدام ارسال در هدر مشترک هر دو حوزه قرار گرفت؛ در محتوای پایین تکرار نمی‌شود. شرط‌های قبلی کامل‌بودن، ذخیره و Permission حفظ شدند و مسیر «بررسی موارد لازم برای ارسال» روشن است.
- ایجاد/ادامه Draft معیشت در همان هدر قرار گرفت؛ یک ناوبری داخلی حفظ شد. هنگام نمایش تاریخی، Selector نسخه ارسالی حفظ و Selector اضافی حذف شد.
- تاریخچه معیشت پیش‌فرض بسته است؛ Snapshot خانواده هنگام ارسال همچنان بسته و خواندنی است.
- فاصله‌های بالای صفحات، کارت‌های Assessment و تایپوگرافی آیتم‌های هم‌سطح Sidebar هماهنگ شدند.
- داده آزمایشی به Rule دائمی تبدیل نشد؛ شرط نمایشی وابسته به پیشوند HL-TEST از بالای صفحه معیشت حذف شد.

## رفتارهای موجود که تثبیت شدند
اطلاعات پایه فقط داده جاری خانواده و اعضا را نشان می‌دهد؛ شش حوزه در ناوبری، View/Edit صریح، سن فقط DOB و سن نامشخص بدون DOB حفظ شده‌اند.
تعیین وضعیت اولیه در Import و Lifecycle عمومی مدیر اجرایی موجود بودند و منطق آنها تغییر نکرد. آزمون مرورگر اکنون دیده‌شدن فوری خانواده فعال در /leader/families را پیش از تأیید اعضا نیز بررسی می‌کند. Active/Inactive filter مستقل است؛ غیرفعال‌ها و سابقه‌شان در دسترس‌اند.
غیرفعال‌سازی عمومی در پرونده خانواده و فقط برای مدیر اجرایی است. Draft و Submitted معیشت/سلامت حفظ می‌شوند؛ بررسی مدیر طبق Migration 0015 موجود ادامه دارد. Snapshot با تغییر داده جاری بازنویسی نمی‌شود.

## حدود تشخیص تاریخ
در اجرای اولیه روی Build موجود، انتخاب سال/ماه/روز از مقدار خالی بازتولید نشد. بنابراین علت قطعی گزارش دستی ادعا نمی‌شود. اصلاح محدود همگام‌سازی کنترل، همراه با آزمون مسیر واقعی فرم و ذخیره/Refresh، انجام شد. اگر همان رفتار در مرورگر کاربر باقی بماند، نسخه بارگذاری‌شده و توالی دقیق انتخاب باید بررسی شود؛ داده قبلی برای رفع مشکل تغییر داده نشده است.

## Migration و حفاظت
Migration جدید: ندارد.
Backend، مدل عددی معیشت، Permission، Audit و قواعد Snapshot تغییر نکرده‌اند.
آزمون‌های نوشتنی در پایگاه‌های موقت مستقل PostgreSQL اجرا شدند؛ داده واقعی Reset یا Seed نشد.

## اعتبارسنجی
- login: 31 PASS
- access-requests: 22 PASS
- guide-workspace: 24 PASS
- health-import: 19 PASS
- health-screening: 7 PASS
- leader-workspace: 12 PASS
- livelihood: 20 PASS
- livelihood-seed: 9 PASS
- livelihood-vertical: 13 PASS
- roles: 13 PASS
- staging: 5 PASS
- technical-ui: 10 PASS
- persianDate: 4 PASS
- navigation: 2 PASS

Total: 191 PASS / 0 FAIL

- Integration: 73
- Permission: 47
- Browser: 67
- Unit: 4

دسته‌بندی بر اساس موضوع غالب هر سناریوی نام‌گذاری‌شده است؛ سناریوهای ترکیبی فقط یک بار شمرده شده‌اند. این اعداد شمارش assertionها یا تعداد فایل تست نیستند. فهرست سناریوها و دسته‌بندی در test-results/pilot-final-summary.json ثبت شد.
Build و Typecheck: موفق. هشدار غیرمسدودکننده حجم bundle موجود باقی است.
شواهد محلی: test-results/pilot-final-*.log و results.json هر مجموعه.
اعداد، تعداد سناریوهای نام‌گذاری‌شده‌اند؛ هر سناریو می‌تواند چند assertion داشته باشد.

سناریوهای Browser/E2E:
1. تاریخ خالی → سال/ماه → روز فعال → ذخیره → Refresh.
2. تاریخ موجود → تغییر سال/ماه/روز → ذخیره → Refresh؛ منع روز نامعتبر.
3. پاک‌کردن تاریخ اختیاری و حفظ خالی پس از Refresh.
4. Import → فعال → دیده‌شدن فوری در فهرست، بدون Edit/Save و قبل از تأیید اعضا.
5. Active → Inactive → خروج از Active list و دسترسی از فیلتر.
6. Reactivation → بازگشت فوری همان Family.
7. حفظ Draft و Submitted؛ تصمیم مدیر پس از غیرفعال‌سازی.
8. سلامت و معیشت: Returned → اصلاح → ارسال مجدد.
9. حفظ Snapshot تاریخی پس از تغییر اطلاعات پایه.
10. سرگروه، مدیر اجرایی و شاهد؛ Desktop/Tablet/Mobile، RTL و نبود خطای JavaScript.
11. تاریخچه بسته/بازشدنی، Selector نسخه‌ها و ناوبری واحد.

## Deferred و آمادگی
فرمول عددی سلامت و ماژول‌های آینده Deferred باقی ماندند.
در سناریوهای اجراشده Blocker مشاهده نشد؛ محدودیت تشخیص گزارش تاریخ در بخش مربوط صریح آمده است. تأیید نهایی تست دستی کاربر جایگزین نشده است.

## Git و فایل‌ها
- apps/frontend/src/components/PersianDateInput.tsx
- apps/frontend/src/pages/HealthAssessment.tsx
- apps/frontend/src/pages/Livelihood.tsx
- apps/frontend/src/pages/RoleWorkspace.css
- tests/assessment-navigation.mjs
- tests/health-import-flow.mjs
- tests/livelihood-flow.mjs
- docs/PILOT_FINAL_FIXES_FA.md
Commit تحویل همان Commit حاوی این گزارش است؛ hash دقیق در پاسخ نهایی ثبت می‌شود.
main بدون تغییر: e529482129e326a4e32c536bb29420b9b06d47fb.
Push انجام نشده است.
README و فایل‌های راه‌انداز محلی قبلی خارج Commit حفظ می‌شوند؛ Working Tree به همین علت کاملاً خالی نخواهد بود.
