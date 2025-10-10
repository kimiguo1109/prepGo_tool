'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import type { APCourse } from '@/types/course';
import { copyToClipboard } from '@/lib/utils';

interface JSONViewerProps {
  data: APCourse;
  onNodeClick?: (path: string) => void;
}

/**
 * JSON 数据查看器组件
 */
export function JSONViewer({ data, onNodeClick }: JSONViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(['root', 'root.units'])
  );
  const [copied, setCopied] = useState(false);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(JSON.stringify(data, null, 2));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const traverse = (obj: any, path: string) => {
      allPaths.add(path);
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach((key) => {
          traverse(obj[key], `${path}.${key}`);
        });
      }
    };
    traverse(data, 'root');
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['root']));
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden h-[800px] flex flex-col">
      {/* 头部工具栏 */}
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <div>
          <h3 className="font-semibold text-gray-900">JSON 数据</h3>
          <p className="text-sm text-gray-500 mt-1">
            {data.units.length} 个单元 • 共{' '}
            {data.units.reduce((sum, unit) => sum + unit.topics.length, 0)} 个主题
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            展开全部
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            折叠全部
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制
              </>
            )}
          </button>
        </div>
      </div>

      {/* JSON 树形视图 */}
      <div className="p-4 overflow-auto flex-1 font-mono text-sm">
        <TreeNode
          data={data}
          path="root"
          label="course"
          expandedPaths={expandedPaths}
          onToggle={toggleExpand}
          onNodeClick={onNodeClick}
        />
      </div>
    </div>
  );
}

interface TreeNodeProps {
  data: any;
  path: string;
  label: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNodeClick?: (path: string) => void;
  level?: number;
}

function TreeNode({
  data,
  path,
  label,
  expandedPaths,
  onToggle,
  onNodeClick,
  level = 0,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(path);
  const hasChildren =
    data !== null &&
    typeof data === 'object' &&
    Object.keys(data).length > 0;

  const handleClick = () => {
    if (hasChildren) {
      onToggle(path);
    }
    // 始终触发点击事件
    if (onNodeClick) {
      console.log('🖱️ 点击了:', path, '- label:', label);
      onNodeClick(path);
    }
  };

  // 渲染值
  const renderValue = () => {
    if (data === null) return <span className="text-gray-500">null</span>;
    if (data === undefined) return <span className="text-gray-500">undefined</span>;
    if (typeof data === 'string')
      return <span className="text-green-600">&quot;{data}&quot;</span>;
    if (typeof data === 'number')
      return <span className="text-blue-600">{data}</span>;
    if (typeof data === 'boolean')
      return <span className="text-purple-600">{data.toString()}</span>;
    if (Array.isArray(data))
      return <span className="text-gray-600">[{data.length}]</span>;
    if (typeof data === 'object')
      return (
        <span className="text-gray-600">
          &#123;{Object.keys(data).length}&#125;
        </span>
      );
    return null;
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 hover:bg-gray-100 rounded cursor-pointer ${
          level === 0 ? '' : 'pl-' + level * 4
        }`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )
        ) : (
          <span className="w-4 inline-block flex-shrink-0" />
        )}
        <span className="text-blue-700 font-medium">{label}</span>
        <span className="text-gray-500">:</span>
        <span>{renderValue()}</span>
      </div>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <div>
          {Object.entries(data).map(([key, value]) => (
            <TreeNode
              key={`${path}.${key}`}
              data={value}
              path={`${path}.${key}`}
              label={key}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
