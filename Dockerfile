FROM node:24-slim

WORKDIR /app

COPY package.json .npmrc ./
RUN npm install --include=dev --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.ts"]
