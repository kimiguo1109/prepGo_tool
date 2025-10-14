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
        // v12.8: 检查是否为新格式（Gemini step 1），如果是则优先使用prepgo_plan
        const hasPrepgoPlan = (topic as any).prepgo_plan !== undefined;
        
        let flashcardsCount: number;
        let quizCount: number;
        let studyGuideWords: number;
        let learnMinutes: number;
        let reviewMinutes: number;
        let practiceMinutes: number;
        let topicEstimatedMinutes: number;
        
        if (hasPrepgoPlan) {
          // 新格式：直接使用prepgo_plan中的值
          const plan = (topic as any).prepgo_plan;
          flashcardsCount = plan.target_flashcards_count || 10;
          quizCount = plan.target_mcq_count || 6;
          studyGuideWords = plan.target_study_guide_words || 1000;
          learnMinutes = plan.learn_minutes || Math.round(studyGuideWords / 150);
          reviewMinutes = plan.review_minutes || Math.round(flashcardsCount * 0.5);
          practiceMinutes = plan.practice_minutes || Math.round(quizCount * 1.5);
          topicEstimatedMinutes = plan.total_estimated_minutes || (learnMinutes + reviewMinutes + practiceMinutes);
        } else {
          // 旧格式：基于LO/EK数量计算
        const loCount = Math.max(1, topic.learning_objectives?.length || 1);
        const ekCount = Math.max(1, topic.essential_knowledge?.length || 1);
        
        // Flashcards: 基于 EK 数量
        const rawFlashcards = 6 + (ekCount - 2) * 2.5;
          flashcardsCount = Math.max(10, Math.min(36, Math.round(rawFlashcards)));

        // Quiz: 基于 LO 和 EK
        const rawQuiz = 6 + (loCount - 1) * 4 + Math.min(ekCount, 8) * 1.25;
          quizCount = Math.max(6, Math.min(16, Math.round(rawQuiz)));

        // Study Guide 词数: 基于 LO 和 EK
        const rawWords = 700 + loCount * 150 + ekCount * 80;
          studyGuideWords = Math.max(600, Math.min(1500, Math.round(rawWords)));

          // 根据内容量反推时间
          learnMinutes = Math.round(studyGuideWords / 150);
          reviewMinutes = Math.round(flashcardsCount * 0.5);
          practiceMinutes = Math.round(quizCount * 1.5);
          topicEstimatedMinutes = learnMinutes + reviewMinutes + practiceMinutes;
        }

        // 设置topic的时间和内容量数据
        (topic as any).topic_estimated_minutes = topicEstimatedMinutes;

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
      
      // v12.8: 添加unit_overview结构
      // 如果输入已有unit_overview（新格式），则保留summary并更新时间
      // 如果没有（旧格式），则创建新的unit_overview
      const existingOverview = (unit as any).unit_overview;
      
      // v12.8.13: 格式化 ced_class_periods（移除波浪线，标准化大小写）
      const rawCedPeriods = existingOverview?.ced_class_periods || unit.ced_class_periods || '';
      const formattedCedPeriods = this.formatCedClassPeriods(rawCedPeriods);
      
      (unit as any).unit_overview = {
        summary: existingOverview?.summary || '',  // 优先使用输入中的summary
        ced_class_periods: formattedCedPeriods,
        exam_weight: existingOverview?.exam_weight || unit.exam_weight || '',
        prepgo_estimated_minutes: existingOverview?.prepgo_estimated_minutes || unitTotalMinutes  // 优先使用输入中的时间
      };
      
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
    console.log('📝 步骤 3/3: 生成具体学习内容（工作池模式，8个worker）...');

    // 统计总 Topic 数量
    const totalTopics = courseData.units.reduce((sum, unit) => sum + unit.topics.length, 0);
    console.log(`   📊 总共需要处理 ${courseData.units.length} 个 Units，${totalTopics} 个 Topics`);
    console.log(`   🚀 使用 8 个并发 worker（完成后立即处理下一个）`);
    
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
    const CONCURRENCY = 8; // 8 个并发 worker
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
          // 带重试的内容生成（v12.8.14: 6次重试）
          const content = await this.generateTopicContentWithRetry(topic, 6, onProgress, totalTopics);
          
          // 更新原始数据
          Object.assign(enhancedData.units[unitIndex].topics[topicIndex], content);
          
          processedCount++;
          
          // 检查是否生成失败（内容为空或包含错误信息）
          // v12.8.4: study_guide 现在是对象格式，需要检查 content_markdown 字段
          const isFailed = !content.study_guide || 
                          !content.study_guide.content_markdown ||
                          content.study_guide.content_markdown.includes('[内容生成失败') ||
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

    // 启动8个并发worker
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
   * 带重试机制的 Topic 内容生成（8次重试 + 指数退避）
   * v12.8.18: 增加重试次数到8次，延长超时时间到120秒，使用更激进的退避策略
   */
  private async generateTopicContentWithRetry(
    topic: any, 
    maxRetries: number = 8,  // v12.8.18: 从6次增加到8次
    onProgress?: (message: string, percent?: number) => void,
    _totalTopics?: number
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // v12.8.18: 超时设置：120秒（增加到2分钟）
      const timeout = 120000;
      
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
          // v12.8.18: 更激进的指数退避：500ms, 1s, 2s, 4s, 6s, 8s, 10s, 12s
          const delays = [500, 1000, 2000, 4000, 6000, 8000, 10000, 12000];
          const delay = delays[Math.min(attempt - 1, delays.length - 1)];
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
    // v12.8.12: 设置合理的默认字数（1500），避免 AI 过度生成
    const targetWordCount = (topic as any).learn?.study_guide_words || 1500;

    const prompt = `You are an AP course content generator. Create high-quality educational content for the following topic.

🚨 CRITICAL REQUIREMENTS 🚨
1. WORD COUNT: ${targetWordCount} words (tolerance: ±50-100 words)
   - Target: ${targetWordCount} words
   - Acceptable: ${targetWordCount - 100} to ${targetWordCount + 100} words
   - STOP at ${targetWordCount + 50} words
   
2. READABILITY:
   - Use clear paragraph breaks (separate concepts)
   - Write short, focused sentences (15-20 words max per sentence)
   - One idea per sentence
   - Use simple, direct language
   
3. CONTENT ALIGNMENT:
   - STRICTLY follow the Learning Objectives below
   - Address EVERY point in Essential Knowledge
   - No additional content beyond CED requirements
   - Stay focused on specified learning goals

TOPIC: ${topic.topic_title}

LEARNING OBJECTIVES (MUST address ALL):
${loSummaries}

ESSENTIAL KNOWLEDGE (MUST cover ALL):
${ekSummaries}

Generate the following content in strict JSON format:

{
  "study_guide": "TARGET: ${targetWordCount} words (±50-100 words). Write a clear, well-structured study guide that DIRECTLY addresses each Learning Objective and Essential Knowledge point. Use paragraph breaks to separate major concepts. Keep sentences SHORT (15-20 words max). Write in simple, direct language suitable for AP students. Focus ONLY on CED-specified content.",
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

FORMULA-BASED QUESTIONS (v12.8.19 - for Math/Statistics/Science courses):
   ⚠️ CRITICAL for courses like: AP Statistics, AP Calculus, AP Physics, AP Chemistry
   
   IF the topic content includes:
   - Mathematical formulas (mean, median, standard deviation, z-score, etc.)
   - Statistical calculations (probability, confidence intervals, hypothesis tests, etc.)
   - Chemical equations or quantitative analysis
   - Physics formulas (force, energy, momentum, etc.)
   
   THEN you MUST include formula-based calculation questions:
   
   a) Question Distribution for Math/Statistics Topics:
      - 40-60% of quiz questions SHOULD involve calculations or formula application
      - Include worked-out numerical examples in questions
      - Provide specific data for students to calculate
   
   b) Formula Question Format:
      "question": "A dataset has values: 12, 15, 18, 20, 25. Calculate the mean and standard deviation. Which is closest to the mean?",
      "options": ["14.5", "16.0", "18.0", "20.5"],
      "correct_answer": "C",
      "explanation": "Mean = (12+15+18+20+25)/5 = 90/5 = 18.0. The standard deviation is approximately 4.7."
   
   c) Examples of Formula-Based Questions:
      - Statistics: "Given p-hat = 0.45 and n = 100, calculate the standard error..."
      - Statistics: "If z-score = 1.96, what percentile does this represent?"
      - Chemistry: "If 2.0 mol of H2 reacts with 1.0 mol of O2, how many grams of H2O..."
      - Physics: "A 5 kg object accelerates at 3 m/s^2. What is the net force?"
   
   d) Formula Writing Guidelines:
      - Write formulas in plain text: "mean = sum of values / n"
      - Show step-by-step calculation in explanation
      - Use actual numbers from the topic's Essential Knowledge
      - Make sure calculations are correct and verifiable
   
   e) Balance with Conceptual Questions:
      - 40-60%: Calculation/formula questions
      - 40-60%: Conceptual understanding questions
      - Mix both types to test comprehensive understanding

CRITICAL REQUIREMENTS (STRICT PRIORITY ORDER):
1. ⚠️ JSON COMPLETENESS - HIGHEST PRIORITY:
   - The ENTIRE JSON MUST be complete with proper closing brackets
   - If approaching output token limit (~20000 tokens), STOP writing and close JSON properly
   
2. 🔴 WORD COUNT CONTROL:
   - Study guide: ${targetWordCount} words (acceptable: ${targetWordCount - 100} to ${targetWordCount + 100})
   - STOP at ${targetWordCount + 50} words
   - Track your progress and plan accordingly
   
3. 📖 READABILITY & STRUCTURE:
   - Use paragraph breaks: Start new paragraph for each major concept/Learning Objective
   - Short sentences: 15-20 words maximum per sentence
   - One clear idea per sentence
   - Simple, direct language (avoid jargon unless necessary)
   - Natural flow: concept → explanation → example → application
   
4. 🎯 CONTENT ALIGNMENT (CED-FOCUSED):
   - Address EVERY Learning Objective explicitly
   - Cover ALL Essential Knowledge points
   - No extra content beyond CED requirements
   - Use CED terminology consistently
   - Connect concepts to specified learning goals
   
3. ALL content MUST be in ENGLISH only
4. Generate EXACTLY ${flashcardCount} flashcards (not more, not less)
5. Generate EXACTLY ${quizCount} quiz questions (not more, not less)
6. Use academic but clear language suitable for AP students
7. Return ONLY valid JSON - NO comments, NO markdown backticks, NO extra text before or after
8. Do NOT use Chinese or any other non-English languages

SPECIAL CHARACTERS HANDLING (CRITICAL for Chemistry, Math, Physics):
   - Chemical formulas: Use plain text (H2O not $H_2O$, CO2 not $CO_2$)
   - Greek letters: Use full names (Delta-H not ΔH, Delta-S not ΔS, theta not θ)
   - Superscripts/subscripts: Use plain text with parentheses (H2O, CO2, x^2, H+ ion)
   - Math expressions: Use plain text (2x + 3 not $2x + 3$)
   - Degrees: Use word "degrees" not ° symbol
   - NO LaTeX formatting ($...$)
   - NO special Unicode symbols

IMAGE FLAGGING - MARK requires_image CORRECTLY:
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

JSON SYNTAX - CRITICAL FOR PARSING SUCCESS:
   ⚠️ The following rules are MANDATORY to prevent JSON parsing errors:
   
   a) String Content Rules:
      - NEVER use double quotes (") inside string values
      - Use single quotes (') or apostrophes for possessives (it's, don't, can't)
      - Replace any internal quotes with apostrophes: "the 'concept' is" NOT "the \"concept\" is"
      - For emphasis or terminology, use single quotes: 'key term' NOT "key term"
   
   b) Formatting Rules:
      - In study_guide: Write as ONE continuous line (no line breaks)
      - Replace all newlines with spaces in long text
      - NO trailing commas after last array/object item
      - Use ONLY standard ASCII punctuation
   
   c) Special Characters:
      - Avoid fancy quotes (", ", ', ') - use standard quotes only
      - Avoid em dashes (—) - use regular hyphens (-)
      - Avoid ellipsis character (…) - use three periods (...)
   
   d) Validation:
      - Every opening bracket must have closing bracket: { }, [ ]
      - Every key must have quoted value: "key": "value"
      - Commas between items but NOT before closing bracket

FLASHCARD DIVERSIFICATION: MUST include a MIX of all three card types:
    - "Term-Definition": Simple vocabulary or terminology
    - "Concept-Explanation": Explaining principles or processes
    - "Scenario/Question-Answer": Application questions or scenarios
    Each flashcard MUST have a "card_type" field with one of these exact values
    
FORMULA FLASHCARDS (v12.8.19 - for Math/Statistics/Science courses):
    For courses with mathematical/statistical/scientific content:
    - 30-40% of flashcards SHOULD test formula knowledge and calculation
    - Include formula definition cards: 
      Front: "What is the formula for standard error of a sample proportion?"
      Back: "SE(p-hat) = sqrt(p(1-p)/n), where p is the proportion and n is the sample size"
    - Include calculation practice cards:
      Front: "Calculate the z-score for x=85, mean=75, SD=5"
      Back: "z = (x - mean)/SD = (85-75)/5 = 2.0. This value is 2 standard deviations above the mean."
    - Show step-by-step work in the answer

WRITING ORDER & STRATEGY:
    1. Generate flashcards FIRST (each card: 30-40 words total)
    2. Generate quiz SECOND (each explanation: 35-50 words)
    3. Generate study_guide LAST - ORGANIZE BY LEARNING OBJECTIVES
    4. STOP at ${targetWordCount + 50} words and close JSON

STUDY GUIDE STRUCTURE (${targetWordCount} words, ±50-100 tolerance):

    Format with CLEAR PARAGRAPHS:
    
    ${targetWordCount <= 1000 ? `
    For ${targetWordCount} words - Organize into 5-6 SHORT PARAGRAPHS:
    
    Paragraph 1 (80-100 words): Brief introduction
    - Define the topic in one sentence
    - Explain why it matters (2-3 sentences)
    - Preview main points
    
    Paragraphs 2-4 (200-250 words each): One paragraph per Learning Objective
    - Start with the learning objective concept
    - Explain core idea (3-4 SHORT sentences)
    - Provide ONE concrete example
    - Connect to Essential Knowledge point
    
    Paragraph 5 (80-100 words): Brief conclusion
    - Summarize key takeaways (3-4 sentences)
    - Link concepts together
    ` : targetWordCount <= 1500 ? `
    For ${targetWordCount} words - Organize into 6-8 CLEAR PARAGRAPHS:
    
    Paragraph 1 (100-120 words): Introduction
    - Define topic and context
    - State importance
    - Preview structure
    
    Paragraphs 2-4 (300-350 words each): One per major Learning Objective
    Each paragraph should:
    - Begin with clear topic sentence
    - Explain concept in 4-5 SHORT sentences (15-20 words each)
    - Include ONE specific example
    - Reference relevant Essential Knowledge
    - Use paragraph break before next concept
    
    Paragraph 5 (100-120 words): Conclusion
    - Recap main concepts
    - Synthesize connections
    ` : `
    For ${targetWordCount} words - Organize into 8-10 READABLE PARAGRAPHS:
    
    Introduction paragraph (120-150 words)
    
    3-4 main concept paragraphs (~${Math.floor((targetWordCount - 270) / 3)} words each):
    - Each paragraph = one Learning Objective
    - Short sentences throughout
    - Clear paragraph breaks between concepts
    
    Conclusion paragraph (120-150 words)
    `}
    
    READABILITY RULES:
    ✓ Paragraph break before each new Learning Objective
    ✓ Sentences: 15-20 words maximum (split long sentences)
    ✓ One idea per sentence
    ✓ Simple vocabulary (AP student level)
    ✓ Active voice preferred
    ✓ Concrete examples over abstract theory
    
    CED ALIGNMENT:
    ✓ Reference Learning Objectives by concept (not by number)
    ✓ Cover ALL Essential Knowledge points
    ✓ Use CED terminology exactly
    ✓ No content beyond CED scope
    ✓ Connect each paragraph to specific learning goal`;

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
        maxOutputTokens: 28000,  // v12.8.12: 增加到28000，但要求 AI 严格控制字数
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...(httpsAgent ? { httpsAgent, proxy: false } : {}),
      timeout: 120000  // v12.8.18: 增加到120秒（2分钟），提高稳定性
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      throw new Error('API 返回空响应');
    }

    let content: any;

    try {
      const jsonText = this.extractJSON(text);
      content = JSON.parse(jsonText);
      
      // 验证内容数量是否符合要求（允许 ±2 的误差）
      const actualFlashcards = content.flashcards?.length || 0;
      const actualQuiz = content.quiz?.length || 0;
      
      if (actualFlashcards < flashcardCount - 2 || actualQuiz < quizCount - 2) {
        console.warn(`   ⚠️  内容数量不足: flashcards ${actualFlashcards}/${flashcardCount}, quiz ${actualQuiz}/${quizCount}`);
        throw new Error(`内容被截断（flashcards: ${actualFlashcards}/${flashcardCount}, quiz: ${actualQuiz}/${quizCount}）`);
      }
      
      // v12.8.4: 第一次解析成功，跳到转换逻辑
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
        
        // 2. 修复常见的引号问题（v12.8.11: 增强版）
        // a) 替换中文引号和特殊引号
        fixedJson = fixedJson
          .replace(/"/g, '"')
          .replace(/"/g, '"')
          .replace(/'/g, "'")
          .replace(/'/g, "'");
        
        // b) 修复字符串值中未转义的双引号
        // 使用更健壮的正则表达式
        fixedJson = fixedJson.replace(
          /"(explanation|question_text|front|back|question|study_guide)":\s*"((?:[^"\\]|\\.)*)"/g,
          (match, key, value) => {
            // 确保内部引号被转义
            const escapedValue = value
              .replace(/\\"/g, '__ESCAPED_QUOTE__')  // 保护已转义的引号
              .replace(/"/g, '\\"')                   // 转义未转义的引号
              .replace(/__ESCAPED_QUOTE__/g, '\\"');  // 恢复已转义的引号
            return `"${key}": "${escapedValue}"`;
          }
        );
        
        // 3. 修复数组/对象中的换行符
        fixedJson = fixedJson.replace(/[\r\n]+/g, ' ');
        
        // 4. 修复连续的多个空格
        fixedJson = fixedJson.replace(/\s{2,}/g, ' ');
        
        // 5. 修复已转义但仍有问题的换行符
        fixedJson = fixedJson.replace(/\\n\\n+/g, '\\n');
        
        // ========== 尝试解析修复后的 JSON ==========
        
        content = JSON.parse(fixedJson);
        
        // 再次验证数量
        const actualFlashcards = content.flashcards?.length || 0;
        const actualQuiz = content.quiz?.length || 0;
        
        if (actualFlashcards < flashcardCount - 2 || actualQuiz < quizCount - 2) {
          console.warn(`   ⚠️  修复后内容数量仍不足: flashcards ${actualFlashcards}/${flashcardCount}, quiz ${actualQuiz}/${quizCount}`);
          throw new Error(`内容被截断（flashcards: ${actualFlashcards}/${flashcardCount}, quiz: ${actualQuiz}/${quizCount}）`);
        }
        
        console.log(`    ✅ Topic ${topic.topic_number} JSON 修复成功`);
      } catch (secondError: any) {
        // 修复也失败，记录详细信息
        console.error(`❌ Topic ${topic.topic_number} JSON 解析失败:`, parseError.message);
        console.error(`   原始响应前 500 字符:`, text.substring(0, 500));
        console.error(`   原始响应后 500 字符:`, text.substring(Math.max(0, text.length - 500)));
        throw new Error(`JSON 解析失败: ${parseError.message}`);
      }
    }
    
    // ========== 统一的字段转换逻辑 (v12.8.4) ==========
    // 无论是第一次解析成功还是修复后成功，都执行此转换
        
        // v12.6: 结合 AI 判断和 checkRequiresImage 规则（取并集）
        // v12.8: 添加所有新字段
    // v12.8.4: 使用正确的字段名 front_content/back_content，并添加 card_id 和 topic_id
    const topicId = `ap_us_history_${topic.topic_number.replace('.', '_')}`;
    const flashcards = (content.flashcards || []).map((card: any, cardIdx: number) => {
          const imageNeeded = card.requires_image || this.checkRequiresImage('flashcard', card.front, card.back);
          const difficulty = card.difficulty || this.calculateDifficultyLevel({
            question: card.front,
            options: [],
            explanation: card.back
          });
      
      // Map card_type to correct format
      let mappedCardType = card.card_type || 'Concept-Explanation';
      if (mappedCardType === 'Term-Definition') mappedCardType = 'definition';
      else if (mappedCardType === 'Concept-Explanation') mappedCardType = 'concept';
      else if (mappedCardType === 'Scenario/Question-Answer') mappedCardType = 'application';
          
          // v12.8.3: 只保留 image_suggested，移除 requires_image
      // v12.8.8: 移除 card_id 和 topic_id（不需要在 complete JSON 中）
        return {
        card_type: mappedCardType,
        front_content: card.front,
        back_content: card.back,
            difficulty: difficulty,
            image_suggested: imageNeeded,
            image_suggestion_description: null,
            version: '1.0.0',
            status: 'draft'
          };
        });
        
    // v12.8.4: 修改 quiz 格式，添加 quiz_id 和 topic_id，使用 question_text，options 改为对象格式
    const quiz = (content.quiz || []).map((q: any, qIdx: number) => {
          const imageNeeded = q.requires_image || this.checkRequiresImage('quiz', q.question, q.explanation);
          const difficultyLevel = q.difficulty_level || this.calculateDifficultyLevel(q);
      
      // Convert options from array to object format {A, B, C, D}
      let optionsObj: { A: string; B: string; C: string; D: string };
      if (Array.isArray(q.options)) {
        optionsObj = {
          A: q.options[0] || '',
          B: q.options[1] || '',
          C: q.options[2] || '',
          D: q.options[3] || ''
        };
      } else {
        optionsObj = q.options || { A: '', B: '', C: '', D: '' };
      }
          
          // v12.8.3: 只保留 image_suggested，移除 requires_image
      // v12.8.8: 移除 quiz_id 和 topic_id（不需要在 complete JSON 中）
          return {
        difficulty_level: difficultyLevel,
        question_text: q.question,
        options: optionsObj,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            image_suggested: imageNeeded,
            image_suggestion_description: null,
            version: '1.0.0',
            status: 'draft'
          };
        });
        
        // v12.8.3: study_guide 改为对象格式，包含完整的元数据
    // v12.8.4: 添加 study_guide_id 和 topic_id
    // v12.8.8: 移除 study_guide_id 和 topic_id（不需要在 complete JSON 中）
        const studyGuideText = content.study_guide || '';
        const wordCount = this.calculateWordCount(studyGuideText);
        const studyGuide = studyGuideText ? {
          content_markdown: studyGuideText,
          word_count: wordCount,
          reading_minutes: this.calculateReadingMinutes(wordCount),
          version: '1.0',
          status: 'draft'
        } : null;
        
        return {
          study_guide: studyGuide,
          flashcards,
          quiz
        };
  }

  /**
   * 格式化 ced_class_periods
   * v12.8.13: 移除波浪线，标准化大小写（首字母大写，其他小写）
   * 输入: "~17-23 CLASS PERIODS" 或 "~17-23 Class Periods"
   * 输出: "17-23 Class Periods"
   */
  private formatCedClassPeriods(rawPeriods: string): string {
    if (!rawPeriods) return '';
    
    // 移除开头的波浪线
    let formatted = rawPeriods.replace(/^~\s*/, '');
    
    // 标准化 "Class Periods" 的大小写（不区分输入格式）
    formatted = formatted.replace(
      /(class\s+periods)/gi,
      'Class Periods'
    );
    
    return formatted;
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
  async convertToDualJSON(courseData: APCourse): Promise<DualJSONOutput> {
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
    // v12.8.5: 改为 for...of 以支持 async SAQ/FRQ 生成
    for (const unit of courseData.units) {
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
        // v12.8.3: study_guide 现在是一个对象，包含 content_markdown 和元数据
        // v12.8.4: 使用 _learn 后缀而不是 _sg，与 complete JSON 格式保持一致
        if (topic.study_guide) {
          studyGuides.push({
            study_guide_id: `${topicId}_learn`,
            topic_id: topicId,
            content_markdown: topic.study_guide.content_markdown,
            word_count: topic.study_guide.word_count,
            reading_minutes: topic.study_guide.reading_minutes,
            version: topic.study_guide.version,
            status: topic.study_guide.status
          });
        }

        // Flashcards
        // v12.8.4: 更新为使用新字段名 front_content/back_content
        if (topic.flashcards && topic.flashcards.length > 0) {
          topic.flashcards.forEach((card, cardIdx) => {
            topicFlashcards.push({
              card_id: `${topicId}_fc_${String(cardIdx + 1).padStart(3, '0')}`,
              topic_id: topicId,
              card_type: card.card_type,
              front_content: card.front_content,
              back_content: card.back_content,
              difficulty: card.difficulty,
              image_suggested: card.image_suggested,
              image_suggestion_description: card.image_suggestion_description,
              version: card.version,
              status: card.status
            });
          });
        }

        // Quiz Questions
        // v12.8.4: 更新为使用新字段名 question_text，options 为对象格式
        if (topic.quiz && topic.quiz.length > 0) {
          topic.quiz.forEach((q, qIdx) => {
            quizzes.push({
              quiz_id: `${topicId}_q_${String(qIdx + 1).padStart(3, '0')}`,
              topic_id: topicId,
              question_text: q.question_text,
              option_a: q.options.A || '',
              option_b: q.options.B || '',
              option_c: q.options.C || '',
              option_d: q.options.D || '',
              correct_answer: q.correct_answer,
              explanation: q.explanation,
              difficulty_level: q.difficulty_level,
              image_suggested: q.image_suggested,
              image_suggestion_description: q.image_suggestion_description,
              version: q.version,
              status: q.status
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
        // v12.8.5: 减少 MCQ 数量为 15-17，为 SAQ/FRQ 留出空间
        const mcqCount = Math.min(17, Math.max(15, unitQuizzes.length));
        const selectedQuizzes = this.selectRandomQuizzes(unitQuizzes, mcqCount);

        // v12.8.5: 生成 SAQ 和 FRQ 题目
        console.log(`    📝 为 Unit ${unit.unit_number} 生成 SAQ/FRQ 题目...`);
        const saqFrqQuestions = await this.generateSAQandFRQ(unit, courseId);
        
        // 计算总题数和时间
        const totalQuestions = selectedQuizzes.length + saqFrqQuestions.length;
        const mcqMinutes = Math.round(selectedQuizzes.length * 1.5);
        const saqFrqMinutes = saqFrqQuestions.length * 8; // SAQ/FRQ 平均 8 分钟每题
        const totalMinutes = mcqMinutes + saqFrqMinutes;

        // v12.8: 生成符合数据库表格式的unit_test信息
        const unitTestInfo = {
          test_id: testId,
          unit_id: unitId,
          course_id: courseId,
          title: `Unit ${unit.unit_number} Progress Check: ${unit.unit_title}`,
          description: this.generateTestDescription(unit),
          recommended_minutes: totalMinutes,
          total_questions: totalQuestions,
          version: '1.0.0',
          status: 'draft'
        };

        // 添加到扁平化的unit_tests数组（用于separated_content_json）
        unitTests.push(unitTestInfo);

        // v12.8.3: 同时添加到unit对象中（用于combined_complete_json）
        // 不包含自动生成的 ID（test_id, course_id, unit_id）
        unit.unit_test = {
          title: unitTestInfo.title,
          description: unitTestInfo.description,
          recommended_minutes: unitTestInfo.recommended_minutes,
          total_questions: unitTestInfo.total_questions,
          version: unitTestInfo.version,
          status: unitTestInfo.status
        };

        // v12.8.3: 生成test_questions
        // separated_content_json 使用 UnitAssessmentQuestion[]（包含所有ID）
        // combined_complete_json 使用简化版本（不包含自动生成的ID）
        const currentUnitQuestions: any[] = [];

        selectedQuizzes.forEach((item, idx) => {
          const q = item.quiz;
          const topic = unit.topics.find(t => `${courseId}_${t.topic_number.replace('.', '_')}` === item.topicId);
          
          // v12.8.4: 根据题型动态构建对象
          const questionType = q.question_type || 'mcq';
          
          // 用于 separated_content_json 的完整对象（包含所有 ID）
          const questionObjForSeparated: UnitAssessmentQuestion = {
            question_id: `${testId}_q_${String(idx + 1).padStart(3, '0')}`,
            test_id: testId,
            question_number: idx + 1,
            question_type: questionType,
            difficulty_level: this.calculateDifficultyLevel(q),
            ap_alignment: topic?.topic_number || `${unit.unit_number}.${idx + 1}`,
            source: 'PrepGo Original AP-Style',
            question_text: q.question_text || q.question,
            image_suggested: q.image_suggested || false
          };
          
          // 根据题型添加对应字段
          if (questionType === 'mcq') {
            questionObjForSeparated.options = Array.isArray(q.options) ? {
              A: q.options[0] || '',
              B: q.options[1] || '',
              C: q.options[2] || '',
              D: q.options[3] || ''
            } : q.options;
            questionObjForSeparated.correct_answer = q.correct_answer;
            questionObjForSeparated.explanation = q.explanation;
          } else if (questionType === 'saq' || questionType === 'frq') {
            if (q.stimulus_type) questionObjForSeparated.stimulus_type = q.stimulus_type;
            if (q.stimulus) questionObjForSeparated.stimulus = q.stimulus;
            if (q.rubric) questionObjForSeparated.rubric = q.rubric;
            if (questionType === 'frq' && q.parts) {
              questionObjForSeparated.parts = q.parts;
            }
          }
          
          // v12.8.3: 用于 combined_complete_json 的对象（不包含自动生成的 ID）
          // 支持 MCQ, SAQ, FRQ 不同题型
          // v12.8.4: 根据题型动态添加字段（questionType 已在上方定义）
          
          const questionObjForCombined: any = {
            question_number: idx + 1,
            question_type: questionType,
            difficulty_level: this.calculateDifficultyLevel(q),
            ap_alignment: topic?.topic_number || `${unit.unit_number}.${idx + 1}`,
            source: 'PrepGo Original AP-Style',
            image_suggested: q.image_suggested || false
          };
          
          // 根据题型添加对应字段
          if (questionType === 'mcq') {
          // MCQ 特有字段
            questionObjForCombined.question_text = q.question_text || q.question;
            questionObjForCombined.options = Array.isArray(q.options) ? {
            A: q.options[0] || '',
            B: q.options[1] || '',
            C: q.options[2] || '',
            D: q.options[3] || ''
            } : q.options;
          questionObjForCombined.correct_answer = q.correct_answer;
          questionObjForCombined.explanation = q.explanation;
          } else if (questionType === 'saq' || questionType === 'frq') {
            // SAQ/FRQ 特有字段
            if (q.stimulus_type) questionObjForCombined.stimulus_type = q.stimulus_type;
            if (q.stimulus) questionObjForCombined.stimulus = q.stimulus;
            questionObjForCombined.question_text = q.question_text || q.question;
            if (q.rubric) questionObjForCombined.rubric = q.rubric;
            
            // FRQ 的多部分
            if (questionType === 'frq' && q.parts) {
              questionObjForCombined.parts = q.parts;
            }
          }
          
          // 添加到separated_content_json的数组
          unitAssessmentQuestions.push(questionObjForSeparated);
          // 添加到combined_complete_json的unit数组
          currentUnitQuestions.push(questionObjForCombined as any);
        });
        
        // v12.8.5: 添加 SAQ 和 FRQ 题目
        saqFrqQuestions.forEach((q, idx) => {
          const questionNumber = selectedQuizzes.length + idx + 1;
          const questionType = q.question_type || 'saq';
          
          // 获取相关 topic（使用第一个 topic 作为默认对齐）
          const firstTopic = unit.topics[0];
          const apAlignment = q.ap_alignment || firstTopic?.topic_number || `${unit.unit_number}.1`;
          
          // 用于 separated_content_json 的完整对象（包含所有 ID）
          const questionObjForSeparated: UnitAssessmentQuestion = {
            question_id: `${testId}_q_${String(questionNumber).padStart(3, '0')}`,
            test_id: testId,
            question_number: questionNumber,
            question_type: questionType,
            difficulty_level: q.difficulty_level || 7,
            ap_alignment: apAlignment,
            source: 'PrepGo Original AP-Style',
            question_text: q.question_text,
            image_suggested: false
          };
          
          // 添加 SAQ/FRQ 特有字段
          if (q.stimulus_type) questionObjForSeparated.stimulus_type = q.stimulus_type;
          if (q.stimulus) questionObjForSeparated.stimulus = q.stimulus;
          if (q.rubric) questionObjForSeparated.rubric = q.rubric;
          if (q.parts) questionObjForSeparated.parts = q.parts;
          
          // 用于 combined_complete_json 的对象（不包含自动生成的 ID）
          const questionObjForCombined: any = {
            question_number: questionNumber,
            question_type: questionType,
            difficulty_level: q.difficulty_level || 7,
            ap_alignment: apAlignment,
            source: 'PrepGo Original AP-Style',
            image_suggested: false
          };
          
          // 添加 SAQ/FRQ 特有字段
          if (q.stimulus_type) questionObjForCombined.stimulus_type = q.stimulus_type;
          if (q.stimulus) questionObjForCombined.stimulus = q.stimulus;
          questionObjForCombined.question_text = q.question_text;
          if (q.rubric) questionObjForCombined.rubric = q.rubric;
          if (q.parts) questionObjForCombined.parts = q.parts;
          
          // 添加到数组
          unitAssessmentQuestions.push(questionObjForSeparated);
          currentUnitQuestions.push(questionObjForCombined);
        });
        
        // v12.8: 将test_questions添加到unit对象（用于combined_complete_json）
        unit.test_questions = currentUnitQuestions;
      }
    }

    // v12.8.3: 清理临时字段（在返回之前）
    // 移除 topic 中的临时字段：learn, review, practice, topic_estimated_minutes
    courseData.units.forEach(unit => {
      unit.topics.forEach((topic: any) => {
        delete topic.learn;
        delete topic.review;
        delete topic.practice;
        delete topic.topic_estimated_minutes;
      });
    });

    // v12.8.6: 生成课程级别的 Mock Exam
    console.log(`\n📝 生成课程 Mock Exam...`);
    const mockExam = await this.generateMockExam(courseData, courseId);
    if (mockExam) {
      courseData.mock_exam = mockExam;
    }

    // v12.8.16: 在输出前格式化所有 ced_class_periods
    courseData.units.forEach(unit => {
      // 格式化 unit 级别的 ced_class_periods
      if (unit.ced_class_periods) {
        unit.ced_class_periods = this.formatCedClassPeriods(unit.ced_class_periods);
      }
      // 格式化 unit_overview 中的 ced_class_periods
      if (unit.unit_overview?.ced_class_periods) {
        unit.unit_overview.ced_class_periods = this.formatCedClassPeriods(unit.unit_overview.ced_class_periods);
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

  /**
   * v12.8: 生成单元测试描述
   * 基于unit的topics生成一段简短的测试描述
   */
  private generateTestDescription(unit: any): string {
    // 提取前3-4个topic的标题来生成描述
    const topicTitles = unit.topics.slice(0, 4).map((t: any) => t.topic_title);
    const topicSummary = topicTitles.join(', ');
    
    // 根据unit标题生成通用描述
    return `This test assesses your understanding of ${unit.unit_title.toLowerCase()}. Questions will cover key concepts including ${topicSummary}, and related topics from this unit.`;
  }

  /**
   * v12.8: 计算题目难度等级（1-10）
   * 基于题目长度、选项复杂度等启发式规则估算
   */
  private calculateDifficultyLevel(question: any): number {
    let difficulty = 5; // 基础难度
    
    // 题目长度：越长越难
    const questionLength = question.question ? question.question.length : 0;
    if (questionLength > 200) difficulty += 1;
    if (questionLength > 300) difficulty += 1;
    
    // 选项长度：平均选项越长越难（仅对有选项的题目）
    if (question.options && question.options.length > 0) {
      const avgOptionLength = question.options.reduce((sum: number, opt: string) => 
        sum + opt.length, 0) / question.options.length;
      if (avgOptionLength > 100) difficulty += 1;
    }
    
    // 解释长度：需要长解释说明通常较难
    if (question.explanation && question.explanation.length > 200) difficulty += 1;
    
    // 限制在1-10范围内
    return Math.max(1, Math.min(10, difficulty));
  }

  /**
   * v12.8: 计算文本字数
   * 支持中英文混合统计
   */
  private calculateWordCount(text: string): number {
    if (!text) return 0;
    
    // 移除Markdown语法标记
    const cleanText = text.replace(/[#*`\[\]()]/g, ' ');
    
    // 统计英文单词
    const englishWords = cleanText.match(/[a-zA-Z]+/g) || [];
    
    // 统计中文字符
    const chineseChars = cleanText.match(/[\u4e00-\u9fa5]/g) || [];
    
    // 英文单词数 + 中文字符数
    return englishWords.length + chineseChars.length;
  }

  /**
   * v12.8: 计算阅读时间（分钟）
   * 基于标准阅读速度：英文250词/分钟，中文300字/分钟
   */
  private calculateReadingMinutes(wordCount: number): number {
    // 假设平均阅读速度为275词/分钟（英文和中文的折中）
    const readingSpeed = 275;
    const minutes = Math.ceil(wordCount / readingSpeed);
    
    // 至少1分钟，最多30分钟（超过30分钟的study guide可能需要分段）
    return Math.max(1, Math.min(30, minutes));
  }

  /**
   * v12.8.6: 生成课程级别的 Mock Exam
   * 包含跨单元的综合性题目
   */
  private async generateMockExam(courseData: APCourse, courseId: string): Promise<any> {
    const courseName = courseData.course_name;
    const totalUnits = courseData.units.length;
    
    // 收集所有 units 的 topic 信息
    const allTopics = courseData.units.flatMap(unit => 
      unit.topics.map(topic => ({
        unit_number: unit.unit_number,
        topic_number: topic.topic_number,
        topic_title: topic.topic_title
      }))
    );
    
    const topicSummary = allTopics.slice(0, 10).map(t => 
      `${t.topic_number}. ${t.topic_title}`
    ).join('\n');
    
    // 从所有 units 的 quiz 中选择 MCQ 题目
    const allQuizzes: any[] = [];
    courseData.units.forEach(unit => {
      unit.topics.forEach(topic => {
        if (topic.quiz && Array.isArray(topic.quiz)) {
          topic.quiz.forEach(q => {
            allQuizzes.push({
              quiz: q,
              unit_number: unit.unit_number,
              topic_number: topic.topic_number
            });
          });
        }
      });
    });
    
    // 选择 45-50 个 MCQ（模拟真实 AP 考试）
    const selectedMCQCount = Math.min(50, Math.max(45, Math.floor(allQuizzes.length * 0.3)));
    const selectedMCQs = this.selectRandomQuizzes(
      allQuizzes.map((item, idx) => ({ ...item, qIdx: idx })),
      selectedMCQCount
    );
    
    // 使用 AI 生成 SAQ 和 FRQ
    const prompt = `You are an AP course assessment generator. Create a comprehensive Mock Exam for the entire course.

COURSE: ${courseName}
TOTAL UNITS: ${totalUnits}

KEY TOPICS (first 10):
${topicSummary}

Generate SAQ and FRQ questions in strict JSON format:

{
  "saq_questions": [
    {
      "question_type": "saq",
      "difficulty_level": 7-9,
      "ap_alignment": "cross-unit (e.g., 1.2, 3.4)",
      "stimulus_type": "text" | "image" | "chart",
      "stimulus": "Material for the question",
      "question_text": "Question with parts a, b, c",
      "rubric": "Detailed scoring rubric"
    }
  ],
  "frq_questions": [
    {
      "question_type": "frq",
      "difficulty_level": 9-10,
      "ap_alignment": "cross-unit",
      "question_text": "Comprehensive synthesis question",
      "rubric": "Detailed rubric with thesis, evidence, analysis requirements"
    }
  ]
}

REQUIREMENTS:
1. Generate EXACTLY 4 SAQ questions (covering different units)
2. Generate EXACTLY 2 FRQ questions (synthesis across multiple units)
3. Questions should test cross-unit connections and themes
4. SAQ and FRQ should be challenging and comprehensive
5. Return ONLY valid JSON`;

    try {
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const response = await axios.post(url, {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000  // v12.8.18: 添加120秒超时配置
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('AI 返回空响应');
      }

      const jsonText = this.extractJSON(text);
      const content = JSON.parse(jsonText);
      
      // 构建 mock questions
      const mockQuestions: any[] = [];
      let questionNumber = 1;
      
      // 添加 MCQ
      selectedMCQs.forEach((item) => {
        const q = item.quiz;
        const optionsObj = Array.isArray(q.options) ? {
          A: q.options[0] || '',
          B: q.options[1] || '',
          C: q.options[2] || '',
          D: q.options[3] || ''
        } : q.options;
        
        mockQuestions.push({
          question_number: questionNumber++,
          question_type: 'mcq',
          difficulty_level: q.difficulty_level || 5,
          ap_alignment: `${item.unit_number}.${item.topic_number}`,
          version: '1.0.0',
          status: 'draft',
          official_year: '2024',
          source: 'PrepGo Original AP-Style',
          question_text: q.question_text || q.question,
          options: optionsObj,
          correct_answer: q.correct_answer,
          explanation: q.explanation
        });
      });
      
      // 添加 SAQ
      if (content.saq_questions && Array.isArray(content.saq_questions)) {
        content.saq_questions.forEach((q: any) => {
          mockQuestions.push({
            question_number: questionNumber++,
            question_type: 'saq',
            difficulty_level: q.difficulty_level || 7,
            ap_alignment: q.ap_alignment || 'cross-unit',
            version: '1.0.0',
            status: 'draft',
            official_year: '2024',
            source: 'PrepGo Original AP-Style',
            stimulus_type: q.stimulus_type,
            stimulus: q.stimulus,
            question_text: q.question_text,
            rubric: q.rubric
          });
        });
      }
      
      // 添加 FRQ
      if (content.frq_questions && Array.isArray(content.frq_questions)) {
        content.frq_questions.forEach((q: any) => {
          mockQuestions.push({
            question_number: questionNumber++,
            question_type: 'frq',
            difficulty_level: q.difficulty_level || 9,
            ap_alignment: q.ap_alignment || 'cross-unit',
            version: '1.0.0',
            status: 'draft',
            official_year: '2024',
            source: 'PrepGo Original AP-Style',
            question_text: q.question_text,
            rubric: q.rubric
          });
        });
      }
      
      // 计算推荐时间
      const mcqMinutes = selectedMCQCount * 1.5;
      const saqMinutes = 4 * 15; // 4 SAQ * 15分钟
      const frqMinutes = 2 * 40; // 2 FRQ * 40分钟
      const totalMinutes = Math.round(mcqMinutes + saqMinutes + frqMinutes);
      
      console.log(`    ✅ Mock Exam 生成成功: ${mockQuestions.length} 题 (${selectedMCQCount} MCQ + 4 SAQ + 2 FRQ)`);
      
      return {
        title: `${courseName} - Full-Length Mock Exam`,
        description: `Comprehensive mock exam covering all ${totalUnits} units. Designed to simulate the actual AP exam experience with MCQ, SAQ, and FRQ sections.`,
        recommended_minutes: totalMinutes,
        total_questions: mockQuestions.length,
        version: '1.0.0',
        status: 'draft',
        official_year: '2024',
        mock_questions: mockQuestions
      };
      
    } catch (error: any) {
      console.error(`    ❌ Mock Exam 生成失败:`, error.message);
      return null;
    }
  }

  /**
   * v12.8.5: 生成 SAQ 和 FRQ 题目
   * 为单元测试生成简答题和论述题
   */
  private async generateSAQandFRQ(unit: any, courseId: string): Promise<any[]> {
    const unitTitle = unit.unit_title;
    const topicSummaries = unit.topics.map((t: any) => 
      `${t.topic_number}. ${t.topic_title}`
    ).join('\n');
    
    const prompt = `You are an AP course assessment generator. Create Short Answer Questions (SAQ) and Free Response Questions (FRQ) for a unit test.

UNIT: ${unitTitle}

TOPICS COVERED:
${topicSummaries}

Generate the following in strict JSON format:

{
  "saq_questions": [
    {
      "question_type": "saq",
      "difficulty_level": 6-8 (integer),
      "stimulus_type": "text" | "image" | "chart" | "map",
      "stimulus": "Primary source quote, data, or image description",
      "question_text": "Question with parts a, b, c clearly labeled",
      "rubric": "Detailed scoring rubric explaining how to earn each point"
    }
  ],
  "frq_question": {
    "question_type": "frq",
    "difficulty_level": 8-10 (integer),
    "question_text": "Comprehensive essay question requiring analysis and argumentation",
    "rubric": "Detailed scoring rubric with thesis, contextualization, evidence, and analysis requirements"
  }
}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 2 SAQ questions
2. Generate EXACTLY 1 FRQ question
3. ALL content MUST be in ENGLISH only
4. Return ONLY valid JSON - NO markdown backticks, NO extra text
5. SAQ questions should have 3 parts (a, b, c) testing different skills
6. FRQ should be a synthesis/evaluation question requiring extended response
7. Include specific, detailed rubrics for each question
8. Difficulty levels: SAQ (6-8), FRQ (8-10)
9. Stimulus should be relevant and realistic (quotes, data, scenarios)

EXAMPLE SAQ FORMAT:
{
  "question_type": "saq",
  "difficulty_level": 7,
  "stimulus_type": "text",
  "stimulus": "Quote from historical document or data set",
  "question_text": "a) Identify ONE example of X in the stimulus.\\nb) Explain how Y relates to Z.\\nc) Describe ONE consequence of the development mentioned.",
  "rubric": "a) 1 point for correctly identifying... b) 1 point for explaining the relationship... c) 1 point for describing a specific consequence..."
}

EXAMPLE FRQ FORMAT:
{
  "question_type": "frq", 
  "difficulty_level": 9,
  "question_text": "Evaluate the extent to which [topic] was significant in [context].",
  "rubric": "Thesis (1 pt): Must make a historically defensible claim... Contextualization (1 pt)... Evidence (2 pts)... Analysis (2 pts)..."
}`;

    try {
      // 调用 Gemini API
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const response = await axios.post(url, {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000  // v12.8.18: 添加120秒超时配置
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('AI 返回空响应');
      }

      const jsonText = this.extractJSON(text);
      const content = JSON.parse(jsonText);
      
      // 验证并返回题目数组
      const questions = [];
      
      if (content.saq_questions && Array.isArray(content.saq_questions)) {
        questions.push(...content.saq_questions);
      }
      
      if (content.frq_question) {
        questions.push(content.frq_question);
      }
      
      console.log(`    ✅ 生成 ${questions.length} 个 SAQ/FRQ 题目`);
      return questions;
    } catch (error: any) {
      console.error(`    ❌ 生成 SAQ/FRQ 失败:`, error.message);
      return [];
    }
  }
}

