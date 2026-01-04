# Gunakan latest untuk auto-match dengan npm package
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy all files
COPY . .

# Start the bot
CMD ["node", "bot.js"]
