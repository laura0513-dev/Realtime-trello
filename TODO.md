# Plan de desarrollo — Realtime Trello

## Backend

### ✅ Hecho
- [x] Arquitectura base (capas: config, middlewares, routes, sockets)
- [x] Schema Prisma (User, Board, Column con ColumnType enum + color, Card)
- [x] Dependencias instaladas (0 vulnerabilidades, bcryptjs en lugar de bcrypt)
- [x] TypeScript configurado y validado
- [x] Primera migración de Prisma aplicada (`kanban_app`)

### ✅ Módulo de autenticación
- [x] `POST /api/auth/register` — registro con email y contraseña (hash bcryptjs)
- [x] `POST /api/auth/login` — login, devuelve JWT
- [x] `GET  /api/auth/me` — perfil del usuario autenticado
- [x] Middleware `authenticate` — verificación JWT en rutas protegidas
- [x] Validación de entrada con Zod (schemas)

### ✅ Módulo de tableros (Boards)
- [x] `POST   /api/boards` — crear tablero + 3 columnas por defecto automáticas
- [x] `GET    /api/boards` — listar tableros del usuario (con conteo de columnas)
- [x] `GET    /api/boards/:id` — obtener tablero completo con columnas y cards
- [x] `PATCH  /api/boards/:id` — renombrar tablero
- [x] `DELETE /api/boards/:id` — eliminar tablero (cascade a columnas y cards)

### ✅ Módulo de columnas (Columns)
- [x] `POST   /api/boards/:boardId/columns` — crear columna (title, type, color)
- [x] `PATCH  /api/columns/:id` — editar columna
- [x] `PATCH  /api/columns/:id/position` — reordenar (desplaza las demás automáticamente)
- [x] `DELETE /api/columns/:id` — eliminar (reordena las restantes)

### ✅ Módulo de cards
- [x] `POST   /api/columns/:columnId/cards` — crear card en columna
- [x] `PATCH  /api/cards/:id` — editar título / descripción
- [x] `PATCH  /api/cards/:id/move` — mover card (nueva columna + nueva posición, reordena origen y destino)
- [x] `DELETE /api/cards/:id` — eliminar card (reordena las restantes)

### 🔲 WebSockets (tiempo real)
- [ ] Evento `board:join` / `board:leave` (ya estructurado)
- [ ] Evento `card:moved` — notificar a todos en el tablero
- [ ] Evento `card:created` — notificar nueva card
- [ ] Evento `card:updated` — notificar edición
- [ ] Evento `card:deleted` — notificar eliminación
- [ ] Evento `column:created` / `column:updated` / `column:deleted`

---

## Frontend

### 🔲 Setup
- [ ] Crear app React + TypeScript con Create React App o Vite
- [ ] Instalar Material UI
- [ ] Configurar React Router
- [ ] Configurar cliente HTTP (axios)
- [ ] Configurar cliente Socket.io

### 🔲 Autenticación
- [ ] Página de registro
- [ ] Página de login
- [ ] Contexto global de usuario (AuthContext)
- [ ] Rutas protegidas (PrivateRoute)

### 🔲 Tableros
- [ ] Página de lista de tableros
- [ ] Crear / eliminar tablero

### 🔲 Kanban
- [ ] Vista de tablero con columnas y cards
- [ ] Crear / editar / eliminar columna (con selector de color y tipo)
- [ ] Crear / editar / eliminar card
- [ ] Drag & drop de cards entre columnas (react-beautiful-dnd)
- [ ] Actualizaciones en tiempo real vía Socket.io

---

## Infraestructura

### 🔲 Docker
- [ ] `Dockerfile` para el backend
- [ ] `Dockerfile` para el frontend
- [ ] `docker-compose.yml` con backend + frontend + PostgreSQL
- [ ] Variables de entorno para producción

### 🔲 GitHub
- [ ] `.gitignore` global
- [ ] Commits por módulo terminado
