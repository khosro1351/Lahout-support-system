این ZIP آخرین نسخه فعلی پروژه و مبنای قطعی بازبینی است.
روی همین Repository ادامه بده؛ پروژه جدید نساز و قابلیت‌های سالم قبلی را از نو پیاده‌سازی نکن.
ما نسخه فعلی نقش SUPREME_GUIDE را روی سیستم واقعی کاربر اجرا و صفحه‌به‌صفحه بررسی کردیم. نتیجه این بررسی یک بازبینی معماری و UX نسبتاً گسترده است.
هدف این مرحله صرفاً Patch ظاهری نیست. باید ساختار نقش راهبر را بر اساس Specification زیر اصلاح کنی، در عین حفظ قابلیت‌های سالم، Audit، History، Login، Access Requests و PostgreSQL موجود.
1. اصل معماری نقش راهبر
راهبر:
- مدیر اجرایی روزمره نیست.
- اپراتور سیستم نیست.
- مرجع نظارت، راهبری و تصمیم نهایی است.
- باید با حداقل کلیک، بیشترین اطلاعات مهم را ببیند.
- نباید برای کارهای ساده بین چند صفحه جابه‌جا شود.
UI باید:
- ساده
- مدیریتی
- کم‌تراکم
- Drill-down محور
- Role-aware
- Context-aware
  باشد.
2. هویت بصری
تم فعلی بنفش از نظر کاربر بیش از حد کم‌رنگ است.
اصلاح:
- بنفش اصلی باید شاخص‌تر، عمیق‌تر و حرفه‌ای‌تر شود.
- سفید و یاسی روشن همچنان زمینه غالب باشند.
- سبز فقط Success/Approved.
- قرمز = هشدار جدی.
- کهربایی = پیگیری/تذکر.
- آبی/بنفش = پیام، درخواست یا موضوع اطلاعاتی.
- Blue Lotus فعلی حفظ شود ولی کمی هویت بصری قوی‌تری بگیرد.
از UI شلوغ یا بنفش جیغ خودداری کن.
3. ناوبری سراسری
در تمام صفحات راهبر:
- بازگشت = بازگشت به صفحه قبلی در همان سلسله‌مراتب
- خانه = بازگشت مستقیم به /guide
دیگر فقط لینک «بازگشت به صفحه اصلی» کافی نیست.
این الگو باید در تمام Subpageها یکسان باشد.
4. داشبورد اصلی راهبر
داشبورد اصلی بازطراحی شود.
حوزه‌های اصلی:
1. درخواست‌های دسترسی
2. افراد و مسئولیت‌ها
3. گروه‌بندی و پایش مددجویان
4. مجوزهای موردی
5. مصوبات شورا
6. گزارش‌ها و پایش
کارت مستقل:
- هشدارها و موارد فوری
  حذف شود.
