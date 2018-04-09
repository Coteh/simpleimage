FROM node

WORKDIR /usr/src/simpleimage

ENV NODE_ENV production

COPY package.json package-lock.json ./

RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y python
RUN npm install

COPY . .

RUN npm run build-client

EXPOSE 3010
CMD [ "npm", "start" ]
