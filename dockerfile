# PULL node 24 IMAGE
# docker pull node:24-alpine

# START THE NODE
# docker run -it --rm -v .:/app -w /app node:24-alpine sh

# START THE SERVER WITH THE DOCKER COMPOSE FILE
# docker compose watch

FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Pass dummy variables so Prisma doesn't crash during build-time generation
RUN if [ -f ./prisma/schema.prisma ]; then \
    DATABASE_URL="postgres://localhost:5432" DIRECT_URL="postgres://localhost:5432" npx prisma generate; \
    fi

EXPOSE 3000

CMD ["npm", "run", "dev"]