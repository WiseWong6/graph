# Write Agent - 进度跟踪

> 基于 LangGraph.js 的智能内容生成系统，采用 Research-First 工作流

---

## 项目概述

**核心特性**:
- 并行搜索（Firecrawl + WebResearch）
- 内容创作视角的 Brief 生成
- RAG 增强写作（金句库 + 文章库）
- 智性叙事重写 (Rewrite)
- 去机械化处理 (Humanize)
- 完整图片生成流程（Ark API）
- 微信草稿箱发布

**技术栈**:
- **框架**: LangGraph.js
- **语言**: TypeScript
- **LLM**: DeepSeek (Research) / Anthropic (Draft/Rewrite)
- **搜索**: Firecrawl + Playwright
- **RAG**: LlamaIndex.js + SimpleVectorStore
- **生图**: 火山 Ark API (Doubao Seedream)

---

## 节点完成状态

```
00_select_wechat ✅ | 01_select_model ✅ | 02_research ✅
03_rag ✅ | 04_titles ✅ | 05_select_title ✅
06_draft ✅ | 07_rewrite ✅ | 08_confirm ✅
09_humanize ✅ | 10_prompts ✅ | 11_images ✅
12_upload ✅ | 13_wait_for_upload ✅ | 14_html ✅
15_draftbox ✅
```

**流程说明**:
- **16/16 节点验收通过** ✅
- 双重并行：RAG+Titles 并行，Prompts+Humanize 并行
- 并行汇聚：08_confirm 分流 → 09_humanize/10-13_wait 并行 → 14_html 汇聚

---

## 核心功能

### 耗时统计
- **MetricsTracker** (`src/utils/metrics.ts`): 性能指标追踪
  - 节点执行时间（startNodeExecution / endNodeExecution）
  - LLM Token 使用量（prompt/completion/total）
  - 内存使用监控
  - 错误统计
- **Timing Dashboard** (`src/cli/step-cli.ts`): 仅输出总耗时（不再展示节点/compute 统计）

### 回滚与恢复
- **ResumeManager** (`src/cli/resume-manager.ts`): 基于 LangGraph checkpoint 的恢复管理器
  - 列出所有历史 thread（带状态图标 ✅/⏸️/❌）
  - 列出某个 thread 的所有 checkpoint
  - 从任意 checkpoint 恢复执行
- **使用场景**:
  - 失败重试：节点执行失败后修复重试
  - 回退实验：回到之前节点尝试不同参数
  - 断点续跑：从中断处继续执行
- **使用方式**: `npm run step -- --resume`

### Research 节点 (02)
- 并行搜索管理器（多源 + 降级）
- LLM 分析：关键洞察、概念框架、数据支撑、差异化角度
- Brief 生成：内容创作视角模板 + 置信度标签

### RAG 节点 (03)
- 解析脚本：Excel → JSONL（6,975 篇文章）
- 索引构建：IndexManager + 向量索引
- 检索功能：金句库（37,420 条）+ 文章库（6,975 篇）+ 混合检索

### Titles 节点 (04)
- 基于 Brief 推荐角度生成标题
- RAG 标题库检索提供参考
- 生成 5-10 个候选标题

### Gate C (05) - select_title
- 从候选标题中选择
- 自定义标题输入（含可选备注）
- 重新生成标题选项

### Draft 节点 (06)
- Brief 解析：核心洞察、概念框架、推荐角度、数据点
- RAG 解析：金句 + 文章片段 + 参考标题
- 强制要求用户选择标题

### Rewrite 节点 (07)
- 智性四步法：打破认知 → 通俗解构 → 跨界升维 → 思维留白
- IPS 原则：反直觉洞察 + 跨学科引用 + 简单易懂
- HKR 自检：悬念 + 新知 + 共鸣

### Confirm 节点 (08)
- 确认图片数量和风格选择
- 为后续图片生成流程提供配置

### Humanize 节点 (09)
- **预处理 (Code)**: 使用确定性正则清洗（src/utils/text-cleaner.ts）
  - 去空格、标点规范、去引号、破折号处理
  - 严格保护 Markdown 结构（代码/链接/图片）
- **风格重写 (LLM)**: 专注于去 AI 味、段落融合、口语化
- **设计哲学**: Code 处理死板规则，LLM 注入灵魂

### Images 流程 (10-12)
- **Prompts (10)**: 5 种风格（infographic/healing/pixar/sokamono/handdrawn）
- **Images (11)**: Ark API 生图 + 并行生成 + 水印关闭
- **Upload (12)**: 微信 CDN 并行上传（图文消息图片）+ 回退机制（wechat 配置缺失时自动提示选择）

### Wait For Upload 节点 (13)
- 并行同步点
- 等待图片上传完成后再触发 HTML 转换

### HTML 节点 (14)
- markdown-it 解析 Markdown
- 图片占位符替换为 CDN URL
- 微信编辑器样式
- 保存 HTML + Markdown

### Draftbox 节点 (15)
- 上传永久缩略图素材（thumb_media_id 必填）
- 使用 stable access_token API
- 发布到微信草稿箱
- 摘要限制 54 个汉字

---

## 下一步计划

### 1. 端到端验证
- 运行完整流程：`npm run step`
- 从主题选择到草稿箱发布
- 验证所有节点串联正常
- 重点关注 14_html 是否在 12_upload 完成后再触发
  - 若要续跑失败会话：`npm run step -- --resume`

### 2. 确保并行操作
- 验证 RAG + Titles 并行执行
- 验证 Prompts + Humanize 并行执行
- 检查并行搜索功能
- 确认并行图片上传

### 3. 多 LLM 支持
- Research 节点：DeepSeek
- Draft/Rewrite 节点：Anthropic
- Titles 节点：可选配置
- Humanize 节点：可选配置

---

## 变更日志

### 2026-01-19 (晚) - Humanize 重构
- **架构升级**: Code First, AI Second
  - 引入 `src/utils/text-cleaner.ts` 处理确定性格式清洗
  - 消除 LLM 处理引号/破折号时的幻觉风险
  - LLM 仅负责去 AI 味和润色，不再处理标点规则

### 2026-01-19 (晚) - Upload 回退
- **Upload 节点回退机制**: 恢复会话时 wechat 配置缺失自动提示选择
  - 解决 `--resume` 恢复时 state.decisions.wechat 丢失问题
  - 添加 `promptForWechat()` 回退函数
  - 配置自动保存到 state，下次恢复不会丢失

### 2026-01-19 (早)
- **修复并行汇聚时序**: 14_html 使用 join 边等待 12_upload + 09_humanize 完成
- **标题选择 join**: gate_c_select_title 使用 join 边等待 03_rag + 04_titles
- **HTML 节点验收通过**: markdown-it 解析 + 图片替换（需回归 join 修复）
- **Humanize 增强**: 自动恢复加粗标记并补齐缺失图片占位符
- **Draftbox 节点验收通过**: 永久缩略图素材 + stable token
- **完整发布流程测试**: `scripts/test-publish-flow.ts`
- **微信 API 修复**:
  - 使用 `/cgi-bin/stable_token` 替代旧 API
  - thumb_media_id 必填（上传永久素材）
  - 摘要长度限制 54 个汉字
- **所有 16 个节点验收通过** ✅（含 wait_for_upload）
- **Resume 列表时间修复**: 时间来自 checkpoint `ts`，显示"今晚/昨天/前天/日期"
- **Resume 节点显示优化**: checkpoint 列表改用下一节点并屏蔽 loop 噪音
- **Step CLI 输出优化**: humanize 流式期间缓冲 10/11/12 输出，完成后统一展示
- **耗时面板精简**: 仅保留总耗时

### 2026-01-18
- **ResumeManager**: 恢复界面显示节点名称
- **Upload 节点**: state.wechat 配置修复 + FormData 文件名修复
- **删除 Polish 节点**: 15 → 14 节点
- **Gate C 增强**: 自定义标题 + 重新生成选项
- **Draft 强化**: 强制要求用户选择标题
- **双重并行优化**: RAG+Titles 并行 + 文本/图片并行
- **IndexManager**: 幂等性保护 + 并发加载锁
- **step-cli**: 只在交互式节点后暂停
- **流式输出**: DeepSeek 思考过程逐字显示
- **搜索超时**: 8秒 → 30秒 + 删除 DuckDuckGo
- **标题解析**: Prompt 容错 + max_tokens→2048
- **Reasoner 泄露修复**: 切换 deepseek-chat 模型
- **LanceDB 类型修复**: 向量存储类型错误

### 2026-01-17
- **Research 节点**: 搜索 + Brief 生成
- **RAG 节点**: 索引构建 + 向量检索验证通过
- **Draft 节点**: Brief + RAG 解析增强
- **Rewrite 节点**: 智性叙事实现
- **Humanize 节点**: 去机械化实现

---

## 使用方式

```bash
npm run step              # 单步交互式
npm run step -- --resume  # 恢复会话
npm run test-full         # 完整流程验证
npm run research          # 交互式调研
npm run test-interactive  # 图片生成测试
npm run test-publish-flow # 发布流程测试
```

### RAG 相关
```bash
npm run parse-articles    # 解析文章库 Excel
npm run build-indices     # 构建向量索引
```

---

## 项目结构

```
write-agent/
├── src/
│   ├── agents/article/
│   │   └── nodes/
│   │       ├── 00_select_wechat.node.ts  ✅
│   │       ├── 01_select_model.node.ts   ✅
│   │       ├── 02_research.node.ts       ✅
│   │       ├── 03_rag.node.ts            ✅
│   │       ├── 04_titles.node.ts         ✅
│   │       ├── 05_select_title.node.ts   ✅ (自定义 + 重生成)
│   │       ├── 06_draft.node.ts          ✅ (强制标题)
│   │       ├── 07_rewrite.node.ts        ✅
│   │       ├── 08_confirm.node.ts        ✅
│   │       ├── 09_humanize.node.ts       ✅
│   │       ├── 10_prompts.node.ts        ✅
│   │       ├── 11_images.node.ts         ✅
│   │       ├── 12_upload.node.ts         ✅ (stable token + 回退机制)
│   │       ├── 13_wait_for_upload.node.ts ✅ (并行同步点)
│   │       ├── 14_html.node.ts           ✅
│   │       └── 15_draftbox.node.ts       ✅ (永久素材)
│   ├── rag/           # RAG 索引管理
│   ├── adapters/      # LLM/搜索适配器
│   ├── cli/           # ResumeManager 交互
│   ├── config/        # 节点配置
│   └── utils/         # 工具函数
├── scripts/           # 测试脚本
│   └── test-publish-flow.ts  # 发布流程测试
├── data/              # RAG 数据
└── docs/
    └── ARCHITECTURE.md
```
