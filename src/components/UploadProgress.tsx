'use client';

import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { UploadState } from '@/types/course';

interface UploadProgressProps {
  uploadState: UploadState;
  logs?: string[];
  onCancel?: () => void;
}

/**
 * 上传进度指示器组件
 */
export function UploadProgress({ uploadState, logs = [], onCancel }: UploadProgressProps) {
  const { status, progress, message, error } = uploadState;
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新日志
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // 成功状态不显示（使用 page.tsx 中的绿色提示）
  if (status === 'idle' || status === 'success') {
    return null;
  }

  return (
    <div className="fixed bottom-8 right-8 w-96 bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      {/* 状态图标和标题 */}
      <div className="flex items-center gap-3 mb-4">
        {status === 'uploading' || status === 'processing' ? (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        ) : (
          <XCircle className="w-6 h-6 text-red-500" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {status === 'uploading' && '上传中...'}
            {status === 'processing' && '解析中...'}
            {status === 'error' && '处理失败'}
          </h3>
          {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
        </div>
      </div>

      {/* 进度条 */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 详细日志 */}
      {logs.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>详细日志 ({logs.length})</span>
          </button>
          
          {showLogs && (
            <div className="mt-2 max-h-64 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`py-0.5 ${
                    log.includes('✅') ? 'text-green-600' :
                    log.includes('❌') ? 'text-red-600' :
                    log.includes('⚠️') ? 'text-yellow-600' :
                    log.includes('📄') || log.includes('📖') ? 'text-blue-600' :
                    'text-gray-700'
                  }`}
                >
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      {(status === 'uploading' || status === 'processing') && onCancel && (
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          取消
        </button>
      )}

      {status === 'error' && (
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
}
