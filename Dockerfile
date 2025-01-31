FROM node:18.20.5

ENV TZ=Asia/Shanghai

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV production

EXPOSE 3000

CMD ["node", "dist/index.js"]