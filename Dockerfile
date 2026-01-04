# Base image Playwright official
FROM mcr.microsoft.com/playwright:v1.41.2-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# UBAH INI: npm ci → npm install
RUN npm install --omit=dev --no-package-lock

# Copy all files
COPY . .

# Start the bot
CMD ["node", "bot.js"]
