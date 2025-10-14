/**
 * AI 服务 - 通用 AI 调用接口
 * 使用 Google Gemini 2.5 Flash Lite 生成学习内容
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

/**
 * AI 服务类
 * 提供通用的 AI 调用功能
 */
export class AIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || GEMINI_API_KEY;
    this.model = model || GEMINI_MODEL;
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
    } = {}
  ): Promise<string> {
    const {
      temperature = 0.2,
      maxTokens = 2000,
    } = options;

    try {
      // 转换消息格式为 Gemini 格式
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');

      // 合并 system 消息到第一个 user 消息
      let firstUserContent = '';
      if (systemMessage) {
        firstUserContent = `${systemMessage.content}\n\n`;
      }
      if (userMessages.length > 0) {
        firstUserContent += userMessages[0].content;
      }

      const geminiMessages = [
        {
          role: 'user',
          parts: [{ text: firstUserContent }]
        },
        ...userMessages.slice(1).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      ];

      // 调用 Gemini API
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const response = await axios.post(url, {
        contents: geminiMessages,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
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
    const systemPrompt = `You are a professional AP course study guide generator. Your task is to create comprehensive, clear, and practical study guides for students.

Requirements:
1. Summarize core content of each unit
2. Extract key concepts and learning objectives
3. Provide exam tips and study recommendations
4. Use clear and concise language
5. Output must be valid JSON format
6. ALL CONTENT MUST BE IN ENGLISH`;

    const userPrompt = `Based on the following AP course data, generate a complete study guide:

Course Name: ${courseData.course_name}
Number of Units: ${courseData.units.length}

Each unit contains:
${courseData.units.slice(0, 3).map((u: any) => `
- Unit ${u.unit_number}: ${u.unit_title}
  Topics: ${u.topics.length}
  Learning Objectives: ${u.topics.reduce((sum: number, t: any) => sum + t.learning_objectives.length, 0)}
  Exam Weight: ${u.exam_weight}
`).join('')}

Generate a JSON study guide with the following structure:
{
  "overview": "Course overview in English",
  "units": [
    {
      "unitNumber": 1,
      "unitTitle": "Unit title",
      "summary": "Unit summary in English (max 200 words)",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "examTips": ["Exam tip 1", "Exam tip 2"]
    }
  ],
  "studyTips": ["Overall study tip 1", "Study tip 2", "Study tip 3"]
}

IMPORTANT: Generate ALL content in ENGLISH only. Return only JSON, no other text.`;

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

    const systemPrompt = `You are a professional learning flashcard generator. The flashcards should:
1. Front: Clear question or concept
2. Back: Concise answer or explanation
3. Accurate difficulty grading
4. Cover important knowledge points
5. Output must be valid JSON array format
6. ALL CONTENT MUST BE IN ENGLISH`;

    const userPrompt = `Generate learning flashcards for the following AP course units:

${targetUnits.map((unit: any) => `
Unit ${unit.unit_number}: ${unit.unit_title}
Topics:
${unit.topics.slice(0, 3).map((t: any) => `  - ${t.topic_title}`).join('\n')}
`).join('\n')}

Generate at least 20 flashcards in JSON format:
[
  {
    "front": "Question or concept in English",
    "back": "Answer or explanation in English",
    "unit": 1,
    "topic": "Topic name",
    "difficulty": "easy|medium|hard"
  }
]

IMPORTANT: Generate ALL content in ENGLISH only. Return only JSON array, no other text.`;

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

    const systemPrompt = `You are a professional AP course quiz generator. The quiz should:
1. Include multiple question types (multiple choice, true/false)
2. Appropriate difficulty grading
3. Cover important knowledge points
4. Provide detailed explanations
5. Output must be valid JSON format
6. ALL CONTENT MUST BE IN ENGLISH`;

    const userPrompt = `Generate a quiz for the following AP course units:

${targetUnits.map((unit: any) => `
Unit ${unit.unit_number}: ${unit.unit_title}
Learning Objectives:
${unit.topics.flatMap((t: any) => t.learning_objectives).slice(0, 5).map((lo: any) => `  - ${lo.summary}`).join('\n')}
`).join('\n')}

Generate 10-15 quiz questions in JSON format:
{
  "title": "Unit X Quiz",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question in English",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explanation in English",
      "difficulty": "medium",
      "points": 1
    }
  ]
}

IMPORTANT: Generate ALL content in ENGLISH only. Return only JSON, no other text.`;

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

