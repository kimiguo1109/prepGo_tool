# PrepGo AWS 部署指南

## 📋 文档概述

本文档详细说明如何将 PrepGo AP 课程处理工具部署到 AWS 云服务上。包含多种部署方案、详细步骤、配置要点和成本估算。

**最后更新**: 2025-10-13  
**目标项目**: prepGo_bak  
**框架**: Next.js 15 + TypeScript

---

## 🎯 部署方案对比

| 方案 | 难度 | 成本 | 自动扩展 | 推荐场景 |
|------|------|------|----------|---------|
| **AWS Amplify** | ⭐ | $ | ✅ | 快速上线，类似 Vercel |
| **AWS App Runner** | ⭐⭐ | $$ | ✅ | 容器化应用，简单管理 |
| **ECS Fargate** | ⭐⭐⭐ | $$$ | ✅ | 生产环境，高可用 |
| **EC2 + PM2** | ⭐⭐⭐⭐ | $$ | ❌ | 完全控制，需手动管理 |
| **Lambda + API Gateway** | ⭐⭐⭐⭐⭐ | $ | ✅ | Serverless，复杂配置 |

**推荐方案**: 
- **快速原型/测试**: AWS Amplify
- **生产环境**: AWS App Runner 或 ECS Fargate

---

## 🚀 方案一：AWS Amplify（推荐 - 最简单）

### 特点
- ✅ 类似 Vercel 的体验
- ✅ 自动 CI/CD
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 简单的环境变量管理
- ⚠️ 需要代码托管在 Git (GitHub/GitLab/BitBucket)

### 前置要求
```bash
✓ AWS 账号
✓ 代码推送到 GitHub/GitLab
✓ Google Gemini API Key
✓ 准备好环境变量
```

### 部署步骤

#### 1. 准备代码仓库

```bash
# 1.1 初始化 Git（如果还没有）
cd /Users/mac/Desktop/kimi_playground/prepGo_bak
git init
git add .
git commit -m "Initial commit for AWS deployment"

# 1.2 推送到 GitHub
# 在 GitHub 创建新仓库（prepgo-ap-processor）
git remote add origin https://github.com/your-username/prepgo-ap-processor.git
git branch -M main
git push -u origin main
```

#### 2. 创建 AWS Amplify 配置文件

在项目根目录创建 `amplify.yml`:

```yaml
# amplify.yml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

#### 3. 配置环境变量

创建 `.env.production` 文件（不要提交到 Git）:

```bash
# .env.production
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_APP_URL=https://your-app-name.amplifyapp.com
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/tmp

# AWS Amplify 中需要特殊处理代理
# 注意：Amplify 环境可能不支持代理，需要测试
```

#### 4. AWS 控制台操作

1. **登录 AWS 控制台**
   - 访问 https://console.aws.amazon.com
   - 搜索 "AWS Amplify"

2. **创建新应用**
   - 点击 "New app" → "Host web app"
   - 选择代码托管平台（GitHub）
   - 授权 AWS Amplify 访问你的仓库
   - 选择 `prepgo-ap-processor` 仓库
   - 选择 `main` 分支

3. **配置构建设置**
   - App name: `prepgo-ap-processor`
   - Environment: `production`
   - Build and test settings: 自动检测（会使用 amplify.yml）

4. **添加环境变量**
   - 在 "Environment variables" 部分添加：
     - `GEMINI_API_KEY`: 你的 Gemini API Key
     - `MAX_FILE_SIZE`: 52428800
     - `UPLOAD_DIR`: /tmp
     - `NEXT_PUBLIC_APP_URL`: 留空（稍后填写）

5. **高级设置**
   - Node.js version: 18
   - Build image: Amazon Linux 2023

6. **保存并部署**
   - 点击 "Save and deploy"
   - 等待 5-10 分钟首次部署

7. **更新环境变量**
   - 部署完成后，获取应用 URL（如：https://main.xxx.amplifyapp.com）
   - 返回环境变量，更新 `NEXT_PUBLIC_APP_URL`

#### 5. 验证部署

```bash
# 访问应用 URL
https://main.xxx.amplifyapp.com

