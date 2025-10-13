# PrepGo 工具更新计划 v12.0

## 📋 更新概述

根据最新的 AI Curriculum Architect Prompt，进行以下重大更新：

---

## 🎯 核心变更

### 1. Unit 时长计算方式 ⏱️

**旧逻辑**：
- 基于 `class_to_app_factor` 和 `ced_class_periods` 预设时长
- 然后分配给 Topics

**新逻辑**：
- Topics 时长基于内容量计算（learn + review + practice）
- Unit 时长 = sum(topic.estimated_minutes)
- Course 时长 = sum(unit.estimated_minutes)
- **完全自下而上累加**

---

### 2. 配图标记规则 🖼️

**旧逻辑**：
```typescript
// 关键词判断，范围较宽
const imageKeywords = ['brain', 'diagram', 'structure', ...]
return imageKeywords.some(keyword => text.includes(keyword));
```

**新逻辑**：
```
严格必要性规则：
ONLY IF the content is unintelligible or impossible to answer WITHOUT a visual aid

示例：
❌ "What is the function of the cerebellum?" → requires_image: false
   （可以用文字回答）

✅ "Which labeled structure (A/B/C/D) is the cerebellum?" → requires_image: true
   （必须看图才能回答）
```

---

### 3. Flashcard 类型多样化 🎴

**旧结构**：
```typescript
interface Flashcard {
  front: string;
  back: string;
}
```

**新结构**：
```typescript
interface Flashcard {
  front: string;
  back: string;
  card_type: 'Term-Definition' | 'Concept-Explanation' | 'Scenario/Question-Answer';
}
```

**生成要求**：
- 每个 Topic 的 Flashcards 必须包含三种类型的混合
- AI Prompt 中明确要求生成多样化的卡片类型

---

### 4. Unit Test 重新设计 📝

**旧逻辑**：
- 从 Topic Quiz 中随机抽取 15-20 题
- 只有 MCQ（Multiple Choice Questions）

**新逻辑**：

#### a. 参考 Progress Check 结构
```
从 PDF 的 "Course at a Glance" 页面查找：
- MCQ 数量
- FRQ 数量
- 题型分布
```

#### b. 创建全新考题
```
- 不再从 Topic Quiz 抽题
- AI 扮演"AP 出题官"角色
- 从零创作新的综合性考题
- 题目涵盖多个 Topics
```

#### c. 包含 FRQ（Free-Response Questions）
```typescript
interface UnitAssessmentQuestion {
  question_id: string;
  test_id: string;
  question_type: 'MCQ' | 'FRQ';  // 新增字段
  question_text: string;
  // MCQ 字段
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  // FRQ 字段
  parts?: FRQPart[];  // 多部分问题
  rubric?: string;    // 评分标准
  explanation: string;
  requires_image: boolean;
}

interface FRQPart {
  part_label: string;  // "a", "b", "c", etc.
  part_question: string;
  points: number;
  expected_answer: string;
}
```

#### d. 模仿官方样题风格
```
参考 PDF 的 "Exam Information" 部分：
- 题目措辞
- 复杂度
- 综合性要求
```

---

### 5. Power Score 标准化 (可选优化)

**目的**：更好地平衡 Topics 的权重

**公式**：
```
#LO_time = min(#LO_content, 3)
#EK_time = min(#EK_content, 6)
Power_Score = (#LO_time * 3) + (#EK_time * 2)
```

**用途**：
- 用于时间分配的归一化
- 避免 LO/EK 过多导致的时间膨胀

---

## 📊 数据结构更新

### TypeScript 接口需要更新

#### 1. APCourse
```typescript
interface APCourse {
  course_name: string;
  course_id: string;
  difficulty_level: number;
  estimated_minutes: number;  // 由 Units 自下而上累加
  units: APUnit[];
}
```

#### 2. APUnit
```typescript
interface APUnit {
  unit_id: string;
  unit_number: number;
  unit_title: string;
  estimated_minutes: number;  // 由 Topics 自下而上累加
  ced_class_periods: string;
  exam_weight: string;
  topics: APTopic[];
}
```

#### 3. Flashcard
```typescript
interface Flashcard {
  front: string;
  back: string;
  card_type: 'Term-Definition' | 'Concept-Explanation' | 'Scenario/Question-Answer';
}
```

