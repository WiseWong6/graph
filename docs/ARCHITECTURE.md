# Architecture

## System Overview

Write Agent is a LangGraph.js-based multi-agent content generation system with research-first workflow.

## Core Components

### Agents (`src/agents/`)

- **Article Agent**: End-to-end article generation workflow
  - `00_select_wechat.node.ts` - Interactive WeChat account selection
  - `01_select_model.node.ts` - Interactive LLM model selection
  - `02_research.node.ts` - Research & Brief generation
  - `03_rag.node.ts` - RAG-based content enhancement
  - `04_titles.node.ts` - Title generation
  - `05_select_title.node.ts` - Interactive title selection
  - `06_draft.node.ts` - Draft generation (RAG-enhanced)
  - `07_rewrite.node.ts` - **Intellectual narrative rewrite**
  - `08_confirm.node.ts` - Interactive image configuration
  - `09_humanize.node.ts` - Humanize content (with image placeholders)
  - `10_prompts.node.ts` - Image prompts generation (based on draft)
  - `11_images.node.ts` - Image generation (Ark API)
  - `12_upload.node.ts` - Image upload to WeChat CDN
  - `13_wait_for_upload.node.ts` - Parallel sync point
  - `14_html.node.ts` - HTML conversion (markdown → WeChat format)
  - `15_draftbox.node.ts` - Draftbox publishing

**Parallel Execution Design:**
- Text branch: `07_rewrite → 08_confirm → 09_humanize → 14_html`
- Image branch: `07_rewrite → 08_confirm → 10_prompts → 11_images → 12_upload → 13_wait_for_upload → 14_html`
- Convergence: `14_html` waits for both `09_humanize` and `13_wait_for_upload`

### Adapters (`src/adapters/`)

**Search Infrastructure:**
- **ParallelSearchManager**: Multi-source search with priority-based fallback
  - WebResearch (Google via Playwright) - Priority 1
  - Firecrawl - Priority 2
- **Firecrawl**: Web scraping and search API
- **WebResearch**: Google search via Playwright

**Removed:**
- ~~DuckDuckGo~~ (Removed - unreliable API, timeouts)

### CLI (`src/cli/`)

- **research-cli.ts**: Interactive research agent CLI
  ```bash
  npm run research  # Interactive mode
  ```

### Utilities (`src/utils/`)

- **LLM Client**: Unified interface for DeepSeek, Anthropic, OpenAI
- **Brief Generator**: Content-creation-focused Brief templates
- **Research Scorer**: Confidence calculation, freshness detection
- **Handoff Builder**: YAML handoff format generation

### Configuration (`src/config/`)

- **LLM Config**: Multi-provider support with node-specific settings
  - Research: DeepSeek (cost-effective)
  - Draft: Anthropic Opus (quality)
  - Polish: Anthropic Sonnet (balance)

## Data Flow

```
User Input (CLI)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: Sequential Setup                    │
├─────────────────────────────────────────────────────────────────┤
│ START → Gate A (select_wechat) → Gate A.5 (select_model) → 02_research │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│              Phase 2: First Parallel Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  02_research completes, splits into two branches:              │
│                                                                  │
│  Branch 1 (RAG):                                                │
│    02_research → 03_rag ─────────────────────────┐              │
│                                                  │              │
│  Branch 2 (Titles):                              │              │
│    02_research → 04_titles ──────────────────────┤              │
│                                                  ├─→ Gate C     │
│  LangGraph waits for BOTH to complete ──────────┘   (select_    │
│                                                 title)         │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 3: Sequential Processing                │
├─────────────────────────────────────────────────────────────────┤
│ Gate C → 06_draft → 07_rewrite → 08_confirm                    │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│             Phase 4: Second Parallel Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  08_confirm completes, splits into two branches:                │
│                                                                  │
│  Branch 1 (Image Pipeline):                                     │
│    08_confirm → 10_prompts → 11_images → 12_upload → 13_wait   │
│                            │                                     │
│  Branch 2 (Text Processing):                                    │
│    08_confirm → 09_humanize ←─┘ (uses imageCount from confirm)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Convergence Phase                         │
├─────────────────────────────────────────────────────────────────┤
│  09_humanize + 13_wait ──→ 14_html → 15_draftbox → END        │
│                                                                  │
│  (html node replaces image placeholders with CDN URLs)          │
└─────────────────────────────────────────────────────────────────┘
    ↓
Output Directory
```

**Key Optimization Points:**

**First Parallel Layer (Research → RAG/Titles):**
- `03_rag` and `04_titles` start simultaneously after `02_research` completes
- Both nodes can load IndexManager indices (protected by idempotency)
- LangGraph automatically waits for both before proceeding to `05_select_title`
- **Time saved**: min(T03, T04)

**Second Parallel Layer (Confirm → Image/Text):**
- `10_prompts` uses `draft` (not `humanized`) → can run in parallel with `09_humanize`
- `09_humanize` inserts image placeholders based on `state.decisions.images.count`
- `13_wait_for_upload` ensures upload completes before HTML conversion
- `14_html` replaces placeholders with actual CDN URLs from `12_upload`
- **Time saved**: T09 (humanize runs while image pipeline processes)

## Research Brief Structure

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

## RAG Content Structure

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

## Knowledge Base

```
data/
├── golden_sentences.jsonl    # 37,420 金句 (50.9 MB)
├── article_titles.jsonl        # 6,975 标题 (763 KB)
└── articles/
    ├── 刘润.jsonl              # 3,072 篇文章
    ├── 粥左罗(1).jsonl         # 3,327 篇文章
    └── 数字生命卡兹克.jsonl      #   576 篇文章
```

**Total**: 51,370 searchable entries

## Design Principles

1. **Research-First**: Deep research before content generation
2. **Content-Creation Focus**: Brief serves writers, not just lists findings
3. **Type Safety**: Full TypeScript coverage
4. **Configurability**: YAML-based LLM configuration per node
5. **Search Resilience**: Multi-source search with automatic fallback

## Current Status

✅ **Completed:**
- Research node with parallel search
- LLM-based insight extraction
- Interactive CLI (`npm run research`)
- Multi-angle analysis with recommendations
- High-quality Brief generation
- RAG node implementation (code complete)
- Draft node with Brief/RAG parsing
- Rewrite node for intellectual narrative
- **Full 16-node workflow with dual parallel optimization** (UPDATED)
  - First parallel layer: RAG + Titles after Research
  - Second parallel layer: prompts + humanize after Confirm
- **IndexManager idempotency protection** (NEW)
- **LanceDB vector store TypeScript fixes** (NEW)
- **Vector index construction completed** (UPDATED)

📋 **Planned:**
- Workflow end-to-end testing
- Prompt optimization based on real usage
- Error handling enhancements
