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
   * 步骤 1：计算学习时长（预留，实际在 assignModuleTasks 中自下而上累加）
   * v12.0 更新：时长由 Topic 内容量驱动，自下而上累加
   */
  async calculateDurations(courseData: APCourse, onProgress?: (message: string, percent?: number) => void): Promise<APCourse> {
    console.log('⏱️  步骤 1/3: 初始化时长计算（内容驱动模型）...');
    onProgress?.('初始化时长计算...', 10);

    // v12.0: 时长计算已移至 assignModuleTasks 中
    // 这里只做简单的数据复制和初始化
    const enhancedData = JSON.parse(JSON.stringify(courseData)) as APCourse;

    console.log('✅ 时长计算准备完成（将在模块分配时进行实际计算）');
    onProgress?.('✅ 学习时长计算准备完成', 25);
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

    // v12.0: 自下而上累加时长（Topic → Unit → Course）
    console.log('📊 计算总时长（自下而上累加）...');
    
    let courseTotalMinutes = 0;
    for (const unit of enhancedData.units) {
      let unitTotalMinutes = 0;
      
      for (const topic of unit.topics) {
        const topicMinutes = (topic as any).topic_estimated_minutes || 0;
        unitTotalMinutes += topicMinutes;
      }
      
      (unit as any).unit_estimated_minutes = unitTotalMinutes;
      courseTotalMinutes += unitTotalMinutes;
    }
    
    (enhancedData as any).course_estimated_minutes = courseTotalMinutes;

    console.log(`✅ 模块分配完成（内容驱动模型：LO/EK → 内容量 → 时间）`);
    console.log(`   ⏱️  课程总时长: ${courseTotalMinutes} 分钟`);
    console.log(`   📝 Units 数量: ${enhancedData.units.length}`);
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
      "back": "Concise answer or explanation",
      "card_type": "Term-Definition" | "Concept-Explanation" | "Scenario/Question-Answer"
    }
  ],
  "quiz": [
    {
      "question": "Multiple choice question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "explanation": "Detailed explanation of the correct answer"
    }
  ]
}

CRITICAL REQUIREMENTS:
1. ALL content MUST be in ENGLISH only
2. Generate EXACTLY ${flashcardCount} flashcards (not more, not less)
3. Generate EXACTLY ${quizCount} quiz questions (not more, not less)
4. Study guide should be approximately ${wordCount} words
5. Use academic but clear language suitable for AP students
6. Return ONLY valid JSON - NO comments, NO markdown backticks, NO extra text before or after
7. Do NOT use Chinese or any other non-English languages
8. Ensure valid JSON syntax:
   - All strings must be properly escaped (use \\" for quotes, \\n for newlines)
   - Use proper commas between items
   - NO trailing commas after the last item in arrays or objects
   - NO line breaks within string values (use \\n instead)
9. Start your response immediately with { and end with } - nothing else
10. FLASHCARD DIVERSIFICATION (v12.0): MUST include a MIX of all three card types:
    - "Term-Definition": Simple vocabulary or terminology
    - "Concept-Explanation": Explaining principles or processes
    - "Scenario/Question-Answer": Application questions or scenarios
    Each flashcard MUST have a "card_type" field with one of these exact values`;

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
        maxOutputTokens: 8000,  // 增加到 8000，确保完整内容生成
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
      
      // 验证内容数量是否符合要求（允许 ±2 的误差）
      const actualFlashcards = content.flashcards?.length || 0;
      const actualQuiz = content.quiz?.length || 0;
      
      if (actualFlashcards < flashcardCount - 2 || actualQuiz < quizCount - 2) {
        console.warn(`   ⚠️  内容数量不足: flashcards ${actualFlashcards}/${flashcardCount}, quiz ${actualQuiz}/${quizCount}`);
        throw new Error(`内容被截断（flashcards: ${actualFlashcards}/${flashcardCount}, quiz: ${actualQuiz}/${quizCount}）`);
      }
      
      return {
        study_guide: content.study_guide || '',
        flashcards: content.flashcards || [],
        quiz: content.quiz || []
      };
    } catch (parseError: any) {
      // 尝试修复常见的 JSON 格式错误
      console.warn(`⚠️  Topic ${topic.topic_number} 初次解析失败，尝试修复...`);
      
      try {
        let fixedJson = this.extractJSON(text);
        
        // 修复未转义的换行符（在字符串中）
        fixedJson = fixedJson.replace(/"([^"]*?)[\r\n]+([^"]*?)"/g, (match, before, after) => {
          return `"${before}\\n${after}"`;
        });
        
        // 修复连续的多个换行符
        fixedJson = fixedJson.replace(/\\n\\n+/g, '\\n');
        
        // 尝试再次解析
        const content = JSON.parse(fixedJson);
        
        // 再次验证数量
        const actualFlashcards = content.flashcards?.length || 0;
        const actualQuiz = content.quiz?.length || 0;
        
        if (actualFlashcards < flashcardCount - 2 || actualQuiz < quizCount - 2) {
          console.warn(`   ⚠️  修复后内容数量仍不足: flashcards ${actualFlashcards}/${flashcardCount}, quiz ${actualQuiz}/${quizCount}`);
          throw new Error(`内容被截断（flashcards: ${actualFlashcards}/${flashcardCount}, quiz: ${actualQuiz}/${quizCount}）`);
        }
        
        console.log(`    ✅ Topic ${topic.topic_number} JSON 修复成功`);
        
        return {
          study_guide: content.study_guide || '',
          flashcards: content.flashcards || [],
          quiz: content.quiz || []
        };
      } catch {
        // 修复也失败，记录详细信息
        console.error(`❌ Topic ${topic.topic_number} JSON 解析失败:`, parseError.message);
        console.error(`   原始响应前 500 字符:`, text.substring(0, 500));
        console.error(`   原始响应后 500 字符:`, text.substring(Math.max(0, text.length - 500)));
        throw new Error(`JSON 解析失败: ${parseError.message}`);
      }
    }
  }

  /**
   * 辅助函数：从文本中提取并清理 JSON
   * 使用括号计数法精确定位 JSON 对象边界
   */
  private extractJSON(text: string): string {
    let jsonText = text.trim();
    
    // 移除 markdown 代码块标记
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.substring(7).trim(); // 移除 '```json'
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.substring(3).trim(); // 移除 '```'
    }
    
    // 移除末尾的 markdown 标记
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.substring(0, jsonText.length - 3).trim();
    }

    // 找到第一个 '{' 的位置
    const startIdx = jsonText.indexOf('{');
    if (startIdx === -1) {
      throw new Error('无法从响应中找到 JSON 起始位置');
    }

    // 使用括号计数法找到匹配的 '}' 位置
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let endIdx = -1;

    for (let i = startIdx; i < jsonText.length; i++) {
      const char = jsonText[i];
      
      // 处理转义字符
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      // 处理字符串边界
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // 只在非字符串内部计数括号
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }

    if (endIdx === -1) {
      // JSON 被截断，尝试修复
      console.warn('   ⚠️  检测到 JSON 被截断，尝试修复...');
      
      // 检查是否在 quiz 或 flashcards 数组中被截断
      const lastBraceIdx = jsonText.lastIndexOf('}');
      if (lastBraceIdx > startIdx) {
        // 尝试在最后一个完整对象后截断
        let testJson = jsonText.substring(startIdx, lastBraceIdx + 1);
        
        // 添加必要的闭合符号
        // 检查是否在数组中
        const openArrays = (testJson.match(/\[/g) || []).length - (testJson.match(/\]/g) || []).length;
        const openBraces = (testJson.match(/\{/g) || []).length - (testJson.match(/\}/g) || []).length;
        
        // 闭合数组和对象
        for (let i = 0; i < openArrays; i++) {
          testJson += ']';
        }
        for (let i = 0; i < openBraces; i++) {
          testJson += '}';
        }
        
        // 尝试解析修复后的 JSON
        try {
          JSON.parse(testJson);
          console.log('   ✅ JSON 截断修复成功');
          endIdx = testJson.length;
          jsonText = testJson;
        } catch {
          throw new Error('无法从响应中找到 JSON 结束位置（响应可能被截断）');
        }
      } else {
        throw new Error('无法从响应中找到 JSON 结束位置（响应可能被截断）');
      }
    }

    let cleanJson = jsonText.substring(startIdx, endIdx);
    
    // 移除 JSON 中的注释（Gemini 有时会添加注释）
    // 移除 // 单行注释（但要小心字符串中的 //）
    cleanJson = cleanJson.replace(/"[^"\\]*(?:\\.[^"\\]*)*"|\/\/[^\n]*/g, (match) => {
      return match.startsWith('"') ? match : '';
    });
    
    // 移除 /* */ 多行注释（但要小心字符串中的 /* */）
    cleanJson = cleanJson.replace(/"[^"\\]*(?:\\.[^"\\]*)*"|\/\*[\s\S]*?\*\//g, (match) => {
      return match.startsWith('"') ? match : '';
    });
    
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
              card_type: card.card_type || 'Term-Definition',  // v12.0: 添加卡片类型
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
            question_type: 'MCQ',  // v12.0: 添加题型标记（当前只有MCQ，未来可扩展FRQ）
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
   * v12.0: 严格必要性规则 - ONLY IF unintelligible without visual
   */
  private checkRequiresImage(type: 'flashcard' | 'quiz', front: string, back: string): boolean {
    const text = `${front} ${back}`.toLowerCase();
    
    // v12.0: 严格必要性 - 只标记明确需要看图才能回答的问题
    const strictNecessityPatterns = [
      // 明确引用图表
      'refer to the diagram',
      'refer to the figure',
      'refer to the table',
      'refer to the chart',
      'refer to the graph',
      'refer to the image',
      'shown in the diagram',
      'shown in the figure',
      'shown in the table',
      'shown in the image',
      'in the diagram',
      'in the figure above',
      'in the table',
      'based on the diagram',
      'based on the figure',
      'according to the diagram',
      'according to the figure',
      
      // 标记的结构（A/B/C/D 选择）
      'labeled structure a',
      'labeled structure b',
      'labeled structure c',
      'labeled structure d',
      'structure labeled',
      'which structure',
      'identify the structure',
      'label the',
      'which labeled',
      
      // 图中问题
      'in the image',
      'from the graph',
      'from the chart',
      'the graph shows',
      'the diagram shows',
      'as shown',
      'see figure',
      'see diagram'
    ];
    
    // 只有明确匹配这些模式才需要图片
    return strictNecessityPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * 辅助函数：随机选择 Quiz 题目
   */
  private selectRandomQuizzes(quizzes: any[], count: number): any[] {
    const shuffled = [...quizzes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

