/**
 * 双文件上传组件
 * 支持同时上传 PDF 和 JSON 文件
 */

'use client';

import { useState } from 'react';
import { FileText, CheckCircle } from 'lucide-react';

interface DualFileUploadProps {
  onFilesSelect: (pdfFile: File, jsonFile: File) => void;
  maxSize?: number; // 字节
  disabled?: boolean;
}

export function DualFileUpload({ 
  onFilesSelect, 
  maxSize = 50 * 1024 * 1024,
  disabled = false 
}: DualFileUploadProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.pdf')) {
      setError('请选择 PDF 格式文件');
      return;
    }
    
    if (file.size > maxSize) {
      setError(`PDF 文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    setPdfFile(file);
    
    // 如果两个文件都已选择，触发回调
    if (jsonFile) {
      onFilesSelect(file, jsonFile);
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
      setError('请选择 JSON 格式文件');
      return;
    }
    
    if (file.size > maxSize) {
      setError(`JSON 文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    setJsonFile(file);
    
    // 如果两个文件都已选择，触发回调
    if (pdfFile) {
      onFilesSelect(pdfFile, file);
    }
  };

  return (
    <div className="space-y-4">
      {/* PDF 文件上传 */}
      <div className={`
        border-2 border-dashed rounded-lg p-8
        transition-colors
        ${pdfFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        <div className="flex flex-col items-center gap-4">
          {pdfFile ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {pdfFile ? `已选择: ${pdfFile.name}` : 'AP 课程 PDF 文件'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              用于对照展示（必需）
            </p>
          </div>
          <label className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfChange}
              disabled={disabled}
              className="hidden"
            />
            {pdfFile ? '重新选择' : '选择 PDF'}
          </label>
        </div>
      </div>

      {/* JSON 文件上传 */}
      <div className={`
        border-2 border-dashed rounded-lg p-8
        transition-colors
        ${jsonFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        <div className="flex flex-col items-center gap-4">
          {jsonFile ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {jsonFile ? `已选择: ${jsonFile.name}` : '课程原始数据 JSON'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              已提取的课程结构数据（必需）
            </p>
          </div>
          <label className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleJsonChange}
              disabled={disabled}
              className="hidden"
            />
            {jsonFile ? '重新选择' : '选择 JSON'}
          </label>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* 提示信息 */}
      {pdfFile && jsonFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 text-center">
            ✓ 两个文件都已准备好，开始处理...
          </p>
        </div>
      )}
    </div>
  );
}

