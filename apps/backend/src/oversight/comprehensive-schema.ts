export type Question={key:string;label:string;options?:{value:string;label:string}[];multiple?:boolean;max?:number;optional?:boolean;allowUnknown?:boolean;type?:string;when?:{field:string;values?:string[];not?:string[];includes?:string}};
export const comprehensiveFields:Record<string,Question[]>={
 "livelihood": [
  {
   "key": "incomeRange",
   "label": "وضعیت تقریبی درآمد ماهانه خانواده",
   "options": [
    {
     "value": "NONE",
     "label": "بدون درآمد"
    },
    {
     "value": "UNDER_5",
     "label": "کمتر از ۵ میلیون تومان"
    },
    {
     "value": "5_10",
     "label": "۵ تا ۱۰ میلیون تومان"
    },
    {
     "value": "10_20",
     "label": "۱۰ تا ۲۰ میلیون تومان"
    },
    {
     "value": "OVER_20",
     "label": "بیش از ۲۰ میلیون تومان"
    },
    {
     "value": "UNKNOWN",
     "label": "نامشخص"
    }
   ]
  },
  {
   "key": "incomeSources",
   "label": "منابع اصلی درآمد خانواده",
   "options": [
    {
     "value": "SALARY",
     "label": "حقوق/دستمزد ثابت"
    },
    {
     "value": "BUSINESS",
     "label": "کار آزاد/کسب‌وکار"
    },
    {
     "value": "SEASONAL",
     "label": "روزمزدی/فصلی"
    },
    {
     "value": "PENSION",
     "label": "مستمری/بازنشستگی"
    },
    {
     "value": "ASSISTANCE",
     "label": "کمک مستمر"
    },
    {
     "value": "RELATIVES",
     "label": "حمایت بستگان"
    },
    {
     "value": "ASSETS",
     "label": "درآمد دارایی"
    },
    {
     "value": "IRREGULAR",
     "label": "درآمد نامنظم"
    },
    {
     "value": "NONE",
     "label": "بدون درآمد"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "multiple": true
  },
  {
   "key": "mainIncomeSource",
   "label": "منبع اصلی درآمد",
   "options": [
    {
     "value": "SALARY",
     "label": "حقوق/دستمزد ثابت"
    },
    {
     "value": "BUSINESS",
     "label": "کار آزاد/کسب‌وکار"
    },
    {
     "value": "SEASONAL",
     "label": "روزمزدی/فصلی"
    },
    {
     "value": "PENSION",
     "label": "مستمری/بازنشستگی"
    },
    {
     "value": "ASSISTANCE",
     "label": "کمک مستمر"
    },
    {
     "value": "RELATIVES",
     "label": "حمایت بستگان"
    },
    {
     "value": "ASSETS",
     "label": "درآمد دارایی"
    },
    {
     "value": "IRREGULAR",
     "label": "درآمد نامنظم"
    },
    {
     "value": "NONE",
     "label": "بدون درآمد"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ]
  },
  {
   "key": "stability",
   "label": "در سه ماه اخیر، درآمد خانواده چقدر پایدار و قابل پیش‌بینی بوده است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "پایدار و منظم"
    },
    {
     "value": "OPTION_1",
     "label": "نسبتاً پایدار با نوسان محدود"
    },
    {
     "value": "OPTION_2",
     "label": "ناپایدار و متغیر"
    },
    {
     "value": "OPTION_3",
     "label": "بسیار ناپایدار / مقطعی"
    },
    {
     "value": "OPTION_4",
     "label": "بدون درآمد"
    }
   ]
  },
  {
   "key": "adequacy",
   "label": "در سه ماه اخیر، درآمد خانواده تا چه حد هزینه‌های ضروری زندگی را پوشش داده است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "تقریباً همه نیازهای پایه تأمین شده"
    },
    {
     "value": "OPTION_1",
     "label": "بیشتر نیازها تأمین شده، با محدودیت"
    },
    {
     "value": "OPTION_2",
     "label": "فقط بخشی از نیازهای پایه تأمین شده"
    },
    {
     "value": "OPTION_3",
     "label": "بخش قابل توجهی از نیازهای پایه تأمین نشده"
    },
    {
     "value": "OPTION_4",
     "label": "عملاً توان تأمین نیازهای پایه وجود ندارد"
    }
   ]
  },
  {
   "key": "pressures",
   "label": "حداکثر سه فشار اصلی",
   "options": [
    {
     "value": "FOOD",
     "label": "خوراک"
    },
    {
     "value": "HOUSING",
     "label": "مسکن/اجاره"
    },
    {
     "value": "HEALTH",
     "label": "درمان/دارو"
    },
    {
     "value": "EDUCATION",
     "label": "آموزش"
    },
    {
     "value": "UTILITIES",
     "label": "خدمات ضروری"
    },
    {
     "value": "TRAVEL",
     "label": "رفت‌وآمد"
    },
    {
     "value": "CARE",
     "label": "مراقبت از عضو وابسته"
    },
    {
     "value": "DEBT",
     "label": "اقساط/بدهی"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "multiple": true,
   "max": 3,
   "optional": true
  },
  {
   "key": "essentialCosts",
   "label": "این فشار هزینه‌ای تا چه حد زندگی خانواده را مختل کرده است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "قابل مدیریت"
    },
    {
     "value": "OPTION_1",
     "label": "باعث محدودیت در هزینه‌های غیرضروری شده"
    },
    {
     "value": "OPTION_2",
     "label": "باعث کاهش یا تأخیر در برخی نیازهای ضروری شده"
    },
    {
     "value": "OPTION_3",
     "label": "باعث عدم تأمین مکرر نیازهای ضروری شده"
    },
    {
     "value": "OPTION_4",
     "label": "وضعیت بحرانی ایجاد کرده"
    }
   ]
  },
  {
   "key": "debt",
   "label": "آیا خانواده بدهی یا تعهد مالی مؤثری دارد که بر زندگی روزمره اثر گذاشته باشد؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "ندارد"
    },
    {
     "value": "OPTION_1",
     "label": "دارد ولی قابل مدیریت است"
    },
    {
     "value": "OPTION_2",
     "label": "فشار قابل توجه ایجاد کرده"
    },
    {
     "value": "OPTION_3",
     "label": "دارای معوقه/تأخیر جدی است"
    },
    {
     "value": "OPTION_4",
     "label": "بحران، خطر حقوقی، تخلیه یا قطع خدمت ایجاد کرده"
    }
   ]
  },
  {
   "key": "debtType",
   "label": "نوع اصلی بدهی",
   "options": [
    {
     "value": "RENT",
     "label": "اجاره معوق"
    },
    {
     "value": "INSTALLMENT",
     "label": "اقساط"
    },
    {
     "value": "LOAN",
     "label": "قرض"
    },
    {
     "value": "HEALTH",
     "label": "درمان"
    },
    {
     "value": "UTILITIES",
     "label": "قبوض"
    },
    {
     "value": "EDUCATION",
     "label": "آموزش"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "debt",
    "not": [
     "OPTION_0",
     ""
    ]
   }
  },
  {
   "key": "economicCapacity",
   "label": "آیا فرد دارای توان کار ولی بدون شغل/درآمد متناسب وجود دارد؟",
   "options": [
    {
     "value": "NO",
     "label": "خیر"
    },
    {
     "value": "ONE",
     "label": "بله، یک نفر"
    },
    {
     "value": "MULTIPLE",
     "label": "بله، بیش از یک نفر"
    },
    {
     "value": "UNKNOWN",
     "label": "نامشخص"
    }
   ],
   "allowUnknown": true
  },
  {
   "key": "workBarrier",
   "label": "مانع اصلی",
   "options": [
    {
     "value": "OPPORTUNITY",
     "label": "نبود فرصت"
    },
    {
     "value": "SKILL",
     "label": "مهارت ناکافی"
    },
    {
     "value": "CARE",
     "label": "مسئولیت مراقبت"
    },
    {
     "value": "TRAVEL",
     "label": "رفت‌وآمد"
    },
    {
     "value": "HEALTH",
     "label": "محدودیت سلامت"
    },
    {
     "value": "CAPITAL",
     "label": "نبود سرمایه/ابزار"
    },
    {
     "value": "SOCIAL",
     "label": "محدودیت اجتماعی/خانوادگی"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "economicCapacity",
    "values": [
     "ONE",
     "MULTIPLE"
    ]
   }
  },
  {
   "key": "notes",
   "label": "نکته مهمی درباره وضعیت اقتصادی خانواده که در گزینه‌های بالا منعکس نشده است",
   "type": "text",
   "optional": true
  }
 ],
 "healthMember": [
  {
   "key": "screening",
   "label": "آیا این عضو مسئله سلامت مؤثری دارد که بر زندگی روزمره، مراقبت، درمان یا شرایط خانواده اثر بگذارد؟",
   "options": [
    {
     "value": "NO",
     "label": "ندارد"
    },
    {
     "value": "YES",
     "label": "دارد"
    },
    {
     "value": "UNKNOWN",
     "label": "نامشخص"
    }
   ]
  },
  {
   "key": "issueType",
   "label": "نوع مسئله",
   "options": [
    {
     "value": "CHRONIC",
     "label": "بیماری مزمن"
    },
    {
     "value": "ACUTE",
     "label": "بیماری حاد/جدی"
    },
    {
     "value": "PHYSICAL",
     "label": "محدودیت جسمی"
    },
    {
     "value": "COGNITIVE",
     "label": "محدودیت شناختی/رشدی"
    },
    {
     "value": "MENTAL",
     "label": "سلامت روان"
    },
    {
     "value": "CARE",
     "label": "نیاز به مراقبت مستمر"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "screening",
    "values": [
     "YES"
    ]
   }
  },
  {
   "key": "functionalImpact",
   "label": "اثر بر زندگی",
   "options": [
    {
     "value": "OPTION_0",
     "label": "محدودیت محسوس ندارد"
    },
    {
     "value": "OPTION_1",
     "label": "محدودیت خفیف"
    },
    {
     "value": "OPTION_2",
     "label": "محدودیت قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "محدودیت شدید / وابستگی"
    }
   ],
   "when": {
    "field": "screening",
    "values": [
     "YES"
    ]
   }
  },
  {
   "key": "treatmentGap",
   "label": "وضعیت درمان / دسترسی",
   "options": [
    {
     "value": "OPTION_0",
     "label": "درمان منظم و کافی"
    },
    {
     "value": "OPTION_1",
     "label": "درمان وجود دارد ولی ناکافی/نامنظم است"
    },
    {
     "value": "OPTION_2",
     "label": "درمان لازم است ولی به‌طور مؤثر دریافت نمی‌شود"
    },
    {
     "value": "OPTION_3",
     "label": "عدم دریافت درمان ضروری همراه با خطر جدی"
    }
   ],
   "when": {
    "field": "screening",
    "values": [
     "YES"
    ]
   }
  },
  {
   "key": "barrier",
   "label": "مانع اصلی درمان، در صورت وجود",
   "options": [
    {
     "value": "NONE",
     "label": "مانعی ندارد"
    },
    {
     "value": "COST",
     "label": "هزینه"
    },
    {
     "value": "SERVICE",
     "label": "نبود خدمت تخصصی"
    },
    {
     "value": "TRAVEL",
     "label": "فاصله/رفت‌وآمد"
    },
    {
     "value": "INSURANCE",
     "label": "بیمه"
    },
    {
     "value": "CAREGIVER",
     "label": "نبود همراه/مراقب"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "screening",
    "values": [
     "YES"
    ]
   },
   "optional": true
  }
 ],
 "health": [
  {
   "key": "financialPressure",
   "label": "هزینه‌ها و نیازهای سلامت چه فشاری بر خانواده ایجاد کرده است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "قابل مدیریت"
    },
    {
     "value": "OPTION_1",
     "label": "فشار محدود"
    },
    {
     "value": "OPTION_2",
     "label": "فشار قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "باعث عدم تأمین سایر نیازهای ضروری شده"
    }
   ]
  }
 ],
 "housing": [
  {
   "key": "residenceType",
   "label": "نوع سکونت",
   "options": [
    {
     "value": "OWNER",
     "label": "مالک"
    },
    {
     "value": "RENT",
     "label": "اجاره‌ای"
    },
    {
     "value": "DEPOSIT",
     "label": "رهنی"
    },
    {
     "value": "RELATIVES",
     "label": "نزد بستگان/دیگران"
    },
    {
     "value": "TEMPORARY",
     "label": "موقت"
    },
    {
     "value": "INFORMAL",
     "label": "غیررسمی"
    },
    {
     "value": "HOMELESS",
     "label": "فاقد محل ثابت"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ]
  },
  {
   "key": "stability",
   "label": "پایداری سکونت",
   "options": [
    {
     "value": "OPTION_0",
     "label": "وضعیت پایدار"
    },
    {
     "value": "OPTION_1",
     "label": "احتمال محدود تغییر اجباری"
    },
    {
     "value": "OPTION_2",
     "label": "ادامه سکونت نامطمئن"
    },
    {
     "value": "OPTION_3",
     "label": "خطر جدی تخلیه/جابه‌جایی"
    },
    {
     "value": "OPTION_4",
     "label": "فاقد سکونت پایدار"
    }
   ]
  },
  {
   "key": "immediateDanger",
   "label": "آیا بی‌ثباتی سکونت با نیاز فوری یا خطر آنی همراه است؟",
   "options": [
    {
     "value": "NO",
     "label": "خیر"
    },
    {
     "value": "YES",
     "label": "بله"
    }
   ],
   "type": "boolean",
   "when": {
    "field": "stability",
    "values": [
     "OPTION_4"
    ]
   }
  },
  {
   "key": "problems",
   "label": "نوع مشکل محل سکونت",
   "options": [
    {
     "value": "SAFETY",
     "label": "سازه/ایمنی"
    },
    {
     "value": "WEATHER",
     "label": "رطوبت/سرما/گرما"
    },
    {
     "value": "UTILITIES",
     "label": "آب/برق/گاز/بهداشت"
    },
    {
     "value": "CROWDING",
     "label": "فضای ناکافی/تراکم"
    },
    {
     "value": "ACCESSIBILITY",
     "label": "نامناسب برای عضو دارای محدودیت"
    },
    {
     "value": "ENVIRONMENT",
     "label": "محیط پیرامونی ناامن"
    },
    {
     "value": "NONE",
     "label": "بدون مشکل مؤثر"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "multiple": true
  },
  {
   "key": "qualitySafety",
   "label": "شدت کلی مشکل مسکن",
   "options": [
    {
     "value": "OPTION_0",
     "label": "بدون مشکل مؤثر"
    },
    {
     "value": "OPTION_1",
     "label": "محدود"
    },
    {
     "value": "OPTION_2",
     "label": "قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "شدید/ناایمن"
    }
   ]
  },
  {
   "key": "financialPressure",
   "label": "فشار مالی مسکن",
   "options": [
    {
     "value": "OPTION_0",
     "label": "بدون فشار محسوس"
    },
    {
     "value": "OPTION_1",
     "label": "قابل مدیریت ولی محدودکننده"
    },
    {
     "value": "OPTION_2",
     "label": "باعث کاهش برخی نیازهای ضروری"
    },
    {
     "value": "OPTION_3",
     "label": "باعث معوقه/بدهی/عدم تأمین ضروریات یا بحران"
    }
   ]
  },
  {
   "key": "fit",
   "label": "تناسب مسکن",
   "options": [
    {
     "value": "OPTION_0",
     "label": "مناسب"
    },
    {
     "value": "OPTION_1",
     "label": "نسبتاً مناسب"
    },
    {
     "value": "OPTION_2",
     "label": "محدودیت قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "نامتناسب جدی"
    }
   ]
  }
 ],
 "vulnerability": [
  {
   "key": "dependency",
   "label": "آیا فردی برای زندگی روزمره به حمایت یا مراقبت دیگری وابسته است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "خیر"
    },
    {
     "value": "OPTION_1",
     "label": "نیاز محدود"
    },
    {
     "value": "OPTION_2",
     "label": "نیاز قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "وابستگی شدید"
    }
   ]
  },
  {
   "key": "dependentMembers",
   "label": "عضو/اعضای وابسته",
   "type": "members",
   "multiple": true,
   "when": {
    "field": "dependency",
    "not": [
     "OPTION_0",
     ""
    ]
   }
  },
  {
   "key": "supportAvailability",
   "label": "حمایت موردنیاز تا چه حد فراهم است؟",
   "options": [
    {
     "value": "ENOUGH",
     "label": "کافی"
    },
    {
     "value": "MOSTLY",
     "label": "تا حد زیادی کافی"
    },
    {
     "value": "INADEQUATE",
     "label": "ناکافی"
    },
    {
     "value": "ABSENT",
     "label": "به‌شدت ناکافی/فاقد حمایت"
    }
   ],
   "when": {
    "field": "dependency",
    "not": [
     "OPTION_0",
     ""
    ]
   }
  },
  {
   "key": "risks",
   "label": "نوع ریسک محیطی/اجتماعی",
   "options": [
    {
     "value": "NETWORK",
     "label": "نبود شبکه حمایت مؤثر"
    },
    {
     "value": "ENVIRONMENT",
     "label": "محیط زندگی ناامن"
    },
    {
     "value": "FAMILY",
     "label": "بی‌ثباتی شدید خانوادگی"
    },
    {
     "value": "LEGAL",
     "label": "مشکل حقوقی/هویتی مؤثر"
    },
    {
     "value": "CAREGIVER",
     "label": "خطر بی‌سرپرستی/فقدان مراقب"
    },
    {
     "value": "DEPENDENT",
     "label": "خطر مؤثر برای کودک/سالمند/فرد وابسته"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    },
    {
     "value": "NONE",
     "label": "هیچ‌کدام"
    }
   ],
   "multiple": true
  },
  {
   "key": "socialRisk",
   "label": "شدت ریسک",
   "options": [
    {
     "value": "OPTION_0",
     "label": "فاقد ریسک مؤثر"
    },
    {
     "value": "OPTION_1",
     "label": "نیازمند پایش"
    },
    {
     "value": "OPTION_2",
     "label": "ریسک قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "نیازمند اقدام سریع"
    }
   ]
  },
  {
   "key": "immediateDanger",
   "label": "آیا خطر فوری برای کودک، سالمند یا فرد وابسته وجود دارد؟",
   "options": [
    {
     "value": "NO",
     "label": "خیر"
    },
    {
     "value": "YES",
     "label": "بله"
    }
   ],
   "type": "boolean",
   "when": {
    "field": "risks",
    "includes": "DEPENDENT"
   }
  },
  {
   "key": "crisisType",
   "label": "بحران در شش ماه اخیر",
   "options": [
    {
     "value": "DEATH",
     "label": "فوت عضو مؤثر"
    },
    {
     "value": "HEALTH",
     "label": "بیماری/بستری جدی"
    },
    {
     "value": "INCOME",
     "label": "از دست دادن منبع اصلی درآمد"
    },
    {
     "value": "SEPARATION",
     "label": "جدایی/ازهم‌گسیختگی"
    },
    {
     "value": "HOUSING",
     "label": "از دست دادن مسکن"
    },
    {
     "value": "DISASTER",
     "label": "حادثه/بلای طبیعی"
    },
    {
     "value": "LEGAL",
     "label": "بحران حقوقی مهم"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    },
    {
     "value": "NONE",
     "label": "خیر"
    }
   ]
  },
  {
   "key": "crisis",
   "label": "اثر بحران",
   "options": [
    {
     "value": "OPTION_1",
     "label": "محدود"
    },
    {
     "value": "OPTION_2",
     "label": "قابل توجه"
    },
    {
     "value": "OPTION_3",
     "label": "شدید/بحرانی"
    }
   ],
   "when": {
    "field": "crisisType",
    "not": [
     "NONE",
     ""
    ]
   }
  }
 ],
 "educationMember": [
  {
   "key": "status",
   "label": "وضعیت تحصیل این عضو چگونه است؟",
   "options": [
    {
     "value": "OPTION_0",
     "label": "مشغول تحصیل و بدون مشکل مؤثر"
    },
    {
     "value": "OPTION_1",
     "label": "مشکل محدود ولی ادامه تحصیل برقرار است"
    },
    {
     "value": "OPTION_2",
     "label": "مشکل پایدار و نیازمند حمایت"
    },
    {
     "value": "OPTION_3",
     "label": "غیبت شدید / خطر جدی ترک تحصیل"
    },
    {
     "value": "OPTION_4",
     "label": "ترک تحصیل یا ثبت‌نام‌نشده به‌دلیل مانع مؤثر"
    },
    {
     "value": "UNKNOWN",
     "label": "نامشخص"
    }
   ]
  },
  {
   "key": "barrier",
   "label": "مانع اصلی",
   "options": [
    {
     "value": "COST",
     "label": "هزینه"
    },
    {
     "value": "TRAVEL",
     "label": "رفت‌وآمد"
    },
    {
     "value": "DIGITAL",
     "label": "ابزار/اینترنت"
    },
    {
     "value": "LEARNING",
     "label": "یادگیری"
    },
    {
     "value": "HEALTH",
     "label": "سلامت"
    },
    {
     "value": "CHILD_LABOUR",
     "label": "اشتغال کودک/نوجوان"
    },
    {
     "value": "CARE",
     "label": "مسئولیت مراقبتی"
    },
    {
     "value": "REGISTRATION",
     "label": "ثبت‌نام/مدارک"
    },
    {
     "value": "FAMILY",
     "label": "شرایط خانوادگی"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "status",
    "values": [
     "OPTION_1",
     "OPTION_2",
     "OPTION_3",
     "OPTION_4"
    ]
   }
  },
  {
   "key": "support",
   "label": "حمایت اصلی موردنیاز",
   "options": [
    {
     "value": "SUPPLIES",
     "label": "هزینه/لوازم"
    },
    {
     "value": "TRAVEL",
     "label": "رفت‌وآمد"
    },
    {
     "value": "DIGITAL",
     "label": "ابزار دیجیتال"
    },
    {
     "value": "TUTORING",
     "label": "آموزش تقویتی"
    },
    {
     "value": "REGISTRATION",
     "label": "پیگیری ثبت‌نام"
    },
    {
     "value": "FAMILY",
     "label": "حمایت خانوادگی"
    },
    {
     "value": "OTHER",
     "label": "سایر"
    }
   ],
   "when": {
    "field": "status",
    "values": [
     "OPTION_1",
     "OPTION_2",
     "OPTION_3",
     "OPTION_4"
    ]
   }
  }
 ]
};
export const domainLabels:Record<string,string>={livelihood:'معیشت و اقتصاد',health:'سلامت و درمان',housing:'مسکن',vulnerability:'آسیب‌پذیری ویژه',education:'آموزش'};
export function visibleQuestion(q:Question,values:Record<string,unknown>):boolean {if(!q.when)return true;const value=values[q.when.field]??'';if(q.when.values)return q.when.values.includes(String(value));if(q.when.not)return !q.when.not.includes(String(value));return Array.isArray(value)&&value.includes(q.when.includes);}
