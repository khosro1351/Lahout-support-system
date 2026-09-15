import { AppError } from '../common/app-error';

// Bounded, single-process limiter. No Redis is needed for this local slice.
const attempts = new Map<string, { count: number; until: number }>();
export function checkLoginRate(ip: string): void {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const entry = attempts.get(ip);
  if ((entry && entry.count >= 10) || (!entry && attempts.size >= 10000)) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید.');
  }
  attempts.set(ip, { count: (entry?.count ?? 0) + 1, until: entry?.until ?? now + 300000 });
}
