FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

EXPOSE 4000
ENV PORT=4000
CMD sh -c "npx prisma migrate deploy && node src/index.js"
