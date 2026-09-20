> **GitHub → Staging (هنوز Deploy نشده)**
>
> مبنای تأییدشده `e529482129e326a4e32c536bb29420b9b06d47fb` است. تنظیمات Render و CI روی شاخه `staging` از مبنای دقیق main آماده شده‌اند. هیچ سرویس هزینه‌داری ایجاد نشده؛ URL آنلاین هنوز نداریم. مراحل دقیق: [راهنمای استقرار](docs/STAGING_DEPLOY_FA.md)، وضعیت واقعی: [گزارش آماده‌سازی](docs/STAGING_READINESS_FA.md).
>
> سامانه مدیریت حمایت با رابط React/TypeScript/Vite، API مبتنی بر NestJS/Fastify و PostgreSQL 17 است. در Local، Vite درخواست API را به بک‌اند می‌فرستد. در Staging همان بک‌اند، فایل‌های Build رابط را نیز از یک Origin ارائه می‌کند؛ HTTPS در Render و داده‌ها در PostgreSQL مستقل نگهداری می‌شوند. هیچ موتور امتیازدهی یا Business Rule در این مرحله تغییر نکرده است.
>
> `main`: نسخه پایدار تأییدشده؛ `staging`: توسعه و تست آنلاین. تغییر بعدی ابتدا روی staging تست می‌شود؛ انتقال به main فقط پس از تأیید مالک. Production هنوز ایجاد نشده است.

> **مرحله جاری: بازبینی نهایی راهبر و فرم مشترک ارزیابی**
>
> مبنا: `095f1ec780433503f10b6e27bca68c8c673e5d1f`. مشخصات در docs/GUIDE_FINAL_SPEC_FA.md و گزارش فعلی در [گزارش تحویل](docs/GUIDE_FINAL_DELIVERY_FA.md) است. گزارش‌های قبلی تاریخی هستند.
>
> هشت Migration افزایشی داریم. داشبورد چهار حوزه نظارتی دارد؛ فرم پنج‌حوزه‌ای سرگروه و نمایش فقط‌خواندنی راهبر مشترک است. امتیازدهی مدل 1.0 مطابق جدول مصوب، نسخه‌دار و سمت سرور است. خروجی Excel و پیش‌نمایش چاپ فعال؛ PDF فعلاً غیرفعال است.
>
> ارتقا: پشتیبان PostgreSQL بگیرید؛ سرویس‌ها را متوقف کنید؛ `pnpm install --frozen-lockfile`، `pnpm build` و `pnpm db:migrate` را اجرا کنید. سپس سرویس‌ها را راه‌اندازی کنید. افزونه‌های استاندارد pgcrypto، pg_trgm و btree_gist لازم‌اند. هیچ Migration داده قبلی را Reset نمی‌کند.
>
> Seed تعاملی زیر رمز توسعه را محلی می‌پرسد. راهبر: Aseman؛ سرگروه‌های نمونه: ReviewLeader1 تا ReviewLeader3؛ همیارها: ReviewHelper11، ReviewHelper12، ReviewHelper21، ReviewHelper22، ReviewHelper31، ReviewHelper32. نام نمایشی فارسی است. اجرای مجدد Seed تصمیم‌ها یا رمز موجود را عوض نمی‌کند.
>
> تست‌ها به PostgreSQL با مجوز CREATEDB و پورت‌های آزاد 3001 و 5174 نیاز دارند؛ هر مجموعه پایگاه جدا می‌سازد و حذف می‌کند.

# سامانه حمایت لاهوت — Repository قابل انتقال

نسخه تأییدشده: ورود Aseman با نقش SUPREME_GUIDE ← صفحه اصلی راهبر ← درخواست‌های دسترسی ← تأیید/رد و تاریخچه.
این ادامه همان پروژه موجود است. Source کامل Frontend/Backend، هشت Migration، سه Seed توسعه و سه مجموعه Regression Test داخل Repository هستند.

**برای راه‌اندازی تازه، هیچ فایلی از پوشه Work، نصب Codex، Database فعلی یا فایل Start-Lahout کنار خروجی‌های قدیمی لازم نیست.**
تمام دستورهای این راهنما از ریشه همین Repository اجرا می‌شوند، مگر جایی که صریحاً گفته شده باشد.

## ۱. پیش‌نیازهای Windows

محیط هدف Windows 10/11، نسخه 64-bit است. نسخه‌های این پروژه:

