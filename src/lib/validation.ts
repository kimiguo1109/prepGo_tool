/**
 * PDF 和 JSON 一致性验证服务
 * 确保上传的 PDF 和 JSON 对应同一个课程
 */

import type { APCourse } from '@/types/course';
import pdfParse from 'pdf-parse';

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  courseName?: string;
  pdfCourseName?: string;
  jsonCourseName?: string;
  errors: string[];
  warnings: string[];
  matchScore: number; // 0-100，匹配度评分
}

/**
 * 验证 PDF 和 JSON 的一致性
 * @param pdfBuffer - PDF 文件的 Buffer
 * @param courseData - JSON 课程数据
 */
export async function validatePdfJsonConsistency(
  pdfBuffer: Buffer,
  courseData: APCourse
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let matchScore = 0;

  try {
    // 1. 提取 PDF 文本内容
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    const pdfNumPages = pdfData.numpages;

    console.log(`📄 PDF 页数: ${pdfNumPages}, 文本长度: ${pdfText.length}`);

    // 2. 提取 JSON 中的课程名称
    const jsonCourseName = courseData.course_name;
    
    // 3. 从 PDF 中提取课程名称
    const pdfCourseName = extractCourseNameFromPDF(pdfText);

    // 4. 课程名称匹配
    const courseNameMatch = compareCourseNames(pdfCourseName, jsonCourseName);
    if (courseNameMatch.isMatch) {
      matchScore += 40;
    } else {
      errors.push(
        `课程名称不匹配：PDF显示"${pdfCourseName}"，JSON显示"${jsonCourseName}"`
      );
    }

    // 5. 验证单元数量和标题
    const unitsValidation = validateUnits(pdfText, courseData.units);
    matchScore += unitsValidation.score;
    errors.push(...unitsValidation.errors);
    warnings.push(...unitsValidation.warnings);

    // 6. 验证主题数量（抽样检查）
    const topicsValidation = validateTopicsSample(pdfText, courseData.units);
    matchScore += topicsValidation.score;
    warnings.push(...topicsValidation.warnings);

    // 7. 最终判断
    // 降低阈值到 50 分，允许有一些差异但仍然可以处理
    const isValid = errors.length === 0 && matchScore >= 50;

    console.log(`📊 验证结果: ${isValid ? '✅ 通过' : '❌ 失败'} (分数: ${matchScore}/100)`);

    return {
      isValid,
      courseName: jsonCourseName,
      pdfCourseName,
      jsonCourseName,
      errors,
      warnings,
      matchScore,
    };
  } catch (error) {
    console.error('验证过程出错:', error);
    errors.push(`验证过程出错: ${error instanceof Error ? error.message : '未知错误'}`);
    
    return {
      isValid: false,
      errors,
      warnings,
      matchScore: 0,
    };
  }
}

/**
 * 从 PDF 文本中提取课程名称
 */
function extractCourseNameFromPDF(pdfText: string): string {
  // 常见的 AP 课程名称模式
  const patterns = [
    /AP\s+([A-Z][A-Za-z\s&]+)\s+Course\s+and\s+Exam\s+Description/i,
    /Course\s+and\s+Exam\s+Description\s+AP\s+([A-Z][A-Za-z\s&]+)/i,
    /AP\s+([A-Z][A-Za-z\s&]+)\s+CED/i,
    /AP®?\s+([A-Z][A-Za-z\s&]+)\s+Course/i,
  ];

  for (const pattern of patterns) {
    const match = pdfText.match(pattern);
    if (match && match[1]) {
      const courseName = match[1].trim().replace(/\s+/g, ' ');
      console.log(`🔍 从 PDF 提取课程名: AP ${courseName}`);
      return `AP ${courseName}`;
    }
  }

  // 如果没有匹配到，尝试查找第一页的标题
  const firstPageText = pdfText.substring(0, 3000);
  const lines = firstPageText.split(/[\n\r]+/).filter(line => line.trim().length > 5);
  
  const courseKeywords = ['Biology', 'History', 'Psychology', 'Statistics', 'Chemistry', 'Physics', 'Calculus'];
  
  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.includes('AP')) {
      for (const keyword of courseKeywords) {
        if (cleanLine.toLowerCase().includes(keyword.toLowerCase())) {
          console.log(`🔍 从标题行提取课程名: ${cleanLine}`);
          return cleanLine.replace(/\s+/g, ' ').substring(0, 50);
        }
      }
    }
  }

  console.warn('⚠️ 未能从 PDF 提取课程名称');
  return 'Unknown Course';
}

/**
 * 比较两个课程名称
 */
function compareCourseNames(
  pdfName: string,
  jsonName: string
): { isMatch: boolean; similarity: number } {
  // 标准化名称（去除多余空格、统一大小写）
  const normalize = (name: string) => 
    name.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

  const normalizedPdf = normalize(pdfName);
  const normalizedJson = normalize(jsonName);

  // 完全匹配
  if (normalizedPdf === normalizedJson) {
    return { isMatch: true, similarity: 100 };
  }

  // 包含匹配
  if (normalizedPdf.includes(normalizedJson) || normalizedJson.includes(normalizedPdf)) {
    return { isMatch: true, similarity: 85 };
  }

  // 关键词匹配（提取主要课程名称）
  const extractKeyword = (name: string) => {
    const keywords = name.match(/\b(history|biology|psychology|statistics|calculus|chemistry|physics)\b/i);
    return keywords ? keywords[0].toLowerCase() : '';
  };

  const pdfKeyword = extractKeyword(normalizedPdf);
  const jsonKeyword = extractKeyword(normalizedJson);

  if (pdfKeyword && jsonKeyword && pdfKeyword === jsonKeyword) {
    return { isMatch: true, similarity: 70 };
  }

  return { isMatch: false, similarity: 0 };
}

/**
 * 验证单元信息
 */
function validateUnits(
  pdfText: string,
  units: APCourse['units']
): { score: number; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  const maxScore = 40;

  const jsonUnitCount = units.length;
  
  // 1. 检查 PDF 中的单元数量
  const unitPatterns = [
    /Unit\s+(\d+)/gi,
    /Period\s+(\d+)/gi,
  ];

  const foundUnits = new Set<number>();
  for (const pattern of unitPatterns) {
    const matches = pdfText.matchAll(pattern);
    for (const match of matches) {
      const unitNum = parseInt(match[1], 10);
      if (unitNum >= 1 && unitNum <= 20) {
        foundUnits.add(unitNum);
      }
    }
  }

  const pdfUnitCount = foundUnits.size;

  if (pdfUnitCount === jsonUnitCount) {
    score += 20;
  } else if (Math.abs(pdfUnitCount - jsonUnitCount) <= 1) {
    score += 15;
    warnings.push(
      `单元数量略有差异：PDF 中找到 ${pdfUnitCount} 个单元，JSON 中有 ${jsonUnitCount} 个单元`
    );
  } else {
    errors.push(
      `单元数量明显不匹配：PDF 中找到 ${pdfUnitCount} 个单元，JSON 中有 ${jsonUnitCount} 个单元`
    );
  }

  // 2. 验证单元标题（抽样检查前3个单元）
  const sampleUnits = units.slice(0, Math.min(3, units.length));
  let titleMatchCount = 0;

  for (const unit of sampleUnits) {
    // 清理标题，移除特殊字符和多余空格
    const cleanTitle = unit.unit_title
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    // 清理 PDF 文本
    const cleanPdfText = pdfText
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    // 尝试多种匹配方式
    const matches = [
      // 完整标题匹配
      cleanPdfText.includes(cleanTitle),
      // 标题的关键词匹配（取前3个词）
      cleanTitle.split(' ').slice(0, 3).every(word => 
        word.length > 2 && cleanPdfText.includes(word)
      ),
      // Unit X: Title 格式匹配
      cleanPdfText.includes(`unit ${unit.unit_number}`) && 
      cleanTitle.split(' ').some(word => 
        word.length > 3 && cleanPdfText.includes(word)
      ),
    ];
    
    if (matches.some(m => m)) {
      titleMatchCount++;
      console.log(`✅ 单元 ${unit.unit_number} "${unit.unit_title}" 匹配成功`);
    } else {
      console.log(`⚠️ 单元 ${unit.unit_number} "${unit.unit_title}" 未匹配`);
    }
  }

  const titleMatchRate = titleMatchCount / sampleUnits.length;
  if (titleMatchRate >= 0.67) {
    // 至少2/3匹配
    score += 20;
  } else if (titleMatchRate >= 0.34) {
    // 至少1/3匹配
    score += 10;
    warnings.push(`部分单元标题在 PDF 中未找到（${titleMatchCount}/${sampleUnits.length}）`);
  } else {
    // 少于1/3匹配
    warnings.push(`大部分单元标题在 PDF 中未找到（${titleMatchCount}/${sampleUnits.length}），建议检查文件`);
  }

  return {
    score: Math.min(score, maxScore),
    errors,
    warnings,
  };
}

/**
 * 验证主题（抽样检查）
 */
function validateTopicsSample(
  pdfText: string,
  units: APCourse['units']
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;
  const maxScore = 20;

  // 抽样检查：验证第一个单元的前3个主题
  if (units.length === 0 || units[0].topics.length === 0) {
    warnings.push('无法验证主题：JSON 数据中没有主题信息');
    return { score: 0, warnings };
  }

  const firstUnit = units[0];
  const sampleTopics = firstUnit.topics.slice(0, Math.min(3, firstUnit.topics.length));
  let topicMatchCount = 0;

  for (const topic of sampleTopics) {
    // 检查主题编号
    const topicPattern = new RegExp(`Topic\\s+${topic.topic_number.replace('.', '\\.')}`, 'i');
    if (topicPattern.test(pdfText)) {
      topicMatchCount++;
    }
  }

  const matchRate = topicMatchCount / sampleTopics.length;
  if (matchRate >= 0.8) {
    score = maxScore;
  } else if (matchRate >= 0.5) {
    score = maxScore / 2;
    warnings.push(`部分主题在 PDF 中未找到（${topicMatchCount}/${sampleTopics.length}）`);
  } else {
    warnings.push(`大部分主题在 PDF 中未找到（${topicMatchCount}/${sampleTopics.length}），建议检查数据来源`);
  }

  return { score, warnings };
}

