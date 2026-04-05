FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Default command (can be overridden)
CMD ["npm", "run", "start", "--", "--help"]
