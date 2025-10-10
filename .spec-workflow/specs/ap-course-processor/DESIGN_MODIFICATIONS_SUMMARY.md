# Design Spec 修改总结

## 修改日期
2025-10-10

## 修改原因
需求变更：不再从PDF中提取数据，而是直接使用已提取的JSON文件作为输入。

## 主要修改内容

### 1. 系统架构调整（第1节）
**修改前**：
- PDF上传 → PDF解析 → 数据提取 → JSON生成

**修改后**：
- PDF + JSON 上传 → JSON验证 → 数据计算 → 合并输出
- PDF仅用于对照展示
- JSON包含已提取的课程结构数据

### 2. 数据处理流程简化（第3节）
**删除的步骤**：
- PDF文本提取
- 正则表达式解析
- LLM API调用（如果有）

**新增的4个核心步骤**：
1. **步骤1**: 读取输入数据（PDF用于展示，JSON用于处理）
2. **步骤2**: 统计计算（课程/单元/主题级别统计）
3. **步骤3**: 数据合并（原始数据 + 计算数据）
4. **步骤4**: 输出结果（完整JSON）

### 3. API路由变更（第3节）
**删除的API**：
- `POST /api/upload` - 单独上传PDF
- `POST /api/parse` - 解析PDF
- `GET /api/status/:fileId` - 查询解析状态

**新增的API**：
- `POST /api/process` - 核心API，接收PDF+JSON，返回完整数据
- `POST /api/export` - 导出处理后的JSON

### 4. 新增数据结构（第3.3节）
```typescript
EnrichedAPCourse {
  ...APCourse,  // 原始数据
  statistics: CourseStatistics  // 计算数据
}

CourseStatistics {
  - total_units/topics/learning_objectives/essential_knowledge
  - unit_statistics[]
  - knowledge_hierarchy
  - exam_weight_distribution[]
}
```

### 5. 组件更新
**FileDropZone → DualFileUpload**：
- 支持同时上传PDF和JSON两个文件
- PDF用于对照展示
- JSON用于数据处理
- 两个文件都选择后才开始处理

### 6. 核心逻辑重写（第6节）
**删除**: `src/lib/pdf-parser.ts`（PDF解析服务）

**新增**: `src/lib/data-processor.ts`（数据处理服务）
- `processAPCourseData()` - 主处理函数
- `calculateStatistics()` - 计算统计数据
- `calculateUnitStatistics()` - 单元级统计
- `calculateKnowledgeHierarchy()` - 知识点层级分析
- `calculateExamWeight()` - 考试权重分析
- `extractClassPeriods()` - 提取课时数
- `extractExamWeight()` - 提取权重范围
- `getKnowledgeLevel()` - 判断KC层级

### 7. 页面实现更新（第7节）
**首页（src/app/page.tsx）**：
- 使用DualFileUpload组件
- 调用`/api/process`处理数据
- 显示处理进度
- 成功后跳转到processor页面

## 保留的内容
- JSONViewer 组件（第4.2节）
- PDFViewer 组件（第4.2节）- 用于对照展示
- Zustand状态管理（第5节）
- Tailwind样式配置（第8节）
- 错误处理机制（第9节）
- 性能优化策略（第10节）

## 技术栈不变
- Next.js 15+
- TypeScript 5+
- Tailwind CSS
- shadcn/ui
- react-pdf（PDF展示）
- Zustand（状态管理）
- Zod（数据验证）

## 输入/输出规格

### 输入
1. **PDF文件**: AP课程CED PDF（用于对照展示）
2. **JSON文件**: 已提取的课程结构数据（如 `US History提取原始内容.json`）

### 输出
完整JSON文件，包含：
```json
{
  "course_name": "AP U.S. History",
  "units": [...],  // 原始数据
  "statistics": {  // 计算数据
    "total_units": 9,
    "total_topics": 75,
    "unit_statistics": [...],
    "knowledge_hierarchy": {...},
    "exam_weight_distribution": [...]
  }
}
```

## 不再需要的依赖
- `pdf-parse` - 不再需要解析PDF文本
- 任何LLM API SDK（如果之前计划使用）

## 测试建议
1. 使用 `prepGo/input/US History提取原始内容.json` 作为测试输入
2. 验证统计计算的准确性
3. 测试PDF对照展示功能
4. 验证JSON输出格式

## 后续工作
1. 实现 `src/lib/data-processor.ts`
2. 实现 `src/app/api/process/route.ts`
3. 创建 DualFileUpload 组件
4. 更新 Zustand store（如果需要）
5. 编写单元测试

## 注意事项
- PDF文件现在仅用于UI展示，不参与数据处理
- 所有计算基于JSON输入数据
- 需要验证JSON数据结构的完整性
- 知识点层级判断逻辑需要根据实际数据调整

