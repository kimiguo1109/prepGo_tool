'use client';

import { useState } from 'react';
import { Sparkles, BookOpen, CreditCard, Brain, Check, Loader2, AlertCircle } from 'lucide-react';
import type { EnrichedAPCourse, EnrichedAPUnit } from '@/types/enriched-course';

interface LearningContentGeneratorProps {
  courseData: EnrichedAPCourse;
  unit: EnrichedAPUnit;
  onContentGenerated: (unitNumber: number, contentType: string, content: any) => void;
}

type ContentType = 'study_guide' | 'flashcards' | 'quiz';

export function LearningContentGenerator({
  courseData,
  unit,
  onContentGenerated,
}: LearningContentGeneratorProps) {
  const [generating, setGenerating] = useState<Record<ContentType, boolean>>({
    study_guide: false,
    flashcards: false,
    quiz: false,
  });

  const [errors, setErrors] = useState<Record<ContentType, string | null>>({
    study_guide: null,
    flashcards: null,
    quiz: null,
  });

  const contentConfig = {
    study_guide: {
      icon: BookOpen,
      label: '学习指南',
      description: 'AI生成的单元学习指南',
      color: 'blue',
    },
    flashcards: {
      icon: CreditCard,
      label: '闪卡',
      description: '20+张知识点闪卡',
      color: 'purple',
    },
    quiz: {
      icon: Brain,
      label: '测验',
      description: '10-15道测验题',
      color: 'green',
    },
  };

  const handleGenerate = async (contentType: ContentType) => {
    setGenerating(prev => ({ ...prev, [contentType]: true }));
    setErrors(prev => ({ ...prev, [contentType]: null }));

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseData,
          unitNumber: unit.unit_number,
          contentType,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }

      // 通知父组件更新数据
      onContentGenerated(unit.unit_number, contentType, result.data);

    } catch (error) {
      console.error(`生成${contentConfig[contentType].label}失败:`, error);
      setErrors(prev => ({
        ...prev,
        [contentType]: error instanceof Error ? error.message : '生成失败'
      }));
    } finally {
      setGenerating(prev => ({ ...prev, [contentType]: false }));
    }
  };

  const getStatus = (contentType: ContentType) => {
    return unit.learning_content?.generation_status[contentType] || 'pending';
  };

  const getContent = (contentType: ContentType) => {
    return unit.learning_content?.[contentType];
  };

  const renderButton = (contentType: ContentType) => {
    const config = contentConfig[contentType];
    const Icon = config.icon;
    const status = getStatus(contentType);
    const isGenerating = generating[contentType];
    const error = errors[contentType];
    const hasContent = getContent(contentType);

    const colorClasses = {
      blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
      purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
      green: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
    };

    return (
      <div key={contentType} className="space-y-2">
        <button
          onClick={() => handleGenerate(contentType)}
          disabled={isGenerating || status === 'generating'}
          className={`
            w-full p-4 rounded-lg border-2 transition-all
            flex items-center gap-3
            ${hasContent ? 'bg-gray-50 border-gray-300' : colorClasses[config.color as keyof typeof colorClasses]}
            ${isGenerating || status === 'generating' ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md'}
          `}
        >
          <div className="flex-shrink-0">
            {isGenerating || status === 'generating' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : hasContent ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 text-left">
            <div className="font-medium">{config.label}</div>
            <div className="text-xs opacity-75">
              {isGenerating || status === 'generating' 
                ? '正在生成...' 
                : hasContent 
                ? '已生成 - 点击重新生成'
                : config.description}
            </div>
          </div>

          {hasContent && !isGenerating && (
            <Sparkles className="w-4 h-4 text-yellow-500" />
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
        <Sparkles className="w-4 h-4 text-yellow-500" />
        <span>AI 学习内容生成</span>
      </div>

      {renderButton('study_guide')}
      {renderButton('flashcards')}
      {renderButton('quiz')}
    </div>
  );
}

