# گزارش تثبیت Pilot — ۱۴۰۵/۰۷/۰۶

## مبنا و تحویل
- Repository: khosro1351/Lahout-support-system
- Branch: staging
- HEAD قبل: e5af0c13a7112e472d0f976124eddded357ba0e6
- Commit تحویل: Commit حاوی همین گزارش؛ شناسه دقیق در پاسخ تحویل و git log ثبت می‌شود.
- main بدون تغییر: e529482129e326a4e32c536bb29420b9b06d47fb
- Push انجام نشده است. تغییرات راه‌انداز محلی و README از این Commit خارج‌اند.

## مرجع و معماری
سند تفصیلی docs/MASTER-SPECIFICATION-FA.md مرجع مقدم تصمیم‌های مصوب است؛ اسناد قبلی حفظ شده‌اند. بازاستفاده از سرویس، Permission، Audit و کنترل‌های موجود انجام شد. Dependency جدیدی اضافه نشد.

فهرست عمومی خانواده از صف ارزیابی جدا شد؛ خانواده فعال واردشده بلافاصله دیده می‌شود، حتی وقتی تأیید تکمیل اعضا هنوز انجام نشده است. صلاحیت شروع ارزیابی همچنان نیازمند تأیید صریح اعضاست. داشبورد خلاصه، فهرست مستقل خانواده، فیلتر وضعیت، فهرست سلامت و پیگیری‌های دو حوزه هماهنگ شدند.

ناوبری مشترک پرونده و هدر ارزیابی، حالت مشاهده/ویرایش، دلیل برگشت و اقدام بعدی مشخص‌اند. معیشت به بخش‌های کوتاه درآمد، اشتغال، هزینه، شواهد، جمع‌بندی و نتیجه تقسیم شد. کنترل گزینه‌های رایج/سایر متن‌های قبلی را حفظ می‌کند. فاصله‌ها و سرریز عرض تبلت اصلاح شد.

## Permission و Lifecycle
- سرگروه: تعیین وضعیت اولیه فقط از NEEDS_CLASSIFICATION و در گروه خود؛ تغییر مجدد عمومی مجاز نیست.
- مدیر اجرایی: تغییر وضعیت عمومی و فعال‌سازی مجدد با دلیل، کنترل نسخه، Actor، Timestamp و Audit؛ ابطال Batch طبق قواعد موجود.
- همیار شاهد: Read-only مدیریتی.
- غیرفعال‌سازی هیچ Draft یا Snapshot را حذف/بسته نمی‌کند؛ نسخه ارسال‌شده همچنان توسط مدیر قابل تأیید/برگشت است و وضعیت جاری خانواده جداگانه نمایش داده می‌شود.
- فعال‌سازی مجدد همان Family Record را به فهرست برمی‌گرداند؛ Batch باطل‌شده قابل فعال‌سازی نیست.

## Import و تاریخچه
Timestamp انتقال از زمان واقعی ایجاد Family در Confirm خوانده و شمسی نمایش داده می‌شود؛ قابل ویرایش دستی نیست. فیلتر غیرفعال/همه تاریخچه را در دسترس نگه می‌دارد. تعیین وضعیت به‌تنهایی فعالیت مسدودکننده Rollback نیست؛ ویرایش عملیاتی و ارزیابی همچنان مسدودکننده‌اند.

Snapshotهای تاریخی بازنویسی نشده‌اند. سن جاری فقط از DOB است؛ بدون DOB نامشخص می‌ماند و به‌تنهایی مانع ارسال معیشت نیست. داده سن تاریخی حفظ می‌شود.

## Migration
0015_import_submitted_review.sql: اصلاح محدود تابع موجود track_activity برای ادامه بررسی نسخه‌ای که پیش از غیرفعال‌سازی ارسال شده است؛ شروع ارزیابی جدید خانواده Import‌شده همچنان نیازمند فعال‌بودن و تأیید اعضاست. هیچ Reset یا بازنویسی داده ندارد.

Migration روی پایگاه محلی موجود اعمال شد. مقایسه قبل/بعد در ۱۵ جدول، ۱۳۹۷ رکورد را بدون تغییر محتوا تأیید کرد؛ شواهد محلی: test-results/pilot-data-preservation.json. آزمون‌ها در پایگاه‌های جداگانه اجرا شدند.

## اعتبارسنجی
- login: 31 PASS / 0 FAIL
- access-requests: 22 PASS / 0 FAIL
- guide-workspace: 24 PASS / 0 FAIL
- health-import: 19 PASS / 0 FAIL
- health-screening: 7 PASS / 0 FAIL
- leader-workspace: 12 PASS / 0 FAIL
- livelihood: 17 PASS / 0 FAIL
- livelihood-seed: 9 PASS / 0 FAIL
- livelihood-vertical: 13 PASS / 0 FAIL
- roles: 13 PASS / 0 FAIL
- staging: 5 PASS / 0 FAIL
- technical-ui: 10 PASS / 0 FAIL
- Persian date: 4 PASS (including 492 round trips)
- Assessment navigation: 2 PASS
- Total: 188 PASS / 0 FAIL

