/**
 * Tests unitarios para auth.service.ts
 *
 * ─── GUÍA DE APIs DE VITEST UTILIZADAS EN ESTE ARCHIVO ───────────────────────
 *
 * describe(nombre, fn)
 *   Agrupa tests relacionados bajo un nombre común. Anida sin límite para
 *   organizar suites por módulo o comportamiento.
 *
 * it(nombre, fn) / test(nombre, fn)
 *   Define un caso de prueba individual. 'it' se lee como "it should…"
 *   (debería…). Ambas funciones son equivalentes.
 *
 * expect(valor)
 *   Punto de entrada para las aserciones. Sin él el test pasa aunque el código
 *   esté roto. Encadena matchers como .toBe(), .toBeInstanceOf(), etc.
 *
 * vi.mock(ruta, factoryFn?)
 *   Intercepta un módulo completo y reemplaza sus exportaciones por mocks.
 *   IMPORTANTE: vi.mock() se "iza" (hoisted) al principio del archivo antes
 *   de los imports, por lo que la factory se ejecuta de forma lazy cuando el
 *   módulo se importa por primera vez.
 *
 * vi.fn()
 *   Crea una función mock (spy) que registra sus llamadas, argumentos y
 *   valor de retorno. Equivale a jest.fn().
 *
 * vi.mocked(fn)
 *   Devuelve la misma función pero con el tipo TypeScript de un mock, dando
 *   acceso a .mockResolvedValue(), .mockReturnValue(), etc. con type-safety.
 *
 * mockResolvedValue(valor)
 *   Configura el mock para que retorne Promise.resolve(valor) en cada llamada
 *   sucesiva. Ideal para simular operaciones async de Prisma.
 *
 * mockResolvedValueOnce(valor)
 *   Igual que mockResolvedValue pero solo para la PRÓXIMA llamada. Útil cuando
 *   la misma función mock se llama varias veces con resultados distintos.
 *
 * mockReturnValue(valor)
 *   Configura el mock para retornar un valor síncrono en cada llamada.
 *   Usado para jwt.sign que es síncrono.
 *
 * beforeEach(fn)
 *   Se ejecuta antes de cada test individual. Aquí lo usamos para resetear
 *   el estado de los mocks y garantizar tests independientes (sin contaminación
 *   entre ellos).
 *
 * mockReset(mock) — de vitest-mock-extended
 *   Limpia el estado completo del deep mock de Prisma: borra valores de retorno
 *   configurados, historial de llamadas y cualquier implementación mock.
 *
 * mockDeep<T>() — de vitest-mock-extended
 *   Crea un "deep mock" de un tipo complejo (como PrismaClient) donde TODOS
 *   sus métodos anidados son automáticamente vi.fn(). Evita tener que definir
 *   manualmente cientos de métodos de Prisma.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─── MOCKS DE MÓDULOS ─────────────────────────────────────────────────────────
// Todos los vi.mock() se izan al principio del archivo por Vitest, así
// que las importaciones del módulo bajo test (auth.service) recibirán los
// mocks, no los módulos reales.

// 1. Mock de la base de datos: reemplaza prisma con un deep mock
vi.mock('../config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// 2. Mock de variables de entorno: proporciona valores seguros para tests
vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'super-secret-key-for-tests',
    JWT_EXPIRES_IN: '7d',
    PORT: '4000',
    CLIENT_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));

// 3. Mock de bcryptjs: evitamos el hash real (12 rondas = ~300ms por test)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// 4. Mock de jsonwebtoken: devolvemos un token predecible sin firmar nada real
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn(),
  },
}));

// ─── IMPORTACIONES DEL MÓDULO BAJO TEST ──────────────────────────────────────
// Se importan DESPUÉS de vi.mock() aunque Vitest iza los mocks al principio.
import { register, login, getMe } from '../modules/auth/auth.service';
import { registerSchema } from '../modules/auth/auth.schemas';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';

// ─── SETUP DEL MOCK DE PRISMA ─────────────────────────────────────────────────
// Casteamos 'prisma' al tipo del mock para acceder a mockResolvedValue etc.
// ReturnType<typeof mockDeep<PrismaClient>> es el tipo del mock profundo.
type MockPrisma = ReturnType<typeof mockDeep<PrismaClient>>;
const db = prisma as unknown as MockPrisma;

// ─────────────────────────────────────────────────────────────────────────────

describe('Auth Service', () => {
  // beforeEach se ejecuta antes de CADA it(). Resetea todos los mocks para
  // que un test no "contamine" el estado de los siguientes.
  beforeEach(() => {
    mockReset(db);
    // vi.clearAllMocks() resetea el historial de llamadas de vi.fn() no-prisma
    vi.clearAllMocks();
    // Restauramos el valor de retorno por defecto de jwt.sign
    vi.mocked(jwt.sign).mockReturnValue('mock.jwt.token' as never);
  });

  // ─── REGISTER ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    /**
     * A1 — Registro exitoso
     * Flujo: findUnique (no existe) → hash → create → jwt.sign → { user, token }
     * Verificamos que la respuesta tiene user y token, y que user NO expone password.
     */
    it('A1 - registra un nuevo usuario y retorna user + token', async () => {
      // Arrange: el email no está en uso
      db.user.findUnique.mockResolvedValue(null);

      // Arrange: bcrypt.hash devuelve un hash simulado
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password_123' as never);

      // Arrange: Prisma crea el usuario (SELECT sin campo password)
      db.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Laura',
        email: 'laura@test.com',
        createdAt: new Date(),
      } as any);

      // Act
      const result = await register({
        name: 'Laura',
        email: 'laura@test.com',
        password: 'SecurePass1',
      });

      // Assert: la respuesta tiene la forma correcta
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('mock.jwt.token');

      // Assert: el user retornado NO tiene password (campo sensible ocultado)
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe('laura@test.com');

      // Assert: se verificó que el email no existía antes de crear
      expect(db.user.findUnique).toHaveBeenCalledTimes(1);
      // Assert: la contraseña fue hasheada (nunca guardamos en plano)
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass1', expect.any(Number));
    });

    /**
     * A2 — Email duplicado → 409 Conflict
     * Si el email ya existe, debe lanzar AppError con statusCode 409.
     * Usamos .catch(e => e) en lugar de try/catch para aplanar el código.
     */
    it('A2 - lanza AppError 409 si el email ya está en uso', async () => {
      // Arrange: findUnique retorna un usuario existente
      db.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        name: 'Otro',
        email: 'laura@test.com',
        password: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act: capturamos el error con .catch(e => e) en lugar de try/catch
      // Este patrón es más limpio y funciona perfecto con async/await
      const error = await register({
        name: 'Laura',
        email: 'laura@test.com',
        password: 'SecurePass1',
      }).catch((e) => e);

      // Assert
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Email already in use');
      expect(error.statusCode).toBe(409);

      // Assert: create nunca debe llamarse si el email ya existe
      expect(db.user.create).not.toHaveBeenCalled();
    });

    /**
     * A3 — Validación Zod del schema de registro
     * El schema registerSchema valida la contraseña. Una contraseña débil
     * debe hacer que safeParse() retorne success:false con los issues correctos.
     * Nota: esta validación ocurre en el controller, no en el service.
     * Aquí probamos el schema directamente para mayor cobertura.
     */
    it('A3 - registerSchema rechaza contraseña sin mayúscula ni número', () => {
      // Act: safeParse() nunca lanza, solo retorna { success, data } o { success, error }
      const result = registerSchema.safeParse({
        name: 'Laura',
        email: 'laura@test.com',
        password: 'weakpass', // sin mayúscula ni número
      });

      // Assert: la validación falla
      expect(result.success).toBe(false);

      if (!result.success) {
        // error.issues es el array de errores en Zod v3/v4 (NOT error.errors)
        // Verificamos que hay al menos un issue relacionado con la contraseña
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── LOGIN ─────────────────────────────────────────────────────────────────

  describe('login()', () => {
    /**
     * A4 — Login exitoso
     * Flujo: findUnique → bcrypt.compare (true) → jwt.sign → { user, token }
     */
    it('A4 - autentica correctamente y retorna user + token', async () => {
      // Arrange: usuario encontrado en la BD con hash almacenado
      db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Laura',
        email: 'laura@test.com',
        password: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Arrange: bcrypt.compare confirma que la contraseña coincide
      // mockResolvedValue(true as never) — 'as never' para satisfacer el tipo
      // booleano que bcrypt.compare retorna en su tipado de TS
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act
      const result = await login({
        email: 'laura@test.com',
        password: 'SecurePass1',
      });

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      // El objeto user en la respuesta no debe exponer el hash de la contraseña
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe('laura@test.com');
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });

    /**
     * A5 — Email no encontrado → 401 Invalid credentials
     * SEGURIDAD: el mensaje de error es IDÉNTICO al de contraseña incorrecta
     * para no revelar si un email está registrado (user enumeration attack).
     */
    it('A5 - lanza AppError 401 si el email no existe', async () => {
      // Arrange: ningún usuario con ese email
      db.user.findUnique.mockResolvedValue(null);

      const error = await login({
        email: 'noexiste@test.com',
        password: 'cualquier-pass',
      }).catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);

      // bcrypt.compare nunca debe llamarse si no hay usuario
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    /**
     * A6 — Contraseña incorrecta → mismo error que A5 (401 Invalid credentials)
     * SEGURIDAD: error idéntico para email inexistente y contraseña incorrecta.
     * Así el atacante no puede distinguir entre los dos casos.
     */
    it('A6 - lanza AppError 401 si la contraseña no coincide (mismo mensaje que A5)', async () => {
      // Arrange: el usuario existe
      db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Laura',
        email: 'laura@test.com',
        password: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Arrange: bcrypt.compare dice que la contraseña NO coincide
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const error = await login({
        email: 'laura@test.com',
        password: 'ContrasenaEquivocada1',
      }).catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      // El mensaje es EXACTAMENTE el mismo que en A5 — esto es intencional
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
    });
  });

  // ─── GET ME ────────────────────────────────────────────────────────────────

  describe('getMe()', () => {
    /**
     * Bonus — Usuario no encontrado → 404
     */
    it('lanza AppError 404 si el userId no corresponde a ningún usuario', async () => {
      db.user.findUnique.mockResolvedValue(null);

      const error = await getMe('id-inexistente').catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });
});
