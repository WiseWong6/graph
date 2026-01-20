## 替换 Rewrite 模板为 Wise 写作宪法 v1.2

### 变更内容
将 `config/llm.yaml` 中的 `rewrite_user` 模板替换为新的「Wise 写作宪法（Style Prompt v1.2｜更短更硬｜MECE版）」。

### 新模板要点
1. **身份与原则**：活人感、真诚、边界
2. **结构骨架**（隐性覆盖）：Hook → 故事 → 翻转 → 机制 → 方法 → 价值观
3. **语言与排版**：短句优先、锚点句单独成行、禁论文体
4. **证据规则**：必须给来源线索或声明亲历经验
5. **输出协议**：只输出正文，文末追加 HKR 尾标

### 保留变量
- `{title}` - 标题
- `{draft_content}` - 待重写正文
- `{key_insights}` - 核心洞察
- `{recommended_angle}` - 推荐角度
- `{quotes}` - 金句点缀
- `{personal_rag_content}` - 作者历史内容参考
- `{personal_rag_voice}` - 作者历史风格参考

### 变更文件
- `config/llm.yaml` - 替换 `rewrite_user` 模板内容