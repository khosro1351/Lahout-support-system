# راه‌اندازی پایدار محلی موبایل

آدرس فعلی ورود: http://192.168.1.8:5175/login

## علت
پردازش‌ها پس از Restart ویندوز باقی نمی‌مانند. راه‌انداز قبلی فقط PostgreSQL، Backend و رابط Desktop را اجرا می‌کرد؛ درگاه موبایل جداگانه بود. Startup پس از ورود به ویندوز نیز نصب نشده بود.

## اجرای روزمره
روی Start-Lahout.cmd دوبار کلیک کنید. اکنون سرویس‌های Desktop و LAN با هم بالا می‌آیند.
Start-Mobile.cmd همان مسیر را بدون بازکردن مرورگر Desktop اجرا می‌کند و آماده‌شدن LAN را الزامی می‌داند.
بستن پنجره راه‌انداز سرویس‌ها را متوقف نمی‌کند. اجرای دوباره از سرویس‌های سالم موجود استفاده می‌کند.
هیچ Build، Migration، Reset یا Seed خودکاری انجام نمی‌شود.

## آدرس‌ها
- موبایل: http://192.168.1.8:5175/login
- Desktop: http://127.0.0.1:5173/login
- ورودی موبایل: 0.0.0.0:5175
- Backend: فقط 127.0.0.1:3000
- PostgreSQL: فقط 127.0.0.1:55432

ورودی LAN، Host، subnet و Origin را کنترل می‌کند؛ Session/CSRF سامانه حفظ می‌شوند. هیچ Tunnel، URL عمومی، Port Forwarding یا استقرار Production ساخته نشده است.

## وضعیت و توقف
از پوشه پروژه:
- node scripts/mobile-lan.mjs status
- node scripts/mobile-lan.mjs stop
- node scripts/mobile-lan.mjs start

Stop فقط LAN را متوقف می‌کند. برای شروع همه سرویس‌ها از Start-Mobile.cmd استفاده کنید.

## اجرای اختیاری پس از ورود به ویندوز
نصب یک‌باره برای کاربر جاری:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Install-Local-Autostart.ps1

حذف:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Install-Local-Autostart.ps1 -Remove

این گزینه آماده شده ولی نصب نشده است. به Administrator نیاز ندارد و Windows Service یا تغییر سطح سیستم ایجاد نمی‌کند؛ یک میان‌بر در Startup کاربر ثبت می‌شود. اجرا بعد از ورود کاربر است، نه قبل از Login ویندوز. راه‌انداز برای اتصال شبکه صبر می‌کند.
Restart واقعی ویندوز و نصب این گزینه در این آزمون انجام نشد.

## شبکه و Firewall
IP ممکن است با تغییر Wi-Fi/DHCP عوض شود؛ آدرس جاری را از خروجی راه‌انداز بخوانید.
در صورت وجود چند کارت شبکه خصوصی، config/lan.env.example را به .env.lan کپی و LAN_ADDRESS را مشخص کنید. .env اصلی تغییر نمی‌کند.
LAN_PORT پیش‌فرض 5175 است. اگر IP هنگام اجرای درگاه تغییر کرد، ابتدا LAN را متوقف و سپس Start-Mobile.cmd را دوباره اجرا کنید.
Firewall خاموش یا گسترده نشده است. بررسی مدیریتی Firewall در ابزار این جلسه با Access denied مواجه شد.
در صورت مسدودبودن اتصال، scripts/Enable-Mobile-Firewall.ps1 قاعده‌ای محدود به Node، IP انتخاب‌شده، LocalSubnet و پروفایل Private آماده می‌کند. فقط در صورت نیاز با Administrator اجرا شود؛ این اسکریپت خودکار اجرا نشده است.

## شواهد بررسی
در شروع، پورت 5175 و سرویس‌های برنامه در دسترس نبودند؛ راه‌انداز دیتابیس موجود را بدون تغییر داده بالا آورد.
netstat وضعیت LISTENING روی 0.0.0.0:5175 و loopback بودن سه سرویس دیگر را تأیید کرد.
LAN عمداً متوقف شد و اجرای راه‌انداز اصلی آن را بازگرداند؛ سرویس‌های Desktop موجود reuse شدند.
چهار سناریوی tests/mobile-lan-startup.mjs موفق:
- صفحه ورود LAN و Health متصل به PostgreSQL واقعی
- اجرای دوباره بدون پردازش تکراری
- رد Origin خارجی/غایب و API خصوصی بدون ورود
- مرورگر در عرض ۱۴۴۰، ۷۶۸ و ۳۹۰، RTL، بدون overflow و خطای JavaScript

نتایج: test-results/mobile-lan-startup-results.json
مالک سامانه ورود موفق روی گوشی واقعی را پیش‌تر تأیید کرده بود؛ این نوبت روی مرورگر اتوماتیک و اتصال IP محلی بررسی شد.

## لاگ‌ها و Git
لاگ‌ها در .local/startup و .local/mobile/gateway.log هستند. Credential چاپ یا Commit نمی‌شود.
این Commit فقط راه‌اندازی محلی را پوشش می‌دهد. فایل‌های در حال توسعه Document و Migration 0016 وارد آن نشده و Migration اجرا نشده است.
main دست‌نخورده است و Push انجام نشده است.
