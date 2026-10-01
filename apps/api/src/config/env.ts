import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const DEV_ACCESS_SECRET = 'change-me-dev-access-secret-at-least-32-characters';
const DEV_ENCRYPTION_KEY = 'ZGV2LW9ubHktdG9rZW4tZW5jcnlwdGlvbi1rZXktMzI=';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    WEB_ORIGIN: z.url(),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'Must be 32 bytes, base64-encoded'),
    COOKIE_SECURE: bool.default(false),
    /**
     * Express 'trust proxy' setting so rate limits and audit logs see the real
     * client IP behind Cloudflare/Nginx/Next. 'false', 'true' (1 hop), a hop
     * count, or a subnet list such as 'loopback,uniquelocal'.
     */
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((v): boolean | number | string => {
        if (v === 'false' || v === '0' || v === '') return false;
        if (v === 'true') return 1;
        if (/^\d+$/.test(v)) return Number(v);
        return v;
      }),
    SWAGGER_ENABLED: bool.optional(),
    R2_ENDPOINT: z.string().min(1),
    R2_PUBLIC_ENDPOINT: z.string().optional(),
    R2_ACCESS_KEY: z.string().min(1),
    R2_SECRET_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    STORAGE_AUTO_CREATE_BUCKET: bool.default(false),
    RAZORPAY_KEY: z.string().optional(),
    RAZORPAY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    METRICS_TOKEN: z.string().optional(),
    RATE_LIMIT_DISABLED: bool.default(false),
    /** "Continue with Google": both set to enable. The redirect URI defaults to <WEB_ORIGIN>/api/v1/auth/google/callback. */
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.url().optional(),
    /** Google's OpenID endpoints; only overridden by tests. */
    GOOGLE_ISSUER: z.url().default('https://accounts.google.com'),
    GOOGLE_AUTH_URL: z.url().default('https://accounts.google.com/o/oauth2/v2/auth'),
    GOOGLE_TOKEN_URL: z.url().default('https://oauth2.googleapis.com/token'),
    GOOGLE_JWKS_URL: z.url().default('https://www.googleapis.com/oauth2/v3/certs'),
    /**
     * Custom domains: hosts point a CNAME at this name (default "domains.<web host>"),
     * or A records at CUSTOM_DOMAIN_ADDRESSES for apex domains.
     */
    CUSTOM_DOMAIN_TARGET: z.string().optional(),
    CUSTOM_DOMAIN_ADDRESSES: z
      .string()
      .default('')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    /** Cloudflare for SaaS issues certificates for customer domains when both are set. */
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_ZONE_ID: z.string().optional(),
    CLOUDFLARE_API_BASE: z.url().optional(),
    /** Without Cloudflare: 'manual' means the operator provides customer-domain certificates. Unset = feature unavailable. */
    CUSTOM_DOMAIN_TLS: z.enum(['manual']).optional(),
    /** Staff (SUPPORT, PLATFORM_ADMIN) must pass two-step sign-in before any admin route. Defaults to true in production. */
    STAFF_MFA_REQUIRED: bool.optional(),
    /** 'pretty' needs the pino-pretty dev dependency; containers always log JSON. */
    LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_SECRET'], message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither' });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Dev secret used in production' });
    }
    if (env.TOKEN_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
      ctx.addIssue({ code: 'custom', path: ['TOKEN_ENCRYPTION_KEY'], message: 'Dev key used in production' });
    }
    if (!env.COOKIE_SECURE) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Must be true in production' });
    }
    if (env.RATE_LIMIT_DISABLED) {
      ctx.addIssue({ code: 'custom', path: ['RATE_LIMIT_DISABLED'], message: 'Cannot disable rate limiting in production' });
    }
    if (env.STAFF_MFA_REQUIRED === false) {
      ctx.addIssue({ code: 'custom', path: ['STAFF_MFA_REQUIRED'], message: 'Staff two-step sign-in cannot be disabled in production' });
    }
    // An empty REDIS_PASSWORD would start Redis without authentication.
    if (!urlHasPassword(env.REDIS_URL)) {
      ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'Redis must require a password in production' });
    }
    for (const [key, value] of Object.entries(env)) {
      if (value === 'CHANGE_ME') ctx.addIssue({ code: 'custom', path: [key], message: 'Still the CHANGE_ME placeholder from .env.production.example' });
    }
  });

function urlHasPassword(url: string): boolean {
  try {
    return new URL(url).password !== '';
  } catch {
    return false;
  }
}

export type AppConfig = z.infer<typeof EnvSchema> & { swaggerEnabled: boolean; allowedOrigins: string[]; staffMfaRequired: boolean };

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  return {
    ...env,
    swaggerEnabled: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    staffMfaRequired: env.STAFF_MFA_REQUIRED ?? env.NODE_ENV === 'production',
    allowedOrigins: Array.from(new Set([env.WEB_ORIGIN, ...env.CORS_ORIGINS])),
  };
}
