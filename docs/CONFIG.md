# 配置指南

## LLM 配置 (`config/llm.yaml`)

LLM 配置分为四个层级（低 → 高优先级）：

1. `providers.*.defaults` - 提供商默认设置
2. `models.*.defaults` - 模型默认设置
3. `nodes.*.overrides` - 节点级覆盖
4. 运行时覆盖（交互式选择）

### 结构说明

- `defaults.model`：全局回退模型 ID
- `providers`：提供商设置和默认值
- `models`：模型注册条目（提供商 + 模型 + 默认值）
- `nodes`：每个节点的模型选择和覆盖
- `prompts`：可选的节点级 Prompt 模板

### 环境变量

```bash
export DEEPSEEK_API_KEY="..."
export ARK_API_KEY="..."
```

### 示例

```yaml
defaults:
  model: deepseek-reasoner

providers:
  deepseek:
    type: openai_compat
    api_key_env: DEEPSEEK_API_KEY
    base_url: https://api.deepseek.com

models:
  deepseek-reasoner:
    name: "DeepSeek Reasoner (思考模型)"
    provider: deepseek
    model: deepseek-reasoner
    defaults:
      params:
        max_tokens: 8192
        temperature: 0.3

nodes:
  research:
    model: deepseek-reasoner
    overrides:
      params:
        temperature: 0.3
```

### 迁移助手

```bash
tsx scripts/migrate-llm-config.ts --input config/llm.old.yaml --output config/llm.yaml
```

### 交互式模型选择

CLI 支持：
- 使用配置默认值
- 选择全局模型
- 每节点覆盖模型

选择结果会持久化回 `config/llm.yaml`。

## 输出配置 (`config/output.yaml`)

输出配置文件定义了文章生成工作流的输出目录结构、文件命名规则和 Checkpoint 设置。

### 核心概念

- **base_dir**：所有输出的根目录
- **structure**：不同类型文件的子目录结构
- **naming**：文件和目录的命名规则
- **checkpoint**：中间结果的保存策略

### 输出目录配置

```yaml
output:
  # 输出根目录（相对路径或绝对路径）
  base_dir: "./output"

  # 目录结构配置
  structure:
    research: "research/"      # 调研资料
    drafts: "drafts/"          # 文章草稿
    images: "images/"          # 配图
    final: "final/"            # 最终版本
    logs: "_logs/"             # 日志
    checkpoints: "_checkpoints/"  # Checkpoint
    temp: "_temp/"             # 临时文件

  # 目录创建策略
  creation_policy: "auto"     # auto / manual / strict
```

### 文件命名规则

```yaml
naming:
  # 运行 ID 格式
  run_id_format: "article-{datetime}"

  # 日期时间格式（Python strftime 格式）
  date_format: "%Y%m%d_%H%M%S"

  # 文件命名模板
  files:
    research: "research-{run_id}.md"
    draft: "draft-v{version}-{run_id}.md"
    polished: "polished-v{version}-{run_id}.md"
    titles: "titles-{run_id}.md"
    image: "image-{index}-{run_id}.png"
    image_prompt: "image-prompt-{index}-{run_id}.txt"
    html: "article-{run_id}.html"
    final: "final-{run_id}.md"
    log: "run-{run_id}.log"
    checkpoint: "checkpoint-{node_name}-{run_id}.json"
```

### 输出结构模式

```yaml
layout:
  # 布局模式
  # - flat: 所有文件放在对应的 type 目录下
  # - hierarchical: 每次运行创建独立的子目录
  # - hybrid: 混合模式（推荐）
  mode: "hybrid"

  # hybrid 模式配置（推荐）
  hybrid:
    # 内容文件按运行分组
    content_mode: "hierarchical"

    # 日志文件集中管理
    log_mode: "centralized"
```

