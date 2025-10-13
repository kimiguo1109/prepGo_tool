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
    const CONCURRENCY = 8; // 5 个并发 worker
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

8. SPECIAL CHARACTERS HANDLING (CRITICAL for Chemistry, Math, Physics):
   - Chemical formulas: Use plain text (H2O not $H_2O$, CO2 not $CO_2$)
   - Greek letters: Use full names (Delta-H not ΔH, Delta-S not ΔS, theta not θ)
   - Superscripts/subscripts: Use plain text with parentheses (H2O, CO2, x^2, H+ ion)
   - Math expressions: Use plain text (2x + 3 not $2x + 3$)
   - Degrees: Use word "degrees" not ° symbol
   - NO LaTeX formatting ($...$)
   - NO special Unicode symbols

9. IMAGE FLAGGING - MARK requires_image CORRECTLY:
   For EACH flashcard and quiz question, set requires_image flag:
   
   A. General Rule (All Courses):
      - TRUE if question is unintelligible or impossible to answer without visual
      - Example: "Which labeled structure (A/B/C) is the cerebellum?"
   
   B. History/Social Science Rule (CRITICAL for this course):
      - TRUE if question is a STIMULUS-BASED question requiring PRIMARY or SECONDARY source analysis
      - Include: political cartoons, historical maps, photographs, propaganda posters, charts/graphs
      - Example: "Based on the political cartoon from 1898, what does the cartoonist suggest about..."
      - Example: "The map above shows territorial expansion. Which acquisition..."
      - These are ANALYSIS questions where the source material is ESSENTIAL
   
   C. Exclusion Rule:
      - FALSE if question only mentions a visualizable object but asks about function/definition
      - Example: "What was the purpose of the Monroe Doctrine?" (no image needed)

10. JSON SYNTAX - MUST FOLLOW STRICTLY:
   - In study_guide: ONE continuous line, replace newlines with spaces
   - Use ONLY ASCII characters in JSON structure
   - Use apostrophes instead of fancy quotes (' not ' or ")
   - Escape ALL double quotes inside strings as \\"
   - NO line breaks inside string values
   - NO trailing commas
   - Keep explanations concise to avoid token limits

10. FLASHCARD DIVERSIFICATION: MUST include a MIX of all three card types:
    - "Term-Definition": Simple vocabulary or terminology
    - "Concept-Explanation": Explaining principles or processes
    - "Scenario/Question-Answer": Application questions or scenarios
    Each flashcard MUST have a "card_type" field with one of these exact values

11. PRIORITIZE QUIZ COMPLETION: If running low on tokens, reduce study_guide length but ALWAYS complete all ${quizCount} quiz questions

EXAMPLE of CORRECT format for Chemistry:
{
  "study_guide": "Gibbs free energy (Delta-G) determines spontaneity. When Delta-G is negative the reaction is spontaneous. Use formula Delta-G = Delta-H - T times Delta-S.",
  "flashcards": [{"front": "Delta-H", "back": "Enthalpy change in a reaction", "card_type": "Term-Definition"}],
  "quiz": [{"question": "For the reaction 2H2(g) + O2(g) -> 2H2O(l), Delta-H = -572 kJ. Is this exothermic?", "options": ["A. Yes", "B. No", "C. Cannot determine", "D. It depends"], "correct_answer": "A", "explanation": "Delta-H is negative so heat is released making it exothermic."}]
}`;

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
        maxOutputTokens: 12000,  // v12.3: 增加到12000，确保Chemistry等课程完整生成
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
      
      // v12.6: 结合 AI 判断和 checkRequiresImage 规则（取并集）
      // 逻辑：AI认为需要 OR 代码规则认为需要 → 标记为true
      const flashcards = (content.flashcards || []).map((card: any) => ({
        ...card,
        requires_image: card.requires_image || this.checkRequiresImage('flashcard', card.front, card.back)
      }));
      
      const quiz = (content.quiz || []).map((q: any) => ({
        ...q,
        requires_image: q.requires_image || this.checkRequiresImage('quiz', q.question, q.explanation)
      }));
      
      return {
        study_guide: content.study_guide || '',
        flashcards,
        quiz
      };
    } catch (parseError: any) {
      // 尝试修复常见的 JSON 格式错误
      console.warn(`⚠️  Topic ${topic.topic_number} 初次解析失败，尝试修复...`);
      
      try {
        let fixedJson = this.extractJSON(text);
        
        // ========== 增强的 JSON 修复逻辑 (v12.3 - 支持所有AP课程) ==========
        
        // 0. 清理特殊字符（Chemistry, Physics, Math）
        fixedJson = this.cleanSpecialCharacters(fixedJson);
        
        // 1. 修复 study_guide 中的未转义换行符
        // 查找 "study_guide": "..." 并修复其中的换行
        fixedJson = fixedJson.replace(
          /"study_guide"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
          (match, content) => {
            // 替换真实的换行符为空格
            const fixed = content
              .replace(/\r\n/g, ' ')
              .replace(/\n/g, ' ')
              .replace(/\r/g, ' ')
              .replace(/\s+/g, ' '); // 合并多个空格
            return `"study_guide": "${fixed}"`;
          }
        );
        
        // 2. 修复未转义的引号（但不影响已转义的）
        // 在字符串值中查找未转义的双引号
        fixedJson = fixedJson.replace(
          /:\s*"([^"]*[^\\])"([^,}\]]*?)"/g,
          (match, before, after) => {
            // 如果检测到问题，尝试修复
            if (after && after.trim()) {
              return `: "${before}\\"${after}"`;
            }
            return match;
          }
        );
        
        // 3. 修复数组/对象中的换行符
        fixedJson = fixedJson.replace(/[\r\n]+/g, ' ');
        
        // 4. 修复连续的多个空格
        fixedJson = fixedJson.replace(/\s{2,}/g, ' ');
        
        // 5. 修复已转义但仍有问题的换行符
        fixedJson = fixedJson.replace(/\\n\\n+/g, '\\n');
        
        // ========== 尝试解析修复后的 JSON ==========
        
        const content = JSON.parse(fixedJson);
        
        // 再次验证数量
        const actualFlashcards = content.flashcards?.length || 0;
        const actualQuiz = content.quiz?.length || 0;
        
        if (actualFlashcards < flashcardCount - 2 || actualQuiz < quizCount - 2) {
          console.warn(`   ⚠️  修复后内容数量仍不足: flashcards ${actualFlashcards}/${flashcardCount}, quiz ${actualQuiz}/${quizCount}`);
          throw new Error(`内容被截断（flashcards: ${actualFlashcards}/${flashcardCount}, quiz: ${actualQuiz}/${quizCount}）`);
        }
        
        console.log(`    ✅ Topic ${topic.topic_number} JSON 修复成功`);
        
        // v12.6: 结合 AI 判断和 checkRequiresImage 规则（取并集）
        const flashcards = (content.flashcards || []).map((card: any) => ({
          ...card,
          requires_image: card.requires_image || this.checkRequiresImage('flashcard', card.front, card.back)
        }));
        
        const quiz = (content.quiz || []).map((q: any) => ({
          ...q,
          requires_image: q.requires_image || this.checkRequiresImage('quiz', q.question, q.explanation)
        }));
        
        return {
          study_guide: content.study_guide || '',
          flashcards,
          quiz
        };
      } catch (secondError: any) {
        // 修复也失败，记录详细信息
        console.error(`❌ Topic ${topic.topic_number} JSON 解析失败:`, parseError.message);
        console.error(`   原始响应前 500 字符:`, text.substring(0, 500));
        console.error(`   原始响应后 500 字符:`, text.substring(Math.max(0, text.length - 500)));
        throw new Error(`JSON 解析失败: ${parseError.message}`);
      }
    }
  }

  /**
   * 辅助函数：清理特殊字符（Chemistry, Physics, Math）
   * v12.3: 处理LaTeX公式、希腊字母、特殊符号
   */
  private cleanSpecialCharacters(jsonText: string): string {
    let cleaned = jsonText;
    
    // 1. 移除LaTeX格式标记 ($...$)
    cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');
    
    // 2. 替换常见的希腊字母和特殊符号
    const replacements: Record<string, string> = {
      // 希腊字母
      'Δ': 'Delta-',
      'δ': 'delta-',
      'θ': 'theta',
      'Θ': 'Theta',
      'π': 'pi',
      'Π': 'Pi',
      'σ': 'sigma',
      'Σ': 'Sigma',
      'μ': 'mu',
      'λ': 'lambda',
      'ω': 'omega',
      'Ω': 'Omega',
      'α': 'alpha',
      'β': 'beta',
      'γ': 'gamma',
      
      // 特殊符号
      '°': ' degrees',
      '±': '+/-',
      '≈': 'approximately',
      '≠': 'not equal to',
      '≤': 'less than or equal to',
      '≥': 'greater than or equal to',
      '→': '->',
      '←': '<-',
      '⇌': '<->',
      '∞': 'infinity',
      '√': 'sqrt',
      '∫': 'integral',
      '∑': 'sum',
      '∏': 'product',
      
      // 上标/下标（常见）
      '²': '^2',
      '³': '^3',
      '⁰': '^0',
      '¹': '^1',
      '⁴': '^4',
      '⁵': '^5',
      '⁶': '^6',
      '⁷': '^7',
      '⁸': '^8',
      '⁹': '^9',
      
      // 引号（使用转义）
      '\u201C': '"',  // "
      '\u201D': '"',  // "
      '\u2018': "'",  // '
      '\u2019': "'",  // '
      
      // 其他
      '—': '-',
      '–': '-',
      '…': '...',
      '×': 'x',
      '÷': '/',
    };
    
    // 应用所有替换
    for (const [symbol, replacement] of Object.entries(replacements)) {
      cleaned = cleaned.split(symbol).join(replacement);
    }
    
    // 3. 清理残留的特殊Unicode字符（替换为空格）
    // 保留ASCII字符 (32-126) 和基本标点
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    
    return cleaned;
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
              requires_image: this.checkRequiresImage('flashcard', card.front, card.back)  // 使用代码规则重新计算
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
              requires_image: this.checkRequiresImage('quiz', q.question, q.explanation)  // 使用代码规则重新计算
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
            requires_image: q.requires_image  // v12.5: 使用AI生成的字段
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
   * v12.4: 通用平衡规则 + 历史/社科类专用规则
   * 
   * 策略：
   * 1. 明确引用图表 → 必须标记
   * 2. 历史/社科材料分析 → 必须标记（NEW）
   * 3. 通用视觉概念模式 → Flashcard中标记
   */
  private checkRequiresImage(type: 'flashcard' | 'quiz', front: string, back: string): boolean {
    const text = `${front} ${back}`.toLowerCase();
    const frontText = front.trim().toLowerCase();
    
    // ========== 第一优先级：明确引用图表（所有题型，必须标记） ==========
    const explicitReferences = [
      // 直接引用
      'refer to the diagram', 'refer to the figure', 'refer to the table',
      'refer to the chart', 'refer to the graph', 'refer to the image',
      'refer to the map', 'refer to the illustration', 'refer to the cartoon',
      'refer to the photograph', 'refer to the poster',
      
      // 显示在...
      'shown in the diagram', 'shown in the figure', 'shown in the table',
      'shown in the image', 'shown in the graph', 'shown above', 'shown below',
      'pictured in', 'depicted in', 'illustrated in',
      
      // 在...中
      'in the diagram', 'in the figure', 'in the table', 'in the chart',
      'in the graph', 'in the image', 'in the map', 'in the cartoon',
      'in the photograph', 'in the poster above',
      
      // 基于...
      'based on the diagram', 'based on the figure', 'based on the graph',
      'based on the table', 'based on the map', 'based on the cartoon',
      'based on the photograph', 'based on the poster',
      'according to the diagram', 'according to the figure', 'according to the graph',
      
      // 标记和识别
      'labeled as', 'labeled with', 'label the', 'identify the', 'which labeled',
      
      // 数据来源
      'from the graph', 'from the chart', 'from the table', 'from the diagram',
      'from the map', 'from the cartoon',
      
      // 展示
      'the graph shows', 'the diagram shows', 'the table shows', 'the chart shows',
      'the map shows', 'the cartoon shows', 'the photograph shows',
      'as shown in', 'as illustrated', 'as depicted',
      
      // 观察
      'observe the', 'look at the', 'see figure', 'see diagram',
      'see table', 'see graph', 'see map', 'see cartoon'
    ];
    
    if (explicitReferences.some(pattern => text.includes(pattern))) {
      return true;
    }
    
    // ========== 第二优先级：历史/社科材料分析（NEW - v12.4） ==========
    // 识别"stimulus-based questions"的关键模式
    const historicalSourcePatterns = [
      // 政治漫画分析
      'the cartoon suggests', 'the cartoon depicts', 'the cartoon illustrates',
      'the cartoonist suggests', 'the cartoonist argues', 'the cartoonist portrays',
      'political cartoon', 'editorial cartoon',
      
      // 地图分析
      'the map above', 'the map illustrates', 'the map shows',
      'territorial expansion', 'the shaded area', 'the region shown',
      
      // 照片/图片分析
      'the photograph above', 'the photograph shows', 'the image above',
      'the picture shows', 'the illustration above',
      
      // 海报/宣传材料
      'the poster above', 'the poster suggests', 'propaganda poster',
      'recruitment poster', 'wartime poster',
      
      // 图表/数据分析
      'the chart above', 'the graph above', 'the data shown',
      'the statistics in', 'the table above',
      
      // 文档/材料分析
      'the document above', 'the excerpt above', 'the passage above',
      'the primary source', 'the author suggests', 'according to the source',
      
      // 解读性提问（历史材料）
      'what does the', 'what does this', 'interpret the', 'analyze the',
      'the source suggests', 'the source indicates', 'the source reflects',
      'best reflects', 'best represents', 'best illustrates',
      'perspective of', 'point of view', 'intended audience'
    ];
    
    if (historicalSourcePatterns.some(pattern => text.includes(pattern))) {
      return true;
    }
    
    // ========== 第三优先级：通用视觉概念模式（仅Flashcard） ==========
    // Quiz需要明确引用才标记，保持严格性
    if (type === 'flashcard') {
      
      // 模式1: 包含"structure"或"diagram"等视觉关键词
      const visualKeywords = [
        'structure of', 'structure is', 'structure shows',
        'diagram of', 'diagram shows',
        'model of', 'model shows',
        'cross-section of', 'anatomy of', 'schematic of',
        'blueprint of', 'layout of', 'configuration of'
      ];
      
      if (visualKeywords.some(keyword => text.includes(keyword))) {
        return true;
      }
      
      // 模式2: 问题询问视觉特征或位置
      const visualQuestionPatterns = [
        'what does', 'how does', 'where is',
        'locate the', 'identify the location',
        'position of', 'placement of', 'arrangement of',
        'shape of', 'appearance of', 'visual features'
      ];
      
      const hasVisualQuestion = visualQuestionPatterns.some(pattern => 
        frontText.includes(pattern)
      );
      
      if (hasVisualQuestion && (
        text.includes('structure') || text.includes('component') ||
        text.includes('part') || text.includes('organ') || text.includes('system')
      )) {
        return true;
      }
      
      // 模式3: Flashcard front 询问"这是什么"类型的视觉识别
      if (frontText.includes('what is this') || 
          frontText.includes('identify this') ||
          frontText.includes('name this') ||
          frontText.includes('label this')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 辅助函数：随机选择 Quiz 题目
   */
  private selectRandomQuizzes(quizzes: any[], count: number): any[] {
    const shuffled = [...quizzes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