# 检查以下功能：
✓ 页面正常加载
✓ 文件上传功能
✓ PDF 解析功能
✓ AI 生成功能
```

### 故障排查

#### 问题 1：代理访问 Google API
```
AWS Amplify 默认环境不支持 HTTP_PROXY/HTTPS_PROXY
```

**解决方案 A**: 修改代码直接调用（推荐）
```typescript
// src/lib/gemini-client.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// 不使用代理，直接调用（AWS 环境通常可以直接访问 Google API）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
```

**解决方案 B**: 使用 VPN 服务或 AWS VPC Endpoint
- 需要更复杂的网络配置
- 不推荐用于 Amplify

#### 问题 2：PDF 文件处理
```
pdf-parse 依赖 canvas，在 serverless 环境可能失败
```

**解决方案**: 
- Next.js config 已配置 `serverExternalPackages: ['pdf-parse']`
- 确保 `canvas` 依赖被正确排除
- 如果仍有问题，考虑使用 AWS Lambda Layer

#### 问题 3：文件上传大小限制
```
AWS Amplify 默认请求大小限制 6MB
```

**解决方案**:
- 使用 AWS S3 直接上传（推荐）
- 或使用 AWS API Gateway 提高限制

### 成本估算

```
免费额度（每月）:
- 构建时间: 1000 分钟
- 托管: 15GB 存储 + 15GB 带宽
- 请求: 500,000 次

超出免费额度:
- 构建: $0.01/分钟
- 托管: $0.023/GB 存储，$0.15/GB 带宽
- 请求: $0.30/100万次

预估月成本（中等使用）: $5-20
```

---

## 🐳 方案二：AWS App Runner（推荐 - 生产环境）

### 特点
- ✅ 基于容器，更灵活
- ✅ 自动扩展
- ✅ 支持 Docker，完全控制环境
- ✅ 自动负载均衡
- ✅ 支持代理配置

### 部署步骤

#### 1. 创建 Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 禁用 Next.js 遥测
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# 生产运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### 2. 更新 next.config.js

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // 添加这一行，用于 Docker 部署
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'canvas',
      });
    }

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    
    return config;
  },
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;
```

#### 3. 创建 .dockerignore

```
# .dockerignore
node_modules
.next
.git
.env*.local
*.log
.DS_Store
uploads/*
output/*
```

#### 4. 本地测试 Docker 镜像

```bash
# 构建镜像
docker build -t prepgo-ap-processor .

# 本地运行测试
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your-api-key \
  prepgo-ap-processor

# 访问 http://localhost:3000 测试
```

#### 5. 推送到 Amazon ECR（Elastic Container Registry）

```bash
# 5.1 安装 AWS CLI
brew install awscli  # macOS

# 5.2 配置 AWS CLI
aws configure
# 输入:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (如: ap-east-1 香港)
# - Default output format (json)

# 5.3 创建 ECR 仓库
aws ecr create-repository \
  --repository-name prepgo-ap-processor \
  --region ap-east-1

# 5.4 登录到 ECR
aws ecr get-login-password --region ap-east-1 | \
  docker login --username AWS --password-stdin \
  <your-account-id>.dkr.ecr.ap-east-1.amazonaws.com

# 5.5 标记镜像
docker tag prepgo-ap-processor:latest \
  <your-account-id>.dkr.ecr.ap-east-1.amazonaws.com/prepgo-ap-processor:latest

# 5.6 推送镜像
docker push <your-account-id>.dkr.ecr.ap-east-1.amazonaws.com/prepgo-ap-processor:latest
```

#### 6. 创建 App Runner 服务

1. **AWS 控制台操作**
   - 访问 AWS App Runner 服务
   - 点击 "Create service"

2. **配置源**
   - Source: Container registry
   - Provider: Amazon ECR
   - Container image URI: 选择刚才推送的镜像
   - Deployment trigger: Manual（或 Automatic）

3. **配置服务**
   - Service name: prepgo-ap-processor
   - Virtual CPU: 1 vCPU
   - Memory: 2 GB
   - Port: 3000

4. **配置环境变量**
   ```
   GEMINI_API_KEY=your-api-key
   MAX_FILE_SIZE=52428800
   UPLOAD_DIR=/tmp
   NODE_ENV=production
   ```

5. **配置自动扩展**
   - Min instances: 1
   - Max instances: 5
   - Concurrency: 100

6. **健康检查**
   - Path: /
   - Interval: 10 秒
   - Timeout: 5 秒
   - Unhealthy threshold: 3

7. **创建服务**
   - 点击 "Create & deploy"
   - 等待 5-10 分钟

#### 7. 配置自定义域名（可选）

```bash
# 在 App Runner 控制台:
1. 选择你的服务
2. Custom domains → Add domain
3. 输入域名（如: prepgo.yourdomain.com）
4. 按照说明添加 CNAME 记录到你的 DNS
```

### 自动部署（CI/CD）

创建 `.github/workflows/deploy-apprunner.yml`:

```yaml
name: Deploy to AWS App Runner

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-east-1
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build, tag, and push image to Amazon ECR
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: prepgo-ap-processor
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
    
    - name: Deploy to App Runner
      run: |
        aws apprunner start-deployment \
          --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }}
```

### 成本估算

```
基础配置（1 vCPU + 2 GB）:
- 计算: $0.064/vCPU-hour + $0.007/GB-hour
- 每月成本（24/7 运行）: ~$50
- 按实际使用计费，可暂停节省成本

存储（ECR）:
- $0.10/GB-月

预估月成本: $50-100
```

---

## ⚙️ 方案三：AWS ECS Fargate（企业级）

### 特点
- ✅ 完全托管的容器服务
- ✅ 高可用性和容错
- ✅ 与 AWS 生态系统深度集成
- ✅ 精细的网络和安全控制
- ⚠️ 配置复杂度较高

### 架构组件

```
Internet → ALB (Application Load Balancer)
         → ECS Service
           → Fargate Tasks (1-N)
             → Container (Next.js App)
```

### 部署步骤

#### 1. 准备工作

```bash
# 使用前面 App Runner 方案中的 Dockerfile
# 镜像已推送到 ECR
```

#### 2. 创建 VPC 和子网（如果没有）

```bash
# 2.1 创建 VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=prepgo-vpc}]'

# 2.2 创建公共子网（2个，用于 ALB）
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-east-1a

aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-east-1b

# 2.3 创建私有子网（2个，用于 Fargate）
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-east-1a

aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.12.0/24 \
  --availability-zone ap-east-1b

# 2.4 创建 Internet Gateway
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway \
  --internet-gateway-id igw-xxxxx \
  --vpc-id vpc-xxxxx

# 2.5 配置路由表
# （简化版，实际需要配置 NAT Gateway 等）
```

#### 3. 创建 ECS 集群

```bash
# 使用 AWS CLI
aws ecs create-cluster \
  --cluster-name prepgo-cluster \
  --region ap-east-1

# 或使用 AWS 控制台
```

#### 4. 创建任务定义

创建 `task-definition.json`:

```json
{
  "family": "prepgo-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "prepgo-container",
      "image": "<account-id>.dkr.ecr.ap-east-1.amazonaws.com/prepgo-ap-processor:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "MAX_FILE_SIZE",
          "value": "52428800"
        }
      ],
      "secrets": [
        {
          "name": "GEMINI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-east-1:<account-id>:secret:prepgo-gemini-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/prepgo",
          "awslogs-region": "ap-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

注册任务定义:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

#### 5. 创建 Application Load Balancer

```bash
# 5.1 创建 ALB
aws elbv2 create-load-balancer \
  --name prepgo-alb \
  --subnets subnet-public-1 subnet-public-2 \
  --security-groups sg-xxxxx

# 5.2 创建目标组
aws elbv2 create-target-group \
  --name prepgo-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-path /

# 5.3 创建监听器
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

#### 6. 创建 ECS 服务

```bash
aws ecs create-service \
  --cluster prepgo-cluster \
  --service-name prepgo-service \
  --task-definition prepgo-task:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1,subnet-private-2],securityGroups=[sg-xxxxx]}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=prepgo-container,containerPort=3000"
```

#### 7. 配置 Auto Scaling

