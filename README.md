# Write Agent

A LangGraph-based multi-agent writing system with MCP (Model Context Protocol) adapters.

## Overview

Write Agent is an intelligent writing assistant that uses multiple AI agents to research, plan, and generate content. It integrates with external services through MCP adapters like Firecrawl and Context7.

## Features

- **Multi-Agent Architecture**: Powered by LangGraph.js for complex workflow orchestration
- **MCP Adapters**: Seamless integration with Firecrawl, Context7, and other MCP services
- **CLI Interface**: Interactive command-line interface for easy usage
- **Flexible Configuration**: YAML-based configuration for LLM and output settings
- **Type-Safe**: Built with TypeScript for better development experience

## Installation

```bash
npm install
```

## Usage

### CLI

```bash
# Development mode with hot reload
npm run dev

# Build the project
npm run build

# Run the CLI
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## Project Structure

```
write-agent/
├── src/
│   ├── agents/          # Agent definitions and graphs
│   ├── adapters/        # MCP service adapters
│   ├── config/          # Configuration loaders
│   ├── utils/           # Utility functions
│   └── cli/             # CLI interface
├── config/              # YAML configuration files
├── output/              # Generated content output
├── tests/               # Test files
└── docs/                # Documentation
```

## Configuration

Edit `config/llm.yaml` for LLM settings and `config/output.yaml` for output configuration.

## License

MIT
