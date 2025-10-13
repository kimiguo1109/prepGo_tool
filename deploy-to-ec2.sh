#!/bin/bash
# PrepGo 一键部署到 EC2 脚本
# 在 Mac 上执行此脚本，自动部署到 EC2 服务器
# 使用方法: chmod +x deploy-to-ec2.sh && ./deploy-to-ec2.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置信息
EC2_IP="13.56.60.49"
EC2_USER="root"
EC2_PASSWORD="StudyXn=10487###sss"
APP_DIR="/var/www/prepgo"
LOCAL_DIR="/Users/mac/Desktop/kimi_playground/prepGo_bak"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  PrepGo EC2 部署脚本${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查是否安装了 sshpass（用于密码登录）
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}⚠️  未安装 sshpass，正在安装...${NC}"
    brew install hudochenkov/sshpass/sshpass || {
        echo -e "${RED}❌ 安装失败，请手动安装: brew install hudochenkov/sshpass/sshpass${NC}"
        exit 1
    }
fi

# 定义 SSH 命令别名
SSH_CMD="sshpass -p '$EC2_PASSWORD' ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP"
SCP_CMD="sshpass -p '$EC2_PASSWORD' scp -o StrictHostKeyChecking=no"

echo -e "${BLUE}📋 选择部署方式:${NC}"
echo "  1) 首次完整部署（包含环境安装）"
echo "  2) 快速更新（仅上传代码并重启）"
echo "  3) 仅上传代码（不重启）"
echo "  4) 远程命令（在服务器执行命令）"
echo "  5) 查看服务器状态"
echo ""
read -p "请选择 (1-5): " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        echo -e "\n${GREEN}🚀 开始完整部署...${NC}\n"
        
        # 1. 打包代码
        echo -e "${BLUE}📦 打包代码...${NC}"
        cd "$LOCAL_DIR"
        tar --exclude='node_modules' \
            --exclude='.next' \
            --exclude='uploads' \
            --exclude='output' \
            --exclude='.git' \
            --exclude='.DS_Store' \
            --exclude='*.log' \
            -czf /tmp/prepgo-deploy.tar.gz .
        echo -e "${GREEN}✅ 代码打包完成${NC}"
        
        # 2. 上传代码
        echo -e "${BLUE}📤 上传代码到服务器...${NC}"
        $SCP_CMD /tmp/prepgo-deploy.tar.gz $EC2_USER@$EC2_IP:/tmp/
        echo -e "${GREEN}✅ 代码上传完成${NC}"
        
        # 3. 执行远程部署脚本
        echo -e "${BLUE}🔧 在服务器上执行部署...${NC}"
        $SSH_CMD 'bash -s' << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 开始服务器端部署..."

# 检测系统类型
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s)
fi

# 更新系统
echo "📦 更新系统..."
if [[ "$OS" == "amzn" ]] || [[ "$OS" == "centos" ]]; then
    sudo yum update -y
    PKG_MGR="yum"
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt update && sudo apt upgrade -y
    PKG_MGR="apt"
else
    echo "⚠️  未知系统类型: $OS"
    PKG_MGR="yum"
fi

# 安装 Node.js 18
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js 18..."
    if [ "$PKG_MGR" = "yum" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
        sudo apt install -y nodejs
    fi
else
    echo "✅ Node.js 已安装: $(node -v)"
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 已安装"
fi

# 安装 Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    if [ "$PKG_MGR" = "yum" ]; then
        sudo yum install -y nginx
    else
        sudo apt install -y nginx
    fi
    sudo systemctl enable nginx
    sudo systemctl start nginx
else
    echo "✅ Nginx 已安装"
fi

# 创建应用目录
echo "📁 准备应用目录..."
sudo mkdir -p /var/www/prepgo
sudo chown -R $USER:$USER /var/www/prepgo
cd /var/www/prepgo

# 解压代码
echo "📂 解压代码..."
tar -xzf /tmp/prepgo-deploy.tar.gz
rm /tmp/prepgo-deploy.tar.gz

# 创建必要目录
mkdir -p uploads output logs

# 配置环境变量（如果不存在）
if [ ! -f .env.production ]; then
    echo "🔐 创建环境变量文件..."
    cat > .env.production << 'EOF'
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://13.56.60.49
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/var/www/prepgo/uploads
GEMINI_API_KEY=your-gemini-api-key-here
EOF
    echo "⚠️  请编辑 /var/www/prepgo/.env.production 填入 GEMINI_API_KEY"
fi

# 安装依赖
echo "📦 安装依赖..."
npm install --production=false

# 构建应用
echo "🏗️  构建应用..."
npm run build

# 配置 PM2
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
echo "🚀 启动应用..."
pm2 delete prepgo 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER 2>/dev/null || pm2 startup

# 配置 Nginx
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/conf.d/prepgo.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name 13.56.60.49;
    client_max_body_size 50M;
    
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
        
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
EOF

# 重启 Nginx
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "================================"
echo "✅ 部署完成！"
echo "================================"
echo "🌐 访问地址: http://13.56.60.49"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs prepgo"
echo ""
echo "⚠️  重要: 请配置 GEMINI_API_KEY"
echo "命令: nano /var/www/prepgo/.env.production"
echo ""
ENDSSH
        
        echo -e "${GREEN}✅ 部署完成！${NC}"
        echo -e "${YELLOW}⚠️  请登录服务器配置 API Key:${NC}"
        echo -e "   ssh root@13.56.60.49"
        echo -e "   nano /var/www/prepgo/.env.production"
        ;;
        
    2)
        echo -e "\n${GREEN}⚡ 快速更新部署...${NC}\n"
        
        # 打包代码
        echo -e "${BLUE}📦 打包代码...${NC}"
        cd "$LOCAL_DIR"
        tar --exclude='node_modules' \
            --exclude='.next' \
            --exclude='uploads' \
            --exclude='output' \
            --exclude='.git' \
            --exclude='.DS_Store' \
            --exclude='*.log' \
            -czf /tmp/prepgo-update.tar.gz .
        
        # 上传
        echo -e "${BLUE}📤 上传代码...${NC}"
        $SCP_CMD /tmp/prepgo-update.tar.gz $EC2_USER@$EC2_IP:/tmp/
        
        # 更新
        echo -e "${BLUE}🔄 更新应用...${NC}"
        $SSH_CMD << 'ENDSSH'
cd /var/www/prepgo
echo "📂 解压新代码..."
tar -xzf /tmp/prepgo-update.tar.gz
rm /tmp/prepgo-update.tar.gz

echo "📦 更新依赖..."
npm install --production=false

echo "🏗️  重新构建..."
npm run build

echo "🔄 重启应用..."
pm2 restart prepgo

echo "✅ 更新完成！"
pm2 status
ENDSSH
        
        echo -e "${GREEN}✅ 更新完成！${NC}"
        ;;
        
    3)
        echo -e "\n${BLUE}📤 仅上传代码...${NC}\n"
        
        cd "$LOCAL_DIR"
        tar --exclude='node_modules' \
            --exclude='.next' \
            --exclude='uploads' \
            --exclude='output' \
            --exclude='.git' \
            --exclude='.DS_Store' \
            --exclude='*.log' \
            -czf /tmp/prepgo-code.tar.gz .
        
        $SCP_CMD /tmp/prepgo-code.tar.gz $EC2_USER@$EC2_IP:/tmp/
        
        $SSH_CMD << 'ENDSSH'
cd /var/www/prepgo
tar -xzf /tmp/prepgo-code.tar.gz
rm /tmp/prepgo-code.tar.gz
echo "✅ 代码已上传到 /var/www/prepgo"
ENDSSH
        
        echo -e "${GREEN}✅ 上传完成！${NC}"
        echo -e "${YELLOW}提示: 需要手动构建和重启:${NC}"
        echo "  ssh root@13.56.60.49"
        echo "  cd /var/www/prepgo && npm run build && pm2 restart prepgo"
        ;;
        
    4)
        echo -e "\n${BLUE}🖥️  远程命令执行${NC}\n"
        echo "连接到服务器，输入 'exit' 退出"
        sshpass -p "$EC2_PASSWORD" ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP
        ;;
        
    5)
        echo -e "\n${BLUE}📊 查看服务器状态...${NC}\n"
        
        $SSH_CMD << 'ENDSSH'
echo "================================"
echo "系统信息"
echo "================================"
echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "内核: $(uname -r)"
echo ""

echo "================================"
echo "资源使用"
echo "================================"
echo "CPU 核心数: $(nproc)"
echo "内存使用:"
free -h | grep -E "Mem|Swap"
echo ""
echo "磁盘使用:"
df -h | grep -E "Filesystem|/$|/var"
echo ""

echo "================================"
echo "服务状态"
echo "================================"
echo "Node.js: $(node -v 2>/dev/null || echo '未安装')"
echo "npm: $(npm -v 2>/dev/null || echo '未安装')"
echo "PM2: $(pm2 -v 2>/dev/null || echo '未安装')"
echo "Nginx: $(nginx -v 2>&1 | cut -d'/' -f2 || echo '未安装')"
echo ""

if command -v pm2 &> /dev/null; then
    echo "================================"
    echo "PM2 应用状态"
    echo "================================"
    pm2 status
    echo ""
fi

if command -v nginx &> /dev/null; then
    echo "================================"
    echo "Nginx 状态"
    echo "================================"
    sudo systemctl status nginx --no-pager | head -10
    echo ""
fi

if [ -d "/var/www/prepgo" ]; then
    echo "================================"
    echo "应用信息"
    echo "================================"
    echo "应用目录: /var/www/prepgo"
    echo "目录大小: $(du -sh /var/www/prepgo 2>/dev/null | cut -f1)"
    echo "最后更新: $(stat -c %y /var/www/prepgo/.next 2>/dev/null | cut -d'.' -f1 || echo '未知')"
    
    if [ -f "/var/www/prepgo/package.json" ]; then
        echo "应用版本: $(grep '"version"' /var/www/prepgo/package.json | cut -d'"' -f4)"
    fi
    echo ""
fi

echo "================================"
echo "网络状态"
echo "================================"
echo "监听端口:"
sudo netstat -tlnp | grep -E "nginx|node" 2>/dev/null || sudo ss -tlnp | grep -E "nginx|node"
echo ""

echo "================================"
echo "最近日志（最后 5 行）"
echo "================================"
if [ -f "/var/www/prepgo/logs/out.log" ]; then
    echo "应用日志:"
    tail -5 /var/www/prepgo/logs/out.log
fi
echo ""
ENDSSH
        ;;
        
    *)
        echo -e "${RED}❌ 无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}操作完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}🌐 访问地址:${NC} http://13.56.60.49"
echo -e "${BLUE}📊 查看日志:${NC} ssh root@13.56.60.49 'pm2 logs prepgo'"
echo -e "${BLUE}🔄 重启应用:${NC} ssh root@13.56.60.49 'pm2 restart prepgo'"
echo ""

# 清理临时文件
rm -f /tmp/prepgo-*.tar.gz

exit 0

