FROM node:20-slim

WORKDIR /app

# Copy package info and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Copy source code
COPY . .

EXPOSE 3000

# Clear stale cache and start dev server to prevent 404s after container restart
CMD ["sh", "-c", "find .next -mindepth 1 -delete 2>/dev/null || true; npx next dev"]