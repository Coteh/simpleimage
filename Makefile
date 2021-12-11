build-prod:
	docker-compose -f docker-compose.yml build
bp: build-prod

build-dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
bd: build-dev

build-test:
	docker-compose -f docker-compose.yml -f docker-compose.test.yml build
bt: build-test

deploy-prod:
	docker-compose -f docker-compose.yml up -d
dp: deploy-prod

deploy-dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
dd: deploy-dev

deploy-dev-https:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev.https.yml up -d
dds: deploy-dev-https

deploy-dev-debug:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev.debug.yml up -d
ddd: deploy-dev-debug

# to test a specific file, pass it like the example below:
# 	make deploy-test TEST_FILE=./test/integ/image_delete_integ_test.js
deploy-test:
	docker-compose -f docker-compose.yml -f docker-compose.test.yml up --abort-on-container-exit
dt: deploy-test

stop:
	docker-compose stop

rm:
	docker-compose rm

clean:
	docker ps -a | grep coteh/simpleimage | cut -d' ' -f1 | xargs docker rm
	docker volume rm simpleimage_node_modules
