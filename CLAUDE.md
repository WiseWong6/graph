# Write Agent - 进度跟踪

> 最后更新: 2026-01-17

## 项目概述

基于 LangGraph.js 的智能内容生成系统，采用 Research-First 工作流。

**核心特性**:
- 并行搜索（Firecrawl + WebResearch）
- 内容创作视角的 Brief 生成
- 多角度分析与推荐
- RAG 增强写作
- 智性叙事重写 (Rewrite)
- 交互式 CLI

---

## 整体进度

| 阶段 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| Research 节点 | ✅ 完成 | 2026-01-17 | 搜索 + LLM 分析 + Brief |
| Brief 质量 | ✅ 完成 | 2026-01-17 | 内容创作视角，多角度推荐 |
| RAG 节点 | ✅ 代码完成 | 2026-01-17 | 索引构建待网络恢复后手动运行 |
| Draft 节点 | ✅ 完成 | 2026-01-17 | Brief + RAG 解析增强 |
| Polish 节点 | ✅ 完成 | 2026-01-17 | 语言润色 |
| Rewrite 节点 | ✅ 完成 | 2026-01-17 | 智性叙事重写 |
| Humanize 节点 | ✅ 完成 | 2026-01-17 | 去机械化，增加活人感 |
| 编译错误修复 | ✅ 完成 | 2026-01-17 | 全部通过 |
| 交互式 CLI | ✅ 完成 | 2026-01-17 | `npm run research` |

---

## 已实现功能清单

### Research 节点 ✅

**搜索能力**:
- [x] 并行搜索管理器（多源 + 降级）
  - [x] WebResearch (Google via Playwright) - Priority 1
  - [x] Firecrawl API - Priority 2

**LLM 分析**:
- [x] 关键洞察提取 (4-5个)
- [x] 概念框架生成 (4层结构)
- [x] 数据支撑整理
- [x] 差异化角度建议 (3个 + 可行性评分)
- [x] 推荐角度生成

**Brief 生成**:
- [x] 内容创作视角模板
- [x] 置信度标签系统
- [x] Markdown + YAML 双输出

### RAG 节点 ✅ (代码完成)

**解析脚本**:
- [x] Excel → JSONL 解析 (`npm run parse-articles`)
- [x] 支持 6,975 篇文章解析

**索引构建**:
- [x] 索引构建脚本 (`npm run build-indices`)
- [x] IndexManager 索引管理器
- [ ] 向量索引（待网络恢复后运行）

**检索功能**:
- [x] 金句库检索（37,420 条）
- [x] 文章库检索（6,975 篇）
- [x] 标题库检索（6,975 个）
- [x] 混合检索（向量 + BM25）

### Draft 节点 ✅

**Brief 解析**:
- [x] 核心洞察提取
- [x] 概念框架提取
- [x] 推荐角度提取
- [x] 数据点提取

**RAG 解析**:
- [x] 金句提取 (用于开头/结尾)
- [x] 文章片段提取 (论据补充)
- [x] 参考标题提取

**结构化 Prompt**:
- [x] 标题 → 推荐角度 → 核心洞察 → 框架 → 数据 → RAG素材
- [x] 明确写作要求（结构、风格、格式）

### Polish 节点 ✅

**语言润色**:
- [x] 保持原意的优化表达
- [x] 提升语言流畅度
- [x] 优化段落结构
- [x] 修正语法错误

### Rewrite 节点 ✅ (智性叙事)

**核心功能**:
- [x] 智性四步法：打破认知 → 通俗解构 → 跨界升维 → 思维留白
- [x] IPS 原则：反直觉洞察 + 跨学科引用 + 简单易懂
- [x] HKR 自检：悬念 + 新知 + 共鸣
- [x] 禁止列表、机械分点、"首先/其次"

**Prompt 构建**:
- [x] 标题 + 核心洞察 + 推荐角度
- [x] 参考金句（用于点缀）
- [x] 智性四步法指导
- [x] IPS 原则 + HKR 自检

### Humanize 节点 ✅ (去机械化)

**核心功能**:
- [x] 格式清洗：去空格、标点规范、去引号
- [x] 风格重写：去 AI 味、段落融合、口语化
- [x] 保留 Markdown 结构（代码/链接/图片）
- [x] 输入优先级：rewritten → polished

**Prompt 构建**:
- [x] 阶段一：格式清洗（去空格、标点规范、去引号）
- [x] 阶段二：风格重写（去除机械连接词、段落融合、口语化）
- [x] 保护内容（代码块、链接、图片、核心观点）

