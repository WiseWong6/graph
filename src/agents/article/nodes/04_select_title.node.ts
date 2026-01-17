/**
 * Gate C: 选择标题
 *
 * 触发时机: 标题生成后执行
 * 功能: 让用户从 LLM 生成的标题选项中选择一个
 *
 * 交互 UI:
 * ```
 * ? 请选择最终标题:
 *   1. Kubernetes 是什么？一文读懂容器编排
 *   2. 从乐高乐园理解 Kubernetes：容器编排的魔法
 *   3. Kubernetes 入门指南：为什么你需要它
 * ```
 *
 * 存储位置: state.decisions.selectedTitle
 */

import { ArticleState } from "../state";

/**
 * 交互提示函数类型
 *
 * 允许外部注入自定义交互逻辑
 * 使用 any 类型以避免 inquirer 复杂的泛型约束
 */
export type InteractivePrompt = <T = unknown>(
  questions: unknown
) => Promise<T>;

/**
 * 默认交互提示函数
 *
 * 使用真实的 inquirer 模块
 */
let promptFn: InteractivePrompt | null = null;

export function setPromptFn(fn: InteractivePrompt | null) {
  promptFn = fn;
}

async function getPromptFn(): Promise<InteractivePrompt> {
  if (!promptFn) {
    // 动态导入 inquirer
    const inquirerModule = await import("inquirer");
    promptFn = inquirerModule.default.prompt as InteractivePrompt;
  }
  return promptFn;
}

/**
 * 选择标题节点
 *
 * 决策流程:
 * 1. 检查是否已有选择 (state.decisions.selectedTitle)
 * 2. 检查是否有标题选项 (state.titles)
 * 3. 如果没有选项，报错返回
 * 4. 弹出交互菜单让用户选择
 * 5. 保存决策到 state.decisions.selectedTitle
 */
export async function selectTitleNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  const existing = state.decisions?.selectedTitle;

  // 已选择，跳过
  if (existing) {
    console.log(`[select_title] 使用已选择的标题: ${existing}`);
    return {};
  }

  const titles = state.titles;

  // 检查是否有标题选项
  if (!titles || titles.length === 0) {
    console.error("[select_title] 错误: 没有可用的标题选项");
    console.error("[select_title] 请确保前序节点 (03_titles) 已正确生成标题");
    return {
      status: "error: no titles available"
    };
  }

  console.log("\n=== Gate C: 选择标题 ===\n");

  const prompt = await getPromptFn();

  // 弹出选择菜单
  const answer = await prompt<{ selectedTitle: string }>([
    {
      type: "list",
      name: "selectedTitle",
      message: "请选择最终标题:",
      choices: titles.map((title, index) => ({
        name: `${index + 1}. ${title}`,
        value: title
      }))
    }
  ]);

  const selected = answer.selectedTitle;
  console.log(`[select_title] 已选择: ${selected}\n`);

  return {
    decisions: {
      ...state.decisions,
      selectedTitle: selected
    }
  };
}

/**
 * 节点信息（用于文档和调试）
 */
export const selectTitleNodeInfo = {
  name: "select_title",
  type: "interactive" as const,
  gate: "C",
  description: "从生成的标题选项中选择一个",
  writes: ["decisions.selectedTitle"],
  requires: ["titles"]
};