صفحه اصلی یک بخش:
موارد نیازمند توجه
داشته باشد و Summary واقعی موارد actionable را نشان دهد:
- درخواست دسترسی منتظر تصمیم
- مجوز موردی منتظر تصمیم
- هشدارهای مهم حل‌نشده
- مصوبه نیازمند توجه
- سایر موارد واقعاً نیازمند اقدام
5. افراد و مسئولیت‌ها
این بخش باید Person-centric شود.
صفحه /guide/people
بالای صفحه:
- Search نام / تلفن / شناسه
- Role
- Group
- وضعیت حساب
- تعداد مسئولیت
این کنترل‌ها فقط Filter هستند.
پایین صفحه باید لیست افراد نمایش داده شود.
انتخاب Role مثلاً «سرگروه» باید همه افراد دارای Role سرگروه را نشان دهد، حتی اگر Roleهای دیگری هم داشته باشند.
5.1 Role labels
UI:
- سرگروه
- همیار گروه
- عضو شورای کانون
- مدیر اجرایی
- مدیر فنی
SUPREME_GUIDE از ابزار عمومی انتصاب/تغییر Role حذف شود.
خود راهبر در لیست مدیریت Roleهای معمول نمایش داده نشود.
5.2 صفحه مستقل Appointments
صفحه مستقل:
/guide/appointments
از Navigation اصلی حذف شود.
انتصاب و تغییر Role باید در صفحه خود شخص انجام شود.
5.3 Person Workspace
مسیر:
People → Person
صفحه شخص باید یک Workspace جامع باشد.
نمایش:
- اطلاعات پایه
- تلفن
- شناسه لازم
- وضعیت حساب
- Roleهای فعلی
- Groupهای مرتبط
- مسئولیت‌های فعال
- History مسئولیت‌ها
- هشدارها
- تذکرها
- پیام‌ها/درخواست‌ها
- هماهنگی‌های مرتبط
- سوابق مهم
همان‌جا:
- افزودن مسئولیت
- پایان مسئولیت
- تغییر Role/Scope
انجام شود.
راهبر برای این اقدامات به صفحه دیگری نرود.
5.4 فرم Role
- Role پیش‌فرض انتخاب‌شده نداشته باشد.
- تاریخ/زمان/Actor خودکار.
- Reason اختیاری.
- «همیار» در Scope سازمانی نباشد.
- Role صحیح:
همیار گروه
با Group Scope.
5.5 Badgeهای Person
در لیست افراد:
- قرمز = هشدار جدی
- کهربایی = پیگیری/تذکر
- بنفش/آبی = پیام یا درخواست برای راهبر
اگر موردی نیست، Badge نمایش داده نشود.
6. Seed آزمایشی جدید
برای قابل تست شدن واقعی سامانه، Development Seed جدید ایجاد کن.
دقیقاً:
- 3 گروه آزمایشی شماره 1، 2، 3
- هر گروه:
  - 1 سرگروه
  - 2 همیار گروه
  - 3 خانواده مددجوی آزمایشی
