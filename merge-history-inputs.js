/**
 * 合并 US History 原始内容.json 和 Gemini-US History step 1.json
 * 创建一个包含所有字段的完整输入文件
 */

const fs = require('fs');
const path = require('path');

// 读取两个文件
const originalPath = path.join(__dirname, 'output', 'US History 原始内容.json');
const geminiPath = path.join(__dirname, 'output', 'Gemini-US History step 1.json');

const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
const geminiData = JSON.parse(fs.readFileSync(geminiPath, 'utf8'));

// 创建映射：topic_number -> topic data
const originalTopicMap = {};
originalData.units.forEach(unit => {
  unit.topics.forEach(topic => {
    originalTopicMap[topic.topic_number] = topic;
  });
});

// 合并数据
const mergedData = {
  course_name: geminiData.course_name,
  units: geminiData.units.map(geminiUnit => {
    // 查找对应的原始unit
    const originalUnit = originalData.units.find(u => u.unit_number === geminiUnit.unit_number);
    
    return {
      unit_number: geminiUnit.unit_number,
      unit_title: geminiUnit.unit_title,
      ced_class_periods: geminiUnit.unit_overview.ced_class_periods,
      exam_weight: geminiUnit.unit_overview.exam_weight,
      unit_overview: geminiUnit.unit_overview,
      topics: geminiUnit.topics.map(geminiTopic => {
        // 查找对应的原始topic
        const originalTopic = originalTopicMap[geminiTopic.topic_number.toString()];
        
        if (!originalTopic) {
          console.warn(`⚠️  找不到 topic ${geminiTopic.topic_number} 的原始数据`);
          return geminiTopic;
        }
        
        // 合并topic数据
        return {
          topic_number: originalTopic.topic_number,
          topic_title: originalTopic.topic_title,
          ced_topic_title: geminiTopic.ced_topic_title,
          topic_overview: geminiTopic.topic_overview,
          prepgo_plan: geminiTopic.prepgo_plan,
          learning_objectives: originalTopic.learning_objectives,
          essential_knowledge: originalTopic.essential_knowledge
        };
      })
    };
  })
};

// 输出合并后的文件
const outputPath = path.join(__dirname, 'output', 'US History 完整输入.json');
fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');

console.log('✅ 合并完成！');
console.log(`📄 输出文件: ${outputPath}`);
console.log(`\n📊 统计信息:`);
console.log(`   - Units 数量: ${mergedData.units.length}`);
console.log(`   - Topics 总数: ${mergedData.units.reduce((sum, u) => sum + u.topics.length, 0)}`);

// 验证所有topic都有learning_objectives和essential_knowledge
let missingCount = 0;
mergedData.units.forEach(unit => {
  unit.topics.forEach(topic => {
    if (!topic.learning_objectives || !topic.essential_knowledge) {
      console.warn(`   ⚠️  Topic ${topic.topic_number} 缺少 LO 或 EK`);
      missingCount++;
    }
  });
});

if (missingCount === 0) {
  console.log('   ✅ 所有 topics 都包含完整的 LO 和 EK 数据');
} else {
  console.log(`   ⚠️  ${missingCount} 个 topics 缺少数据`);
}

