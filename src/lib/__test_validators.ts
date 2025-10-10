// 临时测试文件 - 验证 Zod schemas 工作正常
import { validateAPCourse } from './validators';

// 测试数据
const testData = {
  course_name: 'AP U.S. History',
  units: [
    {
      unit_number: 1,
      unit_title: 'Period 1: 1491-1607',
      ced_class_periods: '~8 Class Periods',
      exam_weight: '4-6%',
      topics: [
        {
          topic_number: '1.1',
          topic_title: 'Test Topic',
          learning_objectives: [
            {
              id: 'Unit 1: Learning Objective A',
              summary: 'This is a test summary that is long enough',
            },
          ],
          essential_knowledge: [
            {
              id: 'KC-1.1',
              summary: 'This is test essential knowledge',
            },
          ],
        },
      ],
    },
  ],
};

const result = validateAPCourse(testData);
console.log('验证结果:', result.success ? '✅ 通过' : '❌ 失败');
if (!result.success) {
  console.error('验证错误:', result.error.errors);
}
