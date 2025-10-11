import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { 
  APCourse,
  DualJSONOutput,
  TopicOverview,
  StudyGuide,
  TopicFlashcard,
  Quiz,
  UnitTest,
  UnitAssessmentQuestion
} from '@/types/course';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';

// 创建代理 agent（仅在本地开发且配置了代理时使用）
const IS_VERCEL = process.env.VERCEL === '1';
const httpsAgent = !IS_VERCEL && PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

/**
 * PrepGo 课程生成器 - 完整的工作流
 * 使用 Google Gemini 2.5 Flash Lite 进行内容生成
 * 
 * 工作流程：
 * 1. 学习时长计算
 * 2. 模块时长与任务分配（Learn/Review/Practice）
 * 3. 生成具体内容（Study Guide/Flashcards/Quiz）
 * 4. 课程完整输出
 */
export class CourseGenerator {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = GEMINI_API_KEY;
    this.model = GEMINI_MODEL;
  }

  /**
   * 步骤 1：计算学习时长
   * 规则：
   * - 课程总时长 = (平均 CED Class Period 数 × 45 分钟) × Factor (0.45-0.55)
   * - Unit 时长 = 70% 按 period 分配 + 30% 按 exam weight 分配
   * - Topic 时长 = 按 LO 数量 (每个 3 分) + EK 数量 (每个 2 分) 比例分配
   */
  async calculateDurations(courseData: APCourse, onProgress?: (message: string, percent?: number) => void): Promise<APCourse> {
    console.log('⏱️  步骤 1/3: 计算学习时长...');
    onProgress?.('计算学习时长...', 10);

    // 直接计算，不调用 AI（避免 JSON 过大问题）
    const enhancedData = JSON.parse(JSON.stringify(courseData)) as APCourse;
    let totalPeriods = 0;

    // 遍历所有 Units 计算时长
    for (const unit of enhancedData.units) {
      let unitTotalMinutes = 0;

      // 计算该 Unit 的 periods（处理多种格式）
      const periodsStr = unit.ced_class_periods;
      let unitPeriods = 0;
      
      // 处理多种格式：
      // - "~8 Class Periods" -> 8
      // - "~10-12 Class Periods" -> 11 (平均值)
      // - "~10–11 CLASS PERIODS" -> 10.5 (长破折号)
      // - "~13–14 AB~9–10 BC" -> 取第一个范围 11.5
      
      // 尝试匹配范围格式（支持短横线和长破折号）
      const rangeMatch = periodsStr.match(/~?(\d+)[–\-](\d+)/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        unitPeriods = (min + max) / 2;
      } else {
        // 单个数字格式
        const singleMatch = periodsStr.match(/~?(\d+)/);
        if (singleMatch) {
          unitPeriods = parseInt(singleMatch[1]);
        }
      }

      totalPeriods += unitPeriods;

      // 计算每个 Topic 的时长
      for (const topic of unit.topics) {
        const loCount = topic.learning_objectives?.length || 0;
        const ekCount = topic.essential_knowledge?.length || 0;
        
        // Topic 时长 = LO × 3 + EK × 2（至少5分钟）
        const topicMinutes = Math.max(5, loCount * 3 + ekCount * 2);
        (topic as any).topic_estimated_minutes = topicMinutes;
        
        unitTotalMinutes += topicMinutes;
      }

      // Unit 时长 = 所有 Topics 时长之和
      (unit as any).unit_estimated_minutes = unitTotalMinutes;
    }

    // 课程总时长 = (总 periods × 45) × Factor 0.5
    const factor = 0.5;  // 在 0.45-0.55 范围内
    const courseTotalMinutes = Math.round(totalPeriods * 45 * factor);
    (enhancedData as any).course_estimated_minutes = courseTotalMinutes;

    console.log('✅ 时长计算完成');
    console.log(`   📊 总 Class Periods: ${totalPeriods}`);
    console.log(`   📈 Factor: ${factor}`);
    console.log(`   ⏱️  课程总时长: ${courseTotalMinutes} 分钟`);
    console.log(`   📝 Units 时长总和: ${enhancedData.units.reduce((sum, u) => (sum + (u as any).unit_estimated_minutes), 0)} 分钟`);

    onProgress?.('✅ 学习时长计算完成', 25);
    return enhancedData;
  }

  /**
   * 步骤 2：分配模块时长与任务
   * 使用"内容驱动时间"模型：根据 LO/EK 数量计算内容量，再反推时间
   */
  async assignModuleTasks(courseData: APCourse, onProgress?: (message: string, percent?: number) => void): Promise<APCourse> {
    console.log('📦 步骤 2/3: 分配模块时长与任务（内容驱动模型）...');
    onProgress?.('分配模块任务（内容驱动模型）...', 30);

    const enhancedData = JSON.parse(JSON.stringify(courseData)) as APCourse;

    // 遍历所有 Units 和 Topics
    for (const unit of enhancedData.units) {
      for (const topic of unit.topics) {
        // 获取 LO 和 EK 数量
        const loCount = Math.max(1, topic.learning_objectives?.length || 1);
        const ekCount = Math.max(1, topic.essential_knowledge?.length || 1);

        // ===== STEP 1: 根据 LO/EK 计算内容量 =====
        
        // Flashcards: 基于 EK 数量
        // 公式: max(10, min(36, 6 + (ekCount - 2) * 2.5))
        const rawFlashcards = 6 + (ekCount - 2) * 2.5;
        const flashcardsCount = Math.max(10, Math.min(36, Math.round(rawFlashcards)));

        // Quiz: 基于 LO 和 EK
        // 公式: max(6, min(16, 6 + (loCount - 1) * 4 + min(ekCount, 8) * 1.25))
        const rawQuiz = 6 + (loCount - 1) * 4 + Math.min(ekCount, 8) * 1.25;
        const quizCount = Math.max(6, Math.min(16, Math.round(rawQuiz)));

        // Study Guide 词数: 基于 LO 和 EK
        // 公式: max(600, min(1500, 700 + loCount * 150 + ekCount * 80))
        const rawWords = 700 + loCount * 150 + ekCount * 80;
        const studyGuideWords = Math.max(600, Math.min(1500, Math.round(rawWords)));

        // ===== STEP 2: 根据内容量反推时间 =====
        
        // Learn: 150词/分钟阅读速度
        const learnMinutes = Math.round(studyGuideWords / 150);

        // Review: 0.5分钟/张卡
        const reviewMinutes = Math.round(flashcardsCount * 0.5);

        // Practice: 1.5分钟/题
        const practiceMinutes = Math.round(quizCount * 1.5);

        // Topic 总时间
        const topicEstimatedMinutes = learnMinutes + reviewMinutes + practiceMinutes;
        (topic as any).topic_estimated_minutes = topicEstimatedMinutes;

        // 添加模块数据
        (topic as any).learn = {
          minutes: learnMinutes,
          study_guide_words: studyGuideWords
        };

        (topic as any).review = {
          minutes: reviewMinutes,
          flashcards_count: flashcardsCount
        };

        (topic as any).practice = {
          minutes: practiceMinutes,
          quiz_count: quizCount
        };
      }
    }

    console.log(`✅ 模块分配完成（内容驱动模型：LO/EK → 内容量 → 时间）`);
    onProgress?.('✅ 模块任务分配完成', 40);

    return enhancedData;
  }

  /**
   * 步骤 3：生成具体学习内容
   * 为每个 Topic 生成 Study Guide、Flashcards、Quiz
   */
  async generateLearningContent(courseData: APCourse, onProgress?: (message: string, percent?: number) => void): Promise<APCourse> {
    console.log('📝 步骤 3/3: 生成具体学习内容（工作池模式，5个worker）...');

    // 统计总 Topic 数量
    const totalTopics = courseData.units.reduce((sum, unit) => sum + unit.topics.length, 0);
    console.log(`   📊 总共需要处理 ${courseData.units.length} 个 Units，${totalTopics} 个 Topics`);
    console.log(`   🚀 使用 5 个并发 worker（完成后立即处理下一个）`);
    
    onProgress?.(`开始生成学习内容（${totalTopics} 个 Topics）...`, 45);
    
    const enhancedData = JSON.parse(JSON.stringify(courseData)) as APCourse;

    // 收集所有需要处理的 topics（带位置信息）
    const topicTasks: Array<{ unitIndex: number; topicIndex: number; topic: any }> = [];
    
    for (let unitIndex = 0; unitIndex < enhancedData.units.length; unitIndex++) {
      const unit = enhancedData.units[unitIndex];
      for (let topicIndex = 0; topicIndex < unit.topics.length; topicIndex++) {
        topicTasks.push({
          unitIndex,
          topicIndex,
          topic: unit.topics[topicIndex]
        });
      }
    }

    // 工作池模式：worker完成后立即取下一个任务
    const CONCURRENCY = 5; // 5 个并发 worker
    let processedCount = 0;
    let failedCount = 0;
    let currentIndex = 0;

    // 创建worker函数
    const worker = async () => {
      while (currentIndex < topicTasks.length) {
        const taskIndex = currentIndex++;
        if (taskIndex >= topicTasks.length) break;

        const { unitIndex, topicIndex, topic } = topicTasks[taskIndex];
        const progress = `${taskIndex + 1}/${totalTopics}`;
        
        console.log(`    📄 [Worker] 处理 Topic ${topic.topic_number} [${progress}]`);
        onProgress?.(`📄 处理 Topic ${topic.topic_number} [${progress}]`, 45 + Math.round((taskIndex / totalTopics) * 45));
        
        try {
          // 带重试的内容生成（4次重试）
          const content = await this.generateTopicContentWithRetry(topic, 4, onProgress, totalTopics);
          
          // 更新原始数据
          Object.assign(enhancedData.units[unitIndex].topics[topicIndex], content);
          
          processedCount++;
          
          // 检查是否生成失败（内容为空或包含错误信息）
          const isFailed = !content.study_guide || 
                          content.study_guide.includes('[内容生成失败') ||
                          content.flashcards.length === 0 ||
                          content.quiz.length === 0;
          
          if (isFailed) {
            failedCount++;
            console.error(`    ❌ Topic ${topic.topic_number} 生成失败（内容为空）[${processedCount}/${totalTopics}]`);
            onProgress?.(`❌ Topic ${topic.topic_number} 失败 [${processedCount}/${totalTopics}]`, 45 + Math.round((processedCount / totalTopics) * 45));
          } else {
            console.log(`    ✅ Topic ${topic.topic_number} 完成 [${processedCount}/${totalTopics}]`);
            onProgress?.(`✅ Topic ${topic.topic_number} 完成 [${processedCount}/${totalTopics}]`, 45 + Math.round((processedCount / totalTopics) * 45));
          }
        } catch (error) {
          failedCount++;
          processedCount++;
          console.error(`    ❌ Topic ${topic.topic_number} 生成失败:`, error);
          onProgress?.(`❌ Topic ${topic.topic_number} 失败`, 45 + Math.round((processedCount / totalTopics) * 45));
        }
        
        // 任务间延迟，避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    // 启动5个并发worker
    await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker()));

    const successCount = processedCount - failedCount;
    
    console.log(`✅ 学习内容生成完成`);
    console.log(`   📊 成功: ${successCount}/${totalTopics}, 失败: ${failedCount}/${totalTopics}`);
    
    if (failedCount > 0) {
      console.warn(`   ⚠️  有 ${failedCount} 个 Topics 生成失败`);
      onProgress?.(`⚠️ 生成完成，但有 ${failedCount}/${totalTopics} 个失败`, 90);
    } else {
      onProgress?.('✅ 学习内容生成完成', 90);
    }
    
    return enhancedData;
  }

  /**
   * 带重试机制的 Topic 内容生成（4次重试 + 快速重试）
   */
  private async generateTopicContentWithRetry(
    topic: any, 
    maxRetries: number = 4,
    onProgress?: (message: string, percent?: number) => void,
    _totalTopics?: number
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 超时设置：60秒
      const timeout = 60000;
      
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`API 调用超时 (${timeout/1000}s)`)), timeout)
        );

        const contentPromise = this.generateSingleTopicContent(topic);

        const content = await Promise.race([contentPromise, timeoutPromise]);
        
        // 成功则返回
        if (attempt > 1) {
          console.log(`    ✅ Topic ${topic.topic_number} 第 ${attempt} 次重试成功`);
        }
        return content;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // 快速重试：200ms, 300ms, 400ms
          const delay = 200 + (attempt - 1) * 100;
          console.warn(`    ⚠️  Topic ${topic.topic_number} 第 ${attempt} 次失败: ${lastError?.message}，${delay}ms 后重试...`);
          onProgress?.(`⚠️  Topic ${topic.topic_number} 第 ${attempt} 次失败，${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败，返回空内容
    console.error(`    ❌ Topic ${topic.topic_number} 重试 ${maxRetries} 次后仍失败:`, lastError?.message);
    onProgress?.(`❌ Topic ${topic.topic_number} 重试 ${maxRetries} 次后仍失败`);
    return {
      study_guide: `[内容生成失败: ${lastError?.message || '未知错误'}]`,
      flashcards: [],
      quiz: []
    };
  }

  /**
   * 生成单个 Topic 的学习内容
   * 使用 Google Gemini 2.5 Flash Lite
   */
  private async generateSingleTopicContent(topic: any): Promise<any> {
    // 提取关键信息
    const loSummaries = topic.learning_objectives.map((lo: any) => lo.summary).join('; ');
    const ekSummaries = topic.essential_knowledge.map((ek: any) => ek.summary).join('; ');
    const flashcardCount = (topic as any).review?.flashcards_count || 3;
    const quizCount = (topic as any).practice?.quiz_count || 8;
    const wordCount = (topic as any).learn?.study_guide_words || 100;

    const prompt = `You are an AP course content generator. Create high-quality educational content for the following topic.

TOPIC: ${topic.topic_title}

LEARNING OBJECTIVES: ${loSummaries}

ESSENTIAL KNOWLEDGE: ${ekSummaries}

Generate the following content in strict JSON format:

{
  "study_guide": "Write a comprehensive study guide in academic English (approximately ${wordCount} words). Cover all learning objectives and essential knowledge. Use clear explanations suitable for AP students.",
  "flashcards": [
    {
      "front": "Clear question or concept",
      "back": "Concise answer or explanation"
    }
    // Generate EXACTLY ${flashcardCount} flashcards
  ],
  "quiz": [
    {
      "question": "Multiple choice question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "explanation": "Detailed explanation of the correct answer"
    }
    // Generate EXACTLY ${quizCount} quiz questions
  ]
}

CRITICAL REQUIREMENTS:
1. ALL content MUST be in ENGLISH only
2. Generate EXACTLY ${flashcardCount} flashcards
3. Generate EXACTLY ${quizCount} quiz questions
4. Study guide should be approximately ${wordCount} words
5. Use academic but clear language suitable for AP students
6. Return ONLY pure JSON - NO comments (no // or /* */), NO markdown, NO explanations
7. Do NOT use Chinese or any other non-English languages
8. Ensure valid JSON syntax - proper commas, no trailing commas`;

    // 调用 Gemini API
    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const response = await axios.post(url, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 6000,  // 增加到 6000，支持完整内容生成
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...(httpsAgent ? { httpsAgent, proxy: false } : {}),
      timeout: 60000
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      throw new Error('API 返回空响应');
    }

    try {
      const jsonText = this.extractJSON(text);
      const content = JSON.parse(jsonText);
      
      return {
        study_guide: content.study_guide || '',
        flashcards: content.flashcards || [],
        quiz: content.quiz || []
      };
    } catch (parseError: any) {
      // 如果 JSON 解析失败，记录详细信息
      console.error(`❌ Topic ${topic.topic_number} JSON 解析失败:`, parseError.message);
      console.error(`   原始响应前 500 字符:`, text.substring(0, 500));
      console.error(`   原始响应后 500 字符:`, text.substring(Math.max(0, text.length - 500)));
      throw new Error(`JSON 解析失败: ${parseError.message}`);
    }
  }

  /**
   * 辅助函数：从文本中提取并清理 JSON
   */
  private extractJSON(text: string): string {
    let jsonText = text.trim();
    
    // 移除 markdown 代码块标记
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
    }

    // 提取 JSON 对象
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从响应中提取 JSON 数据');
    }

    let cleanJson = jsonMatch[0];
    
    // 移除 JSON 中的注释（Gemini 有时会添加注释）
    // 移除 // 单行注释
    cleanJson = cleanJson.replace(/\/\/[^\n]*/g, '');
    
    // 移除 /* */ 多行注释
    cleanJson = cleanJson.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 移除可能的尾部逗号（在数组或对象的最后一个元素后）
    cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
    
    return cleanJson;
  }

  /**
   * 完整工作流：执行所有步骤
   */
  async generateCompleteCourse(
    courseData: APCourse,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<APCourse> {
    console.log('🚀 开始 PrepGo 完整课程生成工作流...\n');
    onProgress?.('开始课程数据处理...', 5);

    try {
      // 步骤 1: 计算时长
      onProgress?.('步骤 1/3: 计算学习时长...', 10);
      let enhancedData = await this.calculateDurations(courseData, onProgress);
      onProgress?.('✅ 步骤 1 完成：学习时长计算成功', 25);
      
      // 步骤 2: 分配模块任务
      onProgress?.('步骤 2/3: 分配模块任务...', 30);
      enhancedData = await this.assignModuleTasks(enhancedData, onProgress);
      onProgress?.('✅ 步骤 2 完成：模块任务分配完成', 40);
      
      // 步骤 3: 生成学习内容（处理所有 Topics）
      onProgress?.('步骤 3/3: 生成学习内容（这可能需要较长时间）...', 45);
      enhancedData = await this.generateLearningContent(enhancedData, onProgress);
      onProgress?.('✅ 步骤 3 完成：学习内容生成完成', 95);
      
      onProgress?.('✅ 课程生成完成！', 100);

      console.log('\n✅ 完整课程生成工作流完成！');
      
      return enhancedData;
    } catch (error) {
      console.error('❌ 课程生成失败:', error);
      throw error;
    }
  }

  /**
   * v11.0: 转换为双 JSON 输出格式
   * - separated_content_json: 扁平化的新内容（用于数据库导入）
   * - combined_complete_json: 嵌套的完整课程结构（保持原始格式）
   */
  convertToDualJSON(courseData: APCourse): DualJSONOutput {
    const courseName = courseData.course_name;
    const courseId = this.generateId(courseName);
    
    // Phase 2 & 3: 生成扁平化内容（用于 separated_content_json）
    const topicOverviews: TopicOverview[] = [];
    const studyGuides: StudyGuide[] = [];
    const topicFlashcards: TopicFlashcard[] = [];
    const quizzes: Quiz[] = [];
    const unitTests: UnitTest[] = [];
    const unitAssessmentQuestions: UnitAssessmentQuestion[] = [];

    // 处理所有 units 和 topics，生成扁平化数据
    courseData.units.forEach((unit) => {
      const unitId = `${courseId}_unit_${unit.unit_number}`;

      // 处理 Topics
      unit.topics.forEach((topic) => {
        const topicId = `${courseId}_${topic.topic_number.replace('.', '_')}`;

        // Topic Overview
        topicOverviews.push({
          topic_id: topicId,
          overview_text: `Explore ${topic.topic_title}`
        });

        // Study Guide
        if (topic.study_guide) {
          studyGuides.push({
            study_guide_id: `${topicId}_sg`,
            topic_id: topicId,
            content_markdown: topic.study_guide
          });
        }

        // Flashcards
        if (topic.flashcards && topic.flashcards.length > 0) {
          topic.flashcards.forEach((card, cardIdx) => {
            topicFlashcards.push({
              card_id: `${topicId}_fc_${String(cardIdx + 1).padStart(3, '0')}`,
              topic_id: topicId,
              front_content: card.front,
              back_content: card.back,
              requires_image: this.checkRequiresImage('flashcard', card.front, card.back)
            });
          });
        }

        // Quiz Questions
        if (topic.quiz && topic.quiz.length > 0) {
          topic.quiz.forEach((q, qIdx) => {
            quizzes.push({
              quiz_id: `${topicId}_q_${String(qIdx + 1).padStart(3, '0')}`,
              topic_id: topicId,
              question_text: q.question,
              option_a: q.options[0] || '',
              option_b: q.options[1] || '',
              option_c: q.options[2] || '',
              option_d: q.options[3] || '',
              correct_answer: q.correct_answer,
              explanation: q.explanation,
              requires_image: this.checkRequiresImage('quiz', q.question, q.explanation)
            });
          });
        }
      });

      // Unit Test (Phase 3) - 从 Topic Quiz 中选择
      const unitQuizzes = unit.topics.flatMap(topic => 
        (topic.quiz || []).map((q, qIdx) => ({
          quiz: q,
          topicId: `${courseId}_${topic.topic_number.replace('.', '_')}`,
          qIdx
        }))
      );

      if (unitQuizzes.length > 0) {
        const testId = `${unitId}_test`;
        const selectedCount = Math.min(20, Math.max(15, unitQuizzes.length));
        const selectedQuizzes = this.selectRandomQuizzes(unitQuizzes, selectedCount);

        unitTests.push({
          test_id: testId,
          unit_id: unitId,
          test_title: `Unit ${unit.unit_number} Test`,
          total_questions: selectedQuizzes.length,
          estimated_minutes: Math.round(selectedQuizzes.length * 1.5)
        });

        selectedQuizzes.forEach((item, idx) => {
          const q = item.quiz;
          unitAssessmentQuestions.push({
            question_id: `${testId}_q_${String(idx + 1).padStart(3, '0')}`,
            test_id: testId,
            question_text: q.question,
            option_a: q.options[0] || '',
            option_b: q.options[1] || '',
            option_c: q.options[2] || '',
            option_d: q.options[3] || '',
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            requires_image: this.checkRequiresImage('quiz', q.question, q.explanation)
          });
        });
      }
    });

    // 返回双 JSON 输出
    return {
      // separated: 扁平化的新内容（用于数据库导入）
      separated_content_json: {
        topic_overviews: topicOverviews,
        study_guides: studyGuides,
        topic_flashcards: topicFlashcards,
        quizzes: quizzes,
        unit_tests: unitTests,
        unit_assessment_questions: unitAssessmentQuestions
      },
      // complete: 嵌套的完整课程结构（保持原始格式）
      combined_complete_json: courseData
    };
  }

  /**
   * 辅助函数：生成 ID
   */
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * 辅助函数：检查是否需要图片
   */
  private checkRequiresImage(type: 'flashcard' | 'quiz', front: string, back: string): boolean {
    const text = `${front} ${back}`.toLowerCase();
    
    // 关键词判断
    const imageKeywords = [
      'diagram', 'chart', 'graph', 'map', 'table', 'figure',
      'image', 'picture', 'photo', 'illustration',
      'structure', 'model', 'Lewis', 'molecular',
      'shown', 'depicted', 'based on the',
      'mitochondrion', 'cell', 'organelle', 'anatomy'
    ];
    
    return imageKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 辅助函数：随机选择 Quiz 题目
   */
  private selectRandomQuizzes(quizzes: any[], count: number): any[] {
    const shuffled = [...quizzes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

