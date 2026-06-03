# voitity-web

Aplicacion inicial en React con Vite y TypeScript.

## Organizacion

- La raiz contiene la configuracion de Docker.
- El proyecto Vite vive en `src/`.
- El codigo fuente de React vive en `src/src/`.

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
