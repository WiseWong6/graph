# Architecture

## System Overview

Write Agent is a LangGraph.js-based multi-agent content generation system with research-first workflow.

## Core Components

### Agents (`src/agents/`)

- **Article Agent**: End-to-end article generation workflow
  - `01_research.node.ts` - Research & Brief generation
  - `02_rag.node.ts` - RAG-based content enhancement
  - `03_titles.node.ts` - Title generation (planned)
  - `04_select_title.node.ts` - Interactive title selection
  - `05_draft.node.ts` - Draft generation (RAG-enhanced)
  - `06_polish.node.ts` - Language refinement
  - `07_rewrite.node.ts` - **Intellectual narrative rewrite** (NEW)
  - `08_humanize.node.ts` - Humanize content (planned)
  - `09_confirm_images.node.ts` - Interactive image configuration
  - `10_prompts.node.ts` - Image prompts generation (planned)
  - `11_images.node.ts` - Image generation (planned)
  - `11.5_upload_images.node.ts` - Image upload (planned)
  - `12_html.node.ts` - HTML conversion (planned)
  - `13_draftbox.node.ts` - Draftbox publishing (planned)

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
Research Node (01_research)
    ├─→ Input Detection (type, complexity)
    ├─→ Parallel Search (Firecrawl + WebResearch)
    │   └─→ Merge & Deduplicate
    ├─→ LLM Analysis (DeepSeek)
    │   ├─→ Extract Insights
    │   ├─→ Build Framework
    │   ├─→ Generate Angles
    │   └─→ Recommend Best Angle
    └─→ Brief Generation
        ├─→ 00_brief.md (Markdown)
        └─→ 00_handoff.yaml (YAML)
    ↓
RAG Node (02_rag) ⚠️ Pending index construction
    ├─→ Load IndexManager (Golden Quotes + Articles + Titles)
    ├─→ Extract Keywords from Brief
    ├─→ Parallel Retrieval (Vector + BM25)
    │   ├─→ Quotes (37,420 entries)
    │   ├─→ Articles (6,975 entries)
    │   └─→ Titles (6,975 entries)
    └─→ RAG Content Generation
        └─→ 01_rag_content.md
    ↓
Titles Node (03_titles) ⚠️ Planned
    └─→ Generate 5-10 title options
    ↓
Select Title Gate (04_select_title)
    └─→ Interactive title selection
    ↓
Draft Node (05_draft)
    ├─→ Parse Brief (insights, framework, angles)
    ├─→ Parse RAG (quotes, articles, titles)
    └─→ Structured draft generation
        └─→ 05_draft.md
    ↓
Polish Node (06_polish)
    ├─→ Language refinement
    ├─→ Paragraph optimization
    └─→ Grammar correction
        └─→ 06_polished.md
    ↓
Rewrite Node (07_rewrite) ✅ NEW
    ├─→ Intellectual narrative style
    ├─→ Four-step flow: Break cognition → Popular deconstruction → Cross-disciplinary lift → Philosophical outro
    ├─→ IPS principles: Intellectual + Polymath + Simple
    └─→ HKR self-check: Hook + Knowledge + Resonance
        └─→ 07_rewrite.md
    ↓
[Future: Humanize → Images → Upload → HTML → Draftbox]
    ↓
Output Directory
```

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
- Polish node for language refinement
- **Rewrite node for intellectual narrative** (NEW)

⚠️ **Pending:**
- Vector index construction (network issue, requires manual run when network is stable)

📋 **Planned:**
- Titles generation node
- Humanize node
- Image generation and upload
- HTML conversion
- Draftbox publishing
- Full workflow integration
