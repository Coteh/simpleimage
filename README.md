# ![simpleimage logo](assets/images/logo.svg "simpleimage")

A simple image hosting web application that I created and implemented using Node.js and Express, with MongoDB as the database and Redis as the session store. (for production only)

## Features

* Upload bmp, png, jpeg, and gif images
* Comment on images
* Image page
    * Image upload date
    * Total number of comments on image
* Delete your images (Must have an account)
* User profile page
    * Join date
    * Comment history and total number of comments posted

## Installation

### Building Locally

~~~sh
# Install dependencies
npm install

# Build web components with webpack
npm build:client

# Run the app (Navigate to http://localhost:3010 on your browser)
npm start
# or, run the app in development mode
npm run start:dev
~~~

### Serving with Docker (in development)

~~~sh
# Build Docker images
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
# or, run
make dev

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
make prod

# Run Docker containers in Docker Compose environment
docker-compose up
# or, run
make deploy-prod
~~~

### Known Limitations

* None yet

### Future Additions

* User preferences menu
* Ability to change email, password, and/or username
* Image galleries
* Custom image IDs
* Delete account
* Mobile layout