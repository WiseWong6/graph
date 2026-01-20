## 修复方案

### 问题根源
配置文件 (`config/llm.yaml`) 中的节点 ID 与代码中传入的节点 ID 不一致，导致：
1. `10_prompts` 节点找不到配置，降级到 `deepseek-reasoner`
2. 流式输出抑制机制失效，`09_humanize` 流式输出期间 `10_prompts` 的输出没有被缓冲

### 修复步骤

1. **修改配置文件 `config/llm.yaml`**
   - 将 `nodes.image_prompt` 改为 `nodes.10_prompts`
   - 将 `nodes.humanize` 改为 `nodes.09_humanize`
   - 将 `nodes.draft` 改为 `nodes.06_draft`
   - 将 `nodes.rewrite` 改为 `nodes.07_rewrite`
   - 将 `nodes.title_gen` 改为 `nodes.04_titles`
   - 确保所有节点 key 与代码中传入的 nodeId 一致

2. **为后台节点添加 `suppress_streaming: true`**
   - `10_prompts` - 已配置，确认生效
   - `11_images`, `12_upload` - 如果是后台并行节点，添加此配置

3. **验证修复**
   - 运行测试，确认 `10_prompts` 使用 `doubao-seed-1-8-251228`
   - 确认 `09_humanize` 流式输出期间 `10_prompts` 输出被缓冲
   - 确认 `09_humanize` 完成后，缓冲的日志被统一输出

### 影响范围
- 仅修改 `config/llm.yaml`
- 不影响任何代码逻辑
- 向后兼容（修复后行为更正确）