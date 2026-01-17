# Configuration Guide

## LLM Configuration (`config/llm.yaml`)

### Models

The system supports multiple OpenAI models:

- **gpt-4o-mini**: Cost-effective, fast (default)
- **gpt-4o**: High-performance for complex tasks
- **o3-mini**: Reasoning-optimized

### Environment Variables

```bash
export OPENAI_API_KEY="your-api-key"
```

### Example Configuration

```yaml
default:
  provider: "openai"
  model: "gpt-4o-mini"
  temperature: 0.7
  maxTokens: 4096
```

## Output Configuration (`config/output.yaml`)

### Formats

- **Markdown** (.md): Plain text markdown (default)
- **HTML** (.html): Formatted HTML
- **PDF** (.pdf): PDF documents (requires additional setup)

### File Naming

Pattern: `{{timestamp}}-{{topic}}`

Example: `2024-01-17-143022-ai-writing.md`

### Example Configuration

```yaml
outputDir: "./output"

formats:
  - type: "markdown"
    extension: ".md"
    enabled: true
```
