# 单词记忆与复习：登录版 + 云端存储

## 功能

- 用户注册 / 登录
- 登录后访问学习页
- 学习数据按用户隔离
- 优先保存到云端 PostgreSQL
- 未配置云数据库时，自动退回本地 JSON 文件，方便本机开发

## 启动

1. 在当前目录安装依赖
2. 复制 `.env.example` 为 `.env`
3. 配置 `TOKEN_SECRET`
4. 如果要使用云数据库，配置 `DATABASE_URL`
5. 运行：

```bash
npm install
npm start
```

启动后访问：

- 登录页：`http://localhost:3000/`
- 学习页：`http://localhost:3000/app`

## 云端数据库

推荐使用托管 PostgreSQL，例如：

- Neon
- Railway
- Supabase
- Render PostgreSQL

拿到连接串后，填入：

```env
DATABASE_URL=postgresql://username:password@host:5432/database_name
```

## 部署建议

典型部署结构：

- 一台云服务器或平台服务运行 `node server.js`
- 一个云端 PostgreSQL 实例
- 域名反代到 Node 服务

如果用 Nginx，可将域名请求反向代理到 `localhost:3000`。

## 数据结构

- `app_users`：用户表
- `user_states`：每个用户一份学习状态

学习页前端仍使用：

- `GET /api/state`
- `PUT /api/state`

只是现在接口会根据当前登录用户读取和保存。
