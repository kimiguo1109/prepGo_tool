/**
 * 完整课程生成 API
 * POST /api/generate-course
 * 
 * 功能：为整个课程的所有 Topics 生成学习内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { CourseGenerator } from '@/lib/course-generator';
import type { APCourse } from '@/types/course';
import { writeFile } from 'fs/promises';
import path from 'path';

// Vercel 函数配置：设置最大执行时间（v12.8.18: 增加到 900 秒 = 15 分钟）
// 大型课程（80+ topics）需要更长时间
export const maxDuration = 900;

/**
 * v12.8.20: Fallback 保存机制
 * 当客户端连接断开时，将生成的课程数据保存到文件系统
 */
async function saveCourseToFallback(
  dualJSON: any,
  courseName: string,
  statistics: any,
  generationTime: number
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `${courseName.toLowerCase().replace(/\s+/g, '_')}_fallback_${timestamp}.json`;
    const fallbackDir = path.join(process.cwd(), 'output', 'fallback');
    const filePath = path.join(fallbackDir, fileName);
    
    // 创建fallback目录（如果不存在）
    const { mkdir } = await import('fs/promises');
    await mkdir(fallbackDir, { recursive: true });
    
    // 保存完整数据
    const fallbackData = {
      ...dualJSON,
      _metadata: {
        saved_at: new Date().toISOString(),
        course_name: courseName,
        statistics,
        generation_time_ms: generationTime,
        reason: 'Client connection lost during transmission'
      }
    };
    
    await writeFile(filePath, JSON.stringify(fallbackData, null, 2), 'utf-8');
    console.log(`💾 课程数据已保存到 Fallback 文件: ${filePath}`);
    console.log(`   📊 统计: ${statistics.total_topics} topics, ${statistics.total_flashcards} flashcards, ${statistics.total_quiz_questions} quiz questions`);
  } catch (error) {
    console.error('❌ 保存 Fallback 文件失败:', error);
  }
}

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
          // 进度回调函数（v12.8.18: 添加 controller 状态检查）
          const onProgress = (message: string, percent?: number) => {
            try {
              // 检查 controller 是否已关闭（超时或客户端断开）
              if (controller.desiredSize === null) {
                // Controller 已关闭，静默返回，不抛出错误
                return;
              }
              
              const progressData = JSON.stringify({
                type: 'progress',
                message,
                percent: percent || 0,
                timestamp: Date.now()
              }) + '\n';
              controller.enqueue(encoder.encode(progressData));
            } catch (err) {
              // 如果 enqueue 失败（controller 已关闭），静默忽略
              // 不中断生成流程
              console.warn('⚠️  进度更新失败（连接已断开）:', (err as Error).message);
            }
          };

          // 执行完整生成流程
          const enhancedCourse = await generator.generateCompleteCourse(
            courseData as APCourse,
            onProgress
          );

          // v11.0: 转换为双 JSON 输出格式
          // v12.8.5: convertToDualJSON 现在是 async（用于生成 SAQ/FRQ）
          // v12.8.21: 仅在连接未断开时发送进度更新
          if (controller.desiredSize !== null) {
            onProgress?.('转换为双 JSON 格式...', 98);
          }
          const dualJSON = await generator.convertToDualJSON(enhancedCourse);

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
            flashcards_requiring_images: flashcards.filter(f => f.image_suggested).length,  // v12.8: 使用image_suggested
            quiz_questions_requiring_images: dualJSON.separated_content_json.quizzes.filter(q => q.image_suggested).length,  // v12.8: 使用image_suggested
            // v12.0: Flashcard 类型分布
            // v12.8.4: 更新为新的类型名称
            flashcard_types: {
              term_definition: flashcards.filter(f => f.card_type === 'definition').length,
              concept_explanation: flashcards.filter(f => f.card_type === 'concept').length,
              scenario_question: flashcards.filter(f => f.card_type === 'application').length,
              person_event: flashcards.filter(f => f.card_type === 'person_event').length,
            }
          };

          // 发送完成消息（v12.8.21: 改进状态检查 + Fallback保存）
          // 先检查连接状态，避免在序列化期间连接断开
          const isConnected = controller.desiredSize !== null;
          
          if (isConnected) {
            // 连接正常，尝试发送
            try {
              // 再次检查状态（在序列化之前）
              if (controller.desiredSize !== null) {
                const completeData = JSON.stringify({
                  type: 'complete',
                  success: true,
                  data: dualJSON,
                  statistics,
                  generationTime,
                  timestamp: Date.now()
                }) + '\n';
                
                // 序列化成功，最后一次检查状态再发送
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(completeData));
                  controller.close();
                  console.log('✅ 完成消息已成功发送到客户端');
                } else {
                  // 序列化期间连接断开
                  console.warn('⚠️  序列化完成但连接已断开，保存到Fallback');
                  await saveCourseToFallback(dualJSON, courseData.course_name, statistics, generationTime);
                }
              } else {
                // 序列化前连接断开
                console.warn('⚠️  准备序列化时连接已断开，保存到Fallback');
                await saveCourseToFallback(dualJSON, courseData.course_name, statistics, generationTime);
              }
            } catch (err) {
              console.warn('⚠️  发送完成消息失败:', (err as Error).message);
              // 保存到fallback
              await saveCourseToFallback(dualJSON, courseData.course_name, statistics, generationTime);
            }
          } else {
            // v12.8.20: 连接已断开，直接保存到文件系统
            console.warn('⚠️  无法发送完成消息: 连接已断开（客户端超时或主动关闭）');
            await saveCourseToFallback(dualJSON, courseData.course_name, statistics, generationTime);
          }

        } catch (error) {
          console.error('❌ 课程生成失败:', error);
          
          // v12.8.21: 改进错误消息发送逻辑
          try {
            if (controller.desiredSize !== null) {
              const errorData = JSON.stringify({
                type: 'error',
                success: false,
                error: error instanceof Error ? error.message : '课程生成失败',
                timestamp: Date.now()
              }) + '\n';
              
              // 序列化成功，再次检查状态
              if (controller.desiredSize !== null) {
                controller.enqueue(encoder.encode(errorData));
                controller.close();
                console.log('✅ 错误消息已发送到客户端');
              } else {
                console.warn('⚠️  序列化完成但连接已断开，无法发送错误消息');
              }
            } else {
              console.warn('⚠️  无法发送错误消息: 连接已断开');
            }
          } catch (err) {
            console.warn('⚠️  发送错误消息失败:', (err as Error).message);
          }
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

