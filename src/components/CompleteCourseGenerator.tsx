'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import type { APCourse } from '@/types/course';
import { downloadJSON, generateFilename } from '@/lib/utils';

interface CompleteCourseGeneratorProps {
  courseData: APCourse;
  onComplete?: (enhancedCourse: APCourse) => void;
}

interface ProgressMessage {
  message: string;
  percent: number;
  timestamp: number;
}

export function CompleteCourseGenerator({ 
  courseData, 
  onComplete 
}: CompleteCourseGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatedCourse, setGeneratedCourse] = useState<APCourse | null>(null);

  const totalTopics = courseData.units.reduce((sum, unit) => sum + unit.topics.length, 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress([]);
    setError(null);
    setGeneratedCourse(null);

    try {
      const response = await fetch('/api/generate-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseData
        }),
      });

      if (!response.ok) {
        throw new Error('服务器响应错误');
      }

      // 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === 'progress') {
              setProgress(prev => [...prev, {
                message: data.message,
                percent: data.percent,
                timestamp: data.timestamp
              }]);
            } else if (data.type === 'complete') {
              console.log('✅ 课程生成完成');
              setGeneratedCourse(data.data);
              onComplete?.(data.data);
            } else if (data.type === 'error') {
              throw new Error(data.error || '生成失败');
            }
          } catch (parseError) {
            console.error('解析进度数据失败:', parseError);
          }
        }
      }

    } catch (err) {
      console.error('❌ 生成失败:', err);
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedCourse) return;
    const filename = generateFilename(generatedCourse.course_name, 'complete-with-ai-content');
    downloadJSON(generatedCourse, filename);
  };

  const currentProgress = progress.length > 0 ? progress[progress.length - 1] : null;

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500 rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            AI 完整课程生成
          </h3>
          <p className="text-sm text-gray-600">
            一键为所有 {totalTopics} 个 Topics 生成学习内容（Study Guide + Flashcards + Quiz）
          </p>
        </div>
      </div>

      {/* 生成按钮 */}
      {!generatedCourse && !generating && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`
            w-full py-4 px-6 rounded-lg font-medium text-white
            transition-all duration-200 transform
            ${generating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 hover:scale-[1.02] hover:shadow-lg'
            }
          `}
        >
          <span className="flex items-center justify-center gap-2">
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>开始生成完整课程</span>
              </>
            )}
          </span>
        </button>
      )}

      {/* 进度显示 */}
      {generating && currentProgress && (
        <div className="space-y-3">
          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700">{currentProgress.message}</span>
              <span className="text-gray-600">{currentProgress.percent}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${currentProgress.percent}%` }}
              />
            </div>
          </div>

          {/* 滚动日志 */}
          <div className="max-h-48 overflow-y-auto bg-white rounded-lg border border-gray-200 p-3 space-y-1">
            {progress.slice(-10).map((item, index) => (
              <div key={index} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString('zh-CN', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}
                </span>
                <span className="flex-1">{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">生成失败</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            
            {/* API 错误提示 */}
            {error.includes('Access denied') && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <p className="font-semibold mb-1">🔑 API Key 问题</p>
                <p>请检查 Qwen API Key 是否有效：</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>访问 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="underline">DashScope 控制台</a></li>
                  <li>检查账户余额和状态</li>
                  <li>更换 <code className="px-1 bg-yellow-100">src/lib/course-generator.ts</code> 中的 API Key</li>
                </ol>
                <p className="mt-2">详细说明请查看 <code className="px-1 bg-yellow-100">API_KEY_GUIDE.md</code></p>
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 成功提示 */}
      {generatedCourse && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-800">✅ 课程生成完成！</p>
              <p className="text-sm text-green-600 mt-1">
                已为 {totalTopics} 个 Topics 生成完整学习内容
              </p>
            </div>
          </div>

          {/* 下载和重新生成按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              下载完整 JSON
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              <Sparkles className="w-4 h-4" />
              重新生成
            </button>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {generatedCourse.units.length}
              </div>
              <div className="text-xs text-gray-600 mt-1">Units</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalTopics}
              </div>
              <div className="text-xs text-gray-600 mt-1">Topics</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {generatedCourse.units.reduce((sum, u) => 
                  sum + u.topics.filter(t => (t as any).study_guide).length, 0
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">已生成</div>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-gray-500 space-y-1 mt-4">
        <p>💡 <strong>提示：</strong>生成过程可能需要 5-10 分钟，取决于课程大小</p>
        <p>⚡ <strong>并发：</strong>使用 5 个并发 worker，自动重试失败的 Topics</p>
        <p>📊 <strong>内容：</strong>每个 Topic 包含 Study Guide、Flashcards、Quiz</p>
        <p>💰 <strong>优化：</strong>使用 qwen-plus 模型 + 精简 prompt，节省约 60% token 费用</p>
        <p>⚠️ <strong>注意：</strong>如遇 API 错误，请检查 Qwen API Key 是否有效</p>
      </div>
    </div>
  );
}

