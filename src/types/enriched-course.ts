/**
 * 增强的课程数据类型定义
 * 包含原始数据、计算统计数据、AI生成的学习内容
 */

import type { APCourse, APUnit } from './course';

/**
 * 增强的课程数据（原始数据 + 计算数据 + AI生成内容）
 */
export interface EnrichedAPCourse extends Omit<APCourse, 'units'> {
  // 添加计算的统计数据
  statistics: CourseStatistics;
  // 单元数组会被增强，包含学习内容
  units: EnrichedAPUnit[];
}

/**
 * 增强的单元数据（包含AI生成的学习内容）
 */
export interface EnrichedAPUnit extends APUnit {
  learning_content?: UnitLearningContent;
}

/**
 * 单元学习内容（AI生成）
 */
export interface UnitLearningContent {
  study_guide?: StudyGuideUnit;
  flashcards?: Flashcard[];
  quiz?: Quiz;
  generation_status: {
    study_guide: 'pending' | 'generating' | 'completed' | 'error';
    flashcards: 'pending' | 'generating' | 'completed' | 'error';
    quiz: 'pending' | 'generating' | 'completed' | 'error';
  };
}

/**
 * 学习指南（单元级别）
 */
export interface StudyGuideUnit {
  unitNumber: number;
  unitTitle: string;
  summary: string;
  keyPoints: string[];
  examTips: string[];
}

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
