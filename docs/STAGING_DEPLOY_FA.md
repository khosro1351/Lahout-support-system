# راهنمای استقرار Staging — بدون ایجاد سرویس در این مرحله

## وضعیت و طرح قابل اجرا

Render Blueprint در `render.yaml` برای یک Web Service با Node 24 و یک PostgreSQL 17 مستقل آماده است. سرویس از Repository خصوصی `khosro1351/Lahout-support-system` و فقط branch `staging` استفاده می‌کند. Frontend کامپایل‌شده و Backend یک Origin دارند؛ بنابراین Session به Cookie بین دامنه‌ای وابسته نیست. پایگاه فقط از شبکه داخلی Render قابل دسترسی تنظیم شده است. این فایل با Apply منابع هزینه‌دار می‌سازد؛ مالک فعلاً هزینه را تأیید نکرده است. تا تأیید تازه، Apply/ایجاد سرویس انجام نشود.

طرح پیشنهادی: Web با 512MB، پایگاه 256MB و 1GB دیسک، Frankfurt. قیمت پایه اعلام‌شده هنگام بررسی حدود ۷ دلار Web و ۶ دلار PostgreSQL در ماه، به‌علاوه دیسک/مصرف/مالیات احتمالی است؛ مبلغ دقیق را قبل از Apply در داشبورد کنترل کنید. این برآورد سقف هزینه نیست. پلن رایگان دیتابیس Render پس از ۳۰ روز منقضی می‌شود؛ بنابراین برای Staging پایدار پیش‌فرض انتخاب نشده است.

منابع رسمی: https://render.com/docs/blueprint-spec ، https://render.com/docs/deploys ، https://render.com/docs/postgresql-extensions ، https://render.com/pricing ، https://render.com/docs/free .

## اقدامات حداقلی پس از تأیید هزینه

1. انتشار Git ابتدا باید تکمیل شود؛ تا زمانی که فایل render.yaml و workflow در branch staging روی GitHub دیده نشده‌اند، Deploy نکنید.
2. در Render با حساب خود وارد شوید. GitHub را Connect کنید و دسترسی فقط همین Repository خصوصی را به برنامه Render بدهید. عمومی‌کردن Repository لازم نیست. رمز/Token را در چت یا Git قرار ندهید.
3. New → Blueprint؛ همین Repository را انتخاب کنید، branch فایل Blueprint را `staging` بگذارید و مسیر `render.yaml` را انتخاب کنید. پروژه/محیط را Staging بنامید؛ نیاز به محیط Production نداریم.
4. پیش از Apply طرح، منطقه، دیسک و برآورد ماهانه را بررسی کنید. فقط بعد از تأیید هزینه توسط مالک Apply کنید. در ورودی محرمانه `STAGING_GUIDE_PASSWORD` یک رمز اختصاصی تصادفی حداقل ۱۶ کاراکتری تعیین و در Password Manager خود نگهداری کنید؛ همان رمز برای ورود Aseman در Staging است.
5. DATABASE_URL خودکار از پایگاه تازه به سرویس تزریق می‌شود. نه DATABASE_URL محلی و نه Backup واقعی را وارد نکنید. RENDER_EXTERNAL_URL توسط Render تنظیم می‌شود؛ برای دامنه پیش‌فرض نیاز به واردکردن FRONTEND_ORIGIN نیست.
6. GitHub Actions باید سبز باشد. Blueprint روی `autoDeployTrigger: checksPass` تنظیم شده؛ در Render نیز After CI Checks Pass را کنترل کنید. ساخت اولیه Blueprint ممکن است Deploy اولیه را شروع کند، پس فقط از Commit با CI سبز Apply کنید.
7. Build/Pre-deploy/Start را در Events و Logs ببینید. Pre-deploy هشت Migration و داده مصنوعی را در پایگاه مخصوص staging اجرا می‌کند. خطا باعث توقف Deploy می‌شود؛ اطلاعات اتصال در خروجی اسکریپت آماده‌سازی چاپ نمی‌شود.
8. آدرس HTTPS واقعی داده‌شده توسط Render را باز کنید؛ مسیر ورود `/login` است. نوار «محیط آزمایشی — فقط داده‌های ساختگی» باید دیده شود. Username: `Aseman`، رمز: Secret تعیین‌شده در مرحله ۴. پس از اولین راه‌اندازی موفق STAGING_SEED_ENABLED را false کنید و Save/Redeploy انجام دهید؛ Migrationها همچنان در هر Deploy اجرا می‌شوند.
9. از کامپیوتر و گوشی با Wi-Fi و اینترنت موبایل وارد شوید. Login، Dashboard، افراد، گروه، پرونده خانواده، فرم فقط‌خواندنی، گزارش و Excel را آزمایش کنید. آدرس آماده‌بودن `/api/v1/health/ready` باید `postgres: ok` بدهد. تا این بررسی واقعی انجام نشده، محیط آنلاین تحویل‌شده محسوب نمی‌شود.

## متغیرهای محیطی

