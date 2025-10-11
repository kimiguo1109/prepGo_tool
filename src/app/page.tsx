'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, RefreshCw } from 'lucide-react';
import { ProcessorLayout } from '@/components/ProcessorLayout';
import { DualFileUpload } from '@/components/DualFileUpload';
import { UploadProgress } from '@/components/UploadProgress';
import { JSONViewer } from '@/components/JSONViewer';
import { LearningContentGenerator } from '@/components/LearningContentGenerator';
import { CompleteCourseGenerator } from '@/components/CompleteCourseGenerator';
import { useAppStore } from '@/store/useAppStore';
import { downloadJSON, generateFilename } from '@/lib/utils';
import type { EnrichedAPCourse } from '@/types/enriched-course';
import type { APCourse } from '@/types/course';

// 使用简化版 PDF 查看器，避免 pdfjs-dist 兼容性问题
const SimplePDFViewer = dynamic(
  () => import('@/components/SimplePDFViewer').then((mod) => ({ default: mod.SimplePDFViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-100">
        <p className="text-gray-500">加载 PDF 查看器...</p>
      </div>
    ),
  }
);

export default function HomePage() {
  const { uploadState, reset } = useAppStore();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [enrichedData, setEnrichedData] = useState<EnrichedAPCourse | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const { setUploadState } = useAppStore();

  // 处理 JSON 导出
  const handleExport = () => {
    if (!enrichedData) return;
    
    const filename = generateFilename(enrichedData.course_name, 'enriched');
    downloadJSON(enrichedData, filename);
  };

  // 处理学习内容生成完成
  const handleContentGenerated = (unitNumber: number, contentType: string, content: any) => {
    console.log(`✅ 生成完成: Unit ${unitNumber} - ${contentType}`);
    
    setEnrichedData(prev => {
      if (!prev) return prev;
      
      const newUnits = prev.units.map(unit => {
        if (unit.unit_number === unitNumber) {
          return {
            ...unit,
            learning_content: {
              ...unit.learning_content,
              [contentType]: content,
              generation_status: {
                ...unit.learning_content?.generation_status,
                study_guide: contentType === 'study_guide' ? 'completed' : unit.learning_content?.generation_status?.study_guide || 'pending',
                flashcards: contentType === 'flashcards' ? 'completed' : unit.learning_content?.generation_status?.flashcards || 'pending',
                quiz: contentType === 'quiz' ? 'completed' : unit.learning_content?.generation_status?.quiz || 'pending',
              },
            },
          };
        }
        return unit;
      });
      
      return { ...prev, units: newUnits };
    });
  };

  // 处理完整课程生成完成（v11.0 - 双 JSON 输出）
  const handleCompleteCourseGenerated = (dualJSON: any) => {
    console.log('✅ 完整课程生成完成（双 JSON 格式）');
    console.log('📦 Separated Content JSON:', dualJSON.separated_content_json);
    console.log('📦 Combined Complete JSON:', dualJSON.combined_complete_json);
    
    // v11.0: 双 JSON 格式已在 CompleteCourseGenerator 组件内处理下载
    // 不需要合并回原始数据结构
  };

  // 处理重置
  const handleReset = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl('');
    setEnrichedData(null);
    setValidationWarnings([]);
    reset();
  };

  // 处理双文件上传
  const handleFilesSelect = async (pdfFile: File, jsonFile: File) => {
    try {
      console.log('Selected files:', pdfFile.name, jsonFile.name);
      
      // 创建 PDF URL 用于预览
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);

      // 设置上传状态
      setUploadState({
        status: 'uploading',
        progress: 0,
        message: '正在上传文件...',
      });

      // 上传文件
      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('jsonFile', jsonFile);

      setUploadState({
        status: 'processing',
        progress: 30,
        message: '正在验证文件一致性...',
      });

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '处理失败');
      }

      setUploadState({
        status: 'processing',
        progress: 80,
        message: '正在计算统计数据...',
      });

      // 保存结果
      setEnrichedData(result.data);
      setValidationWarnings(result.warnings || []);

      console.log('✅ 处理成功:', result.data.course_name);
      console.log('📊 匹配分数:', result.validation?.matchScore);
      console.log('⚠️ 警告:', result.warnings);

      // 更新状态：完成
      setUploadState({
        status: 'success',
        progress: 100,
        message: '处理完成！',
      });

      // 显示成功提示，5秒后自动消失
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('❌ 处理失败:', error);
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '处理失败',
        error: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  return (
    <ProcessorLayout>
      <div className="space-y-8">
        {/* 步骤 1: 文件上传 */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              步骤 1: 上传文件
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              同时上传 AP 课程 PDF（用于对照展示）和 JSON 数据文件（用于数据处理）
            </p>
          </div>
          <DualFileUpload 
            onFilesSelect={handleFilesSelect} 
            disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'} 
          />
          {uploadState.status !== 'idle' && (
            <div className="mt-4">
              <UploadProgress uploadState={uploadState} />
            </div>
          )}
          
          {/* 错误提示 */}
          {uploadState.status === 'error' && uploadState.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">❌ {uploadState.error}</p>
              <button
                onClick={handleReset}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                重试
              </button>
            </div>
          )}

          {/* 验证警告 */}
          {validationWarnings.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ 验证警告：</p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                {validationWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 成功提示 */}
          {showSuccess && enrichedData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg transition-opacity duration-500 animate-fadeIn flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800 font-medium">
                  ✅ 成功处理 {enrichedData.course_name}！
                </p>
                <p className="text-xs text-green-600 mt-1">
                  包含 {enrichedData.units.length} 个单元，
                  {enrichedData.statistics.total_topics} 个主题，
                  {enrichedData.statistics.total_learning_objectives} 个学习目标
                </p>
              </div>
              <button
                onClick={() => setShowSuccess(false)}
                className="text-green-600 hover:text-green-800 transition-colors"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </section>

        {/* 步骤 2: PDF 预览和 JSON 对比 */}
        {pdfUrl && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                步骤 2: 预览与数据
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                左侧为 PDF 原文，右侧为增强的 JSON 数据（含统计信息）
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PDF 预览 */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <SimplePDFViewer 
                  fileUrl={pdfUrl} 
                  initialPage={currentPdfPage}
                  onPageChange={setCurrentPdfPage}
                />
              </div>

              {/* JSON 数据预览 */}
              <div className="flex flex-col">
                {enrichedData ? (
                  <>
                    <JSONViewer 
                      data={enrichedData}
                      onNodeClick={(path) => {
                        console.log('🔍 点击路径:', path);
                        
                        // 点击 unit_number 时跳转
                        const unitMatch = path.match(/units\.(\d+)(?:\.unit_number)?/);
                        if (unitMatch) {
                          const unitIndex = parseInt(unitMatch[1]);
                          const unit = enrichedData.units[unitIndex];
                          
                          if (unit?.start_page) {
                            console.log(`📍 跳转到 Unit ${unit.unit_number}: ${unit.unit_title} → 页码 ${unit.start_page}`);
                            setCurrentPdfPage(unit.start_page);
                          } else {
                            console.warn(`⚠️ Unit ${unit?.unit_number} 没有页码信息`);
                          }
                        }
                      }}
                    />
                    
                    
                    {/* AI 学习内容生成区域 */}
                    <div className="mt-6 space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI 学习内容生成</h3>
                        <p className="text-sm text-gray-600">
                          为整个课程或单独单元生成学习指南、闪卡和测验题
                        </p>
                      </div>

                      {/* 完整课程生成器 */}
                      <CompleteCourseGenerator
                        courseData={enrichedData as APCourse}
                        onComplete={handleCompleteCourseGenerated}
                      />

                      {/* 分隔线 */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">或单独生成每个单元</span>
                        </div>
                      </div>
                      
                      {/* 单元级生成器（保留原有功能） */}
                      <div className="space-y-4">
                        {enrichedData.units.map((unit) => (
                          <div key={unit.unit_number} className="space-y-2">
                            <div className="font-medium text-gray-800">
                              Unit {unit.unit_number}: {unit.unit_title}
                            </div>
                            <LearningContentGenerator
                              courseData={enrichedData}
                              unit={unit}
                              onContentGenerated={handleContentGenerated}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        重新上传
                      </button>
                      <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        导出 JSON
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center h-[800px] flex items-center justify-center">
                    <p className="text-gray-500">
                      上传文件后，增强的 JSON 数据将显示在这里
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 功能说明 */}
        {!pdfUrl && (
          <section className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              功能说明
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>上传 PDF + JSON 双文件输入（最大 50MB）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>自动验证 PDF 和 JSON 是否为同一课程（匹配度评分）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>计算课程统计数据（单元数、主题数、学习目标、知识点层级、考试权重等）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>实时预览 PDF 和增强 JSON 数据的对应关系</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>导出完整的 JSON 文件（含原始数据 + 统计数据）</span>
              </li>
            </ul>
          </section>
        )}
      </div>
    </ProcessorLayout>
  );
}
