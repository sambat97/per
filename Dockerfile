# Gunakan Playwright official image dengan Node.js
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy seluruh aplikasi
COPY . .

# Expose port (opsional, untuk health check)
EXPOSE 3000

# Start bot
CMD ["node", "bot.js"]
