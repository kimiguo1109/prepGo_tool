/**
 * AI 服务 - 通用 AI 调用接口
 * 用于未来生成学习内容（Study Guide, Flashcards, Quiz 等）
 * 
 * 注意：当前版本不使用 AI 进行 PDF 解析，仅保留此文件供未来扩展使用
 */

import OpenAI from 'openai';

// TODO: 将 API Key 移到环境变量
const QWEN_API_KEY = process.env.QWEN_API_KEY || 'sk-a0bced967e594452a0593fcdbf3fec48';

/**
 * AI 服务类
 * 提供通用的 AI 调用功能
 */
export class AIService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || QWEN_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  /**
   * 通用聊天完成接口
   * @param messages - 对话消息列表
   * @param options - 可选参数
   */
  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    } = {}
  ): Promise<string> {
    const {
      model = 'qwen-plus', // 使用 qwen-plus 节省成本
      temperature = 0.2,   // 降低 temperature
      maxTokens = 2000,    // 限制输出长度
      topP = 0.8,
    } = options;

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI 返回空响应');
      }

      return content;
    } catch (error) {
      console.error('AI 调用失败:', error);
      throw new Error(`AI 服务错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成 Study Guide
   */
  async generateStudyGuide(courseData: any): Promise<any> {
    const systemPrompt = `你是一个专业的AP课程学习指南生成专家。你的任务是为学生创建全面、清晰、实用的学习指南。

要求：
1. 总结每个单元的核心内容
2. 提炼关键概念和学习目标
3. 给出考试技巧和学习建议
4. 使用简洁明了的语言
5. 输出必须是有效的 JSON 格式`;

    const userPrompt = `基于以下AP课程数据，生成一份完整的学习指南：

课程名称: ${courseData.course_name}
单元数量: ${courseData.units.length}

每个单元包含：
${courseData.units.slice(0, 3).map((u: any) => `
- Unit ${u.unit_number}: ${u.unit_title}
  主题数: ${u.topics.length}
  学习目标数: ${u.topics.reduce((sum: number, t: any) => sum + t.learning_objectives.length, 0)}
  考试权重: ${u.exam_weight}
`).join('')}

请生成 JSON 格式的学习指南，包含：
{
  "overview": "课程总览",
  "units": [
    {
      "unitNumber": 1,
      "unitTitle": "单元标题",
      "summary": "单元摘要（200字内）",
      "keyPoints": ["要点1", "要点2", "要点3"],
      "examTips": ["考试技巧1", "考试技巧2"]
    }
  ],
  "studyTips": ["整体学习建议1", "学习建议2", "学习建议3"]
}

只返回 JSON，不要任何其他文字。`;

    const response = await this.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.7,
      maxTokens: 4000,
    });

    // 解析 JSON
    return this.parseJSONResponse(response);
  }

  /**
   * 生成 Flashcards
   */
  async generateFlashcards(courseData: any, unitNumber?: number): Promise<any[]> {
    const targetUnits = unitNumber 
      ? courseData.units.filter((u: any) => u.unit_number === unitNumber)
      : courseData.units.slice(0, 2); // 默认生成前2个单元

    const systemPrompt = `你是一个专业的学习闪卡生成专家。生成的闪卡应该：
1. 正面是清晰的问题或概念
2. 背面是简洁的答案或解释
3. 难度分级准确
4. 覆盖重要知识点
5. 输出必须是有效的 JSON 数组格式`;

    const userPrompt = `为以下AP课程单元生成学习闪卡：

${targetUnits.map((unit: any) => `
Unit ${unit.unit_number}: ${unit.unit_title}
主题：
${unit.topics.slice(0, 3).map((t: any) => `  - ${t.topic_title}`).join('\n')}
`).join('\n')}

请生成至少20张闪卡，JSON格式：
[
  {
    "front": "问题或概念",
    "back": "答案或解释",
    "unit": 1,
    "topic": "主题名称",
    "difficulty": "easy|medium|hard"
  }
]

只返回 JSON 数组，不要任何其他文字。`;

    const response = await this.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.8,
      maxTokens: 3000,
    });

    return this.parseJSONResponse(response);
  }

  /**
   * 生成 Quiz
   */
  async generateQuiz(courseData: any, unitNumber?: number): Promise<any> {
    const targetUnits = unitNumber 
      ? courseData.units.filter((u: any) => u.unit_number === unitNumber)
      : courseData.units.slice(0, 1); // 默认生成第一个单元

    const systemPrompt = `你是一个专业的AP课程测验生成专家。生成的测验应该：
1. 包含多种题型（选择题、判断题）
2. 难度分级合理
3. 覆盖重要知识点
4. 提供详细解释
5. 输出必须是有效的 JSON 格式`;

    const userPrompt = `为以下AP课程单元生成测验：

${targetUnits.map((unit: any) => `
Unit ${unit.unit_number}: ${unit.unit_title}
学习目标：
${unit.topics.flatMap((t: any) => t.learning_objectives).slice(0, 5).map((lo: any) => `  - ${lo.summary}`).join('\n')}
`).join('\n')}

请生成10-15道测验题，JSON格式：
{
  "title": "Unit X Quiz",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "问题",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correctAnswer": "选项A",
      "explanation": "解释",
      "difficulty": "medium",
      "points": 1
    }
  ]
}

只返回 JSON，不要任何其他文字。`;

    const response = await this.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.7,
      maxTokens: 3500,
    });

    return this.parseJSONResponse(response);
  }

  /**
   * 解析 AI 返回的 JSON
   */
  private parseJSONResponse(response: string): any {
    // 移除可能的 markdown 代码块
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/```$/, '').trim();
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/```$/, '').trim();
    }

    // 尝试提取 JSON
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.error('JSON 解析失败:', error);
        throw new Error('AI 返回的数据格式无效');
      }
    }

    throw new Error('AI 未返回有效的 JSON 数据');
  }
}

/**
 * 创建 AI 服务实例
 */
export function createAIService(apiKey?: string): AIService {
  return new AIService(apiKey);
}

