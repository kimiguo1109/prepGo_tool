import { z } from 'zod';

/**
 * 学习目标验证模式
 */
export const LearningObjectiveSchema = z.object({
  id: z.string().min(1), // 格式: "Unit 1: Learning Objective A"
  summary: z.string().min(10),
});

/**
 * 基本知识验证模式
 */
export const EssentialKnowledgeSchema = z.object({
  id: z.string().min(1), // 格式: "KC-1.1" 或 "KC-1.1.I.A"
  summary: z.string().min(10),
});

/**
 * 主题验证模式
 */
export const APTopicSchema = z.object({
  topic_number: z.string().regex(/^\d+\.\d+$/), // 格式: "1.1"
  topic_title: z.string().min(3),
  learning_objectives: z.array(LearningObjectiveSchema),
  essential_knowledge: z.array(EssentialKnowledgeSchema),
});

/**
 * 单元验证模式
 */
export const APUnitSchema = z.object({
  unit_number: z.number().int().positive(),
  unit_title: z.string().min(3),
  // 支持多种格式: 
  // - "~8 Class Periods" 
  // - "~14-17 Class Periods"
  // - "~10–11 CLASS PERIODS" (长破折号，大写)
  // - "~13–14 AB~9–10 BC" (AB/BC 标注)
  // - "~22–23 AB~13–14 BC"
  // - "~8–9 CLASS PERIODS (BC)"
  ced_class_periods: z.string().regex(/^~\d+[–\-]?\d*\s*(Class\s+Periods|CLASS\s+PERIODS)(\s*\(?(AB|BC)\)?)?(\s*~\d+[–\-]\d+\s*(AB|BC))?$|^~\d+[–\-]\d+\s+(AB)?~?\d+[–\-]\d+\s+(BC)?$/i),
  // 支持多种格式:
  // - "4-6%" 或 "10-17%" 或 "8-11%"
  // - "10-12% AB / 4-7% BC" (分AB/BC，带斜杠)
  // - "10–12% AB 4–7% BC" (无斜杠)
  // - "10–12%" (长破折号)
  exam_weight: z.string().regex(/^\d+[–\-]\d+%(\s+(AB\s*\/?\s*)?[\d–\-]+%\s*(BC)?)?$/i),
  topics: z.array(APTopicSchema),
  start_page: z.number().int().positive().optional(), // PDF 起始页码
});

/**
 * 课程元数据验证模式
 */
export const CourseMetadataSchema = z.object({
  extracted_at: z.string(),
  pdf_file_name: z.string(),
  pdf_page_count: z.number(),
  version: z.string(),
});

/**
 * 课程验证模式
 */
export const APCourseSchema = z.object({
  course_name: z.string().min(3),
  units: z.array(APUnitSchema),
  metadata: CourseMetadataSchema.optional(),
});

/**
 * 验证 AP 课程数据
 */
export function validateAPCourse(data: unknown) {
  return APCourseSchema.safeParse(data);
}

/**
 * 验证上传文件
 */
export const FileUploadSchema = z.object({
  name: z.string().regex(/\.pdf$/i, '必须是 PDF 文件'),
  size: z.number().max(50 * 1024 * 1024, '文件大小不能超过 50MB'),
  type: z.string().regex(/^application\/pdf$/),
});
