# وضعیت آماده‌سازی Staging — ۲۰۲۶/۰۹/۲۰

طبق تصمیم مالک، فعلاً فقط آماده‌سازی انجام شد؛ هزینه تأیید نشده و هیچ سرویس آنلاین ایجاد نشده است.

## Git

مبنا: `e529482129e326a4e32c536bb29420b9b06d47fb`. در بررسی GitHub، main دقیقاً روی همین Commit و تنها شاخه ریموت بود. staging تازه از همین مبنا ساخته شده است؛ آماده‌سازی قدیمی محلی با نام archive/staging-preparation-2c1360f محفوظ است و منتشر نمی‌شود.
Repository خصوصی: https://github.com/khosro1351/Lahout-support-system . فقط staging مقصد انتشار این مرحله است؛ main تغییر نمی‌کند. نتیجه نهایی انتشار و Hash با Ref شاخه GitHub تطبیق داده می‌شود.

## بررسی‌های موفق

- نصب frozen-lockfile، Typecheck، Build فرانت‌اند/بک‌اند و ابزار Migration: PASS.
- ورود ۳۱، Access Requests بیست‌ودو، راهبر/ارزیابی/Responsive نوزده، بسته Staging پنج: **۷۷ PASS، صفر FAIL نهایی**.
- خطای اولیه پاسخ فایل ناموجود در سرویس Static اصلاح و تست مرتبط دوباره موفق شد.
- PostgreSQL واقعی، هشت Migration موجود، Seed مصنوعی تکرارپذیر؛ هیچ Migration جدید یا تغییر در مدل امتیازدهی/فرم مصوب ایجاد نشده است.
- آزمون Staging محلی: منع Production/پایگاه نامناسب، پایگاه مستقل، حفظ رمز موجود، Launcher و Health، فایل‌های Build و Deep Link، منع فایل خصوصی، ورود و Cookie امن.
- مرورگر در عرض‌های ۱۴۴۰، ۷۶۸، ۳۹۰: ورود، داشبورد، افراد، گروه، خانواده و Workspace، فرم راهبر/سرگروه، گزارش و Access Requests بدون overflow افقی صفحه.
- Excel و پیش‌نمایش چاپ در Regression بررسی شدند؛ PDF همچنان غیرفعال است و تولید PDF ادعا نمی‌شود.
- render.yaml با JSON Schema رسمی Render و YAML گردش CI بررسی شد. نتیجه CI آنلاین در Actions همان Commit جداگانه بررسی می‌شود.

## فایل‌ها و راه‌اندازی

render.yaml، .github/workflows/validate.yml، scripts/start-staging.mjs، scripts/prepare-staging.mjs، tests/staging-runtime.mjs و apps/backend/src/common/static-ui.ts اضافه شدند. Host/Port، محافظ HTTPS، ارائه Build از Backend و نشان محیط آزمایشی تنظیم شدند. .gitignore بازبینی شده و داده خصوصی/Artifact را خارج می‌کند.
مراحل اتصال Repository خصوصی، Secretها، PostgreSQL، Migration، Build/Start، Logs، Rollback و Deploy بعدی در [راهنمای استقرار](STAGING_DEPLOY_FA.md) آمده‌اند.

## باقی‌مانده

تاریخچه main همگام شده و Merge دو تاریخچه دیگر لازم نیست. CI آنلاین باید پس از انتشار در GitHub بررسی شود. اتصال Render و ایجاد منابع فقط پس از تأیید هزینه آینده انجام می‌شود.
URL Staging/Login، PostgreSQL آنلاین، Migration آنلاین و حساب آنلاین هنوز ایجاد نشده‌اند. HTTPS عمومی و دستگاه واقعی با Wi-Fi/اینترنت موبایل تست نشده‌اند؛ آزمون فعلی روی Windows و viewport مرورگر بوده است. نتیجه Linux CI را باید در Actions همان Commit مشاهده کرد.
Username آینده Staging برابر Aseman و رمز فقط از STAGING_GUIDE_PASSWORD در Secret سرویس خواهد بود؛ رمز داخل Git نیست. این آماده‌سازی، تحویل محیط آنلاین محسوب نمی‌شود.
