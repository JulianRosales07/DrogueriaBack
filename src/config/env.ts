import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    projectId: process.env.SUPABASE_PROJECT_ID!,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockDurationMinutes: parseInt(process.env.LOCK_DURATION_MINUTES || '30', 10),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    // Si CORS_ORIGIN está definida (recomendado en producción), se usa esa lista
    // separada por comas. Si no, usamos un fallback que cubre desarrollo local
    // (varios puertos de Vite) y el dominio de producción en Vercel.
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'https://drogueria-alpha.vercel.app',
        ],
  },

  // Upload (Supabase Storage)
  storage: {
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;
