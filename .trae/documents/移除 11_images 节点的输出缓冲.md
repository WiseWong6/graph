## 修复图片显示被缓冲的 Bug

### 问题分析
`displayImageInTerminal` 使用 `console.log`，被 `step-cli.ts` 的 `outputCoordinator.defer()` 缓冲了。`11_images` 节点在 `DEFERRED_NODES_DURING_RENDER` 列表中，导致所有输出（包括图片显示）被延迟到 `09_humanize` 完成后才显示。

### 解决方案
修改 [src/cli/step-cli.ts:77-79](file:///Users/wisewong/Documents/Developer/write-agent/src/cli/step-cli.ts#L77-L79)，从缓冲列表中移除 `"11_images"`：

```typescript
const DEFERRED_NODES_DURING_RENDER = new Set([
  "10_prompts", "12_upload", "13_wait_for_upload"  // 移除 "11_images"
]);
```

### 效果
- 图片生成进度条实时显示
- 图片生成完成后立即显示（不被 `09_humanize` 流式输出缓冲）
- `09_humanize` 依然是聚焦节点（不影响它的输出优先级）