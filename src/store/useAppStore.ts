import { create } from 'zustand';
import type { APCourse, UploadState } from '@/types/course';

/**
 * 应用状态接口
 */
interface AppState {
  // 上传状态
  uploadState: UploadState;
  setUploadState: (state: Partial<UploadState>) => void;

  // 处理日志
  processingLogs: string[];
  addLog: (log: string) => void;
  clearLogs: () => void;

  // 文件信息
  fileId: string | null;
  fileName: string | null;
  setFileInfo: (id: string, name: string) => void;

  // 课程数据
  courseData: APCourse | null;
  setCourseData: (data: APCourse | null) => void;

  // UI 状态
  activeTab: 'preview' | 'compare' | 'edit';
  setActiveTab: (tab: 'preview' | 'compare' | 'edit') => void;

  currentPage: number;
  setCurrentPage: (page: number) => void;

  // 操作方法
  reset: () => void;
}

/**
 * 全局应用状态管理
 */
export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  uploadState: {
    status: 'idle',
    progress: 0,
  },
  processingLogs: [],
  fileId: null,
  fileName: null,
  courseData: null,
  activeTab: 'preview',
  currentPage: 1,

  // 设置方法
  setUploadState: (state) =>
    set((prev) => ({
      uploadState: { ...prev.uploadState, ...state },
    })),

  addLog: (log) =>
    set((prev) => ({
      processingLogs: [...prev.processingLogs, log],
    })),

  clearLogs: () => set({ processingLogs: [] }),

  setFileInfo: (id, name) => set({ fileId: id, fileName: name }),

  setCourseData: (data) => set({ courseData: data }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setCurrentPage: (page) => set({ currentPage: page }),

  reset: () =>
    set({
      uploadState: { status: 'idle', progress: 0 },
      processingLogs: [],
      fileId: null,
      fileName: null,
      courseData: null,
      activeTab: 'preview',
      currentPage: 1,
    }),
}));

// 使用示例
// const { courseData, setCourseData } = useAppStore();
// courseData?.course_name, courseData?.units[0].unit_title
