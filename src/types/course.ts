/**
 * 课程完整数据结构
 * 遵循 College Board CED 文档和 Gemini 提取的实际格式
 */
export interface APCourse {
  course_name: string;
  units: APUnit[];
  metadata?: CourseMetadata;
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
  start_page?: number; // PDF 中的起始页码
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
  study_guide?: string;
  flashcards?: Array<{
    front: string;
    back: string;
  }>;
  quiz?: Array<{
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  }>;
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
}

/**
 * Topic Flashcard（Phase 2 生成）
 */
export interface TopicFlashcard {
  card_id: string;
  topic_id: string;
  front_content: string;
  back_content: string;
  requires_image: boolean;
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
  requires_image: boolean;
}

/**
 * Unit Test（Phase 3 生成）
 */
export interface UnitTest {
  test_id: string;
  unit_id: string;
  test_title: string;
  total_questions: number;
  estimated_minutes: number;
}

/**
 * Unit Assessment Question（Phase 3 生成）
 */
export interface UnitAssessmentQuestion {
  question_id: string;
  test_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  requires_image: boolean;
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
 * Combined Complete JSON - 完整课程包（Phase 1 + 2 + 3）
 */
export interface CombinedCompleteJSON {
  courses: Course[];
  units: Unit[];
  topics: Topic[];
  study_guides: StudyGuide[];
  topic_flashcards: TopicFlashcard[];
  quizzes: Quiz[];
  unit_tests: UnitTest[];
  unit_assessment_questions: UnitAssessmentQuestion[];
}

/**
 * 双 JSON 输出结果（v11.0 最终输出）
 */
export interface DualJSONOutput {
  separated_content_json: SeparatedContentJSON;
  combined_complete_json: CombinedCompleteJSON;
}
