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
00_select_wechat ✅ | 01_research ✅ | 02_rag ✅
03_titles ✅ | 04_select_title ✅ | 05_draft ✅
06_rewrite ✅ | 07_confirm ✅ | 08_humanize ✅
09_prompts ✅ | 10_images ✅ | 11_upload ✅
12_html ⏳ | 13_draftbox ⏳
```

**流程说明**:
- 删除了 polish 节点（Draft → Rewrite 直接连接）
- 双重并行：RAG+Titles 并行，Prompts+Humanize 并行
- 最后 2 节点待验证（HTML + Draftbox）

---

## 核心功能

### Research 节点 (01)
- 并行搜索管理器（多源 + 降级）
- LLM 分析：关键洞察、概念框架、数据支撑、差异化角度
- Brief 生成：内容创作视角模板 + 置信度标签

### RAG 节点 (02)
- 解析脚本：Excel → JSONL（6,975 篇文章）
- 索引构建：IndexManager + 向量索引
- 检索功能：金句库（37,420 条）+ 文章库（6,975 篇）+ 混合检索

### Titles 节点 (03)
- 基于 Brief 推荐角度生成标题
- RAG 标题库检索提供参考
- 生成 5-10 个候选标题

### Gate C (04) - select_title
- 从候选标题中选择
- 自定义标题输入（含可选备注）
- 重新生成标题选项

### Draft 节点 (05)
- Brief 解析：核心洞察、概念框架、推荐角度、数据点
- RAG 解析：金句 + 文章片段 + 参考标题
- 强制要求用户选择标题

### Rewrite 节点 (06)
- 智性四步法：打破认知 → 通俗解构 → 跨界升维 → 思维留白
- IPS 原则：反直觉洞察 + 跨学科引用 + 简单易懂
- HKR 自检：悬念 + 新知 + 共鸣

### Humanize 节点 (08)
- 格式清洗：去空格、标点规范、去引号
- 风格重写：去 AI 味、段落融合、口语化
- 保留 Markdown 结构（代码/链接/图片）

### Images 流程 (09-11)
- **Prompts (09)**: 5 种风格（infographic/healing/pixar/sokamono/handdrawn）
- **Images (10)**: Ark API 生图 + 并行生成 + 水印关闭
- **Upload (11)**: 微信 CDN 并行上传

### HTML 节点 (12)
- 调用 md-to-wxhtml 技能
- 降级方案（简单正则转换）

### Draftbox 节点 (13)
- 微信草稿箱发布
- 支持多账号

---

## 变更日志

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
│   │       ├── 01_research.node.ts       ✅
│   │       ├── 02_rag.node.ts            ✅
│   │       ├── 03_titles.node.ts         ✅
│   │       ├── 04_select_title.node.ts   ✅ (自定义 + 重生成)
│   │       ├── 05_draft.node.ts          ✅ (强制标题)
│   │       ├── 06_rewrite.node.ts        ✅
│   │       ├── 07_confirm.node.ts        ✅
│   │       ├── 08_humanize.node.ts       ✅
│   │       ├── 09_prompts.node.ts        ✅
│   │       ├── 10_images.node.ts         ✅
│   │       ├── 11_upload.node.ts         ✅ (state.wechat + File)
│   │       ├── 12_html.node.ts           ✅
│   │       └── 13_draftbox.node.ts       ✅
│   ├── rag/           # RAG 索引管理
│   ├── adapters/      # LLM/搜索适配器
│   ├── cli/           # ResumeManager 交互
│   ├── config/        # 节点配置
│   └── utils/         # 工具函数
├── scripts/           # 测试脚本
├── data/              # RAG 数据
└── docs/
    └── ARCHITECTURE.md
```