Build کامل Backend/Frontend و Typecheck موفق‌اند؛ آخرین Build فرانت‌اند نیز موفق است. هشدار غیرمسدودکننده حجم bundle بالاتر از ۵۰۰ کیلوبایت باقی است. اصلاح نهایی تنها انتظار عنوان صفحه در آزمون بود و نیاز به Build مجدد نداشت.

Browser/E2E پوشش داد:
- سرگروه: Import، تعیین وضعیت، نمایش فوری، تکمیل اعضا، ویرایش پایه و حفظ پس از Refresh، ارسال/اصلاح معیشت و سلامت.
- مدیر اجرایی: صف، برگشت با دلیل، تأیید، Lifecycle، بررسی نسخه Submitted خانواده غیرفعال و فعال‌سازی مجدد.
- همیار شاهد: مشاهده مدیریتی و ممنوعیت ویرایش.
- Snapshot ثابت، سابقه نسخه‌ها، کنترل همزمانی و اتمیک‌بودن تصمیم/Audit/اعلان.
- اعلان معمولی خوانده‌شده از Inbox خارج می‌شود؛ هشدار فعال با صرف خواندن بسته نمی‌شود.
- مسیرهای فهرست، پرونده، Import، معیشت، سلامت، اعلان و پیگیری در عرض‌های نماینده Desktop/Tablet/Mobile، RTL و نبود خطای JavaScript.
- انتخاب گروه آزمایشی و محدوده نقش‌ها در Regression فنی.

نتایج نهایی هر مجموعه مبنا هستند؛ اجراهای ناموفق میانی ناشی از انتظار عنوان قدیمی و سرویس محلی خاموش رفع شده‌اند. آزمون‌های موفق بدون دلیل دوباره اجرا نشده‌اند.

## آمادگی و Deferred
برای Pilot کنترل‌شده همین Scope، بر اساس آزمون‌های محلی، Blocker شناخته‌شده باقی نمانده است. این نتیجه به معنای استقرار یا تأیید محیط Production نیست.
امتیازدهی عددی سلامت همچنان PENDING_RULES و بدون فرمول جدید است؛ تأیید سلامت تأیید محتوایی است، نه تأیید امتیاز نهایی. دوره یک‌ساله سلامت Hard-code نشده است.
PreCase، Council، Mission، Support، Funding، Sponsors و حوزه‌های آینده خارج Scope هستند.

## فایل‌های این بسته
- apps/backend/src/family-import/family-import.service.ts
- apps/backend/src/health-screening/health-workflow.service.ts
- apps/backend/src/livelihood/livelihood.module.ts
- apps/backend/src/livelihood/livelihood.service.ts
- apps/frontend/src/App.tsx
- apps/frontend/src/components/FamilyBase.tsx
- apps/frontend/src/components/HealthSpecialized.tsx
- apps/frontend/src/components/WorkspaceNavigation.tsx
- apps/frontend/src/components/rolePresentation.ts
- apps/frontend/src/pages/FamilyImport.tsx
- apps/frontend/src/pages/GuideWorkspace.tsx
- apps/frontend/src/pages/HealthAssessment.tsx
- apps/frontend/src/pages/LeaderWorkspace.tsx
- apps/frontend/src/pages/Livelihood.tsx
- apps/frontend/src/pages/LivelihoodReview.tsx
- apps/frontend/src/pages/RoleWorkspace.css
- apps/frontend/src/pages/RoleWorkspace.tsx
- tests/assessment-navigation.mjs
- tests/guide-workspace-flow.mjs
- tests/health-import-flow.mjs
- tests/health-screening-flow.mjs
- tests/leader-workspace-flow.mjs
- tests/livelihood-flow.mjs
- tests/livelihood-seed-flow.mjs
- tests/livelihood-vertical-flow.mjs
- tests/staging-runtime.mjs
- apps/backend/src/health-screening/health.schema.ts
- apps/frontend/src/components/AssessmentHeader.tsx
- apps/frontend/src/components/ChoiceOrOther.tsx
- apps/frontend/src/components/familyVocabulary.ts
- docs/MASTER-SPECIFICATION-FA.md
- migrations/0015_import_submitted_review.sql
- docs/PILOT_STABILIZATION_FA.md

## وضعیت Git پس از تحویل
Commit مستقل فقط برای فایل‌های بالا ساخته می‌شود. README.md، Start-Lahout.cmd، docs/LOCAL_STARTUP_FA.txt، docs/LOCAL_STARTUP_VERIFICATION.md، scripts/Start-Local.ps1 و scripts/local-runtime.mjs مربوط به کار محلی قبلی‌اند و عمداً خارج Commit باقی می‌مانند؛ بنابراین Working Tree کاملاً خالی نخواهد بود.
