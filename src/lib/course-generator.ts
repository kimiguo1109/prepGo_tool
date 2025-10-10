import OpenAI from 'openai';
import type { APCourse } from '@/types/course';

const QWEN_API_KEY = 'sk-a0bced967e594452a0593fcdbf3fec48';

/**
 * PrepGo 课程生成器 - 完整的工作流
 * 
 * 工作流程：
 * 1. 学习时长计算
 * 2. 模块时长与任务分配（Learn/Review/Practice）
 * 3. 生成具体内容（Study Guide/Flashcards/Quiz）
 * 4. 课程完整输出
 */
export class CourseGenerator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: QWEN_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
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
   * 为每个 Topic 分配 Learn、Review、Practice 模块
   * 直接计算，不调用 AI（避免 JSON 过大导致解析失败）
   */
  async assignModuleTasks(courseData: APCourse, onProgress?: (message: string, percent?: number) => void): Promise<APCourse> {
    console.log('📦 步骤 2/3: 分配模块时长与任务...');
    onProgress?.('分配模块任务...', 30);

    const enhancedData = JSON.parse(JSON.stringify(courseData)) as APCourse;

    // 遍历所有 Units 和 Topics，直接计算模块分配
    for (const unit of enhancedData.units) {
      for (const topic of unit.topics) {
        const totalMinutes = (topic as any).topic_estimated_minutes || 30;

        // 按比例分配：Learn 50%, Review 25%, Practice 25%
        const learnMinutes = Math.round(totalMinutes * 0.5);
        const reviewMinutes = Math.round(totalMinutes * 0.25);
        const practiceMinutes = totalMinutes - learnMinutes - reviewMinutes;

        // 计算任务量
        const studyGuideWords = learnMinutes * 5; // 5 字/分钟
        const flashcardsCount = Math.max(1, Math.round(reviewMinutes / 3)); // 3 分钟/张
        const quizCount = Math.min(15, Math.max(6, Math.round(practiceMinutes * 1.5))); // 6-15 题

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

    console.log(`✅ 模块分配完成（已为所有 Topics 计算 Learn/Review/Practice）`);
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
          // 带重试的内容生成
          const content = await this.generateTopicContentWithRetry(topic, 3, onProgress, totalTopics);
          
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
   * 带重试机制的 Topic 内容生成（5次重试 + 递增超时）
   */
  private async generateTopicContentWithRetry(
    topic: any, 
    maxRetries: number = 5,
    onProgress?: (message: string, percent?: number) => void,
    totalTopics?: number
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 递增超时：60s, 90s, 120s, 150s, 180s
      const timeout = 30000 + (attempt * 30000);
      
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
          // 增加延迟避免 API 限流：2s, 4s, 6s, 8s
          const delay = attempt * 2000;
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
   * 优化版：减少 token 使用，提高性价比
   */
  private async generateSingleTopicContent(topic: any): Promise<any> {
    // 提取关键信息，避免发送完整 JSON
    const loSummaries = topic.learning_objectives.map((lo: any) => lo.summary).join('; ');
    const ekSummaries = topic.essential_knowledge.map((ek: any) => ek.summary).join('; ');
    const flashcardCount = (topic as any).review?.flashcards_count || 3;
    const quizCount = (topic as any).practice?.quiz_count || 8;
    const wordCount = (topic as any).learn?.study_guide_words || 100;

    // 优化后的 prompt - 更简洁，减少 token
    const prompt = `Create AP course content for: ${topic.topic_title}

Learning Objectives: ${loSummaries}
Essential Knowledge: ${ekSummaries}

Generate JSON:
{
  "study_guide": "${wordCount} words max, academic English",
  "flashcards": [${flashcardCount} items: {"front":"Q","back":"A"}],
  "quiz": [${quizCount} items: {"question":"","options":["A.","B.","C.","D."],"correct_answer":"A","explanation":""}]
}

Rules: English only, exact counts, concise but comprehensive.`;

    const completion = await this.client.chat.completions.create({
      model: 'qwen-plus', // 使用 qwen-plus 代替 qwen-max（更便宜，质量仍然不错）
      messages: [
        {
          role: 'system',
          content: 'AP content generator. Output JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // 降低 temperature 使输出更确定、更简洁
      max_tokens: 2000, // 限制输出长度，节省 token
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error('API 返回空响应');
    }

    const jsonText = this.extractJSON(text);
    const content = JSON.parse(jsonText);
    
    return {
      study_guide: content.study_guide || '',
      flashcards: content.flashcards || [],
      quiz: content.quiz || []
    };
  }

  /**
   * 辅助函数：从文本中提取 JSON
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

    return jsonMatch[0];
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
}

