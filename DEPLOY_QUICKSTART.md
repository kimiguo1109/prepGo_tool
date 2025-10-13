# 🚀 PrepGo EC2 部署快速指南

## 📦 已准备的文件

1. **`.spec-workflow/EC2_DEPLOYMENT_STEPS.md`** - 详细的手动部署步骤文档
2. **`deploy-to-ec2.sh`** - 一键自动部署脚本（推荐）
3. 本文档 - 快速开始指南

## ⚡ 最快部署方式（推荐）

### 第一步：准备 API Key

确保你有 Google Gemini API Key。如果没有：
1. 访问 https://aistudio.google.com/
2. 创建并复制 API Key

### 第二步：运行一键部署脚本

在你的 Mac 终端执行：

```bash
cd /Users/mac/Desktop/kimi_playground/prepGo_bak

# 赋予执行权限
chmod +x deploy-to-ec2.sh

# 运行脚本
./deploy-to-ec2.sh
```

### 第三步：选择部署方式

脚本会提示你选择：
- **选项 1**: 首次完整部署（第一次部署时选择）
- **选项 2**: 快速更新（代码更新后使用）
- **选项 5**: 查看状态（查看服务器状态）

**首次部署请选择 1**

### 第四步：配置 API Key

部署完成后，连接到服务器配置 API Key：

```bash
ssh root@13.56.60.49
# 密码: StudyXn=10487###sss

# 编辑环境变量
nano /var/www/prepgo/.env.production

# 修改这一行，填入你的实际 API Key
GEMINI_API_KEY=你的实际API-Key

# 保存：Ctrl+O，回车，Ctrl+X 退出

# 重启应用
pm2 restart prepgo

# 退出服务器
exit
```

### 第五步：访问应用

在浏览器打开：
```
http://13.56.60.49
```

## 🎉 完成！

你的应用应该已经在运行了！

---

## 📊 常用命令

### 从 Mac 执行

```bash
# 查看服务器状态
./deploy-to-ec2.sh  # 选择 5

# 快速更新部署
./deploy-to-ec2.sh  # 选择 2

# 直接连接服务器
ssh root@13.56.60.49
# 密码: StudyXn=10487###sss
```

### 在服务器上执行

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs prepgo

# 重启应用
pm2 restart prepgo

# 查看应用最近日志（最后 50 行）
pm2 logs prepgo --lines 50

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看系统资源
htop  # 如果安装了
free -h  # 内存
df -h    # 磁盘
```

---

## 🐛 常见问题

### 问题 1：脚本提示 "sshpass: command not found"

**解决**：
```bash
brew install hudochenkov/sshpass/sshpass
```

### 问题 2：无法访问网站

**检查步骤**：

1. 在 Mac 上测试连接：
```bash
curl http://13.56.60.49
```

2. 登录服务器检查：
```bash
ssh root@13.56.60.49
pm2 status
pm2 logs prepgo --lines 20
```

3. 检查 AWS 安全组：
   - 登录 AWS 控制台
   - EC2 → 实例 → 选择你的实例
   - Security Groups → Inbound rules
   - 确保有这条规则：
     - Type: HTTP
     - Port: 80
     - Source: 0.0.0.0/0

### 问题 3：API 调用失败

检查 API Key 是否正确配置：
```bash
ssh root@13.56.60.49
cat /var/www/prepgo/.env.production | grep GEMINI
```

应该看到：
```
GEMINI_API_KEY=AIza...（你的实际 Key）
```

如果不对，重新编辑：
```bash
nano /var/www/prepgo/.env.production
# 修改后
pm2 restart prepgo
```

### 问题 4：PDF 上传失败

检查目录权限：
```bash
ssh root@13.56.60.49
ls -la /var/www/prepgo/uploads
# 确保目录存在且有写入权限
```

---

## 📈 后续更新流程

当你在本地更新了代码后：

```bash
# 1. 在 Mac 上运行更新脚本
cd /Users/mac/Desktop/kimi_playground/prepGo_bak
./deploy-to-ec2.sh
# 选择 2（快速更新）

# 2. 等待完成（通常 1-2 分钟）

# 3. 访问网站验证
# http://13.56.60.49
```

就是这么简单！

---

## 🔐 安全提醒

⚠️ **重要**：
- 此文档包含服务器密码
- 不要将 `DEPLOY_QUICKSTART.md` 提交到公开仓库
- 不要将 `deploy-to-ec2.sh` 提交到公开仓库
- 建议添加到 `.gitignore`

添加到 `.gitignore`：
```bash
echo "deploy-to-ec2.sh" >> .gitignore
echo "DEPLOY_QUICKSTART.md" >> .gitignore
```

---

## 📚 详细文档

如果遇到问题或想了解更多细节，请查看：

- **详细部署步骤**: `.spec-workflow/EC2_DEPLOYMENT_STEPS.md`
- **AWS 部署方案对比**: `.spec-workflow/AWS_DEPLOYMENT_GUIDE.md`

---

## ✅ 检查清单

首次部署完成后，请确认：

- [ ] 可以访问 http://13.56.60.49
- [ ] 可以上传 PDF 文件
- [ ] PDF 解析功能正常
- [ ] AI 生成功能正常（需要正确的 API Key）
- [ ] `pm2 status` 显示应用运行中
- [ ] `pm2 logs prepgo` 没有错误

---

**需要帮助？**

如果部署过程中遇到任何问题，可以：
1. 查看详细文档
2. 检查服务器日志
3. 联系技术支持

**服务器信息**：
- IP: 13.56.60.49
- 用户: root
- 应用目录: /var/www/prepgo

---

祝部署顺利！🎉