**hybrid 模式结构示例：**
```
output/
  ├── content/
  │   ├── article-20250117_143022/
  │   │   ├── research.md
  │   │   ├── draft-v1.md
  │   │   ├── image-1.png
  │   │   └── final.md
  │   └── article-20250117_150330/
  │       └── ...
  └── _logs/
      ├── 2025-01-17/
      │   ├── run-143022.log
      │   └── run-150330.log
      └── 2025-01-18/
          └── ...
```

### Checkpoint 配置

```yaml
checkpoint:
  # 是否启用 Checkpoint
  enabled: true

  # Checkpoint 保存位置
  dir: "./src/checkpoints"

  # 保存策略
  # - every_node: 每个节点执行完都保存
  # - on_success: 只在节点成功时保存
  # - on_failure: 只在节点失败时保存
  # - end_only: 只在最后保存
  save_strategy: "every_node"

  # 保留策略
  retention:
    policy: "keep_n"    # all / latest_only / keep_n / by_date
    value: 10          # 保留最近 10 个

  # 压缩配置
  compression:
    enabled: false
    format: "gzip"      # gzip, bz2, lzma
    threshold: 1048576  # 大于 1MB 才压缩
```

### 日志配置

```yaml
logging:
  # 日志级别
  level: "INFO"        # DEBUG / INFO / WARNING / ERROR / CRITICAL

  # 日志格式
  format: "detailed"   # text / json / detailed

  # 控制台输出
  console:
    enabled: true
    colored: true
    level: "INFO"

  # 文件输出
  file:
    enabled: true
    max_size: 10485760  # 10MB
    backup_count: 5
    append: true
```

### 清理策略

```yaml
cleanup:
  # 是否启用自动清理
  enabled: true

  # 清理时机
  # - on_start: 运行开始时清理
  # - on_end: 运行结束时清理
  # - scheduled: 定时清理
  # - manual: 手动清理
  trigger: "on_start"

  # 清理规则
  rules:
    temp:
      age: "0s"          # 临时文件立即删除
      pattern: "*"

    logs:
      age: "30d"        # 日志文件保留 30 天
      pattern: "*.log"

    checkpoints:
      policy: "keep_n"
      value: 10

    outputs:
      age: "90d"        # 输出文件保留 90 天
      exclude: ["final/*", "important/*"]

  # 清理前确认
  confirm_before_cleanup: false
```

### 内容保留策略

```yaml
retention:
  # 最终版本保留策略
  final:
    policy: "all"       # all / by_date / by_count

  # 中间产物保留策略
  intermediate:
    drafts: 5           # 草稿保留数量
    images: "all"       # 图片保留策略（all / used_only）
    research: "latest"  # 调研资料保留策略（all / latest）
```

### 导出配置

```yaml
export:
  # 支持的导出格式
  formats:
    markdown:
      enabled: true
      extension: ".md"

    html:
      enabled: true
      extension: ".html"
      include_styles: true
      inline_images: false

    pdf:
      enabled: false
      extension: ".pdf"
      page_size: "A4"
      margin: "2cm"

    docx:
      enabled: false
      extension: ".docx"

  # 导出目标位置
  destinations:
    markdown: "./output/final"
    html: "./output/final"
    pdf: "./output/exports"
    docx: "./output/exports"
```

### 可用变量

**时间相关：**
- `{timestamp}`：Unix 时间戳（1737117022）
- `{datetime}`：格式化的日期时间（20250117_143022）
- `{date}`：日期（20250117）
- `{time}`：时间（143022）
- `{year}`：年份（2025）
- `{month}`：月份（01）
- `{day}`：日期（17）
- `{hour}`：小时（14）
- `{minute}`：分钟（30）
- `{second}`：秒（22）

**运行相关：**
- `{run_id}`：运行 ID（如 article-20250117_143022）
- `{sequence}`：递增序列号
- `{uuid}`：UUID v4

**内容相关：**
- `{version}`：版本号
- `{index}`：序号
- `{type}`：类型
- `{node_name}`：节点名称
