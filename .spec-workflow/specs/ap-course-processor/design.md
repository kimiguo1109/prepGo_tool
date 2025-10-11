# 技术设计文档 - AP 课程处理工具

## 1. 系统架构

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  上传组件    │  │  预览组件    │  │  对照组件    │  │
│  │ (PDF+JSON)   │  │  (JSON树)    │  │ (PDF/JSON)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                  │           │
│         └─────────────────┴──────────────────┘           │
│                          │                                │
│                    ┌─────▼─────┐                         │
│                    │ App Router │                         │
│                    └─────┬─────┘                         │
│                          │                                │
├─────────────────────────┼────────────────────────────────┤
│         Next.js          │         服务端                 │
│                          │                                │
│                    ┌─────▼─────┐                         │
│                    │ API Routes │                         │
│                    └─────┬─────┘                         │
│                          │                                │
│         ┌────────────────┼────────────────┐              │
│         │                │                │              │
│    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐        │
│    │ JSON读取│    │ 数据计算  │   │ JSON合并  │        │
│    │ 服务    │    │ 服务      │   │ 输出服务  │        │
│    └─────────┘    └───────────┘   └───────────┘        │
│                                                           │
└─────────────────────────────────────────────────────────┘

输入：
- PDF 文件（用于展示对照）
- JSON 文件（提取的原始课程结构数据）

输出：
- 完整 JSON（原始数据 + 计算数据）
```

### 1.2 技术栈选型

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| 框架 | Next.js | 15+ | App Router、服务端组件、API Routes |
| 语言 | TypeScript | 5+ | 类型安全、开发体验 |
| 样式 | Tailwind CSS | 3+ | 快速开发、响应式设计 |
| UI组件 | shadcn/ui | Latest | 高质量组件、可定制 |
| PDF渲染 | react-pdf | 10+ | 成熟稳定、React集成好 |
| PDF解析 | pdf-parse | Latest | Node.js原生、轻量级 |
| 代码编辑器 | Monaco Editor | Latest | VSCode同款、强大 |
| 状态管理 | Zustand | Latest | 轻量、简单 |
| 表单处理 | React Hook Form | Latest | 性能优秀 |
| 数据验证 | Zod | Latest | TypeScript优先 |

## 2. 数据模型设计

### 2.1 TypeScript 类型定义

```typescript
// src/types/course.ts

/**
 * 课程完整数据结构
 * 遵循 College Board CED 文档和 Gemini 提取的实际格式
 */
export interface APCourse {
  course_name: string;
  units: APUnit[];
  metadata?: CourseMetadata;
  // Phase 4: 最终统计数据
  image_statistics?: ImageStatistics;
}

/**
 * 课程元数据
 */
export interface CourseMetadata {
  extracted_at: string;
  pdf_file_name: string;
  pdf_page_count: number;
  version: string;
}

/**
 * 单元数据
 */
export interface APUnit {
  unit_number: number;
  unit_title: string;
  ced_class_periods: string; // 格式: "~8 Class Periods"
  exam_weight: string; // 格式: "4-6%"
  topics: APTopic[];
  // AI 生成的单元测试（从 Topic Quiz 编译而成）
  unit_test?: UnitTest;
}

/**
 * 单元测试数据（Phase 3 生成）
 */
export interface UnitTest {
  unit_number: number;
  test_title: string;         // 格式: "Unit 1 Test"
  questions: QuizQuestion[];  // 15-20 题，从 Topic Quiz 中选取
  total_questions: number;
  estimated_minutes: number;  // 建议测试时长
}

/**
 * 主题数据
 */
export interface APTopic {
  topic_number: string; // 格式: "1.1"
  topic_title: string;
  learning_objectives: LearningObjective[];
  essential_knowledge: EssentialKnowledge[];
  // AI 生成的学习内容
  topic_estimated_minutes?: number;
  learn?: {
    minutes: number;
    study_guide_words: number;
  };
  review?: {
    minutes: number;
    flashcards_count: number;
  };
  practice?: {
    minutes: number;
    quiz_count: number;
  };
  study_guide?: string;
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
}

/**
 * 闪卡数据
 */
export interface Flashcard {
  front: string;
  back: string;
  requires_image: boolean; // 是否需要配图
}

/**
 * 测验题目数据
 */
export interface QuizQuestion {
  question: string;
  options: string[];          // 格式: ["A. ...", "B. ...", "C. ...", "D. ..."]
  correct_answer: string;     // 格式: "A", "B", "C", or "D"
  explanation: string;
  requires_image: boolean;    // 是否需要配图
}

/**
 * 学习目标
 */
export interface LearningObjective {
  id: string; // 格式: "Unit 1: Learning Objective A"
  summary: string;
}

/**
 * 基本知识
 */
export interface EssentialKnowledge {
  id: string; // 格式: "KC-1.1" 或 "KC-1.1.I.A"
  summary: string;
}

/**
 * 图像需求统计（Phase 4 生成）
 */
export interface ImageStatistics {
  // Flashcards
  total_flashcards: number;
  flashcards_requiring_images: number;
  flashcards_image_percentage: number;
  
