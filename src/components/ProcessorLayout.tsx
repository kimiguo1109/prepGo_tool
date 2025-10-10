'use client';

import { ReactNode } from 'react';
import { Header } from './Header';

interface ProcessorLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * 处理器页面布局组件
 */
export function ProcessorLayout({
  children,
  title,
  subtitle,
}: ProcessorLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title={title} subtitle={subtitle} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2025 PrepGo. 使用 Next.js 15 + TypeScript 5 构建
          </p>
        </div>
      </footer>
    </div>
  );
}
