# Використовуємо офіційний образ Node.js (Alpine - полегшена версія)
FROM node:20-alpine

# Встановлюємо залежності для збірки нативних модулів (C++) 
# Це необхідно для 'better-sqlite3'
RUN apk add --no-cache python3 make g++ sqlite

# Встановлюємо робочу директорію всередині контейнера
WORKDIR /app

# Копіюємо package.json та package-lock.json
COPY package*.json ./

# Встановлюємо всі залежності (включаючи tsx для запуску TypeScript)
RUN npm install

# Копіюємо весь код проєкту (нам потрібен server/ та src/data/ для моків)
COPY . .

# Створюємо директорію для бази даних, щоб її можна було примонтувати як Volume
RUN mkdir -p /app/server/data

# Вказуємо порт, який буде слухати сервер
EXPOSE 3001

# Встановлюємо змінну середовища для порту
ENV PORT=3001

# Запускаємо бекенд через tsx (без необхідності попередньої компіляції)
CMD ["npx", "tsx", "server/index.ts"]
