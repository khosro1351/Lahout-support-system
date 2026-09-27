import assert from 'node:assert/strict';
import {formatPersianDate,formatPersianDateTime} from '../apps/frontend/src/utils/persianDate.ts';
assert.equal(formatPersianDate('2026-09-26'),'۱۴۰۵/۰۷/۰۴');
assert.equal(formatPersianDateTime('2026-09-26T11:00:00Z'),'۱۴۰۵/۰۷/۰۴ - ۱۴:۳۰');
assert.equal(formatPersianDateTime('2026-09-25T21:00:00Z'),'۱۴۰۵/۰۷/۰۴ - ۰۰:۳۰');
assert.equal(formatPersianDate(new Date('2026-09-26T11:00:00Z')),'۱۴۰۵/۰۷/۰۴');
for(const value of [null,undefined,'','invalid'])assert.equal(formatPersianDateTime(value),'—');
assert.doesNotMatch(formatPersianDateTime('2026-09-26T11:00:00Z'),/[0-9]/);
console.log('PASS Persian date: fixed date/time, Tehran midnight, Date input, empty/invalid, Persian digits');

import {parsePersianDate,toPersianDigits,persianMonthLength} from '../apps/frontend/src/utils/persianDate.ts';
assert.equal(parsePersianDate('۱۴۰۵/۰۶/۲۹'),'2026-09-20');
assert.equal(parsePersianDate('۱۳۴۴/۰۲/۱۸'),'1965-05-08');
assert.equal(parsePersianDate('1405/07/04'),'2026-09-26');
assert.equal(parsePersianDate('١٤٠٥/٠٧/٠٤'),'2026-09-26');
assert.equal(parsePersianDate('۱۳۹۹/۱۲/۳۰'),'2021-03-20');
for(const date of ['۱۴۰۰/۱۲/۳۰','۱۴۰۵/۰۷/۳۱','۱۴۰۵/۱۳/۰۱','۱۴۰۵/۰۰/۱۰','۱۴۰۵/۰۱/۰۰','۱۴۰۵/۰۱/۳۲','۱۴۰۵/۷/۴','bad'])
 assert.equal(parsePersianDate(date),null,date);
assert.equal(parsePersianDate(''),'');
assert.equal(parsePersianDate('  '),'');
assert.equal(toPersianDigits('1405/٠٧/04'),'۱۴۰۵/۰۷/۰۴');
for(let year=1900;year<=2100;year+=5)for(let month=0;month<12;month++){
 const iso=new Date(Date.UTC(year,month,20)).toISOString().slice(0,10);
 assert.equal(parsePersianDate(formatPersianDate(iso)),iso);
}
console.log('PASS Jalali input: 492 civil-date round trips, leap dates, invalid days, optional empty and Persian/Arabic/Latin digits');

assert.equal(persianMonthLength(1399,12),30);assert.equal(persianMonthLength(1400,12),29);assert.equal(persianMonthLength(1405,6),31);assert.equal(persianMonthLength(1405,7),30);assert.equal(persianMonthLength(1405,13),0);
console.log('PASS Jalali select days: leap Esfand, month boundaries and invalid month');
