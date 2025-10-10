'use client';

import { FileText } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

/**
 * 页面头部组件
 */
export function Header({
  title = 'PrepGo AP 课程处理工具',
  subtitle = '自动解析 AP 课程 PDF 文件并生成 JSON 结构化数据',
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
