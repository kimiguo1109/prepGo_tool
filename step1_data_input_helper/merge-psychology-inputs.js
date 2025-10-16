const fs = require('fs');
const path = require('path');

const originalFilePath = path.join(__dirname, 'output', 'Psychology 原始内容.json');
const geminiFilePath = path.join(__dirname, 'output', 'Gemini-AP Psychology step 1.json');
const outputFilePath = path.join(__dirname, 'output', 'Psychology 完整输入.json');

try {
  console.log('📂 读取文件...');
  const originalData = JSON.parse(fs.readFileSync(originalFilePath, 'utf8'));
  const geminiData = JSON.parse(fs.readFileSync(geminiFilePath, 'utf8'));

  // 创建原始数据的 topic 映射（按 topic_number）
  const originalTopicMap = {};
  originalData.units.forEach(unit => {
    unit.topics.forEach(topic => {
      // 将 topic_number 转换为字符串以便匹配（可能是 "1.1" 或 1.1）
      const topicNum = String(topic.topic_number);
      originalTopicMap[topicNum] = topic;
    });
  });

  console.log(`✅ 原始文件: ${originalData.units.length} units, ${Object.keys(originalTopicMap).length} topics`);
  console.log(`✅ Gemini文件: ${geminiData.units.length} units`);

  // 合并数据
  const mergedData = {
    course_name: geminiData.course_name,
    units: geminiData.units.map(geminiUnit => {
      const originalUnit = originalData.units.find(u => u.unit_number === geminiUnit.unit_number);
      
      // 确保 ced_class_periods 和 exam_weight 格式正确
      let cedClassPeriods = originalUnit?.ced_class_periods || geminiUnit.unit_overview.ced_class_periods;
      // 如果已经有 ~，保持原样；否则添加 ~
      if (cedClassPeriods && !cedClassPeriods.startsWith('~')) {
        cedClassPeriods = `~${cedClassPeriods}`;
      }

      let examWeight = originalUnit?.exam_weight || geminiUnit.unit_overview.exam_weight;
      // 确保格式正确（如 "15-25%"）
      if (examWeight && !examWeight.includes('%')) {
        examWeight = `${examWeight}%`;
      }

      return {
        unit_number: geminiUnit.unit_number,
        unit_title: geminiUnit.unit_title,
        ced_class_periods: cedClassPeriods,
        exam_weight: examWeight,
        unit_overview: geminiUnit.unit_overview, // 保留完整的 unit_overview
        topics: geminiUnit.topics.map(geminiTopic => {
          const topicNum = String(geminiTopic.topic_number);
          const originalTopic = originalTopicMap[topicNum];
          
          if (!originalTopic) {
            console.warn(`⚠️  找不到 topic ${geminiTopic.topic_number} 的原始数据`);
            return geminiTopic; // 返回Gemini数据，但会缺少LO/EK
          }

          // 合并 topic 数据
          return {
            topic_number: geminiTopic.topic_number,
            ced_topic_title: geminiTopic.ced_topic_title, // 使用 Gemini 的 ced_topic_title
            topic_title: originalTopic.topic_title, // 添加原始的 topic_title（如果需要）
            topic_overview: geminiTopic.topic_overview, // Gemini 提供
            prepgo_plan: geminiTopic.prepgo_plan, // Gemini 提供
            learning_objectives: originalTopic.learning_objectives, // 原始文件提供
            essential_knowledge: originalTopic.essential_knowledge // 原始文件提供
          };
        })
      };
    })
  };

  // 写入合并后的文件
  fs.writeFileSync(outputFilePath, JSON.stringify(mergedData, null, 2), 'utf8');
  console.log('\n✅ 合并完成！');
  console.log('📄 输出文件:', outputFilePath);

  // 验证合并后的数据
  const unitCount = mergedData.units.length;
  const topicCount = mergedData.units.reduce((sum, unit) => sum + unit.topics.length, 0);
  const allTopicsHaveLoEk = mergedData.units.every(unit =>
    unit.topics.every(topic =>
      topic.learning_objectives && topic.learning_objectives.length > 0 &&
      topic.essential_knowledge && topic.essential_knowledge.length > 0
    )
  );
  const allTopicsHavePlan = mergedData.units.every(unit =>
    unit.topics.every(topic =>
      topic.prepgo_plan && topic.prepgo_plan.total_estimated_minutes
    )
  );

  console.log('\n📊 统计信息:');
  console.log(`   - Units 数量: ${unitCount}`);
  console.log(`   - Topics 总数: ${topicCount}`);
  console.log(`   ${allTopicsHaveLoEk ? '✅' : '❌'} 所有 topics 都包含完整的 LO 和 EK 数据`);
  console.log(`   ${allTopicsHavePlan ? '✅' : '❌'} 所有 topics 都包含 prepgo_plan`);

  // 显示文件大小
  const stats = fs.statSync(outputFilePath);
  console.log(`   - 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

} catch (error) {
  console.error('❌ 合并失败:', error);
  process.exit(1);
}

