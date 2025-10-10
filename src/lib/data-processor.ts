/**
 * AP 课程数据处理服务
 * 负责计算统计数据并合并到原始数据中
 */

import type { APCourse, APUnit } from '@/types/course';
import type {
  EnrichedAPCourse,
  CourseStatistics,
  UnitStatistics,
  KnowledgeHierarchy,
  ExamWeightDistribution,
} from '@/types/enriched-course';

/**
 * 处理 AP 课程数据（步骤 2-3-4）
 * 步骤2: 统计计算
 * 步骤3: 数据合并 + 初始化学习内容结构
 * 步骤4: 返回完整数据
 */
export async function processAPCourseData(
  courseData: APCourse
): Promise<EnrichedAPCourse> {
  // 步骤2: 计算统计数据
  const statistics = calculateStatistics(courseData);

  // 步骤3: 为每个单元初始化学习内容结构
  const enrichedUnits = courseData.units.map(unit => ({
    ...unit,
    learning_content: {
      generation_status: {
        study_guide: 'pending' as const,
        flashcards: 'pending' as const,
        quiz: 'pending' as const,
      }
    }
  }));

  // 步骤3: 合并数据
  const enrichedData: EnrichedAPCourse = {
    ...courseData,
    units: enrichedUnits,
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

