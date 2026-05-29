# Realtime Trello

Aplicación Kanban en tiempo real construida para portafolio.

## Stack
- **Frontend:** React + TypeScript + Material UI
- **Backend:** Node.js + Express + Socket.io
- **Auth:** JWT + bcryptjs
- **Base de datos:** PostgreSQL + Prisma ORM
- **Infraestructura:** Docker + docker-compose

## Arquitectura
Patrón de capas (Layered Architecture): cada parte del código tiene una sola responsabilidad y no sabe lo que hacen las demás. Principio Fail-Fast aplicado en la capa de configuración.

## Desarrollo local — Credenciales de prueba

> ⚠️ Estos datos son únicamente para entorno local de desarrollo. Nunca uses credenciales reales en un repositorio público.

| Campo    | Valor            |
|----------|------------------|
| Nombre   | Laura            |
| Email    | laura@test.com   |
| Password | Test1234         |

### Endpoints de autenticación

```bash
# Registro
POST http://localhost:4000/api/auth/register
{ "name": "Laura", "email": "laura@test.com", "password": "Test1234" }

# Login
POST http://localhost:4000/api/auth/login
{ "email": "laura@test.com", "password": "Test1234" }

# Perfil (requiere token Bearer)
GET http://localhost:4000/api/auth/me
```

## Testing

El backend tiene **29 tests unitarios** cubriendo auth, boards, columns, cards y eventos WebSocket.

### Por qué Vitest en lugar de Jest

| Criterio | Vitest | Jest |
|---|---|---|
| **TypeScript** | Nativo, sin configuración adicional | Requiere `ts-jest` o `babel-jest` |
| **Velocidad** | 2-10x más rápido (usa esbuild internamente) | Más lento en proyectos TypeScript |
| **API** | 100% compatible con Jest (`describe`, `it`, `expect`) | — |
| **ESM** | Soporte nativo | Requiere transformadores adicionales |
| **Integración** | Mismo ecosistema que Vite (frontend) | Ecosistema separado |

En resumen: misma API de Jest, menos configuración y mayor velocidad. Para un stack moderno TypeScript + Vite, Vitest es la elección natural.

### Ejecutar los tests

```bash
cd backend

# Ejecutar todos los tests una vez
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con reporte de cobertura
npm run test:coverage
```

### Cobertura

- `auth.service.ts` — registro, login, getMe (happy path + errores)
- `authenticate` middleware — token ausente, inválido y válido
- `boards.service.ts` — crear tablero, listar, acceso denegado
- `columns.service.ts` — crear, reordenar (arriba/abajo), eliminar, autorización
- `cards.service.ts` — crear, mover (misma columna / columna cruzada), eliminar, autorización
- `cards.controller.ts` — emisión de eventos WebSocket (`card:created`, `card:moved`, aislamiento de sala)

# Conceptos:
Concepto Fail-Fast:
Viene de la electrónica: proteger el sistema antes de que el daño se propague.

Patrón SINGLETON: Una clase solo puede tener una instancia en toda la aplicación y hay un punto de acceso global a ella. 

Websocket: Funciona como una llamada telefónica siempre abierta. Podría simularse con polling en front-end pero sería desgastante y no en tiempo real.

Socket.io implementa el patrón OBSERVER: este consta de emisores de eventos y suscriptores. En este caso, hay una emisión de evento de card movido, y una suscripción que recibe la información.

Una room implementan el patrón de diseño GROUP/CHANNEL: Mandan un evento solo a los usuarios suscritos a un tablero del board específico.

Prisma: ORM (object-relational-mapper). Este genera los modelos, y el código en TS para consultarlas como las migraciones SQL.


DB: username: new_admin_user / 1234