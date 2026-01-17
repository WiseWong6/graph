# Write Agent - 进度跟踪

> 最后更新: 2026-01-18

## 项目概述

基于 LangGraph.js 的智能内容生成系统，采用 Research-First 工作流。

**核心特性**:
- 并行搜索（Firecrawl + WebResearch）
- 内容创作视角的 Brief 生成
- 多角度分析与推荐
- RAG 增强写作
- 智性叙事重写 (Rewrite)
- 交互式 CLI
- 完整图片生成流程（Ark API）

---

## 整体进度

| 阶段 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| Research 节点 | ✅ 完成 | 2026-01-17 | 搜索 + LLM 分析 + Brief |
| Brief 质量 | ✅ 完成 | 2026-01-17 | 内容创作视角，多角度推荐 |
| RAG 节点 | ✅ 代码完成 | 2026-01-17 | 索引构建待网络恢复后手动运行 |
| Titles 节点 | ✅ 完成 | 2026-01-18 | 基于 Brief + RAG 标题检索 |
| Draft 节点 | ✅ 完成 | 2026-01-17 | Brief + RAG 解析增强 |
| Polish 节点 | ✅ 完成 | 2026-01-17 | 语言润色 |
| Rewrite 节点 | ✅ 完成 | 2026-01-17 | 智性叙事重写 |
| Humanize 节点 | ✅ 完成 | 2026-01-17 | 去机械化，增加活人感 |
| Images 流程 | ✅ 完成 | 2026-01-18 | Prompts → 生成 → 上传 |
| HTML 转换 | ✅ 完成 | 2026-01-18 | Markdown → 微信编辑器格式 |
| 草稿箱发布 | ✅ 完成 | 2026-01-18 | 微信 API 集成 |
| 完整工作流 | ✅ 完成 | 2026-01-18 | 15 节点全链路 |

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

### Titles 节点 ✅

**标题生成**:
- [x] 基于 Brief 推荐角度生成标题
- [x] RAG 标题库检索提供参考
- [x] 生成 5-10 个候选标题
- [x] 降级方案（模板标题）

### Images 流程 ✅

**Prompts 节点** (`10_prompts.node.ts`):
- [x] 基于人化文章生成提示词
- [x] 5 种风格支持（infographic/healing/pixar/sokamono/handdrawn）
- [x] 风格 Prefix 完整嵌入
- [x] 降级方案（风格化通用提示词）

**Images 节点** (`11_images.node.ts`):
- [x] Ark API (Doubao Seedream) 生图
- [x] 并行生成（可配置并发）
- [x] 保存到本地
- [x] 错误重试机制
- [x] **水印关闭** (`watermark: false`)

**Upload Images 节点** (`11.5_upload_images.node.ts`):
- [x] 上传到微信 CDN
- [x] 并行上传（可配置并发）
- [x] 返回 CDN URL

### HTML 节点 ✅

**Markdown → HTML 转换**:
- [x] 调用 md-to-wxhtml 技能
- [x] 降级方案（简单正则转换）
- [x] 保存 article.html + article.md

### Draftbox 节点 ✅

**微信草稿箱发布**:
- [x] 调用微信 API
- [x] 支持多账号
- [x] 返回草稿箱链接

---

## 当前使用方式

### 交互式调研
```bash
npm run research
```

### 图片生成测试
```bash
npm run test-interactive
```

### 完整流程（需要 RAG 索引）
```bash
npm run test-full
```

### RAG 相关
```bash
npm run parse-articles    # 解析文章库 Excel
npm run build-indices     # 构建向量索引（待网络恢复）
```

---

## 下一步计划

### P0 - 必须完成

1. **RAG 索引构建** ⚠️ 阻塞
   - 当前问题：网络不稳定，无法下载嵌入模型
   - 备选方案：切换到 OpenAI Embedding API
   - 影响：Titles 节点无法检索参考标题

2. **完整流程端到端测试**
   - 使用真实文章验证 15 节点全链路
   - 调优各节点 Prompt
   - 修复发现的 bug

### P1 - 质量提升

3. **Prompt 优化**
   - 各节点 Prompt 迭代优化
   - 基于真实案例调优
   - A/B 测试不同版本

4. **错误处理增强**
   - 各节点降级策略完善
   - 用户友好的错误提示
   - 重试机制优化

### P2 - 体验优化

5. **CLI 体验**
   - 进度条显示
   - 彩色输出优化
   - 交互确认简化

6. **性能优化**
   - 并发控制调优
   - 缓存机制
   - 流式输出

---

## 技术债务

### 已解决 ✅
- [x] TypeScript 编译错误（全部修复）
- [x] Draft 节点未使用 Brief/RAG 内容
- [x] Polish 节点实现
- [x] Rewrite 节点实现
- [x] Humanize 节点实现
- [x] Titles 节点实现
- [x] Images 流程（Prompts → 生成 → 上传）
- [x] HTML 节点实现
- [x] Draftbox 节点实现
- [x] test-interactive 缺少 user message bug
- [x] Images 节点水印问题

### 待解决
- [ ] RAG 嵌入模型网络问题（可切换 OpenAI API）

---

## 项目结构

```
write-agent/
├── src/
│   ├── agents/article/
│   │   ├── nodes/
│   │   │   ├── 00_select_wechat.node.ts  ✅
│   │   │   ├── 01_research.node.ts       ✅
│   │   │   ├── 02_rag.node.ts            ✅
│   │   │   ├── 03_titles.node.ts         ✅
│   │   │   ├── 04_select_title.node.ts   ✅
│   │   │   ├── 05_draft.node.ts          ✅
│   │   │   ├── 06_polish.node.ts         ✅
│   │   │   ├── 07_rewrite.node.ts        ✅
│   │   │   ├── 08_humanize.node.ts       ✅
│   │   │   ├── 09_confirm_images.node.ts ✅
│   │   │   ├── 10_prompts.node.ts        ✅
│   │   │   ├── 11_images.node.ts         ✅
│   │   │   ├── 11.5_upload_images.node.ts ✅
│   │   │   ├── 12_html.node.ts           ✅
│   │   │   └── 13_draftbox.node.ts       ✅
│   ├── rag/                              ✅
│   ├── adapters/                         ✅
│   ├── cli/                              ✅
│   ├── config/                           ✅
│   └── utils/                            ✅
├── scripts/                              ✅
├── data/                                 ✅
└── docs/
    └── ARCHITECTURE.md                   ✅
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
- **生图**: 火山 Ark API (Doubao Seedream)
