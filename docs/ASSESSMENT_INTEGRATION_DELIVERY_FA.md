# تحویل تثبیت یکپارچگی پرونده و ارزیابی جامع

تاریخ: ۱۴۰۵/۰۷/۱۰ — مبنا: 880a5726e2bb47e0d110c3325ca7e3c11ede5702 — شاخه: staging.

## نتیجه این مرحله

پرونده خانواده ورودی مشترک است؛ اطلاعات پایه و اعضا جاری هستند و پنج حوزه و مرور نهایی به همان موتور جامع متصل‌اند. هیچ فرم ارزیابی دوم ساخته نشده است. مسیرهای قدیمی به موتور واحد هدایت می‌شوند و با پارامتر صریح legacy=1 صرفاً مرجع تاریخی خواندنی دارند. ثبت و تصمیم مستقل در APIهای قدیمی مسدود است؛ Scope و مجوز نقش پیش از عملیات بررسی می‌شود.

قرارداد مشترک familyAssessmentStatus و نوع FamilyAssessmentStatus در apps/backend/src/oversight/family-assessment-status.ts ایجاد شد. API خواندنی GET /api/v1/shared/families/:id/assessment-status و پاسخ‌های پرونده/فهرست/موتور از آن استفاده می‌کنند. این قرارداد Approved، Draft و Submitted را جدا می‌کند و وضعیت پنج حوزه، Applicable/N/A، امتیازها، مجموع خام، سقف، نرمال، سطح نیاز، هشدارها، اقدام بعدی و مدل را برمی‌گرداند. نمای SQL assessment.approved_family_results منبع گزارش‌های معتبر است؛ FINAL به‌تنهایی Approved نیست.

پرونده، فهرست، داشبوردها، صف مدیر، پیگیری و گزارش مرتبط هماهنگ شدند. پس از تغییر موفق، مصرف‌کنندگان داده بازخوانی می‌شوند؛ بازگشت از حوزه به پرونده اصلاح شده است. Document Pipeline در پرونده جاری reuse شده و بدون بازنویسی حفظ شده است.

فعال‌شدن نسخه جدید برای ارزیابی باز هشدار و بازنگری همه پنج حوزه را الزامی می‌کند؛ پاسخ‌های قبلی حذف نمی‌شوند و ارسال ترکیبی مسدود است. خانواده بدون ارزیابی باز خودکار Draft نمی‌گیرد. امتیازها و قواعد پنج حوزه تغییر نکرده‌اند. فعال‌سازی تعریف عددی ناسازگار با موتور نصب‌شده رد می‌شود؛ پشتیبانی از مدل عددی متفاوت نیازمند مأموریت مصوب جداگانه است.

## Migration و داده

0018_assessment_integration.sql غیرمخرب است: دو ستون رهگیری بازنگری Draft، نمای نتیجه Approved، اصلاح منبع نمای گزارش و فعال‌سازی مدل جامع موجود. روی PostgreSQL محلی نیز اعمال شد. شمارش و digest قبل/بعد Snapshotهای جامع، معیشت و سلامت، خانواده‌ها، عضویت‌ها و افراد برابر بودند. هیچ DB reset، حذف یا بازنویسی Snapshot انجام نشد.

## آزمون نهایی

۱۸۴ PASS و صفر FAIL در ۱۲ مجموعه جاری؛ شمارش سناریوهای گزارش‌شده است، نه تعداد تک‌تک assertionها. مجموعه‌ها پس از اصلاح خطاهای اولیه تکمیل و مجموعه‌های متأثر از آخرین اصلاح مجدداً اجرا شدند.

| مجموعه | PASS | FAIL |
|---|---:|---:|
| جامع و E2E | 12 | 0 |
| مرزهای موتور | 24 | 0 |
| مدارک | 12 | 0 |
| Import و Lifecycle | 15 | 0 |
| تاریخ شمسی و سن | 4 | 0 |
| ورود | 31 | 0 |
| درخواست دسترسی | 22 | 0 |
| همیار شاهد و پرونده خواندنی | 20 | 0 |
| نقش‌ها و شبیه‌سازی | 13 | 0 |
| تمامیت سوابق معیشت | 9 | 0 |
| رابط فنی | 10 | 0 |
| سرگروه و ۵۰ پرونده | 12 | 0 |

Build، Build ابزارهای backend، Typecheck و diff check موفق‌اند. هشدار غیرمسدودکننده اندازه bundle فرانت‌اند باقی است؛ Refactor خارج از Scope انجام نشد. سه مجموعه تاریخیِ ثبت مستقل معیشت/سلامت در شمارش جاری نیستند؛ فایل‌ها حفظ شده و جایگزین پوشش آنها در ASSESSMENT_INTEGRATION_TEST_SCOPE_FA.md توضیح داده شده است. عدد PASS این مرحله با گزارش قبلی ۲۴۱ قابل جمع یا مقایسه مستقیم نیست.

Browser/E2E شامل خانواده آموزش Applicable و N/A، ویرایش پایه، همه حوزه‌ها، Draft، Submit/Return/Approve، نتیجه واحد پرونده/فهرست/داشبورد/گزارش، تغییر مدل ارزیابی باز، حفظ Snapshot، Audit اتمیک، مجوز و Scope، مدارک و عرض‌های دسکتاپ/تبلت/موبایل است. آزمون فیزیکی جدید گوشی ادعا نمی‌شود؛ LAN برای آزمون کاربر برقرار است.

## مسیرهای قدیمی

