# syntax=docker/dockerfile:1
#
# Un solo Dockerfile con tres destinos finales: `web`, `bot` e `init-db`.
# Se eligen con `--target`; docker-compose.yml los construye los tres.

# ─── Dependencias ───────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Solo los manifiestos primero: así la capa de node_modules se reaprovecha
# mientras no cambien las dependencias, aunque cambie el código.
COPY package.json package-lock.json ./
COPY packages/core/package.json      packages/core/
COPY packages/applier/package.json   packages/applier/
COPY apps/web/package.json           apps/web/
COPY apps/bot/package.json           apps/bot/
RUN npm ci

# ─── Cliente de Prisma ──────────────────────────────────────────────────────
# El provider de Prisma tiene que quedar fijado ANTES de generar el cliente, y
# se deduce de la URL (ver scripts/proveedor-db.mjs). Por eso viaja como ARG:
# la instancia pública construye con Postgres y el compose de andar por casa,
# con SQLite. No hace falta que la base exista todavía; solo su forma de URL.
FROM deps AS prisma
ARG DATABASE_URL="file:/datos/aribuilder.db"
COPY prisma ./prisma
COPY scripts/proveedor-db.mjs ./scripts/
RUN node scripts/proveedor-db.mjs && npx prisma generate

# ─── Inicialización de la base ──────────────────────────────────────────────
# La imagen standalone de la web no lleva el CLI de Prisma (es dependencia de
# desarrollo), así que crear el esquema en el volumen es trabajo de este destino.
FROM prisma AS init-db
CMD ["npx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"]

# ─── Compilación de la web ──────────────────────────────────────────────────
FROM prisma AS build-web
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Next necesita estas dos en tiempo de compilación aunque no se usen todavía.
# La URL solo tiene que ser válida para el provider elegido: compilar no abre
# ninguna conexión, todas las páginas que tocan la base se sirven por petición.
ARG DATABASE_URL="file:/datos/aribuilder.db"
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="$DATABASE_URL"
RUN npm run build -w @aribuilder/web

# ─── Web ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -S aribuilder && adduser -S aribuilder -G aribuilder

# `standalone` trae su propio node_modules recortado.
COPY --from=build-web --chown=aribuilder:aribuilder /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=aribuilder:aribuilder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=aribuilder:aribuilder /app/prisma ./prisma

USER aribuilder
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ─── Bot ────────────────────────────────────────────────────────────────────
# No hereda de `deps`: el bot no necesita Next, React ni Tailwind, y arrastrarlos
# multiplicaba por ocho el tamaño de la imagen. Se instala solo su rama del
# monorepo, sin dependencias de desarrollo.
FROM node:24-alpine AS bot
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S aribuilder && adduser -S aribuilder -G aribuilder

COPY package.json package-lock.json ./
COPY packages/core/package.json    packages/core/
COPY packages/applier/package.json packages/applier/
COPY apps/bot/package.json         apps/bot/
COPY apps/web/package.json         apps/web/
RUN npm ci --omit=dev --workspace @aribuilder/bot --include-workspace-root

# El cliente generado se trae hecho del destino `prisma`: instalar aquí el CLI de
# Prisma solo para generarlo añadía 57 MB a la imagen final.
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
# Del destino `prisma`, que es donde el esquema ya quedó con el provider bueno.
COPY --from=prisma /app/prisma ./prisma

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/bot ./apps/bot

# Nada de `chown -R`: reescribiría node_modules entero en una capa nueva (+377 MB).
# El bot solo necesita leer, y los archivos que instala npm ya son legibles por todos.
USER aribuilder
CMD ["npx", "tsx", "apps/bot/src/index.ts"]