### 配置系统 ✅

- [x] 多 Provider LLM 支持
  - Research: DeepSeek (性价比)
  - Draft: Anthropic Opus (质量)
  - Polish: Anthropic Sonnet (平衡)
- [x] 节点级配置覆盖

---

## 当前使用方式

### 交互式调研（推荐）
```bash
npm run research
```

### 完整流程测试
```bash
# 需要 RAG 索引就绪
npm run test-full
```

### RAG 相关
```bash
npm run parse-articles    # 解析文章库 Excel
npm run build-indices     # 构建向量索引（待网络恢复）
```

---

## 下一步计划

### 短期（P0）- 核心流程完善

1. **RAG 索引构建** ⚠️ 阻塞
   - 当前问题：网络不稳定，无法下载嵌入模型
   - 备选方案：切换到 OpenAI Embedding API
   - 预计时间：30分钟

2. **Titles 节点** (`03_titles.node.ts`) ⚠️ 依赖标题索引
   - 基于 Brief 推荐角度生成标题
   - 使用高质量 LLM (Anthropic Opus)
   - 输出 5-10 个候选标题
   - 预计时间：1小时

3. **完整流程测试**
   - Research → RAG → Titles → Draft → Polish → Rewrite → Humanize
   - 验证数据流完整性
   - 调优 Prompt 质量
   - 预计时间：1小时

### 中期（P1）- 内容质量提升

4. **HTML 转换** (`12_html.node.ts`)
   - Markdown → 富文本 HTML
   - 保留 data-* 属性
   - 支持微信编辑器格式
   - 预计时间：1小时

### 长期（P2）- 发布与扩展

5. **草稿箱发布**
6. **图片生成集成**
7. **多平台支持（小红书）**
8. **完整 CLI 体验**

---

## 技术债务

### 已解决 ✅
- [x] TypeScript 编译错误（全部修复）
- [x] Draft 节点未使用 Brief/RAG 内容
- [x] Polish 节点实现
- [x] Rewrite 节点实现
- [x] Humanize 节点实现

### 待解决
- [ ] RAG 嵌入模型网络问题
- [ ] Titles 节点未实现（依赖标题索引）

---

## 项目结构

```
write-agent/
├── src/
│   ├── agents/article/
│   │   ├── nodes/
│   │   │   ├── 01_research.node.ts    ✅
│   │   │   ├── 02_rag.node.ts         ✅
│   │   │   ├── 03_titles.node.ts      ⏳ 待实现
│   │   │   ├── 04_select_title.node.ts ✅
│   │   │   ├── 05_draft.node.ts       ✅
│   │   │   ├── 06_polish.node.ts      ✅
│   │   │   ├── 07_rewrite.node.ts     ✅
│   │   │   ├── 08_humanize.node.ts    ✅
│   │   │   ├── 09_confirm_images.node.ts ✅
│   │   │   ├── 10_prompts.node.ts     ⏳ 待实现
│   │   │   ├── 11_images.node.ts      ⏳ 待实现
│   │   │   ├── 11.5_upload_images.node.ts ⏳ 待实现
│   │   │   ├── 12_html.node.ts        ⏳ 待实现
│   │   │   └── 13_draftbox.node.ts    ⏳ 待实现
│   ├── rag/                           ✅
│   │   ├── index/
│   │   │   ├── index-manager.ts       ✅
│   │   │   └── schema.ts              ✅
│   │   └── utils/
│   │       └── rag-formatter.ts       ✅
│   ├── adapters/                      ✅
│   │   ├── parallel-search.ts         ✅
│   │   ├── firecrawl.ts               ✅
│   │   └── mcp-webresearch.ts         ✅
│   ├── cli/
│   │   └── research-cli.ts            ✅
│   ├── config/
│   │   └── llm.yaml                   ✅
│   └── utils/
│       ├── brief-generator.ts         ✅
│       └── llm-client.ts              ✅
├── scripts/                            ✅
├── data/                               ✅
└── docs/
    └── ARCHITECTURE.md               ✅
```

---

## 技术栈

- **框架**: LangGraph.js
- **语言**: TypeScript
- **LLM**: DeepSeek (Research) / Anthropic (Draft/Polish)
- **搜索**: Firecrawl + Playwright
- **RAG**: LlamaIndex.js + 本地嵌入模型
- **向量存储**: SimpleVectorStore
- **CLI**: Node.js readline
