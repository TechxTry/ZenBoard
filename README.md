# ZenBoard

从 **禅道（Zentao）MySQL** 同步数据到本地 **PostgreSQL**，提供 Web 控制台：数据源配置、项目组维护、工作台查询，以及 **可配置周期间隔** 的定时同步与手动同步。

## 功能概览

- **鉴权**：管理员账号 + JWT（MVP 级）
- **系统配置**：禅道 MySQL 连接；自动同步周期（分钟，写入 PostgreSQL `app_settings`）
- **项目组**：自定义分组与成员（关联已同步用户）
- **工作台**：任务、需求、Bug、工时、迭代等列表查询（数据来自本地 PG）
- **同步**：YAML 声明式表映射、水印增量/全量策略；定时任务 + 手动触发

## 快速开始

### 使用 Docker（推荐）

克隆仓库后，本机只需安装 **Docker**（含 Compose 插件），无需单独安装 PostgreSQL、Go 或 Node。

```bash
cd <你的仓库目录>
cp .env.example .env
```

编辑 `.env`，至少修改 **`JWT_SECRET`**、**`ADMIN_PASS`**。禅道 MySQL 可在启动后于 Web 端「系统配置」中填写。

```bash
docker compose up -d --build
```

首次构建会下载基础镜像并编译，可能需要数分钟。

在浏览器打开 **`http://localhost:2024`**。

如需自定义前端端口，可在 `.env` 中设置 `WEB_PORT=xxxx` 后重新执行 `docker compose up -d`。

说明：

- 基础服务（PostgreSQL、Redis）默认**不发布**到宿主机端口，以避免与本机已有服务发生端口冲突；容器间通过 Compose 网络的服务名互通。
- 后端同样默认不发布宿主机端口；前端通过 Nginx 在容器内反代 `/api` 到 `backend:8080`。

使用 `.env` 中的 **`ADMIN_USER`** / **`ADMIN_PASS`** 在登录页登录。若未改用户名，默认为 `admin`。

### 更多说明

- **本地开发**（本机 Go / Node、手动执行数据库迁移）、**环境变量**、**ETL 与部署细节**、**HTTP API 摘要** 等见 [docs/技术说明.md](docs/技术说明.md)。
