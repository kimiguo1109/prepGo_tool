# 变更日志 - AP 课程处理工具

## 2025-10-11 - v11.0 双输出格式重大更新

### 🎯 更新概述

将输出格式从单一 JSON 升级为**双 JSON 输出架构**，以满足数据库导入和完整备份的不同需求。

### ✅ 已完成的更新

#### 1. **design.md** - 设计文档

##### 第 3.4 节：双输出格式设计（Phase 4）
**新增内容**：
- **3.4.0 输出架构概述**：说明双 JSON 输出的目的和用途
- **3.4.3 数据表结构定义**：
  - `separated_content_json` 表结构（6 个表）
  - `combined_complete_json` 表结构（8 个表）
- **3.4.4 最终输出结构示例**：完整的 JSON 示例

**新增接口定义**：
```typescript
interface SeparatedContentJSON {
  topic_overviews: TopicOverview[];
  study_guides: StudyGuide[];
  topic_flashcards: TopicFlashcard[];
  quizzes: Quiz[];
  unit_tests: UnitTest[];
  unit_assessment_questions: UnitAssessmentQuestion[];
}

interface CombinedCompleteJSON {
  courses: Course[];
  units: Unit[];
  topics: Topic[];
  study_guides: StudyGuide[];
  topic_flashcards: TopicFlashcard[];
  quizzes: Quiz[];
  unit_tests: UnitTest[];
  unit_assessment_questions: UnitAssessmentQuestion[];
}
```

##### 第 3.2 节：API 路由规划
**更新内容**：
- API 端点：`POST /api/process` → `POST /api/generate-complete-course`
- 响应格式：返回包含两个 JSON 对象的数据结构
- 新增统计信息：flashcards/quiz questions requiring images

#### 2. **requirements.md** - 需求文档

##### FR-3: 双 JSON 数据预览（v11.0）
**更新内容**：
- 支持预览两个独立的 JSON：`separated_content_json` 和 `combined_complete_json`
- 提供切换按钮在两个视图之间切换
- 显示每个 JSON 的大小和生成时间
- 分别支持复制两个 JSON 到剪贴板

##### FR-6: 双 JSON 数据导出（v11.0）
**更新内容**：
- **分离导出**：单独下载两个 JSON 文件
- **打包导出**：下载包含两个文件的 ZIP 压缩包
- **单独复制**：分别复制到剪贴板
- 文件命名规范：
  - `{course_name}_separated_{timestamp}.json`
  - `{course_name}_complete_{timestamp}.json`
  - `{course_name}_all_{timestamp}.zip`
- 新增验证：检查 `requires_image` 字段和外键完整性

##### 第 4.2 节：输出数据结构（v11.0 双 JSON 格式）
**新增内容**：
- `separated_content_json` 结构示例
- `combined_complete_json` 结构示例
- 扁平化表结构说明

### 📊 输出格式对比

| 特性 | 旧格式（单一 JSON） | 新格式（双 JSON v11.0） |
|------|---------------------|-------------------------|
| 结构 | 嵌套 JSON | 扁平化表结构 |
| 输出 | 1 个 JSON 对象 | 2 个独立 JSON 对象 |
| 用途 | 通用备份 | 分离：数据库导入 + 完整备份 |
| 内容 | 混合所有数据 | separated：仅新内容<br/>combined：完整课程包 |
| 表数量 | N/A | separated: 6 表<br/>combined: 8 表 |
| 外键 | N/A | 明确的 topic_id, unit_id, test_id |

### 🎯 更新原因

1. **数据库友好**：扁平化表结构，直接对应数据库表，无需复杂转换
2. **关注点分离**：
   - `separated_content_json`：专注于新生成的内容，便于增量导入
   - `combined_complete_json`：完整数据包，便于备份和审查
3. **灵活性**：用户可根据需求选择导入部分或全部数据
4. **可维护性**：清晰的外键关系，易于理解和维护

### 📝 开发建议

#### 使用双 JSON 输出

```typescript
// API 响应示例
const response = {
  success: true,
  data: {
    separated_content_json: {
      topic_overviews: [...],
      study_guides: [...],
      topic_flashcards: [...],
      quizzes: [...],
      unit_tests: [...],
      unit_assessment_questions: [...]
    },
    combined_complete_json: {
      courses: [...],
      units: [...],
      topics: [...],
      study_guides: [...],
      topic_flashcards: [...],
      quizzes: [...],
      unit_tests: [...],
      unit_assessment_questions: [...]
    }
  },
  statistics: {
    total_topics: 50,
    total_flashcards: 500,
    flashcards_requiring_images: 75
  }
};
```

#### 数据库导入流程

```typescript
// 导入 separated_content_json 到数据库
async function importToDatabase(separatedJson: SeparatedContentJSON) {
  // 1. 导入 topic_overviews
  await db.topic_overviews.insertMany(separatedJson.topic_overviews);
  
  // 2. 导入 study_guides
  await db.study_guides.insertMany(separatedJson.study_guides);
  
  // 3. 导入 topic_flashcards
  await db.topic_flashcards.insertMany(separatedJson.topic_flashcards);
  
  // 4. 导入 quizzes
  await db.quizzes.insertMany(separatedJson.quizzes);
  
  // 5. 导入 unit_tests
  await db.unit_tests.insertMany(separatedJson.unit_tests);
  
  // 6. 导入 unit_assessment_questions
  await db.unit_assessment_questions.insertMany(separatedJson.unit_assessment_questions);
}
```

