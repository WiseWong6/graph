# 精简 Titles 节点 Prompt（System 兜底 + User 变量化）

## 你说的“MECE”问题是什么
现在的 [03_titles.node.ts](file:///Users/wisewong/Documents/Developer/write-agent/src/agents/article/nodes/03_titles.node.ts) 把很多“能力/规则”写在 user prompt 里（`buildTitlePrompt`），同时 system prompt（`TITLE_SYSTEM_MESSAGE`）也写了一堆规则，导致：
- 能力与实例混杂（system 与 user 分工不清）
- 重复描述（规则在两边都出现）
- 输出不稳定（所以 `parseTitles` 变得很长）

你的目标是对的：
- **System Prompt**：把能力、规则、输出格式、边界条件一次性说清楚，做到“兼容所有 user 变量输入”。
- **User Prompt**：只提供几句话 + 变量（topic、角度、参考标题、count…），做到“最小任务描述”。

## 推荐的 Prompt 结构（可直接照抄原则）

### System Prompt（稳定能力层）应包含 6 个 MECE 块
1) 角色与目标：你是谁、要产出什么（标题列表）
2) 输入字段定义：你将收到哪些变量（topic/angle/refTitles/platform/count/maxLen）
3) 生成策略：6 类标题怎么均匀分配、每条命中 2 个要素等（只在 system 写一次）
4) 输出协议：**强制 JSON**（例如 `{ "titles": [ ... ] }`），不允许解释/思考过程
5) 约束与合规：不夸大、不写 100%、平台适配
6) 错误处理：输入缺失时的降级策略（例如 angle/refTitles 为空时仍能生成）

### User Prompt（实例变量层）只做 2 件事
- 给变量：topic、angle、referenceTitles、count、maxLen、platform
- 给极简指令：按 system 的协议输出

示例（user prompt 甚至可以是 6~10 行）：
- 主题：{topic}
- 平台：{platform}
- 数量：{count}
- 最大字数：{maxLen}
- 推荐角度：{angle.name} / {angle.coreArgument}
- 参考标题：\n{referenceTitles.join("\n")}
- 输出：只返回 JSON，不要任何多余文本

这样 system 兜底能力，user 只喂变量。

## 技术落地方式（在你们仓库里怎么做）
你们项目已经支持从 `config/llm.yaml` 读 prompts（见 [llm.ts](file:///Users/wisewong/Documents/Developer/write-agent/src/config/llm.ts) 的 `getPromptTemplate`），所以最干净的落地是：

1) 把 `TITLE_SYSTEM_MESSAGE` 挪到 `config/llm.yaml -> prompts.title_gen_system`（或等价 key）
2) 把 `buildTitlePrompt` 改成“变量渲染器”，甚至也挪成 `prompts.title_gen_user` 模板
3) 让 LLM **只输出 JSON**，把 `parseTitles` 简化为：
   - 尝试提取 JSON（如果模型偶尔包了 ```json```，就先抽 code block）
   - `JSON.parse` + 校验 `titles` 数组长度/去重/长度限制
4) 如果 JSON 校验失败，才走 fallback（保留现有 `generateFallbackTitles`）

## 你关心的“system 必须兼容 user 的能力”的保证机制
- 把 system prompt 写成“协议 + 约束 + 策略”，不引用具体内容，只引用“你会收到的变量字段”。
- user prompt 永远只负责填变量，不再重复规则。
- 输出强制 JSON（这是让解析变短、让系统兼容的关键）。

## 我会怎么改（实施计划）
1) **设计新协议**：确定 `title_gen` 的输入字段与 JSON 输出 schema（`{ titles: string[] }`）。
2) **改配置**：在 `config/llm.yaml` 新增 `prompts`：`title_gen_system` + `title_gen_user`（变量占位符）。
3) **改 Titles 节点**：
   - 从 yaml 读取 system/user 模板
   - 用变量渲染 user prompt
   - 调用 `client.call({ prompt, systemMessage })`
4) **简化解析**：把 `parseTitles` 变成 JSON-first；保留少量兼容（code block 提取）。
5) **验证**：跑一次 `npm run test-titles` / 或加一个小的单测，确保无论 LLM 输出怎么抖，都能稳定拿到 `titles[]`。

如果你确认，我就按这个计划把 Titles 节点重构到“system 兜底 + user 变量化 + JSON 协议”的结构。