/**
 * 学习内容类型定义
 */

/**
 * Flashcard（闪卡）
 */
export interface Flashcard {
  id: string;
  front: string;  // 正面问题
  back: string;   // 背面答案
  unit: number;   // 所属单元
  topic: string;  // 所属主题
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Quiz 问题
 */
export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];  // 选择题选项
  correctAnswer: string | string[];
  explanation: string;
  unit: number;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

/**
 * Quiz（测验）
 */
export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  totalPoints: number;
  estimatedTime: number; // 分钟
}

/**
 * Study Guide（学习指南）
 */
export interface StudyGuide {
  courseId: string;
  courseName: string;
  units: StudyGuideUnit[];
  overview: string;
  keyTerms: KeyTerm[];
  studyTips: string[];
}

/**
 * 学习指南单元
 */
export interface StudyGuideUnit {
  unitNumber: number;
  unitTitle: string;
  summary: string;
  keyPoints: string[];
  learningObjectives: string[];
  importantConcepts: string[];
  examTips: string[];
}

/**
 * 关键术语
 */
export interface KeyTerm {
  term: string;
  definition: string;
  unit: number;
}

/**
 * 生成进度
 */
export interface GenerationProgress {
  type: 'studyguide' | 'flashcards' | 'quiz';
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

