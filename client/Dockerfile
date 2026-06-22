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

# Start development server
CMD ["npm", "run", "dev"]