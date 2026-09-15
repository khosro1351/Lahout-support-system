export type AppConfig = {
  appEnv: string;
  backendPort: number;
  frontendOrigin: string;
  databaseUrl: string;
  sessionTtlHours: number;
  cookieSecure: boolean;
};

export function loadConfig(): AppConfig {
  const required = ['DATABASE_URL', 'FRONTEND_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const ttl = Number(process.env.SESSION_TTL_HOURS ?? 12);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 24) throw new Error('Invalid session lifetime');
  if (process.env.APP_ENV === 'production' && (process.env.COOKIE_SECURE !== 'true' || !process.env.FRONTEND_ORIGIN!.startsWith('https://'))) throw new Error('Production requires HTTPS and secure cookies');
  return {
    appEnv: process.env.APP_ENV ?? 'development',
    backendPort: Number(process.env.BACKEND_PORT ?? 3000),
    frontendOrigin: process.env.FRONTEND_ORIGIN!,
    databaseUrl: process.env.DATABASE_URL!,
    sessionTtlHours: ttl,
    cookieSecure: (process.env.COOKIE_SECURE ?? 'false') === 'true',
  };
}