| نام | محل/کاربرد |
| --- | --- |
| APP_ENV=staging | runtime؛ Production نیست |
| NODE_VERSION=24.21.0 | انتخاب Node |
| NODE_ENV=production | اجرای Build بهینه؛ به معنی محیط Production کسب‌وکار نیست |
| VITE_APP_ENV=staging | زمان Build؛ نشان آزمایشی، بدون Secret |
| DATABASE_URL | اتصال داخلی پایگاه از Blueprint؛ Secret |
| STAGING_GUIDE_PASSWORD | ورودی محرمانه مالک؛ فقط ساخت اولیه Aseman |
| STAGING_SEED_ENABLED | true برای ساخت داده مصنوعی؛ سپس false |
| STAGING_FIXTURE_PASSWORD | اختیاری و جداگانه برای حساب‌های مصنوعی نقش‌ها؛ در نبود آن تصادفی و چاپ‌نشده است |
| COOKIE_SECURE=true | Cookie امن؛ Launcher نیز آن را اعمال می‌کند |
| SESSION_TTL_HOURS=12 | طول نشست |
| PORT / RENDER_EXTERNAL_URL | خودکار توسط Render |
| FRONTEND_ORIGIN | فقط برای دامنه سفارشی: Origin دقیق HTTPS بدون slash انتهایی |

Session Secret ثابت در این برنامه وجود ندارد؛ Token نشست تصادفی و Hash آن در PostgreSQL نگهداری می‌شود. هیچ متغیر محرمانه‌ای نباید پیشوند VITE_ داشته باشد. تغییر STAGING_GUIDE_PASSWORD پس از ساخت حساب، رمز موجود را Reset نمی‌کند؛ برای جلوگیری از بازنویسی تصادفی عمداً چنین است. پس رمز را در Password Manager نگه دارید.

## فرمان‌های سرویس

Build:
```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile --prod=false
pnpm typecheck
pnpm build
pnpm build:tools
```

Pre-deploy: `node scripts/prepare-staging.mjs`

Start: `node scripts/start-staging.mjs`

همه از ریشه Repository. فایل .env در سرور لازم نیست. Launcher پورت Render را روی 0.0.0.0 باز می‌کند و FRONTEND_ORIGIN را از URL سرویس می‌گیرد. تنها Build رابط از apps/frontend/dist ارائه می‌شود؛ فایل Source، .env و مسیر API ناموجود به HTML تبدیل نمی‌شوند.

## CI و نسخه بعدی

Workflow `.github/workflows/validate.yml` روی Push و PR برای main/staging اجرا می‌شود: نصب قفل‌شده، typecheck، Build هر دو بخش، ابزار Migration، Chromium و تمام تست‌ها با PostgreSQL 17 جدا، سپس تست بسته Staging. داده CI فقط مصنوعی است؛ Artifact و Secret منتشر نمی‌شود. PostgreSQL CI با trust فقط در runner موقت استفاده می‌شود، نه در محیط Staging. Build ناموفق یا تست ناموفق نباید Deploy شود.

```sh
git fetch origin
git switch staging
git pull --ff-only origin staging
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm test:staging
git add <reviewed-files>
git commit -m "feat: describe the tested change"
git push origin staging
```

پس از CI سبز، Render همان staging را Build و Deploy می‌کند. در داشبورد Render شناسه Commit مستقر را با GitHub تطبیق دهید. تأیید مالک روی Staging لازم است؛ سپس PR از staging به main و Merge معمولی انجام شود. Force Push، Reset تاریخچه و Push روزمره توسعه به main مجاز نیست.

## مبنا و انتشار شاخه

main روی `e529482129e326a4e32c536bb29420b9b06d47fb` با GitHub همگام است. staging از همین Commit ساخته شده و فقط آماده‌سازی مصوب استقرار را اضافه می‌کند. main در این مرحله تغییر نمی‌کند. برای مشاهده شناسه فعلی staging به GitHub → Branches مراجعه کنید. در صورت نبود Credential در Git CLI، اتصال مجاز GitHub می‌تواند Tree تست‌شده را با parent همین main منتشر کند؛ شناسه نهایی GitHub مرجع است و باید با نسخه محلی تطبیق داده شود. Force Push یا بازنویسی تاریخچه لازم نیست.

## Log و Rollback

Render → Web Service → Logs برای runtime؛ Events → Deploy برای Build/Pre-deploy. GitHub → Actions برای نتایج CI. رمز یا URL دیتابیس را برای رفع اشکال در Issue کپی نکنید. برای Rollback کد، در Render یک Deploy موفق قبلی را انتخاب کنید و Auto-deploy را موقتاً خاموش کنید؛ سپس اصلاح/revert معمولی را در staging Commit کنید و پس از تست دوباره فعال کنید. Rollback کد Migration را برنمی‌گرداند. پایگاه نیاز به Backup جدا دارد؛ Schema برگشت‌ناپذیر با حذف Migration اصلاح نمی‌شود و باید Migration افزایشی سازگار یا بازیابی کنترل‌شده انجام شود.

## محدودیت‌ها

فعلاً حساب Render متصل و سرویس ایجاد نشده، هزینه تأیید نشده، نتیجه CI در GitHub Actions قابل بررسی است؛ HTTPS عمومی/Wi-Fi/اینترنت موبایل هنوز اجرا نشده‌اند. تست‌های محلی Desktop/Tablet/Mobile شبیه‌سازی viewport هستند. PDF گزارش جدید عمداً غیرفعال است؛ Excel واقعی و پیش‌نمایش چاپ حفظ شده‌اند. Production، داشبورد کامل سرگروه و تصمیم کسب‌وکاری جدید ساخته نشده است.
