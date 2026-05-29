import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { registerSchema, loginSchema } from './auth.schemas';
import * as authService from './auth.service';
import type { AuthRequest } from '../../middlewares/auth';

// El Controller es el puente entre HTTP y el Service.
// Su única responsabilidad es:
//   1. Leer los datos de la petición (req)
//   2. Validarlos con Zod
//   3. Llamar al Service
//   4. Responder al cliente (res)
// Si algo falla, llama a next(error) para que el errorHandler lo gestione.

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // parse() lanza ZodError si los datos no cumplen el schema
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      // .issues contiene el array de errores de validación en Zod v3+
      res.status(400).json({ errors: error.issues.map((e) => e.message) });
      return;
    }
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ errors: error.issues.map((e) => e.message) });
      return;
    }
    next(error);
  }
}

export async function me(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user lo inyecta el middleware authenticate antes de llegar aquí
    const user = await authService.getMe(req.user!.id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}
