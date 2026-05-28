import dotenv from 'dotenv';

dotenv.config();

// Centralizamos todas las variables de entorno en un solo lugar.
// Si falta alguna variable crítica, el servidor falla al arrancar (fail-fast),
// en lugar de fallar silenciosamente en tiempo de ejecución.
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:3000',
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
};
