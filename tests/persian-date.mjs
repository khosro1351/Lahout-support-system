import assert from 'node:assert/strict';
import {formatPersianDate,formatPersianDateTime} from '../apps/frontend/src/utils/persianDate.ts';
assert.equal(formatPersianDate('2026-09-26'),'۱۴۰۵/۰۷/۰۴');
assert.equal(formatPersianDateTime('2026-09-26T11:00:00Z'),'۱۴۰۵/۰۷/۰۴ - ۱۴:۳۰');
assert.equal(formatPersianDateTime('2026-09-25T21:00:00Z'),'۱۴۰۵/۰۷/۰۴ - ۰۰:۳۰');
assert.equal(formatPersianDate(new Date('2026-09-26T11:00:00Z')),'۱۴۰۵/۰۷/۰۴');
for(const value of [null,undefined,'','invalid'])assert.equal(formatPersianDateTime(value),'—');
assert.doesNotMatch(formatPersianDateTime('2026-09-26T11:00:00Z'),/[0-9]/);
console.log('PASS Persian date: fixed date/time, Tehran midnight, Date input, empty/invalid, Persian digits');
