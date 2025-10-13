# PrepGo EC2 服务器部署实战指南

## 🎯 服务器信息

```
IP 地址: 13.56.60.49
用户名: root
密码: StudyXn=10487###sss
```

**注意**: 本文档包含服务器凭证，请妥善保管，不要提交到公开仓库！

---

## 🚀 快速部署（一键脚本）

### 步骤 1: 连接到服务器

在你的 Mac 终端执行：

```bash
# 直接 SSH 连接（使用密码）
ssh root@13.56.60.49
# 输入密码: StudyXn=10487###sss
```

### 步骤 2: 在服务器上执行自动部署脚本

连接成功后，复制以下完整脚本到服务器执行：

```bash
#!/bin/bash
# PrepGo 自动部署脚本
# 使用方法: bash <(curl -s https://raw.githubusercontent.com/your-repo/deploy.sh)
# 或直接复制粘贴运行

set -e  # 遇到错误立即退出

echo "🚀 PrepGo 自动部署脚本开始..."
echo "================================"

# 1. 检查系统信息
echo "📋 系统信息:"
cat /etc/os-release | grep PRETTY_NAME
echo ""

# 2. 更新系统
echo "🔄 更新系统包..."
if command -v yum &> /dev/null; then
    # Amazon Linux / CentOS
    sudo yum update -y
    PACKAGE_MANAGER="yum"
elif command -v apt &> /dev/null; then
    # Ubuntu / Debian
    sudo apt update && sudo apt upgrade -y
    PACKAGE_MANAGER="apt"
else
    echo "❌ 不支持的包管理器"
    exit 1
fi

# 3. 安装 Node.js 18
echo "📦 安装 Node.js 18..."
if ! command -v node &> /dev/null; then
    if [ "$PACKAGE_MANAGER" = "yum" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
        sudo apt install -y nodejs
    fi
else
    echo "✅ Node.js 已安装: $(node -v)"
fi

# 4. 安装 PM2
echo "📦 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "✅ PM2 已安装: $(pm2 -v)"
fi

# 5. 安装 Git
echo "📦 安装 Git..."
if ! command -v git &> /dev/null; then
    if [ "$PACKAGE_MANAGER" = "yum" ]; then
        sudo yum install -y git
    else
        sudo apt install -y git
    fi
else
    echo "✅ Git 已安装: $(git --version)"
fi

# 6. 安装 Nginx
echo "📦 安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    if [ "$PACKAGE_MANAGER" = "yum" ]; then
        sudo amazon-linux-extras install -y nginx1 || sudo yum install -y nginx
    else
        sudo apt install -y nginx
    fi
    sudo systemctl enable nginx
else
    echo "✅ Nginx 已安装"
fi

# 7. 创建应用目录
echo "📁 创建应用目录..."
APP_DIR="/var/www/prepgo"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR
cd $APP_DIR

# 8. 克隆或更新代码
echo "📥 部署代码..."
if [ -d ".git" ]; then
    echo "更新现有代码..."
    git pull origin main
else
    echo "⚠️  需要手动上传代码或配置 Git 仓库"
    echo "请选择以下方式之一："
    echo "  1. 使用 SCP 上传代码"
    echo "  2. 克隆 Git 仓库: git clone https://github.com/your-username/prepgo-ap-processor.git ."
    echo ""
    read -p "是否现在克隆 Git 仓库？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "请输入 Git 仓库地址: " GIT_REPO
        git clone $GIT_REPO .
    else
        echo "⏸️  跳过代码下载，请手动上传代码后重新运行此脚本"
        exit 0
    fi
fi

# 9. 配置环境变量
echo "🔐 配置环境变量..."
if [ ! -f ".env.production" ]; then
    cat > .env.production << 'EOF'
# PrepGo Production Environment Variables
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://13.56.60.49
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/var/www/prepgo/uploads

# Google Gemini API Key - 请替换为实际的 API Key
GEMINI_API_KEY=your-gemini-api-key-here

# 如果服务器需要代理访问 Google API（通常不需要）
# HTTP_PROXY=
# HTTPS_PROXY=
EOF
    echo "⚠️  请编辑 .env.production 文件，填入实际的 GEMINI_API_KEY"
    echo "命令: nano $APP_DIR/.env.production"
else
    echo "✅ .env.production 已存在"
fi

# 10. 创建上传目录
echo "📁 创建上传目录..."
mkdir -p uploads output
sudo chown -R $USER:$USER uploads output

# 11. 安装依赖
echo "📦 安装 Node.js 依赖..."
npm install

# 12. 构建应用
echo "🏗️  构建 Next.js 应用..."
npm run build

# 13. 配置 PM2
echo "⚙️  配置 PM2..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'prepgo',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/prepgo',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# 创建日志目录
mkdir -p logs

# 14. 启动应用
echo "🚀 启动应用..."
pm2 delete prepgo 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | bash

# 15. 配置 Nginx
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/conf.d/prepgo.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name 13.56.60.49;

    # 文件上传大小限制
    client_max_body_size 50M;

    # 日志
    access_log /var/log/nginx/prepgo-access.log;
    error_log /var/log/nginx/prepgo-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置（PDF 处理可能需要较长时间）
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
EOF

# 16. 测试并重启 Nginx
echo "🔄 重启 Nginx..."
sudo nginx -t
sudo systemctl restart nginx

# 17. 配置防火墙（如果需要）
echo "🔥 配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    echo "✅ 防火墙已配置"
elif command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "✅ 防火墙已配置"
else
    echo "⚠️  未检测到防火墙，请确保 AWS 安全组允许 80 和 443 端口"
fi

# 18. 显示部署信息
echo ""
echo "================================"
echo "✅ 部署完成！"
echo "================================"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "🌐 访问地址:"
echo "  http://13.56.60.49"
echo ""
echo "📝 常用命令:"
echo "  查看日志: pm2 logs prepgo"
echo "  重启应用: pm2 restart prepgo"
echo "  查看状态: pm2 status"
echo "  Nginx 日志: sudo tail -f /var/log/nginx/prepgo-error.log"
echo ""
echo "⚠️  重要提醒:"
echo "  1. 请编辑 .env.production 文件，填入实际的 GEMINI_API_KEY"
echo "  2. 确保 AWS 安全组允许 80 端口（HTTP）访问"
echo "  3. 如需 HTTPS，请配置 SSL 证书"
echo ""
echo "🔐 环境变量配置:"
echo "  nano /var/www/prepgo/.env.production"
echo ""
```

