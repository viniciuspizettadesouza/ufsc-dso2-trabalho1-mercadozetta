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

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dependencies AS build

ARG VITE_API_URL=/api
ARG VITE_TENANT_ID=mercadozetta
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TENANT_ID=${VITE_TENANT_ID}

COPY . .
RUN npm run build

FROM nginx:1.28.3-alpine3.23 AS production

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
