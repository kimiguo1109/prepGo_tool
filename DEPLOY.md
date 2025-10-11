# 🚀 Vercel 部署指南

## 📋 部署前准备

### 1. 获取 Gemini API Key
1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录 Google 账户
3. 点击 **"Get API Key"** 创建 API Key
4. 复制 API Key（格式类似：`AQ.Ab8RN6K_karyKOCTQDY0FftMdW9k...`）

### 2. 准备 GitHub 仓库
确保代码已推送到 GitHub：
```bash
git add -A
git commit -m "ready for deployment"
git push origin main
```

---

## 🌐 部署到 Vercel

### 步骤 1: 连接 GitHub 仓库

1. 访问 [Vercel](https://vercel.com/)
2. 使用 GitHub 账号登录
3. 点击 **"Add New Project"**
4. 选择你的 GitHub 仓库：`kimiguo1109/prepGo_tool`
5. 选择 `prepGo_bak` 目录作为根目录

### 步骤 2: 配置项目

**Framework Preset**: Next.js（自动检测）

**Root Directory**: 
- 点击 "Edit"
- 选择 `prepGo_bak` 目录

**Build Settings**:
- Build Command: `npm run build`（默认）
- Output Directory: `.next`（默认）
- Install Command: `npm install`（默认）

### 步骤 3: 配置环境变量 ⚠️ **重要！**

在 "Environment Variables" 部分添加：

| Name | Value | Environment |
|------|-------|-------------|
| `GEMINI_API_KEY` | 你的 Gemini API Key | Production, Preview |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Production, Preview |

**注意**：
- ✅ **不需要**配置 `HTTP_PROXY` 和 `HTTPS_PROXY`
- ✅ Vercel 服务器在海外，可以直接访问 Google API

### 步骤 4: 部署

1. 点击 **"Deploy"**
2. 等待构建完成（约 2-3 分钟）
3. 部署成功后，会获得一个 URL：`https://your-project.vercel.app`

---

## 🔧 部署后配置

### 自定义域名（可选）

1. 进入项目 → **Settings** → **Domains**
2. 添加你的自定义域名
3. 按照提示配置 DNS 记录

### 环境变量更新

如需更新 API Key：
1. 进入项目 → **Settings** → **Environment Variables**
2. 编辑或添加变量
3. 点击 **"Save"**
4. **Redeploy** 项目使更改生效

---

## 📊 部署后测试

### 1. 访问应用
打开你的 Vercel URL：`https://your-project.vercel.app`

### 2. 测试功能
1. 上传 JSON 文件
2. 点击 "生成完整课程内容"
3. 等待生成完成
4. 下载生成的 JSON 文件

### 3. 检查日志
如遇到问题：
1. 进入 Vercel 项目
2. 点击 **"Deployments"**
3. 选择最新部署
4. 查看 **"Functions"** 日志

---

## ⚠️ 常见问题

### Q: 部署后 API 调用失败？
**A**: 检查环境变量是否正确设置：
- 进入 Settings → Environment Variables
- 确认 `GEMINI_API_KEY` 已设置
- 点击 Redeploy

### Q: 生成速度慢？
**A**: 
- Vercel Functions 有 10 秒超时限制（Hobby Plan）
- 升级到 Pro Plan 可获得 60 秒超时
- 或者考虑使用"单独生成每个单元"功能

### Q: 需要代理吗？
**A**: **不需要！** Vercel 服务器在海外，可以直接访问 Google API

### Q: 如何查看 API 消耗？
**A**: 访问 [Google AI Studio](https://aistudio.google.com/) 查看 API 使用情况

---

## 🔄 持续部署

配置完成后，每次推送到 GitHub 的 `main` 分支，Vercel 会自动部署：

```bash
git add -A
git commit -m "update features"
git push origin main
```

Vercel 会自动：
1. 检测到新提交
2. 自动构建
3. 自动部署
4. 更新生产环境

---

## 📈 性能优化建议

### 1. 区域设置
在 `vercel.json` 中已配置香港区域（`hkg1`），适合亚太地区用户

### 2. API 优化
- 当前并发：5 个 workers
- 重试：4 次，快速重试（200-400ms）
- 超时：60 秒

### 3. 升级 Vercel Plan
- **Hobby**: 10 秒超时（免费）
- **Pro**: 60 秒超时（适合完整课程生成）

---

## 🎉 完成！

你的 AP 课程处理工具现在已经可以在线访问了！

**分享链接给用户**：
```
https://your-project.vercel.app
```

**GitHub 仓库**：
```
https://github.com/kimiguo1109/prepGo_tool
```