---

## 📋 手动部署步骤（详细版）

如果你想手动执行每一步，以下是详细步骤：

### 步骤 1: 连接服务器

```bash
# 在你的 Mac 上执行
ssh root@13.56.60.49
# 输入密码: StudyXn=10487###sss
```

### 步骤 2: 检查服务器环境

```bash
# 查看系统版本
cat /etc/os-release

# 查看内存和 CPU
free -h
lscpu | grep "^CPU(s)"

# 查看磁盘空间
df -h
```

### 步骤 3: 更新系统

```bash
# 如果是 Amazon Linux / CentOS
sudo yum update -y

# 如果是 Ubuntu
sudo apt update && sudo apt upgrade -y
```

### 步骤 4: 安装 Node.js 18

```bash
# Amazon Linux / CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# 验证安装
node -v  # 应该显示 v18.x.x
npm -v
```

### 步骤 5: 安装 PM2

```bash
sudo npm install -g pm2

# 验证安装
pm2 -v
```

### 步骤 6: 安装 Nginx

```bash
# Amazon Linux
sudo yum install -y nginx

# Ubuntu
sudo apt install -y nginx

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证安装
nginx -v
```

### 步骤 7: 上传代码到服务器

**方式 A: 使用 SCP（在你的 Mac 上执行）**

```bash
# 打包代码（排除不必要的文件）
cd /Users/mac/Desktop/kimi_playground/prepGo_bak
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='uploads' \
    --exclude='output' \
    --exclude='.git' \
    -czf prepgo.tar.gz .

# 上传到服务器
scp prepgo.tar.gz root@13.56.60.49:/root/

# 然后在服务器上解压
ssh root@13.56.60.49
mkdir -p /var/www/prepgo
cd /var/www/prepgo
tar -xzf /root/prepgo.tar.gz
rm /root/prepgo.tar.gz
```