```bash
# 7.1 注册可扩展目标
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/prepgo-cluster/prepgo-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10

# 7.2 创建扩展策略
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/prepgo-cluster/prepgo-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name prepgo-scaling-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

`scaling-policy.json`:
```json
{
  "TargetValue": 75.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

### 使用 Terraform 自动化（推荐）

创建 `terraform/main.tf`:

```hcl
# 完整的 Terraform 配置文件
# 包含 VPC, ECS, ALB, Auto Scaling 等所有资源
# 篇幅较长，建议单独创建文件
```

### 成本估算

```
Fargate 计算（1 vCPU + 2 GB）:
- 每小时: $0.04048 (CPU) + $0.004445 (memory)
- 每月（2个实例 24/7）: ~$65

ALB:
- 固定成本: $16/月
- 数据处理: $0.008/GB

预估月成本: $80-150
```

---

## 💻 方案四：AWS EC2 + PM2

### 特点
- ✅ 完全控制服务器
- ✅ 可以安装任何软件
- ✅ 成本可预测
- ⚠️ 需要手动管理和维护
- ⚠️ 无自动扩展

### 部署步骤

#### 1. 创建 EC2 实例

```bash
# 1.1 选择 AMI
# Amazon Linux 2023 或 Ubuntu 22.04 LTS

# 1.2 选择实例类型
# t3.small (2 vCPU, 2 GB) 或 t3.medium (2 vCPU, 4 GB)

# 1.3 配置安全组
# 允许入站流量:
# - SSH (22) 从你的 IP
# - HTTP (80) 从所有位置
# - HTTPS (443) 从所有位置
```

#### 2. 连接到 EC2

```bash
# 下载密钥文件 prepgo-key.pem
chmod 400 prepgo-key.pem

# SSH 连接
ssh -i prepgo-key.pem ec2-user@<instance-public-ip>
```

#### 3. 安装依赖

```bash
# 3.1 更新系统
sudo yum update -y  # Amazon Linux
# 或
sudo apt update && sudo apt upgrade -y  # Ubuntu

# 3.2 安装 Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 3.3 安装 PM2
sudo npm install -g pm2

# 3.4 安装 Nginx
sudo yum install -y nginx
# 或
sudo apt install -y nginx

# 3.5 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 4. 部署应用

```bash
# 4.1 克隆代码（或使用 SCP/SFTP 上传）
git clone https://github.com/your-username/prepgo-ap-processor.git
cd prepgo-ap-processor

# 4.2 安装依赖
npm install

# 4.3 创建环境变量
cat > .env.production << EOF
GEMINI_API_KEY=your-api-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/home/ec2-user/prepgo-ap-processor/uploads
NODE_ENV=production
EOF

# 4.4 构建应用
npm run build

# 4.5 使用 PM2 启动
pm2 start npm --name "prepgo" -- start
pm2 save
pm2 startup
```

#### 5. 配置 Nginx 反向代理

```bash
# 编辑 Nginx 配置
sudo nano /etc/nginx/conf.d/prepgo.conf
```

添加以下内容:

```nginx
# /etc/nginx/conf.d/prepgo.conf
server {
    listen 80;
    server_name your-domain.com;

    # 文件上传大小限制
    client_max_body_size 50M;

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
    }
}
```

重启 Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. 配置 HTTPS（使用 Let's Encrypt）

```bash
# 6.1 安装 Certbot
sudo yum install -y certbot python3-certbot-nginx

# 6.2 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 6.3 自动续期
sudo certbot renew --dry-run
```

#### 7. 监控和日志

```bash
# 查看 PM2 状态
pm2 status

# 查看应用日志
pm2 logs prepgo

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 配置 PM2 监控
pm2 install pm2-logrotate
```

### 自动部署脚本

创建 `deploy.sh`:

```bash
#!/bin/bash
# deploy.sh - 自动部署脚本

set -e

echo "🚀 Starting deployment..."

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 构建应用
npm run build

# 4. 重启 PM2
pm2 restart prepgo

echo "✅ Deployment completed!"
```

### 成本估算

```
EC2 实例（t3.small）:
- 按需: $0.0208/小时 × 730小时 = ~$15/月
- 预留实例: ~$10/月

存储（30 GB EBS）:
- $3/月

数据传输:
- 免费额度: 100 GB/月
- 超出: $0.09/GB

预估月成本: $15-30
```

---

## 🔧 通用配置

### 1. 环境变量管理

所有方案都需要配置以下环境变量:

```bash
# 必需
GEMINI_API_KEY=your-google-gemini-api-key

# 可选
NEXT_PUBLIC_APP_URL=https://your-domain.com
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/tmp
NODE_ENV=production

# 数据库（如果需要）
DATABASE_URL=postgresql://...
```

#### 推荐：使用 AWS Secrets Manager

```bash
# 创建密钥
aws secretsmanager create-secret \
  --name prepgo/gemini-api-key \
  --secret-string "your-api-key"

