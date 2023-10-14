FROM node:16

WORKDIR /usr/src/simpleimage

COPY package.json package-lock.json ./

ARG NODE_ENV=production

RUN apt-get update
RUN apt-get install -y exiftran
RUN npm install

COPY . .

RUN npm run build:client

EXPOSE 3010
CMD [ "npm", "start" ]
