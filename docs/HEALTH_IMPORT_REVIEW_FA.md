# تحویل بازبینی پرونده، سلامت و ورود خانواده‌های قبلی

مبنا: `c9103e409e765ed8a6181859bea5c2869ebc3e20` روی `staging`.
تصمیم‌های صریح تأییدشده کاربر و سند راهبردی جدید بر قواعد متعارض `GUIDE_FINAL_SPEC_FA.md` مقدم‌اند.

## پرونده و رابط کاربری

- ناوبری پرونده شش جایگاه دارد: اطلاعات پایه، معیشت، سلامت و سه حوزه غیرفعال آینده.
- اطلاعات پایه مستقل است؛ فرم عملیاتی حوزه‌ها در آن تکرار نمی‌شود.
- معیشت از همان Workflow و محاسبات قبلی استفاده می‌کند؛ نمایش تاریخی فشرده، جزئیات بازشدنی و ناوبری داخلی ثابت شده است.
- داشبورد سرگروه خلاصه و کارت‌های قابل پیگیری دارد؛ فهرست کامل در صفحه خانواده‌هاست.
- Inbox پیش‌فرض خوانده‌نشده/فعال است؛ اعلان عادی پس از خواندن به سابقه می‌رود. هشدار فعال با خواندن بسته نمی‌شود. شمارنده فقط خوانده‌نشده فعال است.
- قواعد تاریخ شمسی، سن محاسبه‌شده و نامشخص بودن سن بدون تاریخ تولد حفظ شده‌اند. سن قدیمی و Snapshotهای قبلی بازنویسی نمی‌شوند.

## سلامت

غربالگری موجود حفظ شده است. برای پاسخ «دارد»، فرم تخصصی عضو شامل مشکل، شدت/اثر، درمان/پیگیری، هزینه، دسترسی و ارجاع به مدارک موجود است. تغییر به «ندارد» یا «نامشخص»، فرم تخصصی جاری را تاریخی می‌کند؛ داده حذف نمی‌شود.

سرگروه مسئول Draft را تکمیل و ارسال می‌کند. مدیر اجرایی نسخه ثابت ارسال‌شده را تأیید می‌کند یا با دلیل برمی‌گرداند. ارسال مجدد نسخه تازه می‌سازد. بعد از تأیید، ایجاد Draft جدید، نسخه تأییدشده را تغییر نمی‌دهد. شاهد نسخه‌های تأییدشده را فقط می‌خواند.

امتیاز عددی جدید عمداً Deferred است: `score=null`، `max=20`، `PENDING_RULES`. تأیید فعلی، تأیید **محتوا** است. تاریخ انقضای یک‌ساله برای سلامت وجود ندارد. فرمول قبلی در گردش جدید فراخوانی نمی‌شود. جدول دقیق چهار شاخص قدیمی در [HEALTH_SCORING_MAPPING_FA.md](HEALTH_SCORING_MAPPING_FA.md) آمده است.

Audit قبل/بعد در پایگاه داده حفظ می‌شود. تاریخچه عمومی پرونده فقط رویداد سلامت را نمایش می‌دهد تا مسیر عمومی، محدودیت دسترسی فرم تخصصی را دور نزند.

## ورود Excel

قالب رسمی یک Sheet و شش ستون دارد: نام، نام خانوادگی، کد ملی، شماره تماس، جنسیت، تاریخ تولد. فقط دو ستون اول الزامی‌اند. تاریخ تولد متنی شمسی `YYYY/MM/DD` است؛ جنسیت زن/مرد/نامشخص یا خالی. گروه از Context سرگروه گرفته می‌شود؛ فایل و Body نمی‌توانند آن را جایگزین کنند.

مراحل: بارگذاری ← اعتبارسنجی و تکراری ← پیش‌نمایش ← تصمیم صریح ← ورود انتخاب‌شده‌ها در یک Transaction.

- کد ملی یکسان: تکراری قطعی و غیرقابل Override.
- نام و نام خانوادگی همراه با شماره تماس یا تاریخ تولد یکسان: مشکوک؛ تصمیم و دلیل الزامی.
- Merge خودکار، تطبیق فازی یا ورود ارزیابی قدیمی وجود ندارد.
- هر خانواده یک سرپرست اولیه دارد و با «نیازمند تعیین وضعیت» ایجاد می‌شود.
- سرگروه وضعیت را فعال/غیرفعال می‌کند. تکمیل اعضا اقدام صریح است؛ خانواده تک‌نفره مجاز است.
- ایجاد ارزیابی مستلزم فعال بودن و تأیید تکمیل اعضاست؛ تاریخ تولد شرط کامل بودن معیشت نیست.
- ابطال مدیر اجرایی غیرحذفی است: فایل، Batch، ردیف‌ها، شناسه‌ها و Audit باقی می‌مانند و خانواده از کار عملیاتی خارج می‌شود.
- تعیین فعال/غیرفعال به‌تنهایی مانع ابطال نیست. ویرایش پرونده، عضو، سند، ارزیابی، حمایت و مأموریت مانع ابطال‌اند.

## تغییر پایگاه داده و وابستگی

- `0013_health_workflow.sql`: فرم‌های جاری/تاریخی سلامت، بازبینی، ارسال ثابت و تصمیم غیرقابل‌تغییر؛ جدا از قیود معیشت.
- `0014_family_import.sql`: وضعیت اولیه خانواده، Batch/فایل/ردیف و پیگیری تکمیل اعضا و فعالیت عملیاتی؛ بدون حذف یا Reset داده.
- `exceljs@4.4.0`: خواندن و ساخت XLSX و قالب دارای راهنمای ستون‌ها. Dependency جدید فقط در Backend است.
- حدود فنی نسخه اول: XLSX، یک Sheet، حداکثر ۳۰۰۰ ردیف و ۲ مگابایت؛ محدودیت بازکردن فشرده‌سازی نیز قبل از Parser اعمال می‌شود. فایل رمزدار، فرمول و تاریخ عددی Excel رد می‌شوند.
- مجوزهای موجود مرکزی reuse شده‌اند و کنترل نهایی نقش/گروه در Service انجام می‌شود؛ اختیار سازمانی جدید برای پشتیبان فنی ایجاد نشده است.

## آزمون و محدودیت

`tests/health-import-flow.mjs` پایگاه مستقل می‌سازد و API و مرورگر واقعی را برای Workflow سلامت، Snapshot، Audit، Import، Duplicate، ابطال، مجوزها، اعلان‌ها و نمایش واکنش‌گرا بررسی می‌کند. به Regression اصلی اضافه شده است. داده آزمایشی در پایگاه واقعی Seed نمی‌شود.

محدودیت‌های عمدی: فرمول عددی سلامت، دوره بازبینی قابل‌تنظیم، سه حوزه آینده، پذیرش خانواده جدید و Workflow جدید حمایت/مأموریت در این مرحله پیاده نشده‌اند. اگر پس از Preview تکراری جدید در پایگاه ایجاد شود، Confirm رد می‌شود و فایل باید دوباره بررسی/بارگذاری شود. Import نسخه اول جست‌وجوی فازی یا Merge ندارد.

هشدار اندازه Bundle فرانت‌اند در Build باقی است؛ تقسیم گسترده Bundle خارج از دامنه این مرحله است.

## نتیجه اعتبارسنجی نهایی — ۱۴۰۵/۰۷/۰۵

- Regression کامل: **۱۷۷ PASS / صفر FAIL**؛ شامل ۱۶ گروه سناریوی جدید سلامت و Import.
- اجرای مستقل staging: **۵ PASS / صفر FAIL**.
- ناوبری و نمایش تاریخی با API شبیه‌سازی‌شده: **۲ PASS / صفر FAIL**.
- مجموع: **۱۸۴ PASS / صفر FAIL**. این اعداد گروه‌های سناریو هستند؛ آزمون تاریخ به‌تنهایی ۴۹۲ تبدیل رفت‌وبرگشت را نیز بررسی می‌کند.
- Build و Typecheck موفق؛ هشدار غیرمسدودکننده اندازه Bundle باقی است.
- مرورگر واقعی: ذخیره/Refresh، ارسال/بازگشت/تأیید سلامت، نسخه تاریخی، قالب و بارگذاری Excel، Preview/Confirm، تکمیل صریح اعضا، تعیین وضعیت، ابطال، جداسازی مجوزها و Inbox هشدارها موفق‌اند.
- دو Migration روی پایگاه محلی نیز اجرا شدند؛ اثر انگشت **۱۳۳۷ رکورد موجود در ۱۰ جدول** قبل/بعد یکسان بود. هیچ Reset یا Seed روی پایگاه واقعی انجام نشد.
- برنامه محلی در `http://127.0.0.1:5173/login` با Backend جدید آماده شد.
- تغییرات قبلی README و فایل‌های راه‌اندازی محلی در Commit این بسته وارد نمی‌شوند. main و remote تغییر نمی‌کنند.

## فایل‌های این بسته

- `apps/backend/package.json`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/auth/permissions.ts`
- `apps/backend/src/family-import/excel.ts`
- `apps/backend/src/family-import/family-import.module.ts`
- `apps/backend/src/family-import/family-import.service.ts`
- `apps/backend/src/guidance/guidance.service.ts`
- `apps/backend/src/health-screening/health-screening.module.ts`
- `apps/backend/src/health-screening/health-screening.service.ts`
- `apps/backend/src/health-screening/health-workflow.service.ts`
- `apps/backend/src/livelihood/livelihood.service.ts`
- `apps/backend/src/main.ts`
- `apps/backend/src/oversight/oversight.service.ts`
- `apps/backend/src/review/review.service.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/AssessmentDomainTabs.tsx`
- `apps/frontend/src/components/FamilyBase.tsx`
- `apps/frontend/src/components/HealthSpecialized.tsx`
- `apps/frontend/src/components/LivelihoodSnapshot.tsx`
- `apps/frontend/src/pages/FamilyImport.tsx`
- `apps/frontend/src/pages/GuideWorkspace.tsx`
- `apps/frontend/src/pages/HealthAssessment.tsx`
- `apps/frontend/src/pages/LeaderFamily.tsx`
- `apps/frontend/src/pages/LeaderWorkspace.tsx`
- `apps/frontend/src/pages/Livelihood.tsx`
- `apps/frontend/src/pages/RoleWorkspace.css`
- `apps/frontend/src/pages/RoleWorkspace.tsx`
- `apps/frontend/src/pages/WorkspaceNotifications.tsx`
- `docs/HEALTH_IMPORT_REVIEW_FA.md`
- `docs/HEALTH_SCORING_MAPPING_FA.md`
- `migrations/0013_health_workflow.sql`
- `migrations/0014_family_import.sql`
- `pnpm-lock.yaml`
- `scripts/run-regression.mjs`
- `tests/assessment-navigation.mjs`
- `tests/guide-workspace-flow.mjs`
- `tests/health-import-flow.mjs`
- `tests/health-screening-flow.mjs`
- `tests/leader-workspace-flow.mjs`
- `tests/livelihood-flow.mjs`
- `tests/livelihood-vertical-flow.mjs`
- `tests/staging-runtime.mjs`