  // Topic Quiz
  total_topic_quiz_questions: number;
  topic_quiz_requiring_images: number;
  topic_quiz_image_percentage: number;
  
  // Unit Tests
  total_unit_test_questions: number;
  unit_test_requiring_images: number;
  unit_test_image_percentage: number;
  
  // 总计
  total_items: number;
  total_requiring_images: number;
  overall_image_percentage: number;
}

/**
 * 上传状态
 */
export interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  error?: string;
}

/**
 * 解析结果
 */
export interface ParseResult {
  success: boolean;
  data?: APCourse;
  error?: string;
  warnings?: string[];
}
```

### 2.2 Zod 验证模式

```typescript
// src/lib/validators.ts
import { z } from 'zod';

export const LearningObjectiveSchema = z.object({
  id: z.string().min(1), // 格式: "Unit 1: Learning Objective A"
  summary: z.string().min(10),
});

export const EssentialKnowledgeSchema = z.object({
  id: z.string().min(1), // 格式: "KC-1.1" 或 "KC-1.1.I.A"
  summary: z.string().min(10),
});

export const APTopicSchema = z.object({
  topic_number: z.string().regex(/^\d+\.\d+$/), // 格式: "1.1"
  topic_title: z.string().min(3),
  learning_objectives: z.array(LearningObjectiveSchema),
  essential_knowledge: z.array(EssentialKnowledgeSchema),
});

export const APUnitSchema = z.object({
  unit_number: z.number().int().positive(),
  unit_title: z.string().min(3),
  ced_class_periods: z.string().regex(/^~\d+\s+Class\s+Periods$/), // 格式: "~8 Class Periods"
  exam_weight: z.string().regex(/^\d+-\d+%$/), // 格式: "4-6%"
  topics: z.array(APTopicSchema),
});

export const APCourseSchema = z.object({
  course_name: z.string().min(3),
  units: z.array(APUnitSchema),
  metadata: z.object({
    extracted_at: z.string(),
    pdf_file_name: z.string(),
    pdf_page_count: z.number(),
    version: z.string(),
  }).optional(),
});
```

## 3. AI 内容生成逻辑

### 3.1 图像标记规则（Image Flagging）

> **适用范围**：Phase 2 和 Phase 3
> - Phase 2: 为新生成的 flashcards 和 quiz questions 添加 requires_image
> - Phase 3: 编译 unit test 时保留原题的 requires_image 标记

AI 生成器在创建 flashcards 和 quiz questions 时，必须为每个项目添加 `requires_image` 标志。

#### 3.1.1 Quiz Questions 图像判断规则

将 `requires_image` 设置为 `true` 的情况：
- 问题要求用户解读图表、图形、地图或数据表
- 问题引用特定的图示、艺术作品、结构或视觉模型
  - 例如："Based on the diagram of the cell..."
  - 例如:"Which artist painted the work shown..."
- 问题基于刺激材料（stimulus-based），需要原始文档、漫画或照片才能理解
- 问题涉及空间推理，图像可以帮助理解（如分子几何、物理力图）

#### 3.1.2 Flashcards 图像判断规则

将 `requires_image` 设置为 `true` 的情况：
- 正面是视觉概念的术语（如"Doric Column"、"Mitochondrion"、"Tectonic Plates Map"）
  - 图像应放在背面与定义一起
- 正面是定义，背面是视觉对象的名称

#### 3.1.3 示例数据

```json
{
  "flashcards": [
    {
      "front": "Cohesion",
      "back": "The property of water molecules sticking to each other due to hydrogen bonds.",
      "requires_image": false
    },
    {
      "front": "Mitochondrion",
      "back": "The powerhouse of the cell, responsible for ATP production.",
      "requires_image": true
    }
  ],
  "quiz": [
    {
      "question": "Which property of water is most directly responsible for the transport of water from roots to leaves?",
      "options": ["A. Polarity", "B. Cohesion", "C. High specific heat", "D. Expansion upon freezing"],
      "correct_answer": "B",
      "explanation": "Cohesion allows water molecules to stick together, creating a continuous column for transport.",
      "requires_image": false
    },
    {
      "question": "Based on the provided Lewis diagram, what is the molecular geometry of the species?",
      "options": ["A. Tetrahedral", "B. Linear", "C. Bent", "D. Trigonal planar"],
      "correct_answer": "A",
      "explanation": "The molecule has four bonding regions and no lone pairs, resulting in tetrahedral geometry.",
      "requires_image": true
    }
  ]
}
```

### 3.2 内容生成工作流

```
Phase 1: Quantitative Planning (使用 JSON)
  ├─ 分析课程类型（A/B/C）
  ├─ 分配参数（学习速度、每日时长）
  ├─ 计算内容数量（target_mcq, target_flashcards, target_sg_words）
  └─ 计算每个 Topic 的学习时长

Phase 2: Iterative Content Generation (使用 JSON 和 PDF)
  ├─ 为每个 Topic 生成 Study Guide
  ├─ 生成 Flashcards（含 requires_image 标记）
  ├─ 生成 Quiz Questions（含 requires_image 标记）
  └─ 注意：requires_image 遵循 3.1 节定义的判断规则

