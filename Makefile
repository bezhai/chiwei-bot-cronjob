# 定义变量
DOCKER_IMAGE_NAME = cronjob
DOCKER_CONTAINER_NAME = chiwei_cronjob
DOCKER_PORT = 3000

# 拉取最新代码并重新构建镜像和容器
# 默认目标：重新构建和运行
.PHONY: all
all: git-pull build run

# 拉取最新代码
.PHONY: git-pull
git-pull:
	git pull

# 构建 Docker 镜像
.PHONY: build
build:
	docker build -t $(DOCKER_IMAGE_NAME) .

# 停止并删除旧的容器（如果存在）
.PHONY: stop
stop:
	@if [ $$(docker ps -q -f name=$(DOCKER_CONTAINER_NAME)) ]; then \
		echo "Stopping running container..."; \
		docker stop $(DOCKER_CONTAINER_NAME); \
	fi
	@if [ $$(docker ps -aq -f name=$(DOCKER_CONTAINER_NAME)) ]; then \
		echo "Removing old container..."; \
		docker rm $(DOCKER_CONTAINER_NAME); \
	fi

# 运行新的容器实例
.PHONY: run
run: stop
	docker run -d --env-file .env --name $(DOCKER_CONTAINER_NAME) $(DOCKER_IMAGE_NAME)

# 清理旧的 Docker 镜像和容器
.PHONY: clean
clean: stop
	@if [ $$(docker images -q $(DOCKER_IMAGE_NAME)) ]; then \
		echo "Removing old image..."; \
		docker rmi $(DOCKER_IMAGE_NAME); \
	fi