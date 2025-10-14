/**
 * 课程完整数据结构
 * 遵循 College Board CED 文档和 Gemini 提取的实际格式
 */
export interface APCourse {
  course_name: string;
  units: APUnit[];
  metadata?: CourseMetadata;
  mock_exam?: {  // v12.8.6: 课程级别的模拟考试
    title: string;
    description: string;
    recommended_minutes: number;
    total_questions: number;
    version: string;
    status: string;
    official_year: string;
    mock_questions: Array<{
      question_number: number;
      question_type: 'mcq' | 'saq' | 'frq';
      difficulty_level: number;
      ap_alignment: string;
      version: string;
      status: string;
      official_year: string;
      source: string;
      
      // MCQ fields
      question_text?: string;
      options?: {
        A: string;
        B: string;
        C: string;
        D: string;
      };
      correct_answer?: string;
      explanation?: string;
      
      // SAQ/FRQ fields
      stimulus_type?: string;
      stimulus?: string;
      rubric?: string;
    }>;
  };
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
  unit_overview?: {  // v12.8: 添加unit_overview嵌套结构（对应Gemini step 1格式）
    summary: string;  // 单元概述，需要AI生成或从input提取
    ced_class_periods: string;  // 如"8 Class Periods"
    exam_weight: string;  // 如"4-6%"
    prepgo_estimated_minutes: number;  // PrepGo估计学习时长
  };
  // v12.8: 保留平铺字段以向后兼容，但推荐使用unit_overview
  ced_class_periods?: string;
  exam_weight?: string;
  topics: APTopic[];
  start_page?: number; // PDF 中的起始页码
  unit_test?: {  // v12.8.3: combined_complete_json中不包含自动生成的ID
    title: string;
    description: string;
    recommended_minutes: number;
    total_questions: number;
    version: string;
    status: string;
  };
  test_questions?: Array<{  // v12.8.3: 单元测试题目数组（不包含自动生成的ID）
    question_number: number;
    question_type: 'mcq' | 'saq' | 'frq';
    difficulty_level: number;
    ap_alignment: string;
    source: string;
    
    // MCQ fields
    question_text?: string;
    options?: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correct_answer?: string;
    explanation?: string;
    
    // SAQ/FRQ fields
    stimulus_type?: string;
    stimulus?: string;
    rubric?: string;
    parts?: Array<{
      part_letter: string;
      prompt: string;
      max_points: number;
    }>;
    
    // Common
    image_suggested?: boolean;
  }>;
}

/**
 * 主题数据
 */
export interface APTopic {
  topic_number: string; // 格式: "1.1"
  topic_title: string;
  learning_objectives: LearningObjective[];
  essential_knowledge: EssentialKnowledge[];
  // 学习内容（AI生成）
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
  study_guide?: {
    content_markdown: string;
    word_count: number;
    reading_minutes: number;
    version: string;
    status: string;
  } | null;  // v12.8.3: 改为对象格式，包含元数据; v12.8.8: 移除 ID 字段
  flashcards?: Array<{
    card_type: 'definition' | 'concept' | 'application' | 'person_event';  // v12.8.4: 更新类型名称
    front_content: string;  // v12.8.4: front → front_content
    back_content: string;  // v12.8.4: back → back_content
    difficulty: number;  // v12.8: 难度等级1-10
    image_suggested: boolean;  // v12.8.3: 是否建议配图（移除requires_image，统一使用此字段）
    image_suggestion_description: string | null;  // v12.8: 配图建议描述
    version: string;  // v12.8: 版本号
    status: string;  // v12.8: 状态（draft/published）
  }>;  // v12.8.8: 移除 card_id 和 topic_id
  quiz?: Array<{
    difficulty_level: number;  // v12.8: 难度等级1-10
    question_text: string;  // v12.8.4: question → question_text
    options: { A: string; B: string; C: string; D: string };  // v12.8.4: 改为对象格式
    correct_answer: string;
    explanation: string;
    image_suggested: boolean;  // v12.8.3: 是否建议配图（移除requires_image，统一使用此字段）
    image_suggestion_description: string | null;  // v12.8: 配图建议描述
    version: string;  // v12.8: 版本号
    status: string;  // v12.8: 状态（draft/published）
  }>;  // v12.8.8: 移除 quiz_id 和 topic_id
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

// ============================================================================
// v11.0 双 JSON 输出格式接口定义
// ============================================================================

/**
 * Topic Overview（Phase 2 生成）
 */
export interface TopicOverview {
  topic_id: string;
  overview_text: string;
}

/**
 * Study Guide（Phase 2 生成）
 */
export interface StudyGuide {
  study_guide_id: string;
  topic_id: string;
  content_markdown: string;
  word_count?: number;  // v12.8: 字数统计
  reading_minutes?: number;  // v12.8: 预计阅读时间（分钟）
  version?: string;  // v12.8: 版本号
  status?: string;  // v12.8: 状态（draft/published）
}

/**
 * Topic Flashcard（Phase 2 生成）
 */
export interface TopicFlashcard {
  card_id: string;
  topic_id: string;
  card_type: 'definition' | 'concept' | 'application' | 'person_event';  // v12.8.4: 更新类型名称
  front_content: string;
  back_content: string;
  difficulty?: number;  // v12.8: 难度等级1-10
  image_suggested?: boolean;  // v12.8: 是否建议配图
  image_suggestion_description?: string | null;  // v12.8: 配图建议描述
  version?: string;  // v12.8: 版本号
  status?: string;  // v12.8: 状态（draft/published）
}

/**
 * Quiz Question（Phase 2 生成）
 */
export interface Quiz {
  quiz_id: string;
  topic_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  difficulty_level?: number;  // v12.8: 难度等级1-10
  image_suggested?: boolean;  // v12.8: 是否建议配图
  image_suggestion_description?: string | null;  // v12.8: 配图建议描述
  version?: string;  // v12.8: 版本号
  status?: string;  // v12.8: 状态（draft/published）
}

/**
 * Unit Test（Phase 3 生成）
 */
export interface UnitTest {
  test_id: string;
  unit_id: string;
  course_id: string;  // v12.8: 添加课程ID
  title: string;  // v12.8: 使用title替代test_title
  description: string;  // v12.8: 添加测试描述
  recommended_minutes: number;  // v12.8: 使用recommended_minutes替代estimated_minutes
  total_questions: number;
  version: string;  // v12.8: 版本号
  status: string;  // v12.8: 状态（draft/published/active）
}

/**
 * FRQ Part（自由回答题部分）
 */
export interface FRQPart {
  part_label: string;  // "a", "b", "c", etc.
  part_question: string;
  points: number;
  expected_answer: string;
}

/**
 * Unit Assessment Question（Phase 3 生成）
 * 支持 MCQ、SAQ 和 FRQ 三种题型
 */
export interface UnitAssessmentQuestion {
  question_id: string;
  test_id: string;
  question_number: number;  // v12.8: 题号
  question_type: 'mcq' | 'saq' | 'frq';  // v12.8: 小写格式，添加SAQ
  difficulty_level: number;  // v12.8: 难度等级（1-10）
  ap_alignment: string;  // v12.8: AP考点对应（如"1.2"或"1.2, 1.4"）
  source: string;  // v12.8: 题目来源
  
  // 材料题相关字段
  stimulus_type?: 'text' | 'image' | 'chart' | 'map';  // v12.8: 材料类型
  stimulus?: string;  // v12.8: 材料内容
  
  question_text: string;
  
  // MCQ fields (仅用于MCQ)
  options?: {  // v12.8: 改为对象格式
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer?: string;
  explanation?: string;  // v12.8: MCQ的解释
  
  // SAQ/FRQ fields
  rubric?: string;  // v12.8: SAQ和FRQ的评分标准
  parts?: FRQPart[];  // FRQ的多部分
  
  // Common fields
  image_suggested?: boolean;  // v12.8.3: 是否建议配图（移除requires_image，统一使用此字段）
}

/**
 * Course（Phase 1 规划 - 用于 combined_complete_json）
 */
export interface Course {
  course_id: string;
  course_name: string;
  course_code?: string;
  difficulty_level: number;
  class_to_app_factor: number;
  estimated_minutes: number;
  ced_period?: string;
}

/**
 * Unit（Phase 1 规划 - 用于 combined_complete_json）
 */
export interface Unit {
  unit_id: string;
  course_id: string;
  unit_number: number;
  unit_title: string;
  estimated_minutes: number;
  ced_period: string;
  exam_weight: string;
}

/**
 * Topic（Phase 1 规划 - 用于 combined_complete_json）
 */
export interface Topic {
  topic_id: string;
  unit_id: string;
  topic_number: string;
  ced_topic_title: string;
  topic_overview: string;
  estimated_minutes: number;
  learn_minutes: number;
  review_minutes: number;
  practice_minutes: number;
  target_sg_words: number;
  target_flashcards: number;
  target_mcq: number;
}

/**
 * Separated Content JSON - 仅包含新生成的内容（Phase 2 & 3）
 */
export interface SeparatedContentJSON {
  topic_overviews: TopicOverview[];
  study_guides: StudyGuide[];
  topic_flashcards: TopicFlashcard[];
  quizzes: Quiz[];
  unit_tests: UnitTest[];
  unit_assessment_questions: UnitAssessmentQuestion[];
}

/**
 * 双 JSON 输出结果（v11.0 最终输出）
 * - separated_content_json: 扁平化的新内容（用于数据库导入）
 * - combined_complete_json: 嵌套的完整课程结构（保持原始 APCourse 格式）
 */
export interface DualJSONOutput {
  separated_content_json: SeparatedContentJSON;
  combined_complete_json: APCourse;
}
