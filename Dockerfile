FROM node

WORKDIR /usr/src/simpleimage

COPY package.json package-lock.json ./

RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y python
RUN npm install

COPY . .

ENV NODE_ENV production

EXPOSE 3010
CMD [ "npm", "start" ]