### 🚀 下一步

1. **更新代码实现**：修改 `course-generator.ts` 和 `ai-service.ts` 以输出新格式
2. **更新 UI 组件**：支持双 JSON 预览和导出
3. **编写转换函数**：从旧格式迁移到新格式（如需要）
4. **更新测试用例**：验证双 JSON 输出的正确性

### 📚 相关文件

- ✅ `design.md` - 已更新（3.2, 3.4 节）
- ✅ `requirements.md` - 已更新（FR-3, FR-6, 4.2 节）
- ⏳ `tasks.md` - 保持不变（实施时再更新）
- 🆕 `CHANGELOG.md` - 本次更新

---

**更新完成日期**: 2025-10-11  
**更新人**: AI Assistant  
**版本**: v11.0  
**状态**: ✅ Spec 更新完成，待代码实现

---

## 2025-10-05 - 数据结构更新

### ✅ 已完成的更新

#### 1. **requirements.md** - 需求文档
- **第 4.1 节**：更新原始数据 JSON 结构示例
- 采用 snake_case 命名风格（`course_name`, `unit_number`）
- 匹配 Gemini 提取的实际格式
- 移除不存在的字段（`progress_check`, `unit_overview`, `suggested_skill`）

#### 2. **design.md** - 设计文档

##### 第 2.1 节：TypeScript 类型定义
**更新内容**：
```typescript
// 之前 (camelCase)
interface APCourse {
  courseName: string;
  courseCode: string;
  totalClassPeriods: number;
}

// 之后 (snake_case)
interface APCourse {
  course_name: string;
  units: APUnit[];
  metadata?: CourseMetadata;
}
```

**主要变更**：
- ✅ 字段命名：camelCase → snake_case
- ✅ `ced_class_periods`：number → string ("~8 Class Periods")
- ✅ `unit_number`：string → number
- ✅ LO/EK 字段：简化为 `id` + `summary`
- ✅ 移除：`courseCode`, `progressCheck`, `unitOverview`, `suggestedSkill`

##### 第 2.2 节：Zod 验证模式
**更新内容**：
```typescript
// 之前
loCode: z.string().regex(/^[A-Z]+-\d+\.[A-Z]$/)

// 之后
id: z.string().min(1) // "Unit 1: Learning Objective A"
```

**主要变更**：
- ✅ 字段名匹配实际格式
- ✅ 正则表达式适配新格式
- ✅ `ced_class_periods` 验证：`/^~\d+\s+Class\s+Periods$/`

##### 第 6.1 节：PDF 解析服务
**更新内容**：
- ✅ 正则表达式模式更新
- ✅ 提取逻辑适配新数据结构
- ✅ 添加 `parseCedClassPeriods` 工具函数

##### 其他小更新
- ✅ 工具函数增强（formatFileSize, parseCedClassPeriods）
- ✅ Logger 实现完善
- ✅ 使用示例注释

#### 3. **tasks.md** - 任务文档
- ⚠️ **保持不变**（任务实施时会基于更新后的设计）

### 📊 数据结构对比

| 字段 | 旧格式 | 新格式 | 说明 |
|------|--------|--------|------|
| 课程名称 | `courseName` | `course_name` | snake_case |
| 单元编号 | `"1"` (string) | `1` (number) | 数字类型 |
| CED 时长 | `8` (number) | `"~8 Class Periods"` | 字符串格式 |
| LO ID | `loCode: "GEO-1.A"` | `id: "Unit 1: Learning Objective A"` | 格式变化 |
| EK ID | `ekCode: "GEO-1.A.1"` | `id: "KC-1.1"` | 格式变化 |

### 🎯 更新原因

1. **兼容性**：直接支持 Gemini 提取的 JSON 格式
2. **准确性**：与 College Board CED 文档结构保持一致
3. **简化性**：减少数据转换的复杂度
4. **可维护性**：统一数据格式标准

### 📝 开发建议

#### 使用 Gemini JSON 作为测试数据
```bash
# 文件位置
/Users/mac/Desktop/kimi_playground/prepGo/Gemini 2.5提取原始内容.json
```

#### 数据访问示例
```typescript
// ✅ 正确
courseData.course_name
courseData.units[0].unit_number
courseData.units[0].topics[0].learning_objectives[0].id

// ❌ 错误（旧格式）
courseData.courseName
courseData.units[0].unitNumber
```

#### 类型安全
```typescript
import { APCourse, APUnit, APTopic } from '@/types/course';
import { APCourseSchema } from '@/lib/validators';

// 验证数据
const result = APCourseSchema.safeParse(jsonData);
if (result.success) {
  const course: APCourse = result.data;
  // 类型安全的访问
  console.log(course.course_name);
}
```

### 🚀 下一步

1. **运行 Spec Workflow 审批**（如果使用 Dashboard）
2. **开始 Task 1.1**：初始化 Next.js 项目
3. **实施开发任务**：按照 tasks.md 的顺序执行

### 📚 相关文件

- ✅ `requirements.md` - 已更新
- ✅ `design.md` - 已更新
- ⏳ `tasks.md` - 无需更新（等待实施）
- 📄 `Gemini 2.5提取原始内容.json` - 参考数据

---

**更新完成日期**: 2025-10-05  
**更新人**: AI Assistant  
**状态**: ✅ 就绪，可开始开发
