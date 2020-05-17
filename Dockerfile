FROM node:14

WORKDIR /usr/src/simpleimage

COPY package.json package-lock.json ./

ARG NODE_ENV

RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y python
RUN apt-get install -y exiftran
RUN npm install

COPY . .

EXPOSE 3010
CMD [ "npm", "start" ]