**方式 B: 使用 Git（推荐）**

```bash
# 1. 先在 GitHub 创建仓库并推送代码（在你的 Mac 上）
cd /Users/mac/Desktop/kimi_playground/prepGo_bak
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/prepgo-ap-processor.git
git push -u origin main

# 2. 在服务器上克隆
ssh root@13.56.60.49
mkdir -p /var/www/prepgo
cd /var/www/prepgo
git clone https://github.com/your-username/prepgo-ap-processor.git .
```

**方式 C: 使用 SFTP（图形界面）**

使用 FileZilla 或 Cyberduck：
- 主机: 13.56.60.49
- 用户: root
- 密码: StudyXn=10487###sss
- 端口: 22
- 上传整个 prepGo_bak 文件夹到 `/var/www/prepgo`

### 步骤 8: 配置环境变量

```bash
cd /var/www/prepgo

# 创建 .env.production 文件
cat > .env.production << 'EOF'
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://13.56.60.49
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/var/www/prepgo/uploads

# 替换为你的实际 API Key
GEMINI_API_KEY=your-actual-gemini-api-key

# AWS 环境通常不需要代理
# HTTP_PROXY=
# HTTPS_PROXY=
EOF

# 编辑并填入实际的 API Key
nano .env.production
```

### 步骤 9: 安装依赖并构建

```bash
cd /var/www/prepgo

# 安装依赖
npm install

# 构建应用
npm run build

# 创建必要的目录
mkdir -p uploads output logs
```

### 步骤 10: 配置 PM2

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'prepgo',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/prepgo',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 保存 PM2 配置
pm2 save

