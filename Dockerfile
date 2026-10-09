# ---- build: compila el SPA de Angular ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve: Nginx sirviendo los estaticos + proxy al backend ----
FROM nginx:1.27-alpine
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/medicalsys-frontend/browser /usr/share/nginx/html

# URL del ms-gateway al que Nginx reenvia /api y /actuator. Se resuelve en el
# arranque del contenedor (envsubst de la imagen oficial de nginx), asi que se
# puede cambiar con `-e API_GATEWAY_URL=...` sin reconstruir la imagen.
ENV API_GATEWAY_URL=http://localhost:8080

EXPOSE 80
