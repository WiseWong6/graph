# Write Agent

> 基于 LangGraph.js 的智能内容生成系统，采用 Research-First 工作流

## Overview

Write Agent 是一个专业的内容创作调研与生成系统，通过多 Agent 协作完成从调研、选题、写作到发布的全流程。

**核心特点**:
- **深度调研**: 11 部分结构化调研报告（核心事件、技术架构、应用场景、市场影响、竞争格局、趋势研判、写作角度、Brief 建议、风险挑战、信息源）
- **多角度分析**: 3 个差异化写作角度建议 + 智能推荐
- **RAG 增强**: 金句库、文章库、标题库混合检索
- **智性叙事**: IPS 原则 + HKR 自检的高质量重写
- **完整流程**: Research → RAG → Titles → Draft → Polish → Rewrite → Humanize → Images → HTML → Draftbox

## Features

### Research 节点（深度调研）
- 并行搜索（Tavily + WebResearch + Firecrawl）
- LLM 分析生成 11 部分结构化报告
- 置信度标签系统（FACT/BELIEF/ASSUMPTION）
- 3 个差异化写作角度建议

### RAG 节点（知识增强）
- 金句库检索（37,420 条）
- 文章库检索（6,975 篇）
- 标题库检索（6,975 个）
- 混合检索（向量 + BM25）

### 写作流程
- **Draft**: Brief + RAG 增强生成初稿
- **Polish**: 语言润色优化
- **Rewrite**: 智性叙事重写（IPS 原则 + HKR 自检）
- **Humanize**: 去机械化，增加活人感

### 图片生成
- 5 种风格提示词生成
- Ark API (Doubao Seedream) 并行生图
- 微信 CDN 上传

### 发布
- Markdown → 微信编辑器 HTML 转换
- 微信草稿箱 API 发布

## Installation

```bash
# 安装依赖
npm install

# 配置环境变量（复制 .env.example 到 .env）
cp .env.example .env

# 编辑 .env 文件，填入 API Key
# TAVILY_API_KEY=xxx
# ANTHROPIC_API_KEY=xxx
# DEEPSEEK_API_KEY=xxx
```

## Usage

### 调研模式

```bash
npm run research
```

输入主题后生成深度调研报告，包含 11 个部分的完整分析。

### 单步验证模式

```bash
npm run step
```

逐步验证每个节点的输出，用于调试和验证。

### 完整流程

```bash
npm run test-full
```

运行完整的 15 节点工作流。

### RAG 索引构建

```bash
# 解析文章库 Excel
npm run parse-articles

# 构建向量索引
npm run build-indices
```

## Project Structure

```
write-agent/
├── src/
│   ├── agents/article/      # 文章生成 Agent 图和节点
│   │   ├── nodes/           # 15 个节点（00-14）
│   │   └── state.ts         # 状态定义
│   ├── adapters/            # MCP 服务适配器
│   │   ├── tavily.ts        # Tavily 搜索
│   │   ├── firecrawl.ts     # Firecrawl API
│   │   └── parallel-search.ts  # 并行搜索管理器
│   ├── rag/                 # RAG 检索
│   │   ├── index/           # 索引管理
│   │   └── utils/           # RAG 工具
│   ├── config/              # 配置加载器
│   ├── utils/               # 工具函数
│   └── cli/                 # CLI 接口
├── config/                  # YAML 配置文件
│   └── llm.yaml            # LLM 配置
├── data/                    # 数据文件
│   ├── quotes.db           # 金句库
│   ├── articles.db         # 文章库
│   └── titles.db           # 标题库
├── scripts/                 # 脚本工具
└── output/                  # 生成内容输出
```

## Configuration

### LLM 配置 (`config/llm.yaml`)

```yaml
research:
  provider: deepseek
  model: deepseek-chat

draft:
  provider: anthropic
  model: claude-3-5-sonnet-20241022

polish:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
```

## Architecture

### 工作流图

```
00_select_wechat (公众号选择)
        ↓
01_research (深度调研) → 00_brief.md + 00_handoff.yaml
        ↓
    ┌───┴───┐
    ↓       ↓
02_rag  03_titles (并行)
    ↓       ↓
    └───┬───┘
        ↓
04_select_title (标题选择)
        ↓
05_draft (初稿)
        ↓
06_polish (润色)
        ↓
07_rewrite (智性重写)
        ↓
    ┌───┴─────────────┐
    ↓                 ↓
08_confirm (图片确认) 09_humanize (人化)
    ↓                 ↓
10_prompts (提示词)    ↓
    ↓                 ↓
11_images (生图)       ↓
    ↓                 ↓
12_upload (上传)       ↓
    └─────────┬────────┘
              ↓
       13_html (HTML 转换)
              ↓
       14_draftbox (发布)
```

## License

MIT
