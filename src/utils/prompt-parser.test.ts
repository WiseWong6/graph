/**
 * parseHKRScore 单元测试
 */

import { parseHKRScore } from './prompt-parser';

const tests = [
  {
    name: '标准格式（有理由）',
    text: 'Article [[HKR]] H=3(钩子偏弱) K=5(新框架) R=4(有共鸣) [[/HKR]]',
    expected: { h: 3, k: 5, r: 4, reason_h: '钩子偏弱', reason_k: '新框架', reason_r: '有共鸣' }
  },
  {
    name: '标准格式（空理由）',
    text: '[[HKR]] H=3() K=5() R=4() [[/HKR]]',
    expected: { h: 3, k: 5, r: 4, reason_h: '', reason_k: '', reason_r: '' }
  },
  {
    name: '标准格式（无空格）',
    text: '[[HKR]]H=3(理由)K=5(理由)R=4(理由)[[/HKR]]',
    expected: { h: 3, k: 5, r: 4, reason_h: '理由', reason_k: '理由', reason_r: '理由' }
  },
  {
    name: '旧格式不兼容',
    text: 'HKR: H=3, K=5, R=4',
    expected: null
  },
  {
    name: '缺少尾标',
    text: 'No HKR tag here',
    expected: null
  },
  {
    name: '只有开始标签',
    text: '[[HKR]] H=3(理由) K=5(理由)',
    expected: null
  },
  {
    name: '只有结束标签',
    text: '[[/HKR]]',
    expected: null
  },
  {
    name: '完整文章内容',
    text: `这是一篇很棒的文章开头。

中间内容...

[[HKR]] H=4(开头有悬念) K=5(提供了全新框架) R=4(与读者经验强相关) [[/HKR]]`,
    expected: { h: 4, k: 5, r: 4, reason_h: '开头有悬念', reason_k: '提供了全新框架', reason_r: '与读者经验强相关' }
  },
  {
    name: '理由含特殊字符',
    text: '[[HKR]] H=3(钩子: 偏弱) K=5(框架 - 新) R=4(共鸣/强) [[/HKR]]',
    expected: { h: 3, k: 5, r: 4, reason_h: '钩子: 偏弱', reason_k: '框架 - 新', reason_r: '共鸣/强' }
  },
  {
    name: '理由含括号（嵌套不支持）',
    text: '[[HKR]] H=3(钩子(弱)) K=5(框架[新]) R=4(共鸣(强)) [[/HKR]]',
    // 当前实现：[^)]* 会捕获到第一个 )，所以会得到 "钩子(弱"
    // 这是不支持嵌套括号的已知限制
    expected: { h: 3, k: 5, r: 4, reason_h: '钩子(弱', reason_k: '框架[新]', reason_r: '共鸣(强' }
  }
];

let passCount = 0;
let failCount = 0;

tests.forEach(({ name, text, expected }) => {
  const result = parseHKRScore(text);
  const pass = JSON.stringify(result) === JSON.stringify(expected);

  if (pass) {
    passCount++;
    console.log(`✅ ${name}`);
  } else {
    failCount++;
    console.log(`❌ ${name}`);
    console.log(`  Expected:`, expected);
    console.log(`  Got:`, result);
  }
});

console.log(`\n${passCount}/${tests.length} tests passed`);

if (failCount > 0) {
  console.error(`❌ ${failCount} tests failed!`);
  process.exit(1);
} else {
  console.log('✅ All HKR parser tests passed!');
}
