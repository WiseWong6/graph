# 配置指南

## 环境变量配置

项目使用 `.env` 文件管理环境变量。创建 `.env` 文件（参考 `.env.example`）：

```bash
# DeepSeek API（Research 节点）
DEEPSEEK_API_KEY=sk-xxx

# Anthropic API（Draft/Rewrite/Humanize 节点）
ANTHROPIC_API_KEY=sk-ant-xxx

# 火山引擎 API（生图）
ARK_API_KEY=xxx

# 微信公众号配置（Upload + Draftbox 节点）
WECHAT_APP_ID_1=wx1234567890abcdef
WECHAT_APP_SECRET_1=abcdef1234567890abcdef1234567890

WECHAT_APP_ID_2=wx9876543210fedcba
WECHAT_APP_SECRET_2=fedcba9876543210fedcba9876543210

# 上传并发数（可选，默认 5）
UPLOAD_CONCURRENCY=5

# 调试模式（可选）
DEBUG_TIME=true
```

## LLM 配置 (`src/config/llm.ts`)

LLM 配置采用 TypeScript 代码方式，支持节点级模型覆盖。

### 结构说明

- `DEFAULT_MODEL`：全局回退模型 ID
- `PROVIDERS`：提供商配置
- `MODELS`：模型注册（提供商 + 模型 + 默认参数）
- `NODE_OVERRIDES`：节点级模型覆盖

### 支持的提供商

1. **DeepSeek**
   - `deepseek-chat` - 聊天模型
   - `deepseek-reasoner` - 思考模型（Research 节点）

2. **Anthropic**
   - `claude-3-5-sonnet-20241022` - 高质量生成
   - `claude-3-5-haiku-20241022` - 快速生成

3. **Volcengine（火山引擎）**
   - `doubao-pro-32k` - 支持深度思考和流式输出

### 节点级模型配置

```typescript
// Research 节点：使用 DeepSeek 思考模型
NODE_OVERRIDES = {
  "02_research": {
    model: "deepseek-reasoner",
    params: {
      temperature: 0.3,
      max_tokens: 8192
    }
  },
  // Draft 节点：使用 Anthropic Sonnet
  "06_draft": {
    model: "claude-3-5-sonnet-20241022",
    params: {
      temperature: 0.7,
      max_tokens: 4096
    }
  },
  // Humanize 节点：使用 Anthropic Haiku（快速）
  "09_humanize": {
    model: "claude-3-5-haiku-20241022",
    params: {
      temperature: 0.5,
      max_tokens: 8192
    }
  }
};
```

### 交互式模型选择

CLI 支持：
- 使用配置默认值
- 选择全局模型（`01_select_model` 节点）
- 每节点覆盖模型

选择结果会保存到 `state.decisions.selectedModel`。

## 输出配置 (`src/config/output.ts`)

输出配置文件定义了文章生成工作流的输出目录结构、文件命名规则和 Checkpoint 设置。

### 核心概念

- **base_dir**：所有输出的根目录
- **structure**：不同类型文件的子目录结构
- **naming**：文件和目录的命名规则
- **checkpoint**：中间结果的保存策略

### 输出目录配置

```typescript
export const OUTPUT_CONFIG = {
  output: {
    base_dir: "./output",
    structure: {
      research: "research/",
      drafts: "drafts/",
      images: "images/",
      final: "final/",
      logs: "_logs/",
      checkpoints: "_checkpoints/",
      temp: "_temp/"
    },
    creation_policy: "auto"
  }
};
```

### 文件命名规则

```typescript
export const OUTPUT_CONFIG = {
  naming: {
    run_id_format: "article-{datetime}",
    date_format: "%Y%m%d_%H%M%S",
    files: {
      research: "research-{run_id}.md",
      draft: "draft-v{version}-{run_id}.md",
      polished: "polished-v{version}-{run_id}.md",
      titles: "titles-{run_id}.md",
      image: "image-{index}-{run_id}.png",
      image_prompt: "image-prompt-{index}-{run_id}.txt",
      html: "article-{run_id}.html",
      final: "final-{run_id}.md",
      log: "run-{run_id}.log",
      checkpoint: "checkpoint-{node_name}-{run_id}.json"
    }
  }
};
```

### 输出结构模式

```typescript
export const OUTPUT_CONFIG = {
  layout: {
    mode: "hybrid",
    hybrid: {
      content_mode: "hierarchical",
      log_mode: "centralized"
    }
  }
};
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

Checkpoint 使用 SQLite 持久化，位于 `src/checkpoints/article/checkpoints.db`。

```typescript
// graph.ts
const checkpointer = SqliteSaver.fromConnString(
  join(process.cwd(), "src", "checkpoints", "article", "checkpoints.db")
);
```

**Checkpoint 特性：**
- 自动保存每个节点的状态
- 支持中断和恢复
- ResumeManager 可列出所有历史 thread 和 checkpoint

## NPM 脚本

### 主要脚本

```bash
# 开发
npm run dev                # 监听模式启动
npm run build              # 编译 TypeScript
npm run start              # 运行编译后的代码

