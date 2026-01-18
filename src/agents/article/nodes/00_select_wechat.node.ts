/**
 * Gate A: 选择公众号
 *
 * 触发时机: 启动后立即执行
 * 功能: 让用户选择要发布的公众号账号
 *
 * 交互 UI:
 * ```
 * ? 请选择公众号账号:
 *   1. 人类是我的副业
 *   2. 歪斯Wise
 *   3. 自定义
 * ```
 *
 * 存储位置: state.decisions.wechat.account
 */

import { ArticleState } from "../state";
import { config } from "dotenv";

// 加载环境变量
config({ path: process.cwd() + "/.env" });

/**
 * 微信公众号配置
 */
interface WeChatAccount {
  id: string;
  name: string;
  appId: string;
  appSecret: string;
}

/**
 * 可用的公众号列表
 */
const WECHAT_ACCOUNTS: WeChatAccount[] = [
  {
    id: "account1",
    name: "人类是我的副业",
    appId: process.env.WECHAT_APP_ID_1 || "",
    appSecret: process.env.WECHAT_APP_SECRET_1 || ""
  },
  {
    id: "account2",
    name: "歪斯Wise",
    appId: process.env.WECHAT_APP_ID_2 || "",
    appSecret: process.env.WECHAT_APP_SECRET_2 || ""
  }
];

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
 * 3. 保存决策到 state.decisions.wechat (包括 appId 和 appSecret)
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

  // 过滤出配置完整的公众号
  const availableAccounts = WECHAT_ACCOUNTS.filter(
    acc => acc.appId && acc.appSecret
  );

  if (availableAccounts.length === 0) {
    console.error("[select_wechat] ❌ 没有配置完整的公众号！");
    console.error("[select_wechat] 请在 .env 中配置 WECHAT_APP_ID_1 和 WECHAT_APP_SECRET_1");
    throw new Error("No WeChat account configured");
  }

  // 第一步：选择公众号
  const answer1 = await prompt<{ accountId: string }>([
    {
      type: "list",
      name: "accountId",
      message: "请选择公众号账号:",
      choices: availableAccounts.map(acc => ({
        name: acc.name,
        value: acc.id
      }))
    }
  ]);

  const selectedAccount = availableAccounts.find(
    acc => acc.id === answer1.accountId
  );

  if (!selectedAccount) {
    throw new Error(`Selected account not found: ${answer1.accountId}`);
  }

  console.log(`[select_wechat] 已选择: ${selectedAccount.name}\n`);

  return {
    decisions: {
      ...state.decisions,
      wechat: {
        account: selectedAccount.id,
        name: selectedAccount.name,
        appId: selectedAccount.appId,
        appSecret: selectedAccount.appSecret
      }
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
