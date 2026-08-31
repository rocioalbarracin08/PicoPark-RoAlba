FROM node:24-slim

WORKDIR /app

COPY servidor/package*.json ./servidor/
RUN npm --prefix ./servidor install --omit=dev

COPY servidor/ ./servidor/
COPY pagDeJuego/ ./pagDeJuego/

WORKDIR /app/servidor

EXPOSE 3000

CMD ["node", "conexionRed.ts"]