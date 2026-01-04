# Base image Playwright official
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (ganti npm ci jadi npm install)
RUN npm install --omit=dev

# Copy all files
COPY . .

# Start the bot
CMD ["node", "bot.js"]
