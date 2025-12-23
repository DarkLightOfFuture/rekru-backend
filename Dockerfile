FROM node:22.20.0-alpine3.21

WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ENV TZ=Europe/Warsaw
EXPOSE 3000
ENTRYPOINT ["node", "app.js"]
