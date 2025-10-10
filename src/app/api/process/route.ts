/**
 * AP 课程数据处理 API
 * POST /api/process
 * 接收 PDF（展示用）和 JSON（数据处理用）文件
 * 包含 PDF 和 JSON 一致性验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAPCourseData } from '@/lib/data-processor';
import { validatePdfJsonConsistency } from '@/lib/validation';
import { APCourseSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdfFile') as File;
    const jsonFile = formData.get('jsonFile') as File;
    
    // 验证文件
    if (!pdfFile || !jsonFile) {
      return NextResponse.json(
        { success: false, error: 'PDF和JSON文件都是必需的' },
        { status: 400 }
      );
    }

    if (!pdfFile.name.endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'PDF文件格式不正确' },
        { status: 400 }
      );
    }

    if (!jsonFile.name.endsWith('.json')) {
      return NextResponse.json(
        { success: false, error: 'JSON文件格式不正确' },
        { status: 400 }
      );
    }

    // 读取JSON内容
    const jsonText = await jsonFile.text();
    let courseData;
    
    try {
      courseData = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON文件格式无效，无法解析' },
        { status: 400 }
      );
    }
    
    // 验证JSON数据结构
    const validation = APCourseSchema.safeParse(courseData);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'JSON数据结构验证失败',
        warnings: validation.error.issues.map(i => i.message),
      }, { status: 400 });
    }

    // ===== 新增：PDF 和 JSON 一致性验证 =====
    console.log('🔍 开始验证 PDF 和 JSON 一致性...');
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfBytes);
    
    const consistencyValidation = await validatePdfJsonConsistency(
      pdfBuffer,
      courseData
    );

    console.log('📊 一致性验证结果:', {
      isValid: consistencyValidation.isValid,
      matchScore: consistencyValidation.matchScore,
      errors: consistencyValidation.errors,
      warnings: consistencyValidation.warnings,
    });

    // 如果验证失败（匹配度过低），返回错误
    if (!consistencyValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'PDF 和 JSON 内容不一致，请确认上传的是同一门课程的文件',
        details: {
          pdfCourseName: consistencyValidation.pdfCourseName,
          jsonCourseName: consistencyValidation.jsonCourseName,
          matchScore: consistencyValidation.matchScore,
          errors: consistencyValidation.errors,
        },
        warnings: consistencyValidation.warnings,
      }, { status: 400 });
    }

    // 如果有警告但验证通过，记录警告
    if (consistencyValidation.warnings.length > 0) {
      console.warn('⚠️ 一致性验证警告:', consistencyValidation.warnings);
    }
    // ===== 一致性验证结束 =====

    // 处理数据（步骤2-3：计算+合并）
    const startTime = Date.now();
    const enrichedData = await processAPCourseData(courseData);
    const processingTime = Date.now() - startTime;

    // TODO: 保存PDF文件用于后续展示
    // 可以保存到临时目录或返回base64

    return NextResponse.json({
      success: true,
      data: enrichedData,
      processingTime,
      validation: {
        matchScore: consistencyValidation.matchScore,
        courseName: consistencyValidation.courseName,
      },
      warnings: consistencyValidation.warnings,
    });
  } catch (error) {
    console.error('处理错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '数据处理失败' 
      },
      { status: 500 }
    );
  }
}
