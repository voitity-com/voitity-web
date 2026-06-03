#!/bin/sh

set -e

APP_DIR="/app/src"

cd "$APP_DIR"

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing dependencies..."

  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi
fi

exec "$@"

