# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

WORKDIR /app/src

ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=3000

COPY src/package.json src/package-lock.json ./

RUN npm ci

COPY src/ .
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

