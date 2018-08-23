build-prod:
	docker-compose -f docker-compose.yml build

build-dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

build-test:
	docker-compose -f docker-compose.yml -f docker-compose.test.yml build

deploy-prod:
	docker-compose -f docker-compose.yml up

deploy-dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

deploy-test:
	docker-compose -f docker-compose.yml -f docker-compose.test.yml up