/**
 * Fallback课程文件管理 API
 * GET /api/fallback-courses - 列出所有fallback课程
 * GET /api/fallback-courses?file=xxx - 获取特定fallback课程数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('file');
    
    const fallbackDir = path.join(process.cwd(), 'output', 'fallback');
    
    // 如果指定了文件名，返回该文件的数据
    if (fileName) {
      try {
        const filePath = path.join(fallbackDir, fileName);
        const fileContent = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        return NextResponse.json({
          success: true,
          data: data.combined_complete_json,
          metadata: data._metadata,
          statistics: data._metadata?.statistics || {}
        });
      } catch (error) {
        console.error('读取Fallback文件失败:', error);
        return NextResponse.json(
          { success: false, error: '文件不存在或读取失败' },
          { status: 404 }
        );
      }
    }
    
    // 否则，列出所有fallback文件
    try {
      const files = await readdir(fallbackDir);
      const fallbackFiles = files
        .filter(f => f.includes('_fallback_') && f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // 最新的在前
      
      // 读取每个文件的metadata
      const filesWithMetadata = await Promise.all(
        fallbackFiles.map(async (file) => {
          try {
            const filePath = path.join(fallbackDir, file);
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            return {
              fileName: file,
              courseName: data._metadata?.course_name || 'Unknown',
              savedAt: data._metadata?.saved_at || '',
              generationTime: data._metadata?.generation_time_ms || 0,
              statistics: data._metadata?.statistics || {},
              reason: data._metadata?.reason || ''
            };
          } catch (err) {
            console.error(`读取文件 ${file} 的metadata失败:`, err);
            return null;
          }
        })
      );
      
      return NextResponse.json({
        success: true,
        files: filesWithMetadata.filter(f => f !== null)
      });
      
    } catch (error) {
      console.error('读取Fallback目录失败:', error);
      return NextResponse.json({
        success: true,
        files: []
      });
    }
    
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

