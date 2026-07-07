FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm", "start"]
