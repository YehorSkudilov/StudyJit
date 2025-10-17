# Use official Node.js LTS image
FROM node:22-alpine AS base

# Set working directory inside container
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the Next.js default port
EXPOSE 3000

# Run the Next.js app
CMD ["npm", "run", "start"]
