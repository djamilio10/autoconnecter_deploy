FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Frontend et backend sont sur le même domaine (même origine), donc l'API
# relative /api (proxifiée par Caddy) suffit : pas besoin de VITE_API_URL.
RUN npm run build

FROM caddy:2-alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
