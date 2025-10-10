'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

/**
 * PDF 查看器组件
 */
export function PDFViewer({
  fileUrl,
  initialPage = 1,
  onPageChange,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState<string>('');
  const [pageInput, setPageInput] = useState(String(initialPage));

  // 配置 PDF.js worker
  useEffect(() => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError('');
  }

  function onDocumentLoadError(error: Error) {
    setError('PDF 加载失败: ' + error.message);
  }

  function changePage(offset: number) {
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      setPageInput(String(newPage));
      onPageChange?.(newPage);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
      setPageInput(String(page));
      onPageChange?.(page);
    }
  }

  function handlePageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPageInput(e.target.value);
  }

  function handlePageInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const page = parseInt(pageInput, 10);
      if (!isNaN(page)) {
        goToPage(page);
      } else {
        setPageInput(String(pageNumber));
      }
    }
  }

  function handlePageInputBlur() {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      setPageInput(String(pageNumber));
    }
  }

  function changeZoom(delta: number) {
    const newScale = Math.max(0.5, Math.min(2.0, scale + delta));
    setScale(newScale);
  }

  return (
    <div className="flex flex-col h-[800px] bg-gray-100">
      {/* 控制栏 */}
      <div className="flex items-center justify-between p-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="上一页"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-sm font-medium">
            {numPages > 0 ? (
              <>
                <span>第</span>
                <input
                  type="text"
                  value={pageInput}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageInputKeyDown}
                  onBlur={handlePageInputBlur}
                  className="w-12 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="当前页码"
                />
                <span>页 / 共 {numPages} 页</span>
              </>
            ) : (
              <span className="min-w-[120px] text-center">加载中...</span>
            )}
          </div>

          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="下一页"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeZoom(-0.1)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => changeZoom(0.1)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div className="flex-1 overflow-hidden p-4">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="text-gray-500">加载 PDF 中...</div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="text-gray-500">渲染页面中...</div>
                  </div>
                }
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
