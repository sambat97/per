# Update ke versi yang match dengan package.json
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy all files
COPY . .

# Start the bot
CMD ["node", "bot.js"]
