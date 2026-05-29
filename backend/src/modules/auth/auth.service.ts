import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import type { RegisterInput, LoginInput } from './auth.schemas';

// El Service contiene toda la lógica de negocio.
// No sabe nada de HTTP: no conoce req ni res.
// Eso lo hace reutilizable y fácil de probar de forma aislada.

// Tiempo en segundos que tarda bcrypt en generar el hash.
// 12 rounds = ~300ms. Es lento a propósito: dificulta ataques de fuerza bruta.
const SALT_ROUNDS = 12;

function generateToken(userId: string, email: string): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ id: userId, email }, env.JWT_SECRET, options);
}

export async function register(input: RegisterInput) {
  // 1. Verificar que el email no esté en uso
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    // 409 Conflict: el recurso ya existe
    throw new AppError('Email already in use', 409);
  }

  // 2. Hashear la contraseña — NUNCA guardamos texto plano
  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  // 3. Crear el usuario en la base de datos
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
    },
    // Seleccionamos solo los campos que devolveremos al cliente.
    // Nunca devolvemos el campo password, ni siquiera el hash.
    select: { id: true, name: true, email: true, createdAt: true },
  });

  // 4. Generar y devolver el token
  const token = generateToken(user.id, user.email);
  return { user, token };
}

export async function login(input: LoginInput) {
  // 1. Buscar el usuario (traemos el password solo aquí, para compararlo)
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Usamos el mismo mensaje para "email no existe" y "contraseña incorrecta".
  // Si diferenciáramos los mensajes, estaríamos confirmando qué emails están registrados.
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // 2. Comparar la contraseña con el hash guardado
  const passwordMatch = await bcrypt.compare(input.password, user.password);

  if (!passwordMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // 3. Devolver usuario (sin password) y token
  const { password: _omit, ...safeUser } = user;
  const token = generateToken(user.id, user.email);
  return { user: safeUser, token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}
