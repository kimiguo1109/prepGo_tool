'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, Download, FileJson } from 'lucide-react';
import type { APCourse, DualJSONOutput } from '@/types/course';
import { downloadJSON, generateFilename } from '@/lib/utils';

interface CompleteCourseGeneratorProps {
  courseData: APCourse;
  onComplete?: (dualJSON: DualJSONOutput) => void;
}

interface ProgressMessage {
  message: string;
  percent: number;
  timestamp: number;
}

interface GenerationStatistics {
  total_topics: number;
  total_flashcards: number;
  total_quiz_questions: number;
  total_unit_tests: number;
  flashcards_requiring_images: number;
  quiz_questions_requiring_images: number;
  // v12.0: Flashcard 类型分布
  flashcard_types?: {
    term_definition: number;
    concept_explanation: number;
    scenario_question: number;
  };
}

export function CompleteCourseGenerator({ 
  courseData, 
  onComplete 
}: CompleteCourseGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatedCourse, setGeneratedCourse] = useState<DualJSONOutput | null>(null);
  const [statistics, setStatistics] = useState<GenerationStatistics | null>(null);
  const [checkingFallback, setCheckingFallback] = useState(false);

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
              setStatistics(data.statistics);
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
      
      // v13.0: 生成失败后自动检查 Fallback 文件
      console.log('🔍 检测到生成失败，自动检查 Fallback 文件...');
      setTimeout(async () => {
        try {
          const response = await fetch('/api/fallback-courses');
          const result = await response.json();
          
          if (result.success && result.files && result.files.length > 0) {
            const matchingFile = result.files.find((f: any) => 
              f.courseName === courseData.course_name
            );
            
            if (matchingFile) {
              console.log('✅ 找到匹配的 Fallback 文件，自动加载中...');
              const dataResponse = await fetch(`/api/fallback-courses?file=${encodeURIComponent(matchingFile.fileName)}`);
              const dataResult = await dataResponse.json();
              
              if (dataResult.success) {
                const dualJSON: DualJSONOutput = {
                  combined_complete_json: dataResult.data,
                  separated_content_json: {
                    topic_overviews: [],
                    study_guides: [],
                    topic_flashcards: [],
                    quizzes: [],
                    unit_tests: [],
                    unit_assessment_questions: []
                  }
                };
                
                setGeneratedCourse(dualJSON);
                setStatistics(dataResult.statistics);
                setError(null);
                
                // 显示友好的自动恢复提示
                setProgress(prev => [...prev, {
                  message: `✅ 已自动恢复课程数据！虽然连接超时，但课程已成功生成并保存。`,
                  percent: 100,
                  timestamp: Date.now()
                }]);
                
                console.log('✅ Fallback 课程自动加载成功！');
              }
            }
          }
        } catch (fallbackErr) {
          console.error('自动检查 Fallback 失败:', fallbackErr);
        }
      }, 1000);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadSeparated = () => {
    if (!generatedCourse) return;
    const filename = generateFilename(courseData.course_name, 'separated');
    downloadJSON(generatedCourse.separated_content_json, filename);
  };

  const handleDownloadCombined = () => {
    if (!generatedCourse) return;
    const filename = generateFilename(courseData.course_name, 'complete');
    downloadJSON(generatedCourse.combined_complete_json, filename);
  };

  // v12.8.21: 检查并加载Fallback课程
  const handleCheckFallback = async () => {
    setCheckingFallback(true);
    try {
      // 1. 获取fallback文件列表
      const response = await fetch('/api/fallback-courses');
      const result = await response.json();
      
      if (!result.success || !result.files || result.files.length === 0) {
        alert('没有找到已保存的课程数据');
        return;
      }
      
      // 2. 找到最近的匹配课程（按课程名称匹配）
      const matchingFile = result.files.find((f: any) => 
        f.courseName === courseData.course_name
      );
      
      if (!matchingFile) {
        alert(`没有找到 "${courseData.course_name}" 的已保存数据\n\n可用的课程：\n${result.files.map((f: any) => `- ${f.courseName}`).join('\n')}`);
        return;
      }
      
      // 3. 加载该文件的数据
      const dataResponse = await fetch(`/api/fallback-courses?file=${encodeURIComponent(matchingFile.fileName)}`);
      const dataResult = await dataResponse.json();
      
      if (!dataResult.success) {
        alert('加载课程数据失败');
        return;
      }
      
      // 4. 设置到状态中
      const dualJSON: DualJSONOutput = {
        combined_complete_json: dataResult.data,
        separated_content_json: {
          topic_overviews: [],
          study_guides: [],
          topic_flashcards: [],
          quizzes: [],
          unit_tests: [],
          unit_assessment_questions: []
        }
      };
      
      setGeneratedCourse(dualJSON);
      setStatistics(dataResult.statistics);
      setError(null);
      
      alert(`✅ 成功加载已保存的课程！\n\n保存时间：${new Date(dataResult.metadata.saved_at).toLocaleString('zh-CN')}\n生成耗时：${(dataResult.metadata.generation_time_ms / 1000).toFixed(1)}秒`);
      
    } catch (err) {
      console.error('检查Fallback失败:', err);
      alert('检查已保存课程时出错');
    } finally {
      setCheckingFallback(false);
    }
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
        <div className="space-y-3">
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
            
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleGenerate}
                className="text-sm text-red-600 hover:text-red-800 underline font-medium"
              >
                重试
              </button>
            </div>
          </div>
        </div>
        
        {/* v12.8.21: Fallback恢复按钮 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FileJson className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">💡 提示：生成可能已完成</p>
              <p className="text-sm text-blue-600 mt-1">
                提示：主流程可能已完成，但连接超时。数据可能已自动保存到 Fallback 文件。
              </p>
              <p className="text-xs text-blue-500 mt-2">
                📊 提示: 主课程可能已成功生成，仅在转换为双 JSON 格式或发送数据时失败。
                目前已有自动备份机制，可直接导入保存的完整数据。
              </p>
              <button
                onClick={handleCheckFallback}
                disabled={checkingFallback}
                className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {checkingFallback ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>检查中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>检查已保存的课程</span>
                  </>
                )}
              </button>
            </div>
          </div>
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

          {/* 下载按钮 - v11.0 双 JSON */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadSeparated}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
              >
                <FileJson className="w-4 h-4" />
                新内容 JSON
              </button>
              <button
                onClick={handleDownloadCombined}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                完整 JSON
              </button>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              <Sparkles className="w-4 h-4" />
              重新生成
            </button>
          </div>

          {/* 统计信息 - v11.0 */}
          {statistics && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3 p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {statistics.total_topics}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Topics</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {statistics.total_flashcards}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Flashcards</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {statistics.total_quiz_questions}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Quiz 题目</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {statistics.total_unit_tests}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Unit Tests</div>
                </div>
              </div>
              
              {/* 图片需求统计 */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-xs font-semibold text-yellow-800 mb-2">📸 图片需求统计 (v12.6 AI+代码双重判断)</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Flashcards 需配图:</span>
                    <span className="font-medium text-yellow-700">
                      {statistics.flashcards_requiring_images}/{statistics.total_flashcards}
                      ({Math.round(statistics.flashcards_requiring_images / statistics.total_flashcards * 100)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quiz 需配图:</span>
                    <span className="font-medium text-yellow-700">
                      {statistics.quiz_questions_requiring_images}/{statistics.total_quiz_questions}
                      ({Math.round(statistics.quiz_questions_requiring_images / statistics.total_quiz_questions * 100)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* v12.0: Flashcard 类型分布 */}
              {statistics.flashcard_types && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-semibold text-blue-800 mb-2">🎴 Flashcard 类型分布 (v12.0)</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-blue-600">
                        {statistics.flashcard_types.term_definition}
                      </div>
                      <div className="text-gray-600 mt-1">Term-Definition</div>
                      <div className="text-gray-500 text-[10px]">
                        {Math.round(statistics.flashcard_types.term_definition / statistics.total_flashcards * 100)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-purple-600">
                        {statistics.flashcard_types.concept_explanation}
                      </div>
                      <div className="text-gray-600 mt-1">Concept-Explanation</div>
                      <div className="text-gray-500 text-[10px]">
                        {Math.round(statistics.flashcard_types.concept_explanation / statistics.total_flashcards * 100)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-green-600">
                        {statistics.flashcard_types.scenario_question}
                      </div>
                      <div className="text-gray-600 mt-1">Scenario/Question</div>
                      <div className="text-gray-500 text-[10px]">
                        {Math.round(statistics.flashcard_types.scenario_question / statistics.total_flashcards * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-gray-500 space-y-1 mt-4">
        <p>💡 <strong>提示：</strong>生成过程可能需要 5-10 分钟，取决于课程大小</p>
        <p>⚡ <strong>并发：</strong>使用 5 个并发 worker，自动重试失败的 Topics</p>
        <p>📊 <strong>内容：</strong>每个 Topic 包含 Study Guide、Flashcards、Quiz</p>
        <p>🤖 <strong>模型：</strong>使用 Gemini 2.5 Flash Lite 生成高质量内容</p>
        <p>⚠️ <strong>注意：</strong>需要设置 GEMINI_API_KEY 环境变量并配置代理</p>
      </div>
    </div>
  );
}

