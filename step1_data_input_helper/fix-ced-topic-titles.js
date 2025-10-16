/**
 * 修复输入 JSON 文件中 ced_topic_title 与 topic_title 不一致的问题
 * 以 topic_title 为准
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

console.log('🔧 开始修复 ced_topic_title...\n');

files.forEach(filename => {
  const filepath = path.join(inputDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  跳过: ${filename} (文件不存在)`);
    return;
  }
  
  console.log(`📄 处理: ${filename}`);
  
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  let fixCount = 0;
  
  data.units.forEach(unit => {
    unit.topics.forEach(topic => {
      if (topic.ced_topic_title !== topic.topic_title) {
        console.log(`   修复 Topic ${topic.topic_number}:`);
        console.log(`      旧: "${topic.ced_topic_title}"`);
        console.log(`      新: "${topic.topic_title}"`);
        topic.ced_topic_title = topic.topic_title;
        fixCount++;
      }
    });
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`   ✅ 已修复 ${fixCount} 个 ced_topic_title\n`);
  } else {
    console.log(`   ✅ 所有 ced_topic_title 都正确\n`);
  }
});

console.log('🎉 修复完成！');

