FROM node:24-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/server.js ./server.js
COPY backend/src ./src
RUN mkdir -p data uploads
EXPOSE 5050
CMD ["node", "server.js"]
