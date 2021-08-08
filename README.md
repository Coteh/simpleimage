# ![simpleimage logo](assets/images/logo.svg "simpleimage")

[![CircleCI](https://circleci.com/gh/Coteh/simpleimage.svg?style=shield)](https://circleci.com/gh/Coteh/simpleimage)

A simple image hosting web application that I created and implemented using Node.js and Express, with MongoDB as the database and Redis as the session store for production.

![Screenshot](screenshots/screenshot.png "App Screenshot")

## Features

* Upload BMP, PNG, JPEG, and GIF images
* Comment on images
* Image page
    * Image upload date
    * Total number of comments on image
* Delete your images (Must have an account)
* User profile page
    * Join date
    * Comment history and total number of comments posted
* User settings
    * Change password
* Rotates JPEG images based on Orientation tag in EXIF metadata
* Strips EXIF metadata from JPEG images

## Installation

### .env Template

```
MONGODB_URI=<MongoDB URI goes here>
REDIS_URL=<Redis URL goes here>
MONGO_ROOT_USERNAME=<root username for MongoDB instance>
MONGO_ROOT_PASSWORD=<root password for MongoDB instance>
MONGO_INITIAL_DATABASE=<initial database for MongoDB instance>

SESSION_SECRET=<session secret goes here>
GA_TRACKING_ID=<Google Analytics Tracking ID (Universal Analytics)>
LOGIN_TO_UPLOAD=true  # omit this variable if you don't want to require users to login to upload
```

### Building and Running Locally

~~~sh
# Install dependencies
npm install

# Build web components with webpack (and watch for changes when in development mode)
npm run build:client

# Run local MongoDB database
mongod --dbpath ./data/

# Export SESSION_SECRET environment variable (or use a .env file)
export SESSION_SECRET="my-secret"

# Run the app
npm start
# or, run the app in development mode
npm run start:dev

# Navigate to http://localhost:3010 on your browser
~~~

### Serving with Docker (in development)

~~~sh
# Build Docker images
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
# or, run
make build-dev

# Run Docker containers in Docker Compose environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
# or, run
make deploy-dev

# Navigate to http://localhost:8080 on your browser
~~~

### Serving with Docker (in production)

~~~sh
# Build Docker images
docker-compose build
# or, run
make build-prod

# Run Docker containers in Docker Compose environment
docker-compose up
# or, run
make deploy-prod
~~~

### Run Tests

~~~sh
# Build Docker images for test
docker-compose -f docker-compose.yml -f docker-compose.test.yml build
# or, run
make build-test

# Run Docker containers for test in Docker Compose environment
docker-compose -f docker-compose.yml -f docker-compose.test.yml up --abort-on-container-exit
# or, run
make deploy-test
~~~

### Use HTTPS in dev

Using [mkcert](https://github.com/FiloSottile/mkcert):

```sh
mkdir ssl
cd ssl

mkcert -install

mkcert localhost 127.0.0.1 ::1
```

To run development environment using dev HTTPS certs:

```sh
make dds
# or,
docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev.https.yml up
```

## Known Limitations

* Cannot change username/email
* Some of the popup dialogs need a bit of size tweaking (e.g. signup dialog)
* No image upload history (Currently being worked on in [dev/image-history branch](https://github.com/Coteh/simpleimage/tree/dev/image-history))
* No option for anonymous users to upload an image with ability to delete
    * Delete links based on user session are being considered (which is what imgur does as well)
* See [Issues](https://github.com/Coteh/simpleimage/issues) page for more

## Future Additions

* User preferences menu
* Ability to change email and/or username
* Image galleries
* Custom image IDs
* Delete account
