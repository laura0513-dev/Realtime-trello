/**
 * Tests unitarios para el middleware authenticate (auth.ts)
 *
 * ─── APIS DE VITEST NUEVAS EN ESTE ARCHIVO ───────────────────────────────────
 *
 * vi.fn() como argumento (next)
 *   Creamos vi.fn() para Next de Express. Después de llamar al middleware,
 *   comprobamos qué argumento recibió next (error o nada).
 *
 * toHaveBeenCalledWith(arg)
 *   Verifica que un mock fue invocado con el argumento exacto. Usamos
 *   expect.objectContaining() para solo verificar propiedades relevantes.
 *
 * toHaveBeenCalledTimes(n)
 *   Verifica el número exacto de veces que fue invocada la función mock.
 *
 * not.toHaveBeenCalled()
 *   El inverso: verifica que la función NO fue llamada. Útil para confirmar
 *   que el middleware llamó a next(error) en lugar de next() (sin error).
 *
 * expect.objectContaining({ key: val })
 *   Matcher parcial: verifica que el objeto tenga AL MENOS esas propiedades.
 *   Ignora propiedades adicionales del objeto. Equivale a jest.objectContaining.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ─── MOCKS ────────────────────────────────────────────────────────────────────

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'super-secret-key-for-tests',
    JWT_EXPIRES_IN: '7d',
    PORT: '4000',
    CLIENT_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    // verify se mockea por defecto como vi.fn() sin valor de retorno.
    // Cada test configurará el comportamiento que necesita.
    verify: vi.fn(),
  },
}));

// ─── IMPORTACIONES DEL MÓDULO BAJO TEST ──────────────────────────────────────
import { authenticate } from '../middlewares/auth';
import type { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';

// ─── HELPERS: Factories para req/res/next ────────────────────────────────────
// Evitamos repetir la construcción de objetos mock en cada test.

/** Crea un mock de Express Request con el header Authorization dado */
const makeReq = (authHeader?: string): AuthRequest =>
  ({
    headers: authHeader ? { authorization: authHeader } : {},
  }) as unknown as AuthRequest;

/** Crea un mock de Express Response (no se usa en authenticate pero Express lo requiere) */
const makeRes = (): Response => ({}) as unknown as Response;

/** Crea un mock de NextFunction para verificar cómo fue invocado */
const makeNext = () => vi.fn() as unknown as NextFunction;

// ─────────────────────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * A7 — Sin header Authorization → 401 No token provided
   * El middleware debe llamar a next(error) con AppError cuando no hay token.
   * next(error) en Express activa el error handler global.
   */
  it('A7 - llama a next(AppError 401) si no hay header Authorization', () => {
    const req = makeReq(); // sin header
    const res = makeRes();
    const next = makeNext();

    // Act: el middleware es síncrono, no async
    authenticate(req, res, next);

    // Assert: next fue llamado UNA vez con un AppError
    expect(next).toHaveBeenCalledTimes(1);

    // Extraemos el argumento con el que se llamó next
    const errorArg = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.message).toBe('No token provided');
    expect(errorArg.statusCode).toBe(401);
  });

  /**
   * A8 — Token inválido → 401 Invalid or expired token
   * jwt.verify lanza una excepción cuando el token es inválido o ha expirado.
   * El middleware captura esa excepción y llama a next(AppError).
   */
  it('A8 - llama a next(AppError 401) si jwt.verify lanza una excepción', () => {
    // Arrange: jwt.verify lanza JsonWebTokenError (token malformado)
    // mockImplementation permite definir una implementación personalizada del mock
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const req = makeReq('Bearer token.invalido.aqui');
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.message).toBe('Invalid or expired token');
    expect(errorArg.statusCode).toBe(401);
  });

  /**
   * Bonus — Token válido → inyecta user en req y llama next() sin argumentos
   * Cuando el token es válido, el middleware decodifica el payload, lo asigna
   * a req.user y llama a next() (sin error) para pasar al siguiente handler.
   */
  it('inyecta req.user y llama next() sin error cuando el token es válido', () => {
    const fakePayload = { id: 'user-1', email: 'laura@test.com' };

    // Arrange: jwt.verify retorna el payload decodificado (síncrono)
    // mockReturnValue se usa aquí porque jwt.verify es síncrono
    vi.mocked(jwt.verify).mockReturnValue(fakePayload as never);

    const req = makeReq('Bearer valid.jwt.token');
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    // Assert: req.user fue poblado con el payload
    expect(req.user).toEqual(fakePayload);

    // Assert: next fue llamado SIN argumentos (sin error = continuar al handler)
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
