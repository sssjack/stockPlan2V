
# Stage 1: Build React Client
FROM node:18 AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client ./
RUN npm run build

# Stage 2: Setup Server
FROM node:18
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm install --production

# Copy server source
COPY server ./server

# Copy built client assets to server static folder
# We need to ensure server serves these static files
COPY --from=client-build /app/client/dist ./client/dist

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]
