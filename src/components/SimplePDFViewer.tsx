'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

interface SimplePDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

/**
 * 简化的 PDF 查看器 - 使用浏览器原生功能
 * 避免 pdfjs-dist 在 Next.js 15 中的兼容性问题
 */
export function SimplePDFViewer({
  fileUrl,
  initialPage = 1,
  onPageChange,
}: SimplePDFViewerProps) {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(100);

  // 构建带页码的 PDF URL
  const pdfUrlWithPage = `${fileUrl}#page=${pageNumber}&zoom=${scale}`;

  function changePage(offset: number) {
    const newPage = pageNumber + offset;
    setPageNumber(newPage);
    onPageChange?.(newPage);
  }

  function changeZoom(delta: number) {
    const newScale = Math.max(50, Math.min(200, scale + delta));
    setScale(newScale);
  }

  function openInNewTab() {
    window.open(fileUrl, '_blank');
  }

  return (
    <div className="flex flex-col h-[800px] bg-gray-100">
      {/* 控制栏 */}
      <div className="flex items-center justify-between p-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="上一页"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-sm font-medium">
            <span>第</span>
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page) && page > 0) {
                  setPageNumber(page);
                  onPageChange?.(page);
                }
              }}
              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="当前页码"
            />
            <span>页</span>
          </div>

          <button
            onClick={() => changePage(1)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="下一页"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeZoom(-10)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <span className="text-sm font-medium min-w-[60px] text-center">
            {scale}%
          </span>

          <button
            onClick={() => changeZoom(10)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <button
            onClick={openInNewTab}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="在新标签页打开"
            title="在新标签页打开"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={pdfUrlWithPage}
          className="w-full h-full border-none"
          title="PDF Viewer"
        />
      </div>
    </div>
  );
}

