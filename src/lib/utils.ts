import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { APUnit } from '@/types/course';

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 从 "~8 Class Periods" 提取数字
 */
export function parseCedClassPeriods(cedPeriods: string): number {
  const match = cedPeriods.match(/~(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 计算所有单元的总时长
 */
export function calculateTotalPeriods(units: APUnit[]): number {
  return units.reduce((total, unit) => {
    return total + parseCedClassPeriods(unit.ced_class_periods);
  }, 0);
}

/**
 * 下载 JSON 文件
 */
export function downloadJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(courseName: string, suffix: string = ''): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const cleanName = courseName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${cleanName}${suffix ? '_' + suffix : ''}_${timestamp}.json`;
}
