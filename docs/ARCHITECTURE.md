# 系统架构

## 系统概述

Write Agent 是一个基于 LangGraph.js 的多代理内容生成系统，采用研究优先的工作流。

## 核心组件

### 代理节点 (`src/agents/`)

- **Article Agent**：端到端文章生成工作流
  - `00_select_wechat.node.ts` - 交互式选择公众号账号
  - `01_select_model.node.ts` - 交互式选择 LLM 模型
  - `02_research.node.ts` - 调研与 Brief 生成
  - `03_rag.node.ts` - 基于 RAG 的内容增强
  - `04_titles.node.ts` - 标题生成
  - `05_select_title.node.ts` - 交互式标题选择
  - `06_draft.node.ts` - 初稿生成（RAG 增强）
  - `07_rewrite.node.ts` - 智性叙事重写（Kimi K2）
  - `08_confirm.node.ts` - 交互式图片配置确认
  - **09_humanize.node.ts** - **先 LLM 重写（Kimi K2），再代码清洗（确定性规则）**
  - `10_prompts.node.ts` - 图片提示词生成（基于初稿）
  - `11_images.node.ts` - 图片生成（Ark API）
  - `12_upload.node.ts` - 图片上传到微信 CDN
  - `13_wait_for_upload.node.ts` - 并行同步点
  - `14_html.node.ts` - HTML 转换（markdown → 微信格式）
  - `15_draftbox.node.ts` - 发布到草稿箱

**并行执行设计：**
- 文本分支：`07_rewrite → 08_confirm → 09_humanize → 14_html`
- 图片分支：`07_rewrite → 08_confirm → 10_prompts → 11_images → 12_upload → 13_wait_for_upload → 14_html`
- 汇聚点：`14_html` 等待 `09_humanize` 和 `13_wait_for_upload` 都完成

### 适配器 (`src/adapters/`)

**搜索基础设施：**
- **ParallelSearchManager**：多源搜索，基于优先基于优先级的降级机制
  - WebResearch (Google via Playwright) - 优先级 1
  - Firecrawl - 优先级 2
- **Firecrawl**：网页抓取和搜索 API
- **WebResearch**：通过 Playwright 进行 Google 搜索

**已移除：**
- ~~DuckDuckGo~~（已移除 - API 不可靠，频繁超时）

### CLI (`src/cli/`)

- **research-cli.ts**：交互式研究代理 CLI
  ```bash
  npm run research  # 交互模式
  ```

- **index.ts**：主 CLI 入口
  ```bash
  npm run full -- --prompt "写一篇关于 AI Agent 的文章"
  npm run step  # 步进模式
  ```

### 工具函数 (`src/utils/`)

- **LLM Client**：DeepSeek、Anthropic、OpenAI 的统一接口
- **Text Cleaner**：确定性的 markdown 格式化（引号、破折号、空格）
- **Brief Generator**：面向内容创作的 Brief 模板
- **Research Scorer**：置信度计算、时效性检测
- **Handoff Builder**：YAML handoff 格式生成

### 配置 (`src/config/`)

- **LLM Config**：多提供商支持，节点级设置
  - DeepSeek：思考模型，支持深度思考
  - Volcengine：火山引擎，支持深度思考和流式输出
  - 节点级模型切换：支持全局和节点级覆盖

## 数据流

```
用户输入 (CLI)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    阶段 1：顺序前置流程                    │
├─────────────────────────────────────────────────────────────────┤
│ START → Gate A (select_wechat) → Gate A.5 (select_model) → 02_research │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│              阶段 2：第一层并行                      │
├─────────────────────────────────────────────────────────────────┤
│  02_research 完成，拆分为两个分支：              │
│                                                                  │
│  分支 1 (RAG)：                                                │
│    02_research → 03_rag ─────────────────────────┐              │
│                                                  │              │
│  分支 2 (标题)：                              │
│    02_research → 04_titles ──────────────────────┤              │
│                                                  ├─→ Gate C     │
│  LangGraph 等待两者都完成 ──────────┘   (select_    │
│                                                 title)         │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                   阶段 3：顺序中间流程                │
├─────────────────────────────────────────────────────────────────┤
│ Gate C → 06_draft → 07_rewrite → 08_confirm                    │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│             阶段 4：第二层并行                      │
├─────────────────────────────────────────────────────────────────┤
│  08_confirm 完成，拆分为两个分支：                │
│                                                                  │
│  分支 1 (图片流程)：                                     │
│    08_confirm → 10_prompts → 11_images → 12_upload → 13_wait   │
│                            │                                     │
│  分支 2 (文本处理)：                                    │
│    08_confirm → 09_humanize ←─┘ (使用 confirm 中的 imageCount)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                       汇聚阶段                         │
├─────────────────────────────────────────────────────────────────┤
│  09_humanize + 13_wait ──→ 14_html → 15_draftbox → END        │
│                                                                  │
│  (html 节点将图片占位符替换为 CDN URL)          │
└─────────────────────────────────────────────────────────────────┘
    ↓
输出目录
```

