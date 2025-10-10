# PrepGo AP 课程处理工具

一个自动化工具，用于处理 AP 课程的 College Board 官方 CED (Course and Exam Description) PDF 文件，将其解析为结构化的 JSON 数据。

## 🎯 项目概述

本工具旨在简化 PrepGo 课程开发流程，通过自动化提取和处理 AP 课程内容，为教育内容开发人员提供高效的工作方式。

### 核心功能

- ✅ **PDF 文件上传**：支持拖拽上传 CED PDF 文件
- ✅ **自动解析**：智能提取 Units、Topics、Learning Objectives、Essential Knowledge
- ✅ **可视化预览**：JSON 数据树形展示
- ✅ **对照视图**：PDF 与 JSON 左右对照查看
- ✅ **在线编辑**：支持 JSON 数据编辑和验证
- ✅ **数据导出**：导出标准化 JSON 格式

## 🏗️ 开发规范

本项目采用 **Spec-Driven Development** 工作流程，所有开发文档位于 `.spec-workflow/` 目录：

```
.spec-workflow/
└── specs/
    └── ap-course-processor/
        ├── requirements.md   # 需求规格说明书
        ├── design.md         # 技术设计文档
        └── tasks.md          # 任务分解文档
```

### 📋 查看开发文档

1. **需求文档**：[requirements.md](.spec-workflow/specs/ap-course-processor/requirements.md)
   - 用户故事和功能需求
   - 验收标准
   - 成功指标

2. **设计文档**：[design.md](.spec-workflow/specs/ap-course-processor/design.md)
   - 系统架构
   - 技术栈选型
   - API 设计
   - 组件规格

3. **任务文档**：[tasks.md](.spec-workflow/specs/ap-course-processor/tasks.md)
   - 38 个开发任务
   - 任务依赖关系
   - 实施指南

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm (推荐) 或 npm

### 安装

```bash
# 克隆项目
cd prepGo

# 安装依赖（项目初始化后）
pnpm install

# 启动开发服务器
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15+ | React 框架 |
| TypeScript | 5+ | 类型安全 |
| Tailwind CSS | 3+ | 样式框架 |
| react-pdf | 10+ | PDF 渲染 |
| pdf-parse | Latest | PDF 解析 |
| Zustand | 4+ | 状态管理 |
| Zod | 3+ | 数据验证 |
| Monaco Editor | Latest | 代码编辑 |

## 📦 项目结构

```
prepGo/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── page.tsx          # 首页（上传）
│   │   ├── processor/        # 处理页面
│   │   └── api/              # API Routes
│   │       ├── upload/       # 文件上传接口
│   │       ├── parse/        # PDF 解析接口
│   │       └── status/       # 状态查询接口
│   ├── components/           # React 组件
│   │   ├── FileDropZone.tsx
│   │   ├── PDFViewer.tsx
│   │   ├── JSONViewer.tsx
│   │   └── ...
│   ├── lib/                  # 工具库
│   │   ├── pdf-parser.ts     # PDF 解析服务
│   │   ├── validators.ts     # Zod 验证模式
│   │   └── utils.ts          # 工具函数
│   ├── types/                # TypeScript 类型
│   │   └── course.ts
│   └── store/                # 状态管理
│       └── useAppStore.ts
└── .spec-workflow/           # 开发规范文档
```

## 🔄 开发工作流

### 审批流程

本项目使用 Spec Workflow MCP 进行开发管理。在开始开发前，需要：

1. **启动 Spec Workflow Dashboard** 或使用 VS Code 扩展
2. 依次审批以下文档：
   - ✅ requirements.md（需求规格）
   - ✅ design.md（技术设计）
   - ✅ tasks.md（任务分解）

3. 开始实施任务（按 tasks.md 中的顺序）

### 任务实施

```bash
# 查看当前规范状态
# 使用 MCP spec-status 工具

# 实施任务时：
# 1. 在 tasks.md 中将任务标记为 [-] (进行中)
# 2. 完成开发和测试
# 3. 标记为 [x] (已完成)
# 4. 继续下一个任务
```

## 📖 使用示例

### 基本工作流程

1. **上传 PDF**
   ```
   访问首页 → 拖拽或选择 AP CED PDF 文件 → 等待上传完成
   ```

2. **查看预览**
   ```
   自动跳转到处理页面 → 查看 JSON 数据预览 → 验证数据完整性
   ```

3. **对照验证**
   ```
   切换到"对照"标签 → 左侧查看 PDF，右侧查看 JSON → 点击 JSON 项跳转到对应 PDF 页
   ```

4. **编辑导出**
   ```
   切换到"编辑"标签 → 修改数据（可选）→ 点击"导出"→ 下载 JSON 文件
   ```

## 🧪 测试

```bash
# 单元测试
pnpm test

# 组件测试
pnpm test:components

# E2E 测试
pnpm test:e2e

# 测试覆盖率
pnpm test:coverage
```

## 🚢 部署

### Vercel 部署（推荐）

```bash
# 安装 Vercel CLI
pnpm install -g vercel

# 部署
vercel
```

### 环境变量

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/tmp
```

## 📝 数据格式示例

### 原始数据 JSON 结构

```json
{
  "courseName": "AP U.S. History",
  "courseCode": "AP-USHIST",
  "totalClassPeriods": 150,
  "units": [
    {
      "unitNumber": "1",
      "unitTitle": "Period 1: 1491-1607",
      "cedClassPeriods": 4,
      "apExamWeight": "4-6%",
      "topics": [
        {
          "topicNumber": "1.1",
          "topicTitle": "Contextualizing Period 1",
          "learningObjectives": [...],
          "essentialKnowledge": [...]
        }
      ]
    }
  ]
}
```

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 配置
- 使用 Prettier 格式化代码
- 编写完整的 TypeScript 类型
- 为复杂逻辑添加注释

## 📄 许可证

本项目仅供 PrepGo 内部使用。

## 📮 联系方式

如有问题或建议，请联系开发团队。

---

## 📚 相关资源

- [Next.js 文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [react-pdf 文档](https://github.com/wojtekmaj/react-pdf)
- [College Board AP Central](https://apcentral.collegeboard.org/)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-05  
**状态**: 开发中（规范设计阶段）