#### 4. TopicFlashcard (数据库格式)
```typescript
interface TopicFlashcard {
  card_id: string;
  topic_id: string;
  card_type: 'Term-Definition' | 'Concept-Explanation' | 'Scenario/Question-Answer';
  front_content: string;
  back_content: string;
  requires_image: boolean;
}
```

#### 5. UnitAssessmentQuestion
```typescript
interface UnitAssessmentQuestion {
  question_id: string;
  test_id: string;
  question_type: 'MCQ' | 'FRQ';
  question_text: string;
  // MCQ fields (optional for FRQ)
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  // FRQ fields (optional for MCQ)
  parts?: FRQPart[];
  rubric?: string;
  // Common fields
  explanation: string;
  requires_image: boolean;
}
```

---

## 🔧 代码修改清单

### Phase 1: 类型定义更新
- [ ] `src/types/course.ts`
  - [ ] 添加 `card_type` 到 Flashcard
  - [ ] 添加 `question_type` 到 Quiz/UnitAssessmentQuestion
  - [ ] 添加 FRQ 相关字段
  - [ ] 更新 APCourse/APUnit 的 estimated_minutes 注释

### Phase 2: 算法逻辑更新

#### `src/lib/course-generator.ts`

##### a. 时间计算逻辑
- [ ] `assignModuleTasks()` 方法
  - [ ] 保持基于 LO/EK 的内容量计算
  - [ ] 保持基于内容量的时间计算
  - [ ] **新增**：Power Score 计算（可选）
  
- [ ] `calculateDurations()` 方法
  - [ ] **删除**：基于 class_periods 的预设时长
  - [ ] **新增**：自下而上累加 Topic → Unit → Course

##### b. Flashcard 生成
- [ ] `generateSingleTopicContent()` 方法
  - [ ] 更新 Prompt：要求生成三种类型
  - [ ] 更新 Prompt：每个 flashcard 必须包含 `card_type` 字段
  - [ ] 验证：检查返回的 flashcards 是否包含三种类型

##### c. 配图标记
- [ ] `checkRequiresImage()` 方法
  - [ ] **重写**：改为严格必要性规则
  - [ ] **删除**：大部分宽泛的关键词
  - [ ] **保留**：只检测明确需要图片的模式
    - "refer to the diagram/figure/table"
    - "labeled structure A/B/C/D"
    - "shown in the figure"
  
##### d. Unit Test 生成
- [ ] **删除**：`selectRandomQuizzes()` 方法
- [ ] **新增**：`generateUnitTest()` 方法
  - [ ] 参数：unit, all_topics, pdf_context
  - [ ] 逻辑：
    1. 提取 Progress Check 信息（MCQ/FRQ 数量）
    2. 构造新的 Prompt
    3. 调用 AI 生成全新考题
    4. 解析并验证结果
  
- [ ] **更新**：`convertToDualJSON()` 方法
  - [ ] 替换 `selectRandomQuizzes` 调用
  - [ ] 使用新的 `generateUnitTest` 方法

### Phase 3: Prompt 更新

#### AI Generation Prompts

##### a. Topic Content Prompt
```typescript
// src/lib/course-generator.ts - generateSingleTopicContent()

const prompt = `You are an AP course content generator. Create high-quality educational content for the following topic.

TOPIC: ${topic.topic_title}
LEARNING OBJECTIVES: ${loSummaries}
ESSENTIAL KNOWLEDGE: ${ekSummaries}

Generate the following content in strict JSON format:

{
  "study_guide": "Approximately ${wordCount} words...",
  "flashcards": [
    {
      "front": "...",
      "back": "...",
      "card_type": "Term-Definition" | "Concept-Explanation" | "Scenario/Question-Answer"
    }
    // Generate EXACTLY ${flashcardCount} flashcards
    // MUST include a MIX of all three types
  ],
  "quiz": [...]
}

CRITICAL REQUIREMENTS:
1. Flashcard Diversification: MUST include Term-Definition, Concept-Explanation, AND Scenario/Question-Answer types
2. Image Flagging (Strict Necessity): Set requires_image to true ONLY IF unintelligible without visual
3. All content in ENGLISH
4. Valid JSON syntax
`;
```

