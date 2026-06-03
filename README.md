# voitity-web

Landing page inicial de Voitity en React con Vite y TypeScript.

## Organizacion

- La raiz contiene la configuracion de Docker.
- El proyecto Vite vive en `src/`.
- El codigo fuente de React vive en `src/src/`.
- La landing soporta español e ingles, cargando por defecto segun el idioma del navegador.
- Cualquier ruta `/:profile_alias` carga la vista publica del perfil y consume los endpoints `/api/profile/alias/:profile_alias`, `/api/avatar/:profile_id`, `/api/voice/test` y `/api/profile/:profile_id/messages`.

## Requisitos

- Node.js 22 o superior
- npm 10 o superior

## Desarrollo local

```bash
cd src
npm install
npm run dev
```

## Docker

```bash
docker compose up --build
```

La aplicacion queda disponible en http://localhost:3001.

## Build

```bash
cd src
npm run build
```

## Estructura

```text
Dockerfile
docker-compose.yml
docker-entrypoint.sh
src/
  package.json
  src/
    pages/
      Home.tsx
    App.tsx
    main.tsx
```
