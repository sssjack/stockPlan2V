# WealthWise 部署文档

## 环境要求
- **Node.js**: v16+
- **MySQL**: 5.7+ (本项目使用远程数据库: 8.141.121.133)
- **NPM/Yarn**: 包管理工具

## 目录结构
```
stockPlan2V/
├── client/       # 前端 React 项目
├── server/       # 后端 Node.js 项目
├── DESIGN.md     # 设计文档
├── DEPLOY.md     # 部署文档
└── README.md     # 项目说明
```

## 部署步骤

### 1. 数据库初始化
项目包含自动初始化脚本。
进入 `server` 目录并运行初始化脚本（确保已配置好数据库连接）：
```bash
cd server
npm install
node init_db.js
```
*注：`init_db.js` 会读取 `schema.sql` 并自动创建所需的数据库和表结构。*

### 2. 后端服务启动
在 `server` 目录下：
```bash
# 安装依赖 (如果尚未安装)
npm install

# 启动服务
node index.js
```
后端服务将运行在 `http://localhost:3000`。

### 3. 前端服务启动
在 `client` 目录下：
```bash
# 安装依赖
cd ../client
npm install

# 开发模式启动
npm run dev
```
前端服务通常运行在 `http://localhost:5173`。

### 4. 生产环境构建 (可选)
如果要部署到生产服务器（如 Nginx）：

1. **构建前端**:
   ```bash
   cd client
   npm run build
   ```
   构建产物位于 `client/dist` 目录。

2. **后端部署**:
   使用 PM2 管理 Node 进程：
   ```bash
   npm install -g pm2
   cd server
   pm2 start index.js --name wealthwise-api
   ```

3. **Nginx 配置示例**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           root /path/to/stockPlan2V/client/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
       }
   }
   ```

## 注意事项
1. **数据库连接**: 请确保 `server/index.js` 和 `server/init_db.js` 中的数据库配置正确。
2. **跨域问题**: 开发环境中 `vite.config.js` 配置了代理解决跨域。生产环境中请使用 Nginx 反向代理或在 Express 中配置 CORS 允许特定域名。
3. **实时数据**: 当前系统使用模拟算法生成实时股价波动。如需真实数据，请对接新浪财经或腾讯财经 API。
