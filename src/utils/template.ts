/**
 * Template Rendering Utility
 *
 * 全局替换所有 {variable} 占位符
 */

/**
 * 渲染模板字符串，全局替换所有 {variable} 占位符
 *
 * @param template - 模板字符串，包含 {var1} {var2} 等占位符
 * @param vars - 变量字典，key 不带大括号
 * @returns 渲染后的字符串
 *
 * @example
 * renderTemplate('Hello {name}, you are {age}', { name: 'Linus', age: 54 })
 * // => 'Hello Linus, you are 54'
 *
 * @example
 * renderTemplate('{greeting} {name}! {greeting}!', { greeting: 'Hello', name: 'Linus' })
 * // => 'Hello Linus! Hello!'
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  if (!template || Object.keys(vars).length === 0) {
    return template;
  }

  // 构建正则：匹配 {key1}|{key2}|... 全局替换
  const pattern = new RegExp(
    Object.keys(vars)
      .map(key => `{${key}}`)
      .join('|'),
    'g'
  );

  return template.replace(pattern, (match) => {
    const key = match.slice(1, -1); // 去掉大括号
    const value = vars[key];
    return value !== undefined ? String(value) : match; // 未定义时保留原占位符
  });
}