**关键优化点：**

**第一层并行（Research → RAG/Titles）：**
- `03_rag` 和 `04_titles` 在 `02_research` 完成后同时启动
- 两个节点都可以加载 IndexManager 索引（通过幂等性保护）
- LangGraph 自动等待两者都完成后才继续到 `05_select_title`
- **节省时间**：min(T03, T04)

**第二层并行（Confirm → Image/Text）：**
- `10_prompts` 使用 `draft`（不是 `humanized`）→ 可以与 `09_humanize` 并行运行
- `09_humanize` 根据 `state.decisions.images.count` 插入图片占位符
- `13_wait_for_upload` 确保上传完成后才触发 HTML 转换
- `14_html` 将占位符替换为 `12_upload` 的实际 CDN URL
- **节省时间**：T09（humanize 运行时图片流程在处理）

## 调研 Brief 结构

```markdown
# 内容调研报告：{主题}

## 调研概述
- 主题、时间、时效性窗口、调研深度

## 核心洞察
- 4-5 个深度洞察

## 关键概念框架
- 4层分析框架

## 数据引用清单
- 具体数据指标

## 差异化角度建议
- 3 个写作角度（含可行性评分）

## 推荐写作角度
- 最优角度 + 详细理由

## 参考资料
- 所有引用来源
```

## RAG 内容结构

```markdown
# RAG 检索结果

**主题**: {主题}
**检索时间**: {ms}

## 相关金句 ({count})
1. "{金句内容}"
   > 来源: {文章标题} | {作者}

## 相关文章片段 ({count})
### 1. {文章标题}
{内容片段...}
   > 来源: {作者}

## 参考标题 ({count})
1. {标题}
2. {标题}
...
```

## 知识库

```
data/
├── golden_sentences.jsonl    # 37,420 金句 (50.9 MB)
├── article_titles.jsonl        # 6,975 标题 (763 KB)
└── articles/
    ├── 刘润.jsonl              # 3,072 篇文章
    ├── 粥左罗(1).jsonl         # 3,327 篇文章
    └── 数字生命卡兹克.jsonl      #   576 篇文章
```

**总计**：51,370 条可搜索条目

## 设计原则

1. **研究优先**：内容生成前进行深度调研
2. **内容创作导向**：Brief 服务于创作者，而不仅仅是列出发现
3. **类型安全**：完整的 TypeScript 覆盖
4. **可配置性**：基于 YAML 的节点级 LLM 配置
5. **搜索弹性**：多源搜索，自动降级

## 当前状态

✅ **已完成：**
- 带并行搜索的研究节点
- 基于 LLM 的洞察提取
- 交互式 CLI（`npm run research`）
- 多角度分析与推荐
- 高质量 Brief 生成
- RAG 节点实现（代码完成）
- 带 Brief/RAG 解析的 Draft 节点
- 智性叙事重写节点
- **完整的 16 节点工作流，双重并行优化**（已更新）
  - 第一层并行：Research 后的 RAG + Titles
  - 第二层并行：Confirm 后的 prompts + humanize
- **IndexManager 幂等性保护**（新增）
- **LanceDB 向量存储 TypeScript 修复**（新增）
- **向量索引构建完成**（已更新）

📋 **计划中：**
- 工作流端到端测试
- 基于实际使用的 Prompt 优化
- 错误处理增强