# 设置 PM2 开机自启
pm2 startup
# 复制输出的命令并执行
```

### 步骤 11: 配置 Nginx

```bash
# 创建 Nginx 配置
sudo nano /etc/nginx/conf.d/prepgo.conf
```

粘贴以下内容：

```nginx
server {
    listen 80;
    server_name 13.56.60.49;

    # 文件上传大小限制
    client_max_body_size 50M;

    # 日志
    access_log /var/log/nginx/prepgo-access.log;
    error_log /var/log/nginx/prepgo-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

保存后测试并重启：

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 检查状态
sudo systemctl status nginx
```

### 步骤 12: 配置 AWS 安全组

确保你的 EC2 实例安全组允许以下端口：

| 类型 | 协议 | 端口 | 来源 |
|------|------|------|------|
| SSH | TCP | 22 | 你的 IP 或 0.0.0.0/0 |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |

在 AWS 控制台操作：
1. 进入 EC2 Dashboard
2. 选择你的实例
3. 点击 Security Groups
4. 编辑 Inbound Rules
5. 添加上述规则

### 步骤 13: 验证部署

```bash
# 检查 PM2 状态
pm2 status

# 查看应用日志
pm2 logs prepgo

# 检查 Nginx 状态
sudo systemctl status nginx

# 测试本地访问
curl http://localhost:3000

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/prepgo-error.log
```

在浏览器访问：
```
http://13.56.60.49
```

---

## 🔄 更新部署脚本

创建 `deploy.sh` 便于后续更新：

```bash
cd /var/www/prepgo
nano deploy.sh
```

粘贴以下内容：

```bash
#!/bin/bash
# PrepGo 更新部署脚本

set -e

echo "🔄 开始更新部署..."

# 进入项目目录
cd /var/www/prepgo

# 备份当前版本
BACKUP_DIR="/var/backups/prepgo/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r .next $BACKUP_DIR/ 2>/dev/null || true

# 拉取最新代码（如果使用 Git）
if [ -d ".git" ]; then
    echo "📥 拉取最新代码..."
    git pull origin main
else
    echo "⚠️  未使用 Git，请手动上传更新的文件"
    read -p "文件已更新？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 安装依赖（检查是否有新依赖）
echo "📦 检查依赖..."
npm install

# 构建应用
echo "🏗️  构建应用..."
npm run build

# 重启 PM2
echo "🔄 重启应用..."
pm2 restart prepgo

# 等待启动
sleep 3

# 检查状态
pm2 status

echo "✅ 更新完成！"
echo "📊 查看日志: pm2 logs prepgo"
```

赋予执行权限：

```bash
chmod +x deploy.sh

# 使用方法
./deploy.sh
```

---

## 🔐 配置 HTTPS（可选但推荐）

### 使用 Let's Encrypt 免费证书

```bash
# 1. 安装 Certbot
# Amazon Linux
sudo yum install -y certbot python3-certbot-nginx

# Ubuntu
sudo apt install -y certbot python3-certbot-nginx

# 2. 获取证书（需要域名）
# 如果你有域名指向 13.56.60.49，例如 prepgo.yourdomain.com
sudo certbot --nginx -d prepgo.yourdomain.com

# 3. 自动续期测试
sudo certbot renew --dry-run

# 4. 更新环境变量
nano /var/www/prepgo/.env.production
# 修改: NEXT_PUBLIC_APP_URL=https://prepgo.yourdomain.com

# 5. 重启应用
pm2 restart prepgo
```

### 如果没有域名

可以使用 IP 访问 HTTP（不推荐用于生产）或购买域名：
- 在 AWS Route 53 或其他域名服务商购买域名
- 配置 DNS A 记录指向 13.56.60.49
- 然后配置 Let's Encrypt

---

## 📊 监控和维护

### 常用命令

```bash
# PM2 管理
pm2 status              # 查看状态
pm2 logs prepgo         # 查看日志
pm2 logs prepgo --lines 100  # 查看最近 100 行
pm2 restart prepgo      # 重启
pm2 stop prepgo         # 停止
pm2 delete prepgo       # 删除
pm2 monit              # 监控面板

# Nginx 管理
sudo systemctl status nginx    # 状态
sudo systemctl restart nginx   # 重启
sudo nginx -t                  # 测试配置
sudo tail -f /var/log/nginx/prepgo-access.log  # 访问日志
sudo tail -f /var/log/nginx/prepgo-error.log   # 错误日志

# 系统资源
htop                    # 实时监控（需要安装: yum install htop）
df -h                   # 磁盘使用
free -h                 # 内存使用
du -sh /var/www/prepgo  # 项目大小

# 清理日志（如果日志文件过大）
pm2 flush
sudo truncate -s 0 /var/log/nginx/prepgo-access.log
sudo truncate -s 0 /var/log/nginx/prepgo-error.log
```

### 设置日志轮转

```bash
# 创建 logrotate 配置
sudo nano /etc/logrotate.d/prepgo
```

粘贴：

```
/var/www/prepgo/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}

/var/log/nginx/prepgo-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 nginx nginx
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
```

### 设置定时任务（可选）

```bash
# 编辑 crontab
crontab -e
```

添加：

```bash
# 每天凌晨 3 点重启应用（可选）
0 3 * * * cd /var/www/prepgo && pm2 restart prepgo

# 每周日凌晨 2 点清理旧的上传文件
0 2 * * 0 find /var/www/prepgo/uploads -type f -mtime +7 -delete

# 每天备份输出文件
0 4 * * * tar -czf /var/backups/prepgo/output-$(date +\%Y\%m\%d).tar.gz /var/www/prepgo/output
```

---

## 🐛 故障排查

### 问题 1: 无法访问网站

```bash
# 检查 PM2 状态
pm2 status
# 如果状态是 errored，查看日志
pm2 logs prepgo --lines 50

# 检查端口 3000 是否在监听
sudo netstat -tlnp | grep 3000

# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Nginx 配置
sudo nginx -t

# 检查防火墙
sudo firewall-cmd --list-all  # CentOS
sudo ufw status               # Ubuntu

# 测试本地访问
curl http://localhost:3000
curl http://localhost
```

### 问题 2: Gemini API 调用失败

```bash
# 检查环境变量
cat /var/www/prepgo/.env.production

# 测试网络连接
curl -I https://generativelanguage.googleapis.com

# 查看应用日志中的错误
pm2 logs prepgo | grep -i error
```

### 问题 3: PDF 处理失败

```bash
# 检查 pdf-parse 依赖
cd /var/www/prepgo
npm list pdf-parse

