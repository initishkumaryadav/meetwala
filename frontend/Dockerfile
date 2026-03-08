# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL
ARG VITE_SOCKET_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback: serve index.html for all routes (Railway uses dynamic $PORT)
COPY <<'EOF' /etc/nginx/templates/default.conf.template
server {
  listen ${PORT};
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

# Remove default config
RUN rm -f /etc/nginx/conf.d/default.conf

ENV PORT=80
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
