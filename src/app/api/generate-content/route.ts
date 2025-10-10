/**
 * 生成学习内容 API
 * POST /api/generate-content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAIService } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseData, unitNumber, contentType } = body;

    if (!courseData || !unitNumber || !contentType) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数' },
        { status: 400 }
      );
    }

    // 找到指定单元
    const unit = courseData.units.find((u: any) => u.unit_number === unitNumber);
    if (!unit) {
      return NextResponse.json(
        { success: false, error: `未找到单元 ${unitNumber}` },
        { status: 404 }
      );
    }

    console.log(`🤖 开始生成内容: Unit ${unitNumber} - ${contentType}`);
    const aiService = createAIService();
    const startTime = Date.now();

    let content;
    
    try {
      switch (contentType) {
        case 'study_guide':
          content = await aiService.generateStudyGuide(courseData);
          // 只返回当前单元的
          content = content.units?.find((u: any) => u.unitNumber === unitNumber);
          break;

        case 'flashcards':
          content = await aiService.generateFlashcards(courseData, unitNumber);
          break;

        case 'quiz':
          content = await aiService.generateQuiz(courseData, unitNumber);
          break;

        default:
          return NextResponse.json(
            { success: false, error: `不支持的内容类型: ${contentType}` },
            { status: 400 }
          );
      }

      const generationTime = Date.now() - startTime;
      console.log(`✅ 生成完成: ${contentType} (${generationTime}ms)`);

      return NextResponse.json({
        success: true,
        data: content,
        contentType,
        unitNumber,
        generationTime,
      });

    } catch (aiError) {
      console.error(`❌ AI 生成失败:`, aiError);
      return NextResponse.json({
        success: false,
        error: aiError instanceof Error ? aiError.message : 'AI 生成失败',
        contentType,
        unitNumber,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('处理错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '请求处理失败'
      },
      { status: 500 }
    );
  }
}