# 重新安装依赖
npm install pdf-parse --force

# 重新构建
npm run build

# 重启应用
pm2 restart prepgo
```

### 问题 4: 上传文件失败

```bash
# 检查上传目录权限
ls -la /var/www/prepgo/uploads

# 修复权限
sudo chown -R $USER:$USER /var/www/prepgo/uploads
chmod 755 /var/www/prepgo/uploads

# 检查磁盘空间
df -h

# 检查 Nginx 上传限制
grep client_max_body_size /etc/nginx/conf.d/prepgo.conf
```

### 问题 5: 内存不足

```bash
# 查看内存使用
free -h

# 查看应用内存使用
pm2 monit

# 调整 PM2 内存限制
nano /var/www/prepgo/ecosystem.config.js
# 修改: max_memory_restart: '1G' -> '512M'

pm2 restart prepgo
```

---

## 📈 性能优化

### 1. 启用 Nginx 缓存

编辑 `/etc/nginx/conf.d/prepgo.conf`，添加：

```nginx
# 在 http 块中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=prepgo_cache:10m max_size=1g inactive=60m;

server {
    # ... 现有配置 ...
    
    # 缓存静态资源
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache prepgo_cache;
        proxy_cache_valid 200 60m;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

### 2. 启用 Gzip 压缩

编辑 `/etc/nginx/nginx.conf`：

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

### 3. PM2 Cluster 模式（如果 CPU 多核）

```bash
# 编辑 ecosystem.config.js
nano /var/www/prepgo/ecosystem.config.js

# 修改 instances
instances: 'max',  # 或具体数字，如 2

# 重启
pm2 delete prepgo
pm2 start ecosystem.config.js
```

---

## 💰 成本优化建议

### 服务器配置建议

| 流量/用户 | 实例类型 | 月成本（按需） | 月成本（预留） |
|----------|---------|--------------|--------------|
| 小型（测试） | t3.small | ~$15 | ~$10 |
| 中型 | t3.medium | ~$30 | ~$20 |
| 大型 | t3.large | ~$60 | ~$40 |

### 节省成本的方法

1. **使用预留实例**（长期使用可节省 40-60%）
2. **定时关闭**（测试环境）
3. **使用 S3 存储文件**（而非本地磁盘）
4. **配置 CloudWatch 告警**（避免意外高额账单）

---

## ✅ 部署检查清单

- [ ] SSH 连接成功
- [ ] Node.js 18 已安装
- [ ] PM2 已安装
- [ ] Nginx 已安装
- [ ] 代码已上传
- [ ] 环境变量已配置（GEMINI_API_KEY）
- [ ] 依赖已安装 (npm install)
- [ ] 应用已构建 (npm run build)
- [ ] PM2 已启动应用
- [ ] PM2 开机自启已配置
- [ ] Nginx 配置已创建
- [ ] Nginx 已重启
- [ ] AWS 安全组已配置（开放 80 端口）
- [ ] 浏览器可访问 http://13.56.60.49
- [ ] 文件上传功能正常
- [ ] PDF 解析功能正常
- [ ] AI 生成功能正常
- [ ] 日志轮转已配置
- [ ] HTTPS 已配置（如有域名）

---

## 📞 获取帮助

如果部署过程中遇到问题：

1. **查看日志**
   ```bash
   pm2 logs prepgo --lines 100
   sudo tail -100 /var/log/nginx/prepgo-error.log
   ```

2. **检查服务状态**
   ```bash
   pm2 status
   sudo systemctl status nginx
   ```

3. **测试各个组件**
   ```bash
   # 测试 Node.js
   node -v
   
   # 测试应用
   curl http://localhost:3000
   
   # 测试 Nginx
   curl http://localhost
   ```

4. **重启所有服务**
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```

---

**文档版本**: 1.0  
**创建日期**: 2025-10-13  
**服务器**: 13.56.60.49  
**应用**: PrepGo AP Course Processor

**⚠️ 安全提醒**: 请勿将包含密码的文档提交到公开仓库！

