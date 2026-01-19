/**
 * renderTemplate 单元测试
 */

import { renderTemplate } from './template';

// 测试 1: 基本替换
const t1 = renderTemplate('Hello {name}', { name: 'Linus' });
console.assert(t1 === 'Hello Linus', `Test 1 failed: expected "Hello Linus", got "${t1}"`);
console.log('✅ Test 1: 基本替换');

// 测试 2: 多次同名变量全局替换
const t2 = renderTemplate('{greeting} {name}! {greeting}!', { greeting: 'Hello', name: 'Linus' });
console.assert(t2 === 'Hello Linus! Hello!', `Test 2 failed: expected "Hello Linus! Hello!", got "${t2}"`);
console.log('✅ Test 2: 多次同名变量全局替换');

// 测试 3: 未定义变量保留占位符
const t3 = renderTemplate('Hello {name}, age is {age}', { name: 'Linus' });
console.assert(t3 === 'Hello Linus, age is {age}', `Test 3 failed: expected "Hello Linus, age is {age}", got "${t3}"`);
console.log('✅ Test 3: 未定义变量保留占位符');

// 测试 4: 空模板
const t4 = renderTemplate('', { name: 'Linus' });
console.assert(t4 === '', `Test 4 failed: expected "", got "${t4}"`);
console.log('✅ Test 4: 空模板');

// 测试 5: 空变量字典
const t5 = renderTemplate('Hello {name}', {});
console.assert(t5 === 'Hello {name}', `Test 5 failed: expected "Hello {name}", got "${t5}"`);
console.log('✅ Test 5: 空变量字典');

// 测试 6: 多变量混合
const t6 = renderTemplate('{title} by {author}, length {length}', {
  title: 'Linux',
  author: 'Linus',
  length: 1000
});
console.assert(t6 === 'Linux by Linus, length 1000', `Test 6 failed: expected "Linux by Linus, length 1000", got "${t6}"`);
console.log('✅ Test 6: 多变量混合');

// 测试 7: 特殊字符
const t7 = renderTemplate('Price: {price} USD', { price: '$99.99' });
console.assert(t7 === 'Price: $99.99 USD', `Test 7 failed: expected "Price: $99.99 USD", got "${t7}"`);
console.log('✅ Test 7: 特殊字符');

// 测试 8: 连续占位符
const t8 = renderTemplate('{a}{b}{c}', { a: 'A', b: 'B', c: 'C' });
console.assert(t8 === 'ABC', `Test 8 failed: expected "ABC", got "${t8}"`);
console.log('✅ Test 8: 连续占位符');

console.log('\n✅ All renderTemplate tests passed!');