| ابزار | نسخه |
|---|---|
| Node.js | سری 24 LTS؛ در این محیط 24.21.0 آزمایش شده |
| pnpm | دقیقاً 11.19.0، ثبت‌شده در packageManager |
| PostgreSQL | سری 17، با افزونه‌های pgcrypto و pg_trgm |
| Playwright | 1.62.1، در devDependencies و lockfile |

1. [نصب‌کننده رسمی Node.js](https://nodejs.org/en/download) را برای Windows x64، سری 24 LTS نصب کنید. npm و افزودن Node به PATH را فعال نگه دارید؛ سپس PowerShell تازه باز کنید.
2. pnpm را با npm نصب کنید. در Windows از پسوند `.cmd` استفاده شده تا به اجرای اسکریپت PowerShell سراسری وابسته نباشد. [راهنمای رسمی pnpm](https://pnpm.io/installation).

```powershell
node --version
npm.cmd --version
npm.cmd install --global pnpm@11.19.0
pnpm.cmd --version
```

3. [PostgreSQL برای Windows](https://www.postgresql.org/download/windows/) را نصب کنید؛ نسخه 17، Server و Command Line Tools کافی‌اند. رمز مدیر PostgreSQL را خودتان تعیین و خارج از Repository نگه دارید. پورت پیش‌فرض 5432 است. نصب‌کننده سرویس Windows را ایجاد می‌کند؛ در Services بررسی کنید سرویس PostgreSQL در وضعیت Running باشد. Docker، Redis و pgAdmin برای اجرای برنامه لازم نیستند.
4. ZIP را در مسیری کوتاه مانند `C:\Projects\lahout-support-system` استخراج کنید. برای حفظ تاریخچه، پوشه مخفی `.git` داخل ZIP را نیز نگه دارید. نصب Git برای اجرای برنامه ضروری نیست؛ برای ادامه توسعه می‌توانید [Git for Windows](https://git-scm.com/download/win) را نصب کنید.

## ۲. ایجاد Database خالی

در PowerShell، با مدیر محلی PostgreSQL وارد psql شوید. مسیر را با محل نصب خود تطبیق دهید:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

رمز مدیر به صورت تعاملی پرسیده می‌شود. سپس **داخل psql** این دستورها را اجرا کنید:

```sql
CREATE ROLE lahout_dev LOGIN CREATEDB;
\password lahout_dev
CREATE DATABASE lahout_dev OWNER lahout_dev;
\q
```

دستور `\password` رمز کاربر Database را بدون درج آن در متن دستور تنظیم می‌کند. دسترسی CREATEDB فقط برای ایجاد Databaseهای موقت Regression Test در محیط توسعه لازم است. Migrationها افزونه‌های موجود در نصب استاندارد PostgreSQL را ایجاد می‌کنند.
اگر Role یا Database از قبل وجود دارد، آن را حذف نکنید؛ همان مشخصات را در `.env` تنظیم کنید.

## ۳. تنظیمات محلی بدون Secret در Git

```powershell
Set-Location 'C:\Projects\lahout-support-system'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Configure-Database.ps1
```

این اسکریپت رمز PostgreSQL را مخفی می‌پرسد، کاراکترهای ویژه را URL-encode می‌کند و `.env` محلی می‌سازد. اگر `.env` از قبل وجود دارد، آن را بازنویسی نمی‌کند. روش دستی جایگزین: کپی `.env.example` به `.env` و ویرایش با Notepad.

در `DATABASE_URL`، رمز کاربر `lahout_dev` را جایگزین مقدار نمونه کنید؛ اگر رمز شامل کاراکتر ویژه مانند `@`، `:`، `/` یا `%` است، آن بخش باید URL-encoded باشد. پورت و نام Database نیز باید مطابق نصب خودتان باشند. `.env.example` فقط Placeholder دارد؛ `.env` واقعی در Git و ZIP وارد نمی‌شود.

برای تولید امن مقدار URL-encoded بدون نوشتن رمز در تاریخچه PowerShell، می‌توانید رمز را با Read-Host -AsSecureString دریافت کنید؛ رمز Development حساب Aseman را با رمز Database اشتباه نگیرید. روش تعاملی Seed در بخش بعد رمز Aseman را دریافت می‌کند.

فایل `.env` در **ریشه Repository** است و همه دستورهای start/migrate/seed/test آن را می‌خوانند. نمونه تنظیمات غیرمحرمانه:

```dotenv
APP_ENV=development
BACKEND_PORT=3000
FRONTEND_ORIGIN=http://127.0.0.1:5173
SESSION_TTL_HOURS=12
COOKIE_SECURE=false
PREVIEW_PORT=5173
BACKEND_PROXY=http://127.0.0.1:3000
```

مقدار `TEST_DATABASE_ADMIN_URL` می‌تواند خالی بماند؛ تست‌ها آن‌گاه از کاربر `DATABASE_URL` برای ساخت Database جداگانه استفاده می‌کنند. `BROWSER_EXECUTABLE` هم برای مرورگر Playwright خالی می‌ماند.
نشست‌ها در زمان اجرا تولید می‌شوند؛ این برنامه Session Secret ثابت ندارد. هیچ رمز پیش‌فرض برای Aseman در کد تعبیه نشده است.

## ۴. نصب Dependency و ساخت

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd typecheck
pnpm.cmd build
```

`pnpm-lock.yaml` باید همراه Source باشد تا همان نسخه‌های Dependency نصب شوند. اجازه ساخت پکیج‌های native موردنیاز در pnpm-workspace.yaml ثبت شده است. در صورت خطای دانلود، اتصال به Registry را اصلاح و همان دستور را تکرار کنید؛ lockfile را حذف نکنید.
Source زیر `apps/frontend/src` و `apps/backend/src` است. پوشه‌های dist و node_modules از نو ساخته می‌شوند و عمداً داخل Git/ZIP نیستند.

## ۵. Migration و Seed توسعه

```powershell
pnpm.cmd db:migrate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Seed-Development.ps1
```

اسکریپت دوم **رمز دلخواه Development حساب Aseman را به شکل مخفی می‌پرسد**، فقط در محیط همان پردازش به Seed می‌دهد و پس از پایان پاک می‌کند. خود رمز در Source، فایل تنظیمات یا تاریخچه فرمان ذخیره نمی‌شود؛ فقط Argon2id آن در Database قرار می‌گیرد.

نتیجه Seed:

- Username: `Aseman`
- Role: `SUPREME_GUIDE` با دامنه سازمان
- سه Access Request دارای برچسب Development/Test، همگی در وضعیت `PENDING_GUIDE_APPROVAL`
- نمونه‌ها فقط درخواست‌اند؛ حساب مدیر اجرایی، سرگروه یا همیار ساخته نمی‌شود.

اجرای دوباره Migration و Seed بعد از موفقیت، اطلاعات و رمز موجود را بازنویسی نمی‌کند. تغییر رمز با Seed انجام نمی‌شود.
Seedهای مستقل:

```powershell
# Requires DEV_SEED_PASSWORD in the current process; prefer the interactive script above.
pnpm.cmd db:seed:dev
pnpm.cmd db:seed:access:dev
```

برای دسته تازه داده آزمایشی، `DEV_ACCESS_BATCH` را به یک نام تازه مثل `review2` در محیط فرایند تغییر دهید و Seed درخواست‌ها را اجرا کنید. درخواست نهایی‌شده ویرایش نمی‌شود. Seed درخواست‌ها فقط با APP_ENV=development اجرا می‌شود و به Seed محیط واقعی متصل نیست.

## ۶. اجرای برنامه

در **ترمینال اول**، از ریشه Repository:

```powershell
pnpm.cmd start:backend
```

در **ترمینال دوم**، باز هم از ریشه Repository:

```powershell
pnpm.cmd start:frontend
```

مرورگر: [ورود محلی](http://127.0.0.1:5173/login). با `Aseman` و رمزی که در Seed تعیین کردید وارد شوید.
ورود ← صفحه راهبر ← درخواست‌های دسترسی ← جزئیات ← تأیید یا رد. تأیید فقط در انتظار اجرای فنی ثبت می‌شود و حساب/Role را تغییر نمی‌دهد.
برای توقف هر سرویس در ترمینال خودش Ctrl+C بزنید. PostgreSQL سرویس مستقل Windows است.
برای توسعه همراه با Vite، `pnpm.cmd dev` در دسترس است؛ فرمان‌های start بالا build ساخته‌شده را اجرا می‌کنند.

## ۷. Regression Test قابل تکرار

Playwright جزو Dependencyهای خود پروژه است. مرورگر Chromium متناظر را یک بار دریافت کنید. [راهنمای رسمی مرورگرهای Playwright](https://playwright.dev/docs/browsers).

```powershell
pnpm.cmd test:install-browser
pnpm.cmd build
pnpm.cmd test
```

آزمون بسته Staging نیز با `pnpm.cmd test:staging` قابل اجراست (۵ سناریوی مستقل).

یا هر مجموعه جداگانه:

```powershell
pnpm.cmd test:login
pnpm.cmd test:access
pnpm.cmd test:guide
```

تست‌ها رمز تصادفی و موقت خودشان را تولید می‌کنند؛ رمز واقعی Aseman را نمی‌خواهند. هر مجموعه Database جدا روی PostgreSQL می‌سازد و در پایان همان Database را حذف می‌کند. پورت‌های 3001 و 5174 باید آزاد باشند. برنامه محلی روی 3000/5173 می‌تواند هم‌زمان اجرا شود.

نتایج JSON، تصاویر و لاگ‌های اجرای شما در `test-results` ایجاد می‌شوند و وارد Git/ZIP نمی‌شوند. تست ورود ۳۱ بررسی و تست Access Requests بیست‌ودو بررسی دارد. تست فضای راهبر ۱۹ سناریوی چندمرحله‌ای دیگر دارد. ورود مخاطب به فضای محدود پیام‌ها اکنون واقعی است؛ دسترسی مدیریتی راهبر همچنان فقط برای SUPREME_GUIDE مجاز است.
برای استفاده از Chrome موجود، مسیر واقعی chrome.exe را در `BROWSER_EXECUTABLE` فایل `.env` بگذارید؛ آن‌گاه دریافت Chromium لازم نیست. هیچ مسیر مربوط به Codex در پروژه لازم نیست.

## ۸. اگر محیط Work کاملاً حذف شود

برای **راه‌اندازی تازه با داده توسعه** فقط ZIP همین Repository لازم است. Source، lockfile، Migrationها، Seedها، اسکریپت‌ها و `.env.example` داخل آن هستند. Node/pnpm/PostgreSQL را نصب می‌کنید، `.env` را با رمزهای جدید خودتان می‌سازید و بخش‌های ۴ تا ۶ را اجرا می‌کنید. ابزارهای نصب‌شدنی، مرورگرها و Dependencyها از اینترنت دریافت می‌شوند؛ ZIP بسته آفلاین همه ابزارها نیست.

برای **حفظ داده و تصمیم‌های فعلی** علاوه بر Repository، یک Backup جدا و امن PostgreSQL و مشخصات دسترسی لازم است. Seed عمداً تصمیم‌های واقعی قبلی را بازسازی نمی‌کند. Database یا Backup دارای اطلاعات حساس وارد Git/ZIP نشده است. این تحویل Backup داده فعلی نیست؛ حذف پوشه داده بدون Backup، همان داده‌ها را از بین می‌برد.

فایل‌های غیرضروری برای راه‌اندازی تازه: Work، pgdata فعلی، node_modules قبلی، dist قبلی، نصب Codex، Start-Lahout قدیمی و رمز موقت قبلی.

## ساختار Repository و وضعیت قابلیت‌ها

```text
apps/backend/src/          Backend کامل، شامل کدهای M0 حفظ‌شده
apps/frontend/src/         Frontend کامل
apps/backend/scripts/     migrate.ts / seed-dev.ts / seed-access-dev.ts
migrations/               هشت Migration PostgreSQL به ترتیب
scripts/                  Seed تعاملی Windows و اجرای Regression
tests/                    تست ورود، Access Requests و نمایش build
.env.example              نمونه بدون Secret
pnpm-lock.yaml            نسخه‌های قفل‌شده Dependency
docs/                     Business Rules و گزارش تثبیت
.git/                     تاریخچه و Commit تحویلی در ZIP
```

چهار حوزه راهبر: افراد، گروه‌ها و خانواده‌ها، آرشیو مصوبات، گزارش‌های مدیریتی. درخواست‌های دسترسی از ناوبری حذف شده‌اند اما مسیر مستقیم و تاریخچه سالم باقی است. گردش مجوز و مداخله در مصوبات بازنشسته شده‌اند. راهبر ارزیابی را ویرایش نمی‌کند و هشدار متعلق به سرگروه را حل نمی‌کند. حدود تکمیل و Deferred در docs/GUIDE_FINAL_DELIVERY_FA.md آمده است.

فایل docker-compose.yml صرفاً گزینه توسعه جایگزین نصب PostgreSQL است و رمز را از متغیر محلی POSTGRES_PASSWORD می‌گیرد. مسیر اصلی و قابل بررسی این راهنما نصب مستقیم PostgreSQL است؛ Docker برای انتقال لازم نیست.

گزارش‌های TEST_REPORT_FA.md و GUIDE_ACCESS_TEST_REPORT_FA.md مربوط به مراحل قبلی‌اند؛ روش فعلی راه‌اندازی و انتقال همین README است. نتیجه تثبیت در [گزارش انتقال](docs/PORTABILITY_VERIFICATION.md) ثبت می‌شود.
