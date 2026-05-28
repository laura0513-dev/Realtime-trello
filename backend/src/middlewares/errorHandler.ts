import { Request, Response, NextFunction } from 'express';

// Clase base para errores operacionales (errores esperados).
// Distinguimos errores operacionales (400, 401, 404...) de errores de
// programación (bugs) para responder apropiadamente al cliente.
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware de manejo global de errores de Express.
// Recibe 4 parámetros (err, req, res, next): así Express lo identifica
// como error handler y lo invoca solo cuando se llama next(error).
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // Error inesperado: no exponemos detalles internos al cliente
  console.error('[unhandled error]', err);
  res.status(500).json({ message: 'Internal server error' });
}