# 交互式 CLI
npm run step               # 步进模式（主入口）
npm run step -- --resume   # 恢复会话

# 单节点测试
npm run research           # 交互式调研
npm run test-titles        # 标题生成测试
npm run test-research      # 调研节点测试
npm run test-search        # 搜索功能测试
npm run test-interactive  # 交互节点测试

# RAG 相关
npm run parse-articles     # 解析文章库 Excel
npm run build-indices      # 构建向量索引
npm run rag:personal:index # 构建个人知识库索引
npm run test-retrieval     # 测试检索功能

# 图片流程测试
npm run test-image         # 图片生成测试
npm run test-prompts       # 图片提示词测试
npm run test-prompts:quick # 快速提示词测试
npm run test-full-pipeline # 完整图片流程测试

# HTML 流程测试
npm run test-html-flow     # HTML 转换测试

# Resume 功能测试
npm run test-resume        # ResumeManager 测试

# 测试
npm test                   # 运行所有测试
npm run test:unit          # 单元测试
npm run test:integration   # 集成测试
npm run test:e2e           # 端到端测试

# 代码质量
npm run lint               # ESLint 检查
npm run format             # Prettier 格式化
npm run typecheck          # TypeScript 类型检查
```

## 搜索超时配置

搜索超时在 `src/adapters/parallel-search.ts` 中配置：

```typescript
const SEARCH_TIMEOUT_MS = 30000; // 30 秒
```

**降级顺序：**
1. WebResearch (Google via Playwright) - 优先级 1
2. Firecrawl - 优先级 2

## 图片生成配置

### Ark API 配置

```bash
# 环境变量
ARK_API_KEY=xxx
```

### 支持的图片风格

```typescript
export const IMAGE_STYLES = {
  infographic: "信息图表风格",
  healing: "治愈系风格",
  pixar: "皮克斯风格",
  sokamono: "单色极简风格",
  handdrawn: "手绘风格"
};
```

### 图片生成参数

```typescript
// 11_images.node.ts
const IMAGE_CONFIG = {
  width: 1024,
  height: 1024,
  model: "doubao-seedream",
  disableWatermark: true
};
```

## 微信 API 配置

### Stable Token API

使用微信推荐的 `/cgi-bin/stable_token` 接口：

```typescript
// 12_upload.node.ts
async function getAccessToken(config: WechatApiConfig): Promise<string> {
  const response = await fetch(
    `${config.apiUrl}/cgi-bin/stable_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.appSecret
      })
    }
  );
  // ...
}
```

### 上传 API

使用 `/cgi-bin/media/uploadimg` 上传图文消息图片：

```typescript
async function uploadImage(
  imageBuffer: Buffer,
  config: WechatApiConfig
): Promise<string> {
  const formData = new FormData();
  formData.append("media", imageBuffer, {
    filename: "image.png",
    contentType: "image/png"
  });

  const response = await fetch(
    `${config.apiUrl}/cgi-bin/media/uploadimg?access_token=${token}`,
    {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData.getBuffer()
    }
  );
  // ...
}
```

## 调试配置

### 启用调试日志

```bash
# 时间调试（显示并行事件）
DEBUG_TIME=true npm run step

# 完整调试输出
DEBUG=true npm run step
```

### 查看检查点

```bash
# SQLite 查看工具
sqlite3 src/checkpoints/article/checkpoints.db
```

## 性能配置

### 并发控制

```bash
# 上传并发数（默认 5）
UPLOAD_CONCURRENCY=5
```

### 内存使用

- Node.js >= 20.0.0
- 推荐内存：至少 4GB
- 大型向量索引可能需要更多内存

## 故障排除

### 常见问题

1. **搜索超时**
   - 检查网络连接
   - 增加 `SEARCH_TIMEOUT_MS`
   - 检查代理设置

2. **LLM API 失败**
   - 检查 API Key 是否正确
   - 检查余额是否充足
   - 查看错误日志

3. **图片生成失败**
   - 检查 `ARK_API_KEY` 是否正确
   - 检查账户余额
   - 尝试其他图片风格

4. **微信上传失败**
   - 检查 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`
   - 检查账号权限（需要服务号）
   - 检查文件格式（必须是 PNG/JPG）

5. **恢复失败**
   - 检查 `checkpoints.db` 是否损坏
   - 尝试删除损坏的 checkpoint
   - 查看错误日志
