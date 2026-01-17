/**
 * Gate A: 选择公众号
 *
 * 触发时机: 启动后立即执行
 * 功能: 让用户选择要发布的公众号账号
 *
 * 交互 UI:
 * ```
 * ? 请选择公众号账号:
 *   1. 主账号（主号）
 *   2. 备用账号（副号）
 *   3. 自定义别名
 * ```
 *
 * 存储位置: state.decisions.wechat.account
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
 * 选择公众号节点
 *
 * 决策流程:
 * 1. 检查是否已有选择 (state.decisions.wechat?.account)
 * 2. 如果没有，弹出交互菜单
 * 3. 如果选择"自定义"，要求输入别名
 * 4. 保存决策到 state.decisions.wechat
 */
export async function selectWechatNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  const account = state.decisions?.wechat?.account;

  // 已选择，跳过
  if (account) {
    console.log(`[select_wechat] 使用已选择的公众号: ${account}`);
    return {};
  }

  console.log("\n=== Gate A: 选择公众号 ===\n");

  const prompt = await getPromptFn();

  // 第一步：选择账号类型
  const answer1 = await prompt<{ account: string }>([
    {
      type: "list",
      name: "account",
      message: "请选择公众号账号:",
      choices: [
        { name: "主账号（主号）", value: "main" },
        { name: "备用账号（副号）", value: "sub" },
        { name: "自定义别名", value: "custom" }
      ]
    }
  ]);

  let finalAccount = answer1.account;

  // 第二步：如果是自定义，要求输入别名
  if (finalAccount === "custom") {
    const answer2 = await prompt<{ alias: string }>([
      {
        type: "input",
        name: "alias",
        message: "请输入公众号别名:",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "别名不能为空";
          }
          return true;
        }
      }
    ]);
    finalAccount = answer2.alias.trim();
  }

  console.log(`[select_wechat] 已选择: ${finalAccount}\n`);

  return {
    decisions: {
      ...state.decisions,
      wechat: { account: finalAccount as "main" | "sub" | string }
    }
  };
}

/**
 * 节点信息（用于文档和调试）
 */
export const selectWechatNodeInfo = {
  name: "select_wechat",
  type: "interactive" as const,
  gate: "A",
  description: "启动时选择公众号账号",
  writes: ["decisions.wechat"]
};
