/**
 * 修复输入 JSON 文件中重复的 topic_number
 * 问题: 当 topic 数量 >= 10 时，第10个 topic 的编号会从 X.10 变成 X.1
 * 原因: JavaScript 将数字 2.10 转换为字符串时变成 "2.1"
 */

const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'input');
const files = [
  'Biology 完整输入.json',
  'Statistics 完整输入.json',
  'US History 完整输入.json',
  'Psychology 完整输入_fixed.json'
];

console.log('🔧 开始修复重复的 topic_number...\n');

files.forEach(filename => {
  const filepath = path.join(inputDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  跳过: ${filename} (文件不存在)`);
    return;
  }
  
  console.log(`📄 处理: ${filename}`);
  
  // 备份原文件
  const backupPath = filepath + '.before-fix';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filepath, backupPath);
    console.log(`   ✅ 已备份到: ${path.basename(backupPath)}`);
  }
  
  // 读取并解析 JSON
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  let fixCount = 0;
  
  // 遍历所有 units
  data.units.forEach(unit => {
    const topics = unit.topics;
    const topicCount = topics.length;
    
    if (topicCount < 10) return; // 小于10个 topics 不会有这个问题
    
    // 检查是否有重复的 topic_number
    const topicNumbers = topics.map(t => t.topic_number);
    const hasDuplicate = new Set(topicNumbers).size !== topicNumbers.length;
    
    if (hasDuplicate) {
      console.log(`   🔍 Unit ${unit.unit_number}: 发现重复的 topic_number`);
      
      // 为每个 topic 分配正确的编号
      topics.forEach((topic, index) => {
        const expectedNumber = `${unit.unit_number}.${index + 1}`;
        if (topic.topic_number !== expectedNumber) {
          console.log(`      修复: ${topic.topic_number} -> ${expectedNumber}`);
          topic.topic_number = expectedNumber;
          fixCount++;
        }
      });
    }
  });
  
  if (fixCount > 0) {
    // 保存修复后的文件
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`   ✅ 已修复 ${fixCount} 个 topic_number\n`);
  } else {
    console.log(`   ✅ 没有发现问题\n`);
  }
});

console.log('🎉 修复完成！');