##### b. Unit Test Prompt (NEW)
```typescript
// src/lib/course-generator.ts - generateUnitTest()

const prompt = `You are an AP Exam Designer. Create a high-fidelity Unit Test for this unit.

UNIT: ${unit.unit_title}
TOPICS COVERED: ${topicsSummary}

PROGRESS CHECK REQUIREMENTS (from PDF):
- MCQ Count: ${mcqCount}
- FRQ Count: ${frqCount}

EXAM STYLE GUIDELINES:
Refer to the "Exam Information" section of the CED for style, complexity, and phrasing examples.

Generate a comprehensive unit test:

{
  "test_title": "Unit ${unit.unit_number} Test",
  "questions": [
    {
      "question_type": "MCQ" | "FRQ",
      "question_text": "...",
      // MCQ specific
      "options": [...],
      "correct_answer": "...",
      // FRQ specific
      "parts": [
        {
          "part_label": "a",
          "part_question": "...",
          "points": 2
        }
      ],
      "rubric": "...",
      // Common
      "explanation": "...",
      "requires_image": false
    }
  ]
}

CRITICAL REQUIREMENTS:
1. DO NOT reuse questions from topic quizzes
2. Create NEW, comprehensive questions from scratch
3. FRQs should synthesize knowledge from MULTIPLE topics
4. Total: ${mcqCount} MCQs + ${frqCount} FRQs
5. Model the official AP exam style
`;
```

### Phase 4: UI 更新

#### a. JSON Viewer
- [ ] `src/components/JSONViewer.tsx`
  - [ ] 显示新的 `card_type` 字段
  - [ ] 显示新的 `question_type` 字段
  - [ ] 支持 FRQ 结构的展示

#### b. Statistics Display
- [ ] `src/components/CompleteCourseGenerator.tsx`
  - [ ] 显示 MCQ vs FRQ 统计
  - [ ] 显示 Flashcard 类型分布统计

---

## 🧪 测试计划

### 1. 单元测试
- [ ] 时间计算：验证自下而上累加
- [ ] Flashcard 类型：验证三种类型都存在
- [ ] 配图标记：验证严格规则
- [ ] FRQ 生成：验证结构完整性

### 2. 集成测试
- [ ] 完整课程生成流程
- [ ] 验证输出的两个 JSON 结构
- [ ] 验证统计数据准确性

### 3. E2E 测试
- [ ] 上传 PDF + JSON
- [ ] 生成完整课程
- [ ] 下载并验证结果
- [ ] 检查 Vercel 环境兼容性

---

## 📈 预期效果

### 内容质量提升
- ✅ 更准确的时间估算（基于实际内容）
- ✅ 更多样化的学习材料（三种 Flashcard 类型）
- ✅ 更真实的考试体验（包含 FRQ）
- ✅ 更精准的配图需求（减少不必要的配图）

### 数据结构优化
- ✅ 时间数据完全数据驱动
- ✅ 支持更复杂的考试题型
- ✅ 更好的类型安全

### 用户体验改进
- ✅ 更贴近真实 AP 考试
- ✅ 学习路径更合理
- ✅ 配图需求更明确

---

## ⚠️ 注意事项

### 1. API Token 消耗增加
- Unit Test 的全新生成会增加 API 调用
- 每个 Unit 额外 1 次 API 调用
- 预计总 token 消耗增加 20-30%

### 2. 生成时间延长
- FRQ 生成需要更多时间
- 预计每个 Unit Test 增加 5-10 秒

### 3. Vercel 超时风险
- 对于 30+ Topics 的课程仍可能超时
- 建议继续使用"单独生成每个单元"

---

## 🚀 实施步骤

1. ✅ **Phase 1**: 更新 spec 文档（本文档）
2. ⏳ **Phase 2**: 更新类型定义
3. ⏳ **Phase 3**: 更新核心算法
4. ⏳ **Phase 4**: 更新 AI Prompts
5. ⏳ **Phase 5**: 更新 UI 组件
6. ⏳ **Phase 6**: 测试和修复
7. ⏳ **Phase 7**: 部署到 Vercel

---

**更新日期**: 2025-10-11  
**版本**: v12.0  
**作者**: AI Assistant

