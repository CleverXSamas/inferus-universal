FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist-server/server/index.js"]
