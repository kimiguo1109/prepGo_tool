# 变更日志 - AP 课程处理工具

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
