# 🚀 Vercel 部署完整指南

## 📋 前提条件

1. ✅ GitHub 账号
2. ✅ Vercel 账号（使用 GitHub 登录）
3. ✅ Gemini API Key
4. ✅ 代码已推送到 GitHub

---

## 🔧 步骤 1: 创建 Vercel 项目

### 1.1 导入 GitHub 仓库

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New..."** → **"Project"**
3. 选择你的 GitHub 仓库：`kimiguo1109/prepGo_tool`
4. 点击 **"Import"**

### 1.2 配置项目根目录 ⚠️ **重要！**

在 "Configure Project" 页面：

1. 找到 **"Root Directory"** 设置
2. 点击 **"Edit"**
3. 选择 `prepGo_bak` 目录
4. 点击 **"Continue"**

**为什么需要这一步？**
- 因为你的项目在 `prepGo_bak` 子目录中
- Vercel 默认使用仓库根目录
- 不设置会导致找不到 `package.json` 和 `next.config.js`

---

## ⚙️ 步骤 2: 配置环境变量

在 "Configure Project" 页面，找到 **"Environment Variables"** 部分：

### 2.1 添加 GEMINI_API_KEY

1. **Key (变量名)**: `GEMINI_API_KEY`
2. **Value (值)**: 你的 Gemini API Key
   - 格式：`AQ.Ab8RN6K_karyKOCTQDY0FftMdW9k...`
3. **Environment**: 选择所有环境
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. 点击 **"Add"**

### 2.2 添加 GEMINI_MODEL（可选）

1. **Key**: `GEMINI_MODEL`
2. **Value**: `gemini-2.5-flash-lite`
3. **Environment**: 选择所有环境
4. 点击 **"Add"**

**注意**：
- ❌ **不需要**配置 `HTTP_PROXY` 或 `HTTPS_PROXY`
- ✅ Vercel 服务器在海外，可以直接访问 Google API

---

## 🚀 步骤 3: 部署

1. 环境变量配置完成后，点击 **"Deploy"**
2. 等待构建完成（约 2-3 分钟）
3. 构建成功后，会显示你的应用 URL：
   ```
   https://prep-go-tool-xxx.vercel.app
   ```

---

## 🔍 步骤 4: 验证部署

### 4.1 访问应用

打开你的 Vercel URL，检查：
- ✅ 页面正常加载
- ✅ 可以上传 PDF 和 JSON 文件
- ✅ 预览功能正常

### 4.2 测试 API

1. 上传测试文件
2. 点击"单独生成每个单元" → 选择一个 Unit
3. 点击"学习指南"或"闪卡"测试生成

**如果遇到错误**：
- 查看浏览器控制台（F12）
- 检查 Vercel 项目的 "Deployments" → 最新部署 → "Functions" 日志

---

## ⏱️ 步骤 5: 升级计划（如需要）

### Vercel 计划对比

| 功能 | Hobby (免费) | Pro ($20/月) |
|------|-------------|-------------|
| 函数超时 | 10 秒 | 60 秒 |
| 适合场景 | "单独生成每个单元" | "生成完整课程内容" |
| 推荐 | ✅ 开始使用 | ✅ 生产环境 |

### 如何升级

1. 进入 Vercel Dashboard
2. 点击右上角头像 → **"Account Settings"**
3. 选择 **"Billing"**
4. 点击 **"Upgrade to Pro"**

**升级后的好处**：
- ✅ 函数执行时间从 10 秒增加到 60 秒
- ✅ 可以使用"生成完整课程内容"功能
- ✅ 足够生成 30-40 个 Topics

---

## 🔄 后续更新

### 自动部署

配置完成后，每次推送到 `main` 分支，Vercel 会自动部署：

```bash
git add -A
git commit -m "update features"
git push origin main
```

Vercel 会自动：
1. 检测到新提交
2. 触发构建
3. 部署到生产环境
4. 更新你的应用

### 手动重新部署

如果需要手动重新部署：
1. 进入 Vercel Dashboard
2. 选择你的项目
3. 进入 **"Deployments"**
4. 找到最新的部署
5. 点击右侧 **"..."** → **"Redeploy"**

---

## 🛠️ 故障排除

### 问题 1: 构建失败

**错误**：`Error: Cannot find module 'next'`

**解决**：
1. 检查 Root Directory 是否设置为 `prepGo_bak`
2. 确保 `prepGo_bak/package.json` 存在
3. 在 Vercel 重新选择 Root Directory

---

### 问题 2: API 超时

**错误**：`504 Gateway Timeout` 或 `Function execution timed out`

**原因**：Hobby Plan 限制 10 秒

**解决方案**：
- **选项 1**：升级到 Pro Plan（推荐）
- **选项 2**：使用"单独生成每个单元"功能（执行时间更短）

---

### 问题 3: API Key 错误

**错误**：`AI 调用失败: 401` 或 `403 Forbidden`

**解决**：
1. 检查环境变量是否正确设置：
   - 进入 Vercel Project → **"Settings"** → **"Environment Variables"**
   - 确认 `GEMINI_API_KEY` 存在且正确
2. 在 [Google AI Studio](https://aistudio.google.com/) 验证 API Key 是否有效
3. 重新部署项目（修改环境变量后需要重新部署）

---

### 问题 4: 无法访问 Gemini API

**错误**：`fetch failed` 或 `ECONNREFUSED`

**原因**：不应该出现（Vercel 服务器在海外）

**检查**：
1. 确认没有设置 `HTTP_PROXY` 或 `HTTPS_PROXY` 环境变量
2. 测试 Gemini API 是否正常：
   ```bash
   curl "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=YOUR_API_KEY" \
   -X POST \
   -H "Content-Type: application/json" \
   -d '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'
   ```

---

## 📊 监控和日志

### 查看函数日志

1. 进入 Vercel Dashboard
2. 选择你的项目
3. 进入 **"Deployments"**
4. 点击最新的部署
5. 点击 **"Functions"** 标签
6. 选择具体的函数（如 `api/generate-course`）
7. 查看日志输出

### 实时监控

1. 进入 Vercel Dashboard
2. 选择你的项目
3. 进入 **"Analytics"**（Pro Plan）
4. 查看：
   - 请求数量
   - 错误率
   - 函数执行时间

---

## 🎉 完成！

现在你的 PrepGo 工具已经部署到 Vercel 上了！

**分享链接**：
```
https://your-project-name.vercel.app
```

**功能清单**：
- ✅ 上传 PDF + JSON 文件
- ✅ 查看课程结构
- ✅ 单独生成每个单元的内容
- ✅ 生成完整课程内容（需要 Pro Plan）
- ✅ 下载生成的 JSON 文件
- ✅ 图片需求标记（`requires_image`）

**后续优化**：
1. 考虑添加用户认证
2. 集成数据库存储生成的内容
3. 添加 Analytics 监控
4. 优化 UI/UX

祝你使用愉快！🚀