Phase 3: Unit Test Compilation (使用已生成的 Topic Quiz)
  ├─ 从所有 Topic Quiz 中随机选取题目
  ├─ 编译成 Unit-level 综合测试
  ├─ 保留原题的 requires_image 标记
  └─ 每个 Unit Test 包含 15-20 道题

Phase 4: Final Assembly
  ├─ 组装完整课程数据
  ├─ 验证所有 flashcards 和 quiz questions 都有 requires_image 字段
  ├─ 统计图像需求（需要配图的题目数量）
  └─ 输出完整 JSON（含所有生成内容和图像标记）
```

### 3.3 Unit Test 编译规则（Phase 3）

#### 3.3.1 编译流程

```typescript
/**
 * 从 Topic Quiz 编译 Unit Test
 */
function compileUnitTest(unit: APUnit): UnitTest {
  // 1. 收集所有 Topic Quiz 中的题目
  const allQuestions: QuizQuestion[] = [];
  for (const topic of unit.topics) {
    if (topic.quiz && topic.quiz.length > 0) {
      allQuestions.push(...topic.quiz);
    }
  }

  // 2. 随机选择 15-20 题（根据题目总数）
  const targetCount = Math.min(20, Math.max(15, allQuestions.length));
  const selectedQuestions = shuffleAndSelect(allQuestions, targetCount);

  // 3. 保留原题的所有字段（包括 requires_image）
  return {
    unit_number: unit.unit_number,
    test_title: `Unit ${unit.unit_number} Test`,
    questions: selectedQuestions, // 完整保留 requires_image
    total_questions: selectedQuestions.length,
    estimated_minutes: selectedQuestions.length * 1.5 // 每题 1.5 分钟
  };
}
```

#### 3.3.2 题目选择策略

- **数量**：15-20 题（根据 unit 包含的 topics 数量调整）
- **分布**：尽量从不同 topics 中选取（保证覆盖面）
- **随机性**：使用加权随机（优先选择重要 topics 的题目）
- **保留原始数据**：
  - `question`
  - `options`
  - `correct_answer`
  - `explanation`
  - **`requires_image`**（关键：必须保留）

#### 3.3.3 示例 Unit Test 数据

```json
{
  "unit_number": 1,
  "unit_title": "The Chemical Basis of Life",
  "unit_test": {
    "unit_number": 1,
    "test_title": "Unit 1 Test",
    "questions": [
      {
        "question": "Which property of water is most directly responsible for the transport of water from roots to leaves?",
        "options": [
          "A. Polarity",
          "B. Cohesion",
          "C. High specific heat",
          "D. Expansion upon freezing"
        ],
        "correct_answer": "B",
        "explanation": "Cohesion allows water molecules to stick together, creating a continuous column for transport.",
        "requires_image": false
      },
      {
        "question": "Based on the provided Lewis diagram, what is the molecular geometry of the species?",
        "options": [
          "A. Tetrahedral",
          "B. Linear",
          "C. Bent",
          "D. Trigonal planar"
        ],
        "correct_answer": "A",
        "explanation": "The molecule has four bonding regions and no lone pairs, resulting in tetrahedral geometry.",
        "requires_image": true
      }
    ],
    "total_questions": 18,
    "estimated_minutes": 27
  },
  "topics": [...]
}
```

### 3.4 最终验证与统计（Phase 4）

#### 3.4.1 数据验证清单

在最终输出前，必须验证以下内容：

1. **Flashcards 验证**
   ```typescript
   function validateFlashcards(course: APCourse): ValidationResult {
     for (const unit of course.units) {
       for (const topic of unit.topics) {
         if (topic.flashcards) {
           for (const card of topic.flashcards) {
             // 检查 requires_image 字段是否存在
             if (card.requires_image === undefined) {
               return { valid: false, error: `Missing requires_image in flashcard: ${card.front}` };
             }
           }
         }
       }
     }
     return { valid: true };
   }
   ```

2. **Quiz Questions 验证**
   ```typescript
   function validateQuizQuestions(course: APCourse): ValidationResult {
     for (const unit of course.units) {
       // 验证 Topic Quiz
       for (const topic of unit.topics) {
         if (topic.quiz) {
           for (const q of topic.quiz) {
             if (q.requires_image === undefined) {
               return { valid: false, error: `Missing requires_image in topic quiz: ${q.question}` };
             }
           }
         }
       }
       
       // 验证 Unit Test
       if (unit.unit_test?.questions) {
         for (const q of unit.unit_test.questions) {
           if (q.requires_image === undefined) {
             return { valid: false, error: `Missing requires_image in unit test: ${q.question}` };
           }
         }
       }
     }
     return { valid: true };
   }
   ```

#### 3.4.2 图像需求统计

```typescript
interface ImageStatistics {
  // Flashcards
  total_flashcards: number;
  flashcards_requiring_images: number;
  flashcards_image_percentage: number;
  
  // Topic Quiz
  total_topic_quiz_questions: number;
  topic_quiz_requiring_images: number;
  topic_quiz_image_percentage: number;
  
  // Unit Tests
  total_unit_test_questions: number;
  unit_test_requiring_images: number;
  unit_test_image_percentage: number;
  
  // 总计
  total_items: number;
  total_requiring_images: number;
  overall_image_percentage: number;
}

function calculateImageStatistics(course: APCourse): ImageStatistics {
  let totalFlashcards = 0;
  let flashcardsRequiringImages = 0;
  let totalTopicQuiz = 0;
  let topicQuizRequiringImages = 0;
  let totalUnitTest = 0;
  let unitTestRequiringImages = 0;

  for (const unit of course.units) {
    for (const topic of unit.topics) {
      // 统计 Flashcards
      if (topic.flashcards) {
        totalFlashcards += topic.flashcards.length;
        flashcardsRequiringImages += topic.flashcards.filter(c => c.requires_image).length;
      }
      
      // 统计 Topic Quiz
      if (topic.quiz) {
        totalTopicQuiz += topic.quiz.length;
        topicQuizRequiringImages += topic.quiz.filter(q => q.requires_image).length;
      }
    }
    
    // 统计 Unit Test
    if (unit.unit_test?.questions) {
      totalUnitTest += unit.unit_test.questions.length;
      unitTestRequiringImages += unit.unit_test.questions.filter(q => q.requires_image).length;
    }
  }

  const totalItems = totalFlashcards + totalTopicQuiz + totalUnitTest;
  const totalRequiringImages = flashcardsRequiringImages + topicQuizRequiringImages + unitTestRequiringImages;

  return {
    total_flashcards: totalFlashcards,
    flashcards_requiring_images: flashcardsRequiringImages,
    flashcards_image_percentage: totalFlashcards > 0 ? (flashcardsRequiringImages / totalFlashcards) * 100 : 0,
    
    total_topic_quiz_questions: totalTopicQuiz,
    topic_quiz_requiring_images: topicQuizRequiringImages,
    topic_quiz_image_percentage: totalTopicQuiz > 0 ? (topicQuizRequiringImages / totalTopicQuiz) * 100 : 0,
    
    total_unit_test_questions: totalUnitTest,
    unit_test_requiring_images: unitTestRequiringImages,
    unit_test_image_percentage: totalUnitTest > 0 ? (unitTestRequiringImages / totalUnitTest) * 100 : 0,
    
    total_items: totalItems,
    total_requiring_images: totalRequiringImages,
    overall_image_percentage: totalItems > 0 ? (totalRequiringImages / totalItems) * 100 : 0
  };
}
```

#### 3.4.3 最终输出结构

```json
{
  "course_name": "AP Biology",
  "units": [...],
  "metadata": {
    "extracted_at": "2025-10-07T15:15:52Z",
    "pdf_file_name": "ap-biology-ced.pdf",
    "pdf_page_count": 200,
    "version": "2024"
  },
  "image_statistics": {
    "total_flashcards": 300,
    "flashcards_requiring_images": 45,
    "flashcards_image_percentage": 15,
    "total_topic_quiz_questions": 500,
    "topic_quiz_requiring_images": 80,
    "topic_quiz_image_percentage": 16,
    "total_unit_test_questions": 160,
    "unit_test_requiring_images": 28,
    "unit_test_image_percentage": 17.5,
    "total_items": 960,
    "total_requiring_images": 153,
    "overall_image_percentage": 15.9
  }
}
```

## 4. 数据处理流程（4步骤）

### 4.1 处理流程概述

```
步骤1: 读取输入数据
  ├─ PDF 文件（用于展示对照）
  └─ JSON 文件（原始课程结构数据）

步骤2: 统计计算
  ├─ 课程级别统计
  ├─ 单元级别统计
  └─ 主题级别统计

步骤3: 数据合并
  └─ 原始数据 + 计算数据

步骤4: 输出结果
  └─ 完整 JSON（包含基础数据和计算数据）
```

### 3.2 API 路由规划

#### POST /api/process
处理课程数据（核心API）

**请求**：
```typescript
// Content-Type: multipart/form-data
{
  pdfFile: File;      // PDF文件（用于对照展示）
  jsonFile: File;     // JSON文件（原始课程数据）
}
```

**响应**：
```typescript
{
  success: boolean;
  data?: EnrichedAPCourse;  // 完整数据（原始+计算）
  error?: string;
  warnings?: string[];
  processingTime: number;
}
```

### 3.3 计算数据结构定义

```typescript
// src/types/enriched-course.ts

/**
 * 增强的课程数据（原始数据 + 计算数据）
 */
export interface EnrichedAPCourse extends APCourse {
  // 添加计算的统计数据
  statistics: CourseStatistics;
}

/**
 * 课程统计数据
 */
export interface CourseStatistics {
  // 课程级别统计
  total_units: number;
  total_topics: number;
  total_learning_objectives: number;
  total_essential_knowledge: number;
  
  // 单元统计详情
  unit_statistics: UnitStatistics[];
  
  // 知识点层级分布
  knowledge_hierarchy: KnowledgeHierarchy;
  
  // 考试权重分析
  exam_weight_distribution: ExamWeightDistribution[];
}

/**
 * 单元统计
 */
export interface UnitStatistics {
  unit_number: number;
  unit_title: string;
  topic_count: number;
  learning_objective_count: number;
  essential_knowledge_count: number;
  class_periods: number; // 从 "~8 Class Periods" 提取数字
  exam_weight_min: number; // 从 "4-6%" 提取最小值
  exam_weight_max: number; // 从 "4-6%" 提取最大值
  exam_weight_avg: number; // 平均值
}

/**
 * 知识点层级分布
 */
export interface KnowledgeHierarchy {
  // 按层级统计 KC 数量
  level_1: number; // 如 KC-1.1
  level_2: number; // 如 KC-1.1.I
  level_3: number; // 如 KC-1.1.I.A
  level_4: number; // 如 KC-1.1.I.A.i
  
  // 详细列表
  by_level: {
    level: number;
    count: number;
    examples: string[]; // 示例ID
  }[];
}

/**
 * 考试权重分布
 */
export interface ExamWeightDistribution {
  unit_number: number;
  weight_range: string; // 如 "4-6%"
  min_weight: number;
  max_weight: number;
  avg_weight: number;
  class_periods: number;
  efficiency: number; // 权重/课时比
}
```

### 3.4 API 实现示例

```typescript
// src/app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processAPCourseData } from '@/lib/data-processor';
import { APCourseSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdfFile') as File;
    const jsonFile = formData.get('jsonFile') as File;
    
    // 验证文件
    if (!pdfFile || !jsonFile) {
      return NextResponse.json(
        { success: false, error: 'PDF和JSON文件都是必需的' },
        { status: 400 }
      );
    }

    if (!pdfFile.name.endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'PDF文件格式不正确' },
        { status: 400 }
      );
    }

    if (!jsonFile.name.endsWith('.json')) {
      return NextResponse.json(
        { success: false, error: 'JSON文件格式不正确' },
        { status: 400 }
      );
    }

    // 读取JSON内容
    const jsonText = await jsonFile.text();
    const courseData = JSON.parse(jsonText);
    
    // 验证JSON数据结构
    const validation = APCourseSchema.safeParse(courseData);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'JSON数据结构验证失败',
        warnings: validation.error.issues.map(i => i.message),
      }, { status: 400 });
    }

    // 处理数据（步骤2-3：计算+合并）
    const startTime = Date.now();
    const enrichedData = await processAPCourseData(courseData);
    const processingTime = Date.now() - startTime;

    // 保存PDF文件用于后续展示
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfBytes);
    // 这里可以保存到临时目录或返回base64

    return NextResponse.json({
      success: true,
      data: enrichedData,
      processingTime,
      warnings: [],
    });
  } catch (error) {
    console.error('处理错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '数据处理失败' 
      },
      { status: 500 }
    );
  }
}
```

## 4. 组件设计

### 4.1 组件树结构

```
App
├── Layout
│   ├── Header
│   └── Footer
├── HomePage (/)
│   ├── UploadSection
│   │   ├── FileDropZone
│   │   └── UploadProgress
│   └── RecentFiles
└── ProcessorPage (/processor)
    ├── Sidebar
    │   ├── FileInfo
    │   └── ExportButtons
    ├── MainContent
    │   ├── TabNavigation
    │   ├── PreviewTab
    │   │   └── JSONViewer
    │   ├── CompareTab
    │   │   ├── PDFViewer (左)
    │   │   └── JSONTree (右)
    │   └── EditTab
    │       └── MonacoEditor
    └── StatusBar
```

### 4.2 核心组件规格

#### DualFileUpload 组件

```typescript
// src/components/DualFileUpload.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface DualFileUploadProps {
  onFilesSelect: (pdfFile: File, jsonFile: File) => void;
  maxSize?: number; // 字节
  disabled?: boolean;
}

export function DualFileUpload({ 
  onFilesSelect, 
  maxSize = 50 * 1024 * 1024,
  disabled = false 
}: DualFileUploadProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.pdf')) {
      setError('请选择 PDF 格式文件');
      return;
    }
    
    if (file.size > maxSize) {
      setError(`PDF 文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    setPdfFile(file);
    
    // 如果两个文件都已选择，触发回调
    if (jsonFile) {
      onFilesSelect(file, jsonFile);
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
      setError('请选择 JSON 格式文件');
      return;
    }
    
    if (file.size > maxSize) {
      setError(`JSON 文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    setJsonFile(file);
    
    // 如果两个文件都已选择，触发回调
    if (pdfFile) {
      onFilesSelect(pdfFile, file);
    }
  };

  return (
    <div className="space-y-4">
      {/* PDF 文件上传 */}
      <div className={`
        border-2 border-dashed rounded-lg p-8
        transition-colors
        ${pdfFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        <div className="flex flex-col items-center gap-4">
          {pdfFile ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {pdfFile ? `已选择: ${pdfFile.name}` : 'AP 课程 PDF 文件'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              用于对照展示（必需）
            </p>
          </div>
          <label className="btn-primary cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfChange}
              disabled={disabled}
              className="hidden"
            />
            {pdfFile ? '重新选择' : '选择 PDF'}
          </label>
        </div>
      </div>

      {/* JSON 文件上传 */}
      <div className={`
        border-2 border-dashed rounded-lg p-8
        transition-colors
        ${jsonFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        <div className="flex flex-col items-center gap-4">
          {jsonFile ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {jsonFile ? `已选择: ${jsonFile.name}` : '课程原始数据 JSON'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              已提取的课程结构数据（必需）
            </p>
          </div>
          <label className="btn-primary cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleJsonChange}
              disabled={disabled}
              className="hidden"
            />
            {jsonFile ? '重新选择' : '选择 JSON'}
          </label>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* 提示信息 */}
      {pdfFile && jsonFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 text-center">
            ✓ 两个文件都已准备好，开始处理...
          </p>
        </div>
      )}
    </div>
  );
}
```

#### JSONViewer 组件

```typescript
// src/components/JSONViewer.tsx
'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';
import type { APCourse } from '@/types/course';

interface JSONViewerProps {
  data: APCourse;
  onNodeClick?: (path: string) => void;
}

export function JSONViewer({ data, onNodeClick }: JSONViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(['root'])
  );

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">JSON 数据</h3>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Copy className="w-4 h-4" />
          复制
        </button>
      </div>
      
      <TreeNode
        data={data}
        path="root"
        expandedPaths={expandedPaths}
        onToggle={toggleExpand}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}

// TreeNode 递归组件实现...
```

#### PDFViewer 组件

```typescript
// src/components/PDFViewer.tsx
'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// PDF.js worker 配置
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

export function PDFViewer({ 
  fileUrl, 
  initialPage = 1,
  onPageChange 
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function changePage(offset: number) {
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      onPageChange?.(newPage);
    }
  }

  const changeZoom = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2.0, scale + delta));
    setScale(newScale);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 控制栏 */}
      <div className="flex items-center justify-between p-4 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm">
            第 {pageNumber} 页 / 共 {numPages} 页
          </span>
          
          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeZoom(-0.1)}
            className="p-2 rounded hover:bg-gray-200"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          
          <button
            onClick={() => changeZoom(0.1)}
            className="p-2 rounded hover:bg-gray-200"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex justify-center"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
```

## 5. 状态管理

### 5.1 Zustand Store 设计

```typescript
// src/store/useAppStore.ts
import { create } from 'zustand';
import type { APCourse, UploadState } from '@/types/course';

interface AppState {
  // 上传状态
  uploadState: UploadState;
  setUploadState: (state: Partial<UploadState>) => void;
  
  // 文件信息
  fileId: string | null;
  fileName: string | null;
  setFileInfo: (id: string, name: string) => void;
  
  // 课程数据
  courseData: APCourse | null;
  setCourseData: (data: APCourse | null) => void;
  
  // UI 状态
  activeTab: 'preview' | 'compare' | 'edit';
  setActiveTab: (tab: 'preview' | 'compare' | 'edit') => void;
  
  currentPage: number;
  setCurrentPage: (page: number) => void;
  
  // 操作方法
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  uploadState: {
    status: 'idle',
    progress: 0,
  },
  fileId: null,
  fileName: null,
  courseData: null,
  activeTab: 'preview',
  currentPage: 1,
  
  // 设置方法
  setUploadState: (state) =>
    set((prev) => ({
      uploadState: { ...prev.uploadState, ...state },
    })),
    
  setFileInfo: (id, name) =>
    set({ fileId: id, fileName: name }),
    
  setCourseData: (data) =>
    set({ courseData: data }),
    
  setActiveTab: (tab) =>
    set({ activeTab: tab }),
    
  setCurrentPage: (page) =>
    set({ currentPage: page }),
    
  reset: () =>
    set({
      uploadState: { status: 'idle', progress: 0 },
      fileId: null,
      fileName: null,
      courseData: null,
      activeTab: 'preview',
      currentPage: 1,
    }),
}));

// 使用示例
// const { courseData, setCourseData } = useAppStore();
// courseData.course_name, courseData.units[0].unit_title
```

## 6. 数据处理服务（核心逻辑）

### 6.1 数据处理主流程

```typescript
// src/lib/data-processor.ts
import type { APCourse, EnrichedAPCourse, CourseStatistics } from '@/types/course';

/**
 * 处理 AP 课程数据（步骤 2-3-4）
 * 步骤2: 统计计算
 * 步骤3: 数据合并
 * 步骤4: 返回完整数据
 */
export async function processAPCourseData(
  courseData: APCourse
): Promise<EnrichedAPCourse> {
  // 步骤2: 计算统计数据
  const statistics = calculateStatistics(courseData);
  
  // 步骤3: 合并数据
  const enrichedData: EnrichedAPCourse = {
    ...courseData,
    statistics,
  };
  
  // 步骤4: 返回完整数据
  return enrichedData;
}

/**
 * 步骤2: 计算课程统计数据
 */
function calculateStatistics(courseData: APCourse): CourseStatistics {
  // 课程级别统计
  const total_units = courseData.units.length;
  const total_topics = courseData.units.reduce(
    (sum, unit) => sum + unit.topics.length, 
    0
  );
  const total_learning_objectives = courseData.units.reduce(
    (sum, unit) => sum + unit.topics.reduce(
      (topicSum, topic) => topicSum + topic.learning_objectives.length,
      0
    ),
    0
  );
  const total_essential_knowledge = courseData.units.reduce(
    (sum, unit) => sum + unit.topics.reduce(
      (topicSum, topic) => topicSum + topic.essential_knowledge.length,
      0
    ),
    0
  );

  // 单元统计详情
  const unit_statistics = courseData.units.map(unit => 
    calculateUnitStatistics(unit)
  );

  // 知识点层级分布
  const knowledge_hierarchy = calculateKnowledgeHierarchy(courseData);

  // 考试权重分析
  const exam_weight_distribution = courseData.units.map(unit => 
    calculateExamWeight(unit)
  );

  return {
    total_units,
    total_topics,
    total_learning_objectives,
    total_essential_knowledge,
    unit_statistics,
    knowledge_hierarchy,
    exam_weight_distribution,
  };
}

/**
 * 计算单个单元的统计数据
 */
function calculateUnitStatistics(unit: APUnit): UnitStatistics {
  const topic_count = unit.topics.length;
  
  const learning_objective_count = unit.topics.reduce(
    (sum, topic) => sum + topic.learning_objectives.length,
    0
  );
  
  const essential_knowledge_count = unit.topics.reduce(
    (sum, topic) => sum + topic.essential_knowledge.length,
    0
  );

  // 从 "~8 Class Periods" 提取数字
  const class_periods = extractClassPeriods(unit.ced_class_periods);

  // 从 "4-6%" 提取权重范围
  const { min, max, avg } = extractExamWeight(unit.exam_weight);

  return {
    unit_number: unit.unit_number,
    unit_title: unit.unit_title,
    topic_count,
    learning_objective_count,
    essential_knowledge_count,
    class_periods,
    exam_weight_min: min,
    exam_weight_max: max,
    exam_weight_avg: avg,
  };
}

/**
 * 计算知识点层级分布
 */
function calculateKnowledgeHierarchy(
  courseData: APCourse
): KnowledgeHierarchy {
  const levelCounts = {
    level_1: 0,
    level_2: 0,
    level_3: 0,
    level_4: 0,
  };
  
  const levelExamples: Record<number, string[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  // 遍历所有 essential_knowledge
  courseData.units.forEach(unit => {
    unit.topics.forEach(topic => {
      topic.essential_knowledge.forEach(ek => {
        const level = getKnowledgeLevel(ek.id);
        
        if (level === 1) levelCounts.level_1++;
        else if (level === 2) levelCounts.level_2++;
        else if (level === 3) levelCounts.level_3++;
        else if (level === 4) levelCounts.level_4++;

        // 收集示例（最多3个）
        if (levelExamples[level].length < 3) {
          levelExamples[level].push(ek.id);
        }
      });
    });
  });

  return {
    ...levelCounts,
    by_level: [
      { level: 1, count: levelCounts.level_1, examples: levelExamples[1] },
      { level: 2, count: levelCounts.level_2, examples: levelExamples[2] },
      { level: 3, count: levelCounts.level_3, examples: levelExamples[3] },
      { level: 4, count: levelCounts.level_4, examples: levelExamples[4] },
    ],
  };
}

/**
 * 计算考试权重分布
 */
function calculateExamWeight(unit: APUnit): ExamWeightDistribution {
  const class_periods = extractClassPeriods(unit.ced_class_periods);
  const { min, max, avg } = extractExamWeight(unit.exam_weight);
  
  // 计算效率：权重/课时比
  const efficiency = class_periods > 0 ? avg / class_periods : 0;

  return {
    unit_number: unit.unit_number,
    weight_range: unit.exam_weight,
    min_weight: min,
    max_weight: max,
    avg_weight: avg,
    class_periods,
    efficiency: Number(efficiency.toFixed(4)),
  };
}

// ========== 辅助函数 ==========

/**
 * 从 "~8 Class Periods" 提取数字
 */
function extractClassPeriods(text: string): number {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 从 "4-6%" 提取权重
 */
function extractExamWeight(text: string): { min: number; max: number; avg: number } {
  const match = text.match(/(\d+)-(\d+)%/);
  if (!match) {
    return { min: 0, max: 0, avg: 0 };
  }
  
  const min = parseInt(match[1], 10);
  const max = parseInt(match[2], 10);
  const avg = (min + max) / 2;
  
  return { min, max, avg };
}

/**
 * 判断 KC 的层级
 * KC-1.1 -> 1
 * KC-1.1.I -> 2
 * KC-1.1.I.A -> 3
 * KC-1.1.I.A.i -> 4
 */
function getKnowledgeLevel(kcId: string): number {
  // 移除 "KC-" 前缀
  const parts = kcId.replace(/^KC-/, '').split('.');
  
  // 计算层级
  let level = 1; // 基础层级 (如 KC-1.1)
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // 检查是否包含罗马数字 (I, II, III, IV)
    if (/^[IVX]+$/i.test(part)) {
      level++;
    }
    // 检查是否包含大写字母 (A, B, C)
    else if (/^[A-Z]$/.test(part)) {
      level++;
    }
    // 检查是否包含小写字母或数字加小写字母 (i, ii, a, b)
    else if (/^[a-z]+$/i.test(part) && part.length <= 2) {
      level++;
    }
  }
  
  return Math.min(level, 4); // 最多4层
}
```

### 6.2 类型导入

```typescript
// src/types/course.ts 中需要导入的类型
import type {
  UnitStatistics,
  KnowledgeHierarchy,
  ExamWeightDistribution,
} from './enriched-course';
```

## 7. 路由设计

### 7.1 App Router 结构

```
src/app/
├── layout.tsx              # 根布局
├── page.tsx                # 首页（双文件上传）
├── processor/
│   ├── page.tsx            # 处理页面
│   └── loading.tsx         # 加载状态
├── api/
│   ├── process/
│   │   └── route.ts        # 数据处理 API（核心）
│   └── export/
│       └── route.ts        # 导出 JSON API
└── globals.css             # 全局样式
```

### 7.2 页面实现

```typescript
// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DualFileUpload } from '@/components/DualFileUpload';
import { Header } from '@/components/Header';
import { useAppStore } from '@/store/useAppStore';

export default function HomePage() {
  const router = useRouter();
  const { setUploadState, setCourseData } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelect = async (pdfFile: File, jsonFile: File) => {
    setIsProcessing(true);
    setUploadState({ status: 'uploading', progress: 0 });

    try {
      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('jsonFile', jsonFile);

      setUploadState({ status: 'processing', progress: 50 });

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setCourseData(result.data);
        setUploadState({ 
          status: 'success', 
          progress: 100,
          message: `处理完成（用时 ${result.processingTime}ms）`
        });
        
        // 跳转到处理页面
        router.push('/processor');
      } else {
        throw new Error(result.error || '处理失败');
      }
    } catch (error) {
      console.error('处理错误:', error);
      setUploadState({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              PrepGo AP 课程处理工具
            </h1>
            <p className="text-gray-600 text-lg">
              上传 PDF 和 JSON 文件，自动计算统计数据并生成完整的课程结构
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <DualFileUpload 
              onFilesSelect={handleFilesSelect}
              disabled={isProcessing}
            />

            {isProcessing && (
              <div className="mt-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${50}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    正在处理课程数据...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 功能说明 */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-2xl mb-3">📊</div>
              <h3 className="font-semibold mb-2">统计计算</h3>
              <p className="text-sm text-gray-600">
                自动计算单元、主题、学习目标和知识点的数量统计
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-2xl mb-3">🔍</div>
              <h3 className="font-semibold mb-2">层级分析</h3>
              <p className="text-sm text-gray-600">
                分析知识点的层级分布，提供详细的结构洞察
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <div className="text-2xl mb-3">⚖️</div>
              <h3 className="font-semibold mb-2">权重分析</h3>
              <p className="text-sm text-gray-600">
                计算考试权重分布和学习效率指标
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

## 8. 样式规范

### 8.1 Tailwind 配置

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
```

### 8.2 设计令牌

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer components {
  .btn-primary {
    @apply bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
}
```

## 9. 错误处理

### 9.1 错误边界

```typescript
// src/components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('错误边界捕获:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              出错了
            </h2>
            <p className="text-gray-600">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-primary"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 10. 性能优化

### 10.1 优化策略

1. **代码分割**
   - 使用 `dynamic` 动态导入大型组件
   - PDF 查看器按需加载

2. **图片优化**
   - 使用 Next.js `Image` 组件
   - 自动优化格式和大小

3. **缓存策略**
   - API 响应缓存
   - 客户端状态持久化

4. **虚拟滚动**
   - 大型 JSON 数据使用虚拟列表

### 10.2 实现示例

```typescript
// 动态导入
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div>加载编辑器...</div>,
});

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div>加载 PDF 查看器...</div>,
});
```

## 11. 测试策略

### 11.1 测试类型

- **单元测试**：工具函数、验证器
- **组件测试**：React 组件
- **集成测试**：API 路由
- **E2E 测试**：完整工作流

### 11.2 测试工具

- Jest + React Testing Library
- Playwright (E2E)
- MSW (API Mocking)

## 12. 部署配置

### 12.1 Vercel 配置

```json
// vercel.json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["hkg1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 12.2 环境变量

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE=52428800
UPLOAD_DIR=/tmp
```

## 13. 安全考虑

1. **文件上传安全**
   - 文件类型验证
   - 文件大小限制
   - 病毒扫描（可选）

2. **XSS 防护**
   - 内容转义
   - CSP 头部设置

3. **CORS 配置**
   - 限制允许的源

4. **速率限制**
   - API 调用频率限制

## 14. 监控与日志

```typescript
// src/lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta);
  },
};
```

## 15. 文档要求

- README.md：项目说明、安装、使用
- API.md：API 接口文档
- CONTRIBUTING.md：贡献指南
- 代码注释：JSDoc 格式
