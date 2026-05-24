FROM node:20-slim

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "server.js"]
