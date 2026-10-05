FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY client client
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/folio.db
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server --include-workspace-root=false
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 4000
CMD ["npm", "start"]
