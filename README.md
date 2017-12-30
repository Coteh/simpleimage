# simpleimage

A simple image hosting web application that I created and implemented using Node.js and Express, with MongoDB as the database.

## Features

- Upload bmp, png, jpeg, and gif images
- Comment on images
- Delete your images (Must have an account)

## Installation

### Building Locally

~~~sh
# Install dependencies
npm install

# Build web components with webpack
npm build

# Run the app (Navigate to http://localhost:9001 on your browser)
npm start
~~~

### Serving with Docker

~~~sh
# Build Docker images
docker-compose build

# Run Docker containers in Docker Compose environment
docker-compose up
~~~

### Known Limitations

- None yet

### Future Additions

- User preferences menu
- Ability to change email, password, and/or username
- Image galleries
- Custom image IDs
- Delete account