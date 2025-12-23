FROM node:22.20.0-alpine3.21

WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
EXPOSE 3000
ENTRYPOINT ["node", "app.js"]