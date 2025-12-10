# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time API endpoints for Vite
ARG VITE_API_BASE_URL=http://backend:5050
ARG VITE_MODEL_API_BASE_URL=http://model:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_MODEL_API_BASE_URL=${VITE_MODEL_API_BASE_URL}

RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
