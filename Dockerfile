FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
# Install ALL dependencies (including devDependencies) for building
RUN npm install

# Copy source code
COPY . .

# Build the frontend and backend
RUN npm run build

# ---
# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy production package.json
COPY package*.json ./
# Install ONLY production dependencies
RUN npm install --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Specify environment variable for port
ENV PORT=3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
