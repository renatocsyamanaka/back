FROM node:20-alpine

WORKDIR /app

# 🔥 DEPENDÊNCIAS DO CANVAS (OBRIGATÓRIO)
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  cairo-dev \
  pango-dev \
  jpeg-dev \
  giflib-dev \
  librsvg-dev \
  pixman-dev \
  pkgconfig \
  fontconfig \
  ttf-dejavu

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]