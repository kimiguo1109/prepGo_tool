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