# 在应用中读取（需要 AWS SDK）
```

### 2. 文件存储（大文件上传）

#### 方案 A：本地临时存储（简单）
```javascript
// 默认使用 /tmp，适合临时文件
UPLOAD_DIR=/tmp
```

#### 方案 B：AWS S3（推荐）

```bash
# 创建 S3 存储桶
aws s3 mb s3://prepgo-uploads --region ap-east-1

# 配置 CORS
aws s3api put-bucket-cors \
  --bucket prepgo-uploads \
  --cors-configuration file://cors.json
```

修改代码使用 S3:

```typescript
// src/lib/s3-upload.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: "ap-east-1" });

export async function uploadToS3(file: File) {
  const command = new PutObjectCommand({
    Bucket: "prepgo-uploads",
    Key: `${Date.now()}-${file.name}`,
    Body: file,
  });
  
  return await s3Client.send(command);
}
```

### 3. 数据库（如果需要持久化）

#### AWS RDS PostgreSQL

```bash
# 创建数据库实例
aws rds create-db-instance \
  --db-instance-identifier prepgo-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourPassword \
  --allocated-storage 20

# 获取连接字符串
DATABASE_URL=postgresql://admin:password@endpoint:5432/prepgo
```

### 4. CDN 和缓存（AWS CloudFront）

```bash
# 为静态资源配置 CloudFront
# 可以显著提升全球访问速度
```

### 5. 监控和告警

#### CloudWatch 监控

```bash
# 配置 CloudWatch Logs
# 所有方案都支持，自动收集日志

# 创建告警
aws cloudwatch put-metric-alarm \
  --alarm-name prepgo-high-cpu \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --period 300 \
  --statistic Average \
  --threshold 80 \
  --alarm-actions arn:aws:sns:...
```

---

## 📊 方案总结和推荐

### 快速决策表

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 快速测试/演示 | **AWS Amplify** | 最快上线，类似 Vercel |
| 小型生产应用 | **AWS App Runner** | 简单易用，自动扩展 |
| 企业级应用 | **ECS Fargate** | 高可用，完整生态 |
| 需要完全控制 | **EC2 + PM2** | 最大灵活性 |
| 成本敏感 | **EC2 t3.small** | 最低成本（$15/月） |

### 我的推荐

**第一阶段（测试）**: 使用 **AWS Amplify**
- ✅ 最快验证功能
- ✅ 零运维成本
- ✅ 自动 HTTPS 和 CDN

**第二阶段（生产）**: 迁移到 **AWS App Runner**
- ✅ 更好的性能
- ✅ 支持 Docker，环境可控
- ✅ 合理的成本
- ✅ 仍然简单易管理

**长期（企业）**: 考虑 **ECS Fargate**
- ✅ 高可用性
- ✅ 复杂网络配置
- ✅ 完整 AWS 集成

---

## 🚨 重要注意事项

### 1. Google API 访问
```
⚠️ AWS 环境通常可以直接访问 Google API
⚠️ 不需要像本地开发那样配置 HTTP_PROXY
⚠️ 如果仍有问题，考虑使用 NAT Gateway 或 VPN
```

### 2. 代码修改
```typescript
// 移除或条件化代理配置
// src/lib/gemini-client.ts

const agent = process.env.NODE_ENV === 'development' 
  ? new HttpsProxyAgent(process.env.HTTPS_PROXY!)
  : undefined;
```

### 3. 安全性
```
✅ 使用 AWS Secrets Manager 存储 API Key
✅ 配置 IAM 角色和权限
✅ 启用 CloudWatch 日志
✅ 使用 HTTPS
✅ 定期更新依赖
```

### 4. 成本优化
```
✅ 使用 Reserved Instances（长期使用）
✅ 配置 Auto Scaling（按需扩展）
✅ 使用 S3 Lifecycle 策略（清理旧文件）
✅ 启用 CloudFront 缓存
✅ 监控和优化冷启动
```

---

## 📝 后续步骤

1. **选择部署方案**（推荐从 AWS Amplify 开始）
2. **准备 AWS 账号**（如果还没有）
3. **获取 Gemini API Key**
4. **推送代码到 GitHub**（Amplify 需要）
5. **按照上述步骤部署**
6. **测试所有功能**
7. **配置监控和告警**
8. **优化性能和成本**

---

## 🆘 获取帮助

如果遇到问题:
1. 检查 CloudWatch Logs
2. 查看 AWS 支持文档
3. 联系开发团队

**文档版本**: 1.0  
**最后更新**: 2025-10-13  
**维护者**: PrepGo 开发团队

