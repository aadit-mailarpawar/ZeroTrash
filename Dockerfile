FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_PHOTO_LOCATION_ENABLED=false
ENV NEXT_PUBLIC_PHOTO_LOCATION_ENABLED=$NEXT_PUBLIC_PHOTO_LOCATION_ENABLED
RUN npx next build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=5173
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 5173
CMD ["node", "server.js"]