- /workspace/livelihood/:id → حوزه معیشت موتور جامع؛ legacy=1 برای تاریخچه.
- /workspace/health/:id → حوزه سلامت موتور جامع؛ legacy=1 برای تاریخچه.
- /workspace/families/:id/assessments و /guide/families/:id/assessments → موتور جامع؛ legacy=1 برای تاریخچه.
- صف‌های قدیمی مدیر → /executive/comprehensive.

## وضعیت پروژه و کار بعدی

هسته جاری پرونده، اعضا، Import، Lifecycle، مدارک، ارزیابی پنج‌حوزه، گردش جامع و تاریخچه قابل آزمون یکپارچه است. این نتیجه به معنی پایان کل سامانه جامع یا مجوز استقرار عمومی نیست.

ترتیب پیشنهادی ادامه، بدون اجرای Feature جدید در این Commit:

1. پذیرش کاربری همین جریان یکپارچه با پرونده‌های واقعی مجاز و نقش‌های واقعی؛ آزمون دستگاه واقعی موبایل/تبلت و ثبت ایرادهای مشخص.
2. تعیین Backlog مصوب تکمیل عملیات: پذیرش خانواده جدید/پیش‌پرونده، گردش‌های کامل حمایت و درخواست، شورا و تصمیم‌ها، مأموریت/تحقیق، حامیان و منابع مالی. بخش‌هایی از این موضوعات اکنون سابقه/نمای مدیریتی موجود دارند؛ نباید همه را ساخته‌نشده فرض کرد. قبل از هر مرحله، فاصله قابلیت موجود تا فرآیند مصوب همان بخش باید بررسی شود.
3. تکمیل گزارش‌های نهایی و خروجی‌های موردنیاز بهره‌بردار بر مبنای نتیجه Approved واحد؛ فقط مواردی که در پذیرش کاربری کمبودشان روشن شود.
4. آمادگی بهره‌برداری جداگانه: حساب‌های واقعی و مجوز مصوب، سیاست نگهداری مدارک، پشتیبان‌گیری و آزمون Restore دیتابیس و فایل‌ها، پایش خطا و راهنمای عملیاتی. برخی ابزارهای پایش/پشتیبان در UI هنوز Deferred هستند.
5. پس از تأیید نسخه Local، مأموریت مستقل آماده‌سازی Web/Server شامل Hosting، Domain، SSL، DB و ذخیره‌سازی Production و برنامه انتقال؛ در این مرحله انجام نشده است.

Deferred واقعی این مرحله: اجرای فیزیکی دوباره روی دستگاه کاربر و استقرار Production خارج از Scope؛ مدل عددی جدید خارج از مصوبه جاری پیاده نشده است. HEIC طبق سند مرجع همچنان Deferred است. برای درصد پیشرفت کل پروژه، Backlog نهایی و معیار پایان همه ماژول‌ها باید تثبیت شود؛ درصد حدسی اعلام نمی‌شود.

## Git و محیط محلی

Commit فقط شامل فایل‌های این مأموریت است. README.md و docs/LOCAL_STARTUP_FA.txt و docs/LOCAL_STARTUP_VERIFICATION.md خارج از Commit حفظ شده‌اند. main دست‌نخورده است. کاربر در پایان اجازه Push staging به origin در khosro1351/Lahout-support-system را داده است؛ نتیجه Push و hash نهایی پس از اجرای Git در گزارش گفتگو اعلام می‌شود. هیچ Deployment انجام نشده است.

محیط Local با Start-Lahout.cmd و LAN http://192.168.1.8:5175/login ادامه دارد؛ تنظیم راه‌اندازی جدیدی در این مرحله ساخته نشده است.

## فایل‌های این مرحله

- apps/backend/src/health-screening/health-screening.service.ts
- apps/backend/src/health-screening/health-workflow.service.ts
- apps/backend/src/livelihood/livelihood.service.ts
- apps/backend/src/oversight/assessment.service.ts
- apps/backend/src/oversight/comprehensive-assessment.service.ts
- apps/backend/src/oversight/legacy-assessment.ts
- apps/backend/src/oversight/oversight.module.ts
- apps/backend/src/oversight/oversight.service.ts
- apps/frontend/src/App.tsx
- apps/frontend/src/api/client.ts
- apps/frontend/src/components/AssessmentDomainTabs.tsx
- apps/frontend/src/components/LegacyAssessmentGate.tsx
- apps/frontend/src/components/rolePresentation.ts
- apps/frontend/src/pages/ComprehensiveAssessment.tsx
- apps/frontend/src/pages/GuideSlice.tsx
- apps/frontend/src/pages/GuideWorkspace.tsx
- apps/frontend/src/pages/LeaderFamily.tsx
- apps/frontend/src/pages/LeaderWorkspace.tsx
- apps/frontend/src/pages/Livelihood.tsx
- apps/frontend/src/pages/RoleWorkspace.tsx
- docs/MASTER-SPECIFICATION-FA.md
- scripts/run-regression.mjs
- tests/comprehensive-flow.mjs
- tests/documents-flow.mjs
- tests/family-read-slice.mjs
- tests/guide-workspace-flow.mjs
- tests/health-import-flow.mjs
- tests/leader-workspace-flow.mjs
- tests/livelihood-seed-flow.mjs
- tests/roles-flow.mjs
- tests/technical-ui-flow.mjs
- apps/backend/src/oversight/family-assessment-status.ts
- apps/frontend/src/components/FamilyAssessmentSummary.tsx
- docs/ASSESSMENT_INTEGRATION_IMPACT_FA.md
- docs/ASSESSMENT_INTEGRATION_TEST_SCOPE_FA.md
- migrations/0018_assessment_integration.sql
- docs/ASSESSMENT_INTEGRATION_DELIVERY_FA.md
