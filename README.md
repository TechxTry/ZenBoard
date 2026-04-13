# ZenBoard

从 **禅道（Zentao）MySQL** 同步数据到本地 **PostgreSQL**，提供 Web 控制台：数据源配置、项目组维护、工作台查询，以及 **可配置周期间隔** 的定时同步与手动同步。

面向**使用者**的上手说明见本文；架构、开发、API、ETL 等见 **[docs/](docs/)**。

## 功能概览

- **鉴权**：管理员账号 + JWT（MVP 级）
- **系统配置**：禅道 MySQL 连接；自动同步周期（分钟）
- **项目组**：自定义分组与成员（关联已同步用户）
- **工作台**：任务、需求、Bug、工时、迭代等列表查询
- **同步**：YAML 表映射、水印增量/全量；定时 + 手动触发

## 使用 Docker 部署（推荐）

本机安装 **Docker**（含 Compose 插件）即可，无需单独装 PostgreSQL、Go 或 Node。

```bash
git clone <本仓库地址>
cd zt_board
cp .env.example .env
```

编辑 `.env`，至少修改 **`JWT_SECRET`**、**`ADMIN_PASS`**。禅道 MySQL 可在启动后于 Web「系统配置」中填写。

**默认使用 [Docker Hub](https://hub.docker.com/u/techxtry) 上的预构建镜像**（命名空间默认 `techxtry`，标签默认 `latest`，可用 **`DOCKERHUB_NAMESPACE`**、**`ZENBOARD_IMAGE_TAG`** 覆盖）：

```bash
docker compose pull
docker compose up -d
```

浏览器访问 **`http://localhost:2024`**。改端口可在 `.env` 中设 `WEB_PORT`，再执行一次 `docker compose up -d`。

**从源码本地构建**（改前后端代码或调试 Dockerfile 时用）：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

PostgreSQL / Redis / 后端默认不映射到宿主机端口，仅前端对外；登录账号为 `.env` 中的 **`ADMIN_USER`** / **`ADMIN_PASS`**（用户名未改时默认为 `admin`）。

### 更新

已 `git clone` 的仓库：`git pull` 后若需新版镜像，执行 `docker compose pull && docker compose up -d`；若使用本地构建，则 `docker compose ... up -d --build`（命令同上，含 `docker-compose.build.yml`）。

更多说明见 [docs/技术说明.md](docs/技术说明.md)。
