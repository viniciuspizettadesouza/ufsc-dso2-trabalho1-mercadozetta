FROM node:24.18.0-alpine3.23 AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM dependencies AS development

COPY --chown=node:node . .
RUN chown node:node /app && \
    mkdir -p /app/node_modules/.vite && \
    chown -R node:node /app/node_modules/.vite
USER node

EXPOSE 3333

CMD ["npm", "run", "dev"]

FROM dependencies AS build

COPY . .
RUN npm run build

FROM node:24.18.0-alpine3.23 AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle

USER node
EXPOSE 3333

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "const http=require('http');const request=http.get({host:'127.0.0.1',port:process.env.PORT||3333,path:'/health',headers:{'X-Tenant-Id':process.env.HEALTHCHECK_TENANT_ID||'mercadozetta'}},response=>process.exit(response.statusCode===200?0:1));request.on('error',()=>process.exit(1));request.setTimeout(2000,()=>{request.destroy();process.exit(1)})"

CMD ["node", "dist/server.js"]
