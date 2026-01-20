## 实现计划：在终端直接显示图片（iTerm2 支持）

### 1. 新增终端图片显示工具
**文件**: `src/utils/terminal-image.ts`
- 检测 iTerm2 终端（`TERM_PROGRAM=iTerm.app`）
- 读取图片文件并转 Base64
- 发送 iTerm2 escape code 渲染图片
- 非 iTerm2 终端降级到路径显示

### 2. 修改图片生成节点
**文件**: `src/agents/article/nodes/11_images.node.ts`
- 在返回 state 前遍历 `validPaths`
- 调用 `displayImageInTerminal()` 显示每张图片
- 使用 console.log 直接输出（避免被并行缓冲机制影响）

### 3. 技术实现
- 使用 iTerm2 的 `ESC ] 1337 ; File = ... : Base64内容 BEL` escape code
- 零依赖，不引入新包
- 优雅降级：非 iTerm2 显示路径 + 文件信息

### 4. 效果预期
```
✅ 生成图片 (12s)

📸 图片 1:
[图片直接渲染在终端中]
output/xxx/images/image_01.png

📸 图片 2:
[图片直接渲染在终端中]
output/xxx/images/image_02.png
```

**改动文件**：
- 新增：`src/utils/terminal-image.ts`
- 修改：`src/agents/article/nodes/11_images.node.ts`