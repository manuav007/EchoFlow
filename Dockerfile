FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy root package files and install frontend deps
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Install pm2 globally
RUN npm install -g pm2

# Copy the rest of the app
COPY . .

# Install backend dependencies (if nodeServer has its own package.json)
RUN if [ -f /app/nodeServer/package.json ]; then cd /app/nodeServer && npm install --no-audit --no-fund; fi

# Expose ports
EXPOSE 3000
EXPOSE 8000

# Use pm2-runtime to run the ecosystem file
CMD ["pm2-runtime", "ecosystem.config.js"]