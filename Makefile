prod:
	docker-compose -f docker-compose.yml build

dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

deploy-prod:
	docker-compose -f docker-compose.yml up

deploy-dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up