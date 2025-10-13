/**
 * 完整课程生成 API
 * POST /api/generate-course
 * 
 * 功能：为整个课程的所有 Topics 生成学习内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { CourseGenerator } from '@/lib/course-generator';
import type { APCourse } from '@/types/course';

// Vercel 函数配置：设置最大执行时间为 60 秒
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseData } = body;

    if (!courseData || !courseData.units || courseData.units.length === 0) {
      return NextResponse.json(
        { success: false, error: '课程数据无效或缺失' },
        { status: 400 }
      );
    }

    console.log(`🚀 开始生成完整课程: ${courseData.course_name}`);
    console.log(`   📚 Units: ${courseData.units.length}`);
    console.log(`   📝 Topics: ${courseData.units.reduce((sum: number, u: any) => sum + u.topics.length, 0)}`);

    const startTime = Date.now();
    const generator = new CourseGenerator();

    // 使用流式响应实时推送进度
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 进度回调函数
          const onProgress = (message: string, percent?: number) => {
            const progressData = JSON.stringify({
              type: 'progress',
              message,
              percent: percent || 0,
              timestamp: Date.now()
            }) + '\n';
            controller.enqueue(encoder.encode(progressData));
          };

          // 执行完整生成流程
          const enhancedCourse = await generator.generateCompleteCourse(
            courseData as APCourse,
            onProgress
          );

          // v11.0: 转换为双 JSON 输出格式
          onProgress?.('转换为双 JSON 格式...', 98);
          const dualJSON = generator.convertToDualJSON(enhancedCourse);

          const generationTime = Date.now() - startTime;
          console.log(`✅ 课程生成完成，耗时: ${(generationTime / 1000).toFixed(1)}s`);

          // 计算统计信息（v12.0: 添加 card_type 分布）
          const totalTopics = dualJSON.combined_complete_json.units.reduce(
            (sum, unit) => sum + unit.topics.length, 0
          );
          const flashcards = dualJSON.separated_content_json.topic_flashcards;
          const statistics = {
            total_topics: totalTopics,
            total_flashcards: flashcards.length,
            total_quiz_questions: dualJSON.separated_content_json.quizzes.length,
            total_unit_tests: dualJSON.separated_content_json.unit_tests.length,
            flashcards_requiring_images: flashcards.filter(f => f.requires_image).length,
            quiz_questions_requiring_images: dualJSON.separated_content_json.quizzes.filter(q => q.requires_image).length,
            // v12.0: Flashcard 类型分布
            flashcard_types: {
              term_definition: flashcards.filter(f => f.card_type === 'Term-Definition').length,
              concept_explanation: flashcards.filter(f => f.card_type === 'Concept-Explanation').length,
              scenario_question: flashcards.filter(f => f.card_type === 'Scenario/Question-Answer').length,
            }
          };

          // 发送完成消息
          const completeData = JSON.stringify({
            type: 'complete',
            success: true,
            data: dualJSON,
            statistics,
            generationTime,
            timestamp: Date.now()
          }) + '\n';
          controller.enqueue(encoder.encode(completeData));
          controller.close();

        } catch (error) {
          console.error('❌ 课程生成失败:', error);
          
          const errorData = JSON.stringify({
            type: 'error',
            success: false,
            error: error instanceof Error ? error.message : '课程生成失败',
            timestamp: Date.now()
          }) + '\n';
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

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

