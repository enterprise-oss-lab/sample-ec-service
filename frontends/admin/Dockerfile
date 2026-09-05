FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_INVENTORY_API_BASE_URL=http://localhost:18081
ARG VITE_IMAGE_BASE_URL=http://localhost:9000/products
ENV VITE_INVENTORY_API_BASE_URL=$VITE_INVENTORY_API_BASE_URL
ENV VITE_IMAGE_BASE_URL=$VITE_IMAGE_BASE_URL
RUN pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