در مجموع:
- 3 سرگروه
- 6 همیار
- 9 خانواده
ترکیب Roleها:
- سرگروه 1 = سرگروه + عضو شورای کانون
- سرگروه 2 = سرگروه + مدیر اجرایی
- سرگروه 3 = سرگروه + عضو شورای کانون
- یک عضو سوم شورای کانون که سرگروه نیست
برای افراد:
- نام
- نام خانوادگی
- تلفن تستی
- کد ملی تستی
- Account
- Role
- Scope
- Group
به‌صورت Development/Test ایجاد شود.
داده واقعی یا Credential واقعی تولید نکن.
7. گروه‌بندی و پایش مددجویان
عنوان فعلی:
«گروه‌ها و سرگروه‌ها»
جایگزین شود با:
«گروه‌بندی و پایش مددجویان»
7.1 صفحه فهرست گروه‌ها
هر گروه:
- شماره ثابت
- نام اختیاری
- سرگروه
- تعداد همیاران
- تعداد خانواده‌ها
- خلاصه وضعیت خانواده‌ها
- هشدارهای واقعاً مربوط به خود گروه
نام گروه اختیاری است.
اگر نام ندارد:
گروه 2
نمایش داده شود.
7.2 فیلترهای گروه‌ها
تمرکز روی شرایط مددجویان:
- Group
- سرگروه
- تعداد خانواده
- سطح A/B/C/D
- میانگین نیاز
- فوریت
- تحقیق معوق
- نیازمند بازبینی
- هشدار باز
- بار گروه
Sort:
- بیشترین خانواده سطح A
- بیشترین هشدار
- بیشترین پرونده معوق
- بیشترین میانگین نیاز
8. عملیات ساختاری گروه
این عملیات فقط در صفحه فهرست گروه‌ها باشد:
- افزودن گروه
- انتقال خانواده‌ها و غیرفعال‌سازی گروه
- فعال‌سازی مجدد گروه غیرفعال
Hard Delete نداریم.
گروه حذف تاریخی نمی‌شود.
8.1 ادغام
مفهوم عمومی Action را:
«انتقال خانواده‌ها و غیرفعال‌سازی گروه»
در نظر بگیر.
اگر همه خانواده‌ها به یک Group مقصد منتقل شدند، UI می‌تواند آن را «ادغام با گروه X» توصیف کند.
اما Data Model محدود به Merge یک‌به‌یک نباشد.
ممکن است خانواده‌ها بین چند گروه تقسیم شوند.
9. صفحه داخل یک گروه
این صفحه ویرایش ساختار گروه نیست.
تمرکز اصلی:
خانواده‌های تحت پوشش
Header فقط Context:
- شماره گروه
- نام گروه
- سرگروه
- همیاران
- تعداد خانواده
- هشدار Group Scope
نام سرگروه و همیارها clickable باشند و به Person Workspace بروند.
حذف از این صفحه
- تغییر سرگروه
- انتصاب Role
- ایجاد گروه
- ادغام گروه
- غیرفعال‌سازی کل گروه
این Actionها در لایه‌های صحیح خود قرار دارند.
10. Family List داخل گروه
محور اصلی صفحه باشد.
فیلتر:
- نام/کد خانواده
- A/B/C/D
- امتیاز کل
- فوریت
- وضعیت تحقیق
- تاریخ آخرین تحقیق
- نیازمند بازبینی
- وضعیت حمایت
- حوزه مسئله
- هشدار
هر ردیف:
- کد خانواده
- نام سرپرست
- تعداد اعضا
- امتیاز کل
- سطح A/B/C/D
- فوریت
- وضعیت تحقیق
- وضعیت حمایت
- هشدارها
10.1 انتخاب ردیف
Hover فقط Visual Highlight باشد.
Action بر اساس Hover اجرا نشود.
با Click:
ردیف Selected شود.
Selected state باید واضح و پایدار باشد.
Action bar روی Selected family عمل کند.
10.2 Action bar
روی همان صفحه:
- مشاهده پرونده
- انتقال به گروه دیگر
- سایر Actionهای مجاز بر اساس Role
Page جدید برای انتقال نساز.
انتقال:
Select family → Transfer → Select destination → Confirm
در Modal/Inline lightweight flow.
History خودکار ثبت شود.
11. هشدارها
Context-aware باشند:
- Person alert → Person
- Family alert → Family row + Family workspace
- Group alert → Group
- Organization alert → Guide Dashboard
Family Alert باید روی ردیف خانواده هم دیده شود، صرف‌نظر از اینکه کدام Role آن را ایجاد کرده است.
Alert با View شدن Resolve نشود.
فقط:
Action completed + result registered
باعث Resolve شود.
11.1 All Alerts View
کارت مستقل «هشدارها» در Dashboard نداشته باش.
اما از Summary داشبورد، امکان ورود به یک:
All Alerts View
سبک و نظارتی وجود داشته باشد.
Filter:
- Severity
- Person
- Group
- Family
- Type
- Date
- Resolved/Open
این View برای مشاهده و Drill-down است، نه ایجاد Alert.
12. Family Workspace
کلیک روی خانواده:
صفحه جامع چندلایه.
Sections:
- مشخصات خانواده
- اعضا
- معیشت
- سلامت
- مسکن
- آسیب‌پذیری ویژه
- آموزش
- امتیاز حوزه‌ها
- امتیاز کل
- سطح A/B/C/D
- فوریت
- تحقیقات
- فرم سرگروه
- فرم هیأت تحقیق
- مدارک
- حمایت‌ها
- هشدارها
- History
Drill-down
مثلاً کلیک روی:
مسکن
باید:
- پاسخ‌های واقعی فرم
- زیرشاخص‌ها
- امتیاز اجزا
- داده تحقیق
را نشان دهد.
امتیاز تنها یک عدد نهایی نباشد.
13. Shared Workspace برای Roleها
الگوی:
Group → Filters → Families → Family Detail
به‌صورت Shared Component/Workspace ساخته شود.
در آینده همان UI برای:
- راهبر
- سرگروه
- سایر Roleهای مجاز
Reuse شود.
Copy/Paste implementation ممنوع.
تفاوت فقط در:
- Authorization
- Scope
- Actions
باشد.
14. مجوزهای موردی
بخش فعلی «مجوزها و تصمیمات راهبری» بازطراحی اساسی شود.
راهبر:
- Command رسمی ثبت نمی‌کند.
- Mission رسمی ثبت نمی‌کند.
- مخاطب و Deadline برای تصمیم شفاهی تعیین نمی‌کند.
تعامل طبیعی راهبر خارج از سیستم انجام می‌شود.
Workflow فقط:
«مجوزهای موردی»
فقط مدیر اجرایی می‌تواند موردی را برای راهبر ارسال کند.
مفهوم:
فردی ادعا کرده با راهبر هماهنگ کرده یا نظر موافق/مخالف گرفته است.
مدیر اجرایی برای Verification، مورد را ارسال می‌کند.
Guide Detail:
- شخص
- موضوع
- توضیح مدیر
- تاریخ
فقط دو Action:
- سبز: تأیید
- قرمز: عدم تأیید
نتیجه بلافاصله در Dashboard مدیر اجرایی دیده شود.
14.1 Badge
روی Dashboard Guide:
مجوزهای موردی
Badge اصلی:
تعداد موارد منتظر تصمیم
نه تعداد unread.
View کردن مورد، آن را از صف Pending خارج نکند.
فقط Approve/Reject.
Status:
- جدید
- مشاهده‌شده
- تأیید
- عدم تأیید
15. مصوبات شورا
Guide نقش نظارتی دارد.
صفحه:
- List
- Advanced Search
- Filter
- Sort
Detail:
- عنوان
- متن
- تاریخ
- ثبت‌کننده
- وضعیت
- History
- Attachments if any
Guide Action فقط:
- توقف اجرا
- درخواست اصلاح/بازنگری
Guide متن مصوبه را مستقیم Edit نکند.
پس از Action:
مدیر اجرایی بلافاصله مطلع شود.
عملیات اجرایی بعدی خارج از Guide UI انجام شود.
16. حذف ماژول مستقل «هشدارها و موارد فوری»
Routeها می‌توانند برای backward compatibility بمانند، ولی در Navigation راهبر نمایش داده نشوند.
«فوری» Attribute/Severity باشد، نه Module مستقل.
17. گزارش‌ها و پایش
این بخش یکی از مهم‌ترین حوزه‌های Guide است.
باید از صفحه فعلی بسیار قوی‌تر شود.
مصوبات و هماهنگی‌ها از این بخش حذف شوند.
تفکیک مهم
دو بخش خانواده در سیستم داریم و نباید با هم اشتباه شوند:
A) Group/Family Workspace
Case-oriented.
هدف:
- دیدن وضعیت یک خانواده
- فهم معیشت، سلامت، مسکن، آموزش و...
- تصمیم درباره همان پرونده
B) Reports & Monitoring
Aggregate / Statistical.
هدف:
- تحلیل جمعی
- مقایسه
- رتبه‌بندی
- گزارش آماری
- خروجی مدیریتی
این دو UI و Query logic یکسان طراحی نشوند.
18. زیرحوزه‌های Reports
ترجیحاً Tabs/Sections:
- خانواده‌ها
- حمایت‌ها
- مستمری‌ها
- طرح‌های توزیع جمعی
- افراد و گروه‌ها
- عملکرد کانون
- گزارش حامی
19. Family Statistical Reporting
Advanced Filters:
- Group
- Family
- A/B/C/D
- Score
- Urgency
- Research status
- Last research
- Review required
- Support status
- Support type
- Alert
- Date range
- Need domain
Results:
- sortable
- aggregate
- comparable
- exportable
20. Report Builder
Guide خودش Fields گزارش را تعیین کند.
همه Fields باید در دسترس باشند.
سیستم حق ندارد خودش تصمیم بگیرد چه داده‌ای برای کدام مرجع مجاز یا غیرمجاز است.
اما برای جلوگیری از Export تصادفی:
Report output باید بر اساس انتخاب آگاهانه Fieldها ساخته شود.
گزینه:
Select all fields
وجود داشته باشد.
Guide محدودیت Field-level از طرف سیستم نداشته باشد.
21. خروجی گزارش
Report Builder باید:
- PDF
- Excel
- Print
را پشتیبانی کند.
Print layout:
A4 استاندارد
الزامات:
- Print Preview
- Header مناسب
- Page breaks
- جدول شکسته نشود
- شماره صفحه
- عنوان گزارش
- تاریخ تولید
- فیلترهای اعمال‌شده در صورت نیاز
- Portrait/Landscape در صورت تناسب
Output باید برای چاپ واقعی روی کاغذ A4 مناسب باشد.
22. حمایت‌های موردی
Search واقعی روی:
- یخچال
- لباسشویی
- تلویزیون
- درمان
- اجاره
- تحصیل
- کمک نقدی
- هر Support Category آینده
Result:
- خانواده
- تاریخ
- مبلغ
- وضعیت
- منبع
- نتیجه
23. مستمری
گزارش:
- خانواده
- مبلغ
- شروع
- پرداخت‌ها
- معوق
- مجموع
- بار مالی ماهانه
- تغییرات دوره‌ای
24. طرح‌های توزیع جمعی
Report-ready برای:
- سبد کالا
- پوشاک
- لوازم تحصیلی
- کفش
- کیف
- زمستان
- یلدا
- رمضان
- سایر طرح‌ها
Metrics:
- Target families
- Eligible
- Final recipients
- Reserve
- Non-delivery
- Replacement
- Capacity
- Value/Cost
- Groups
- Sponsor/source
- Date
Architecture extensible باشد.
25. Sponsor Report
Report Builder واقعی:
Guide بتواند انتخاب کند:
- موضوع
- بازه زمانی
- گروه هدف
- نوع حمایت
- طرح
- Fieldهای خروجی
Preview → PDF / Excel / A4 Print.
26. Performance Monitoring
پایش:
- کل کانون
- Group
- مدیر اجرایی
- سرگروه
- همیار
- شورا
- سایر Roleها
Indicators:
- تعداد بازدید
- فاصله بازدیدها
- پرونده‌های به‌روز
- بازبینی
- تحقیقات انجام‌شده
- تحقیقات معوق
- زمان رسیدگی
- هشدارهای قرمز
- زمان Resolve هشدار
- اجرای مصوبات
- اقدامات معوق
- حمایت‌های انجام‌شده
- پیگیری درخواست‌ها
27. رتبه‌بندی عملکرد
Ranking خام بر اساس Volume ممنوع.
حداقل دو Dimension:
Performance
- timeliness
- completion
- follow-up quality proxies
- overdue
- data freshness
- alert resolution
Responsibility Load
- تعداد خانواده
- A/B families
- special cases
- open alerts
- workload
Guide باید عملکرد را در Context بار مسئولیت ببیند.
28. مقایسه گروه‌ها
Table/Comparison View:
- Family count
- A/B/C/D
- Up-to-date %
- Overdue research
- Open alerts
- Avg response time
- Avg need score
Sortable.
29. Extensibility
Assessment، Support و Distribution هنوز در مراحل بعدی توسعه کامل‌تر خواهند شد.
بنابراین Reports باید:
- data-driven
- composable
- extensible
باشد.
از Hardcode کردن UI به داده فعلی Seed خودداری کن.
30. Audit / History
تمام عملیات مهم:
- Role change
- Group activation/deactivation
- Family transfer
- Permission verification
- Council intervention
- Alert resolution
Audit شوند.
Hard Delete ممنوع.
31. Regression
حتماً حفظ شوند:
- Login
- Session
- /guide
- Access Requests
- Approve/Reject
- Decision persistence
- PostgreSQL history
هیچ قابلیت سالم قبلی نباید خراب شود.
32. پیاده‌سازی
ابتدا Repository فعلی را تحلیل کن.
سپس:
1. Data model gap analysis
2. Migration در صورت نیاز
3. Seed جدید
4. Backend
5. Shared UI components
6. Guide pages
7. Reports architecture
8. Tests
Refactor غیرضروری نکن.
33. تست‌های الزامی
علاوه بر تست‌های قبلی:
- People filters
- Multi-role
- Person workspace
- Role assignment
- Group seed
- Group activation/deactivation
- Family transfer
- Family row selection
- Context alerts
- Permission request approve/reject
- Council stop/review
- Reports filters
- Field selection
- PDF generation
- Excel export
- A4 print layout
- Performance calculation
- Authorization
Browser tests هم اجرا شوند.
34. خروجی نهایی
در پایان:
- ZIP کامل Repository
- Migration list
- Seed changes
- Routes
- APIs
- Changed files
- Test report
- PASS/FAIL
- Deferred items
تحویل بده.
هیچ قابلیت ناقص را Complete اعلام نکن.
نسخه نهایی باید مستقل، قابل اجرا و قابل تست باشد.
بدون منتظر ماندن برای تأیید دیگری، همین Specification را روی ZIP فعلی اجرا کن و تا تحویل نسخه قابل تست پیش برو.