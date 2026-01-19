// Model selection node
// Allows users to keep defaults, pick a global model, or override specific nodes
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This node simply captures user choice and stores it in state - minimal logic, clean data flow.

import inquirer from "inquirer";
import type { ArticleState } from "../state";
import { getAvailableModels, getAvailableNodes, getNodeModelId, updateConfig } from "../../../config/llm.js";

/**
 * Model selection node (Gate A.5)
 *
 * Shows a CLI menu for selecting the LLM model strategy.
 * The selection is stored in state.decisions.selectedModel and/or selectedModels.
 *
 * Design principles:
 * - Respect existing selection as defaults
 * - Simple inquirer choice menu
 * - No business logic, just data capture
 * - Graceful degradation if no models available
 */
export async function selectModelNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  const existingSelection = state.decisions?.selectedModel;
  const existingOverrides = state.decisions?.selectedModels || {};

  // 2. Get available models from config
  const models = getAvailableModels();

  // 3. Handle empty models list
  if (models.length === 0) {
    console.warn("\n⚠️  No models configured in llm.yaml. Using default configuration.");
    return {};
  }

  // 4. Display selection menu
  console.log("\n🤖 选择 LLM 模型");
  console.log("─".repeat(40));

  const { selectionMode } = await inquirer.prompt([
    {
      type: "list",
      name: "selectionMode",
      message: "请选择配置方式:",
      choices: [
        { name: "使用配置文件默认模型", value: "default" },
        { name: "选择一个全局模型", value: "global" },
        { name: "按节点选择模型（仅修改需要的节点）", value: "per_node" }
      ],
      default: existingSelection ? "global" : "default"
    }
  ]);

  if (selectionMode === "default") {
    console.log("✓ 使用 config/llm.yaml 的默认模型配置");
    return {
      decisions: {
        ...state.decisions,
        selectedModel: undefined,
        selectedModels: {}
      }
    };
  }

  if (selectionMode === "global") {
    const { selectedModel } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedModel",
        message: "请选择要使用的全局模型:",
        choices: models.map((m: { id: string; name: string; provider: string }) => ({
          name: `${m.name} (${m.provider})`,
          value: m.id
        })),
        default: existingSelection || models[0]?.id
      }
    ]);

    const selectedModelConfig = models.find((m) => m.id === selectedModel);
    console.log(`✓ 已选择全局模型: ${selectedModelConfig?.name}`);

    updateConfig((config) => {
      config.defaults = config.defaults || {};
      config.defaults.model = selectedModel;
      if (config.nodes) {
        Object.values(config.nodes).forEach((node) => {
          node.model = selectedModel;
        });
      }
    });

    console.log("✓ 已写入 config/llm.yaml");

    return {
      decisions: {
        ...state.decisions,
        selectedModel,
        selectedModels: {}
      }
    };
  }

  const nodes = getAvailableNodes();
  if (nodes.length === 0) {
    console.warn("⚠️  未找到节点配置，改为使用默认模型。");
    return {
      decisions: {
        ...state.decisions,
        selectedModel: undefined,
        selectedModels: {}
      }
    };
  }

  const { overrideNodes } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "overrideNodes",
      message: "选择需要覆盖模型的节点（空=不覆盖）:",
      choices: nodes.map((nodeId) => ({
        name: nodeId,
        value: nodeId
      })),
      default: Object.keys(existingOverrides)
    }
  ]);

  const selectedModels: Record<string, string> = { ...existingOverrides };

  for (const nodeId of overrideNodes as string[]) {
    const defaultModelId = getNodeModelId(nodeId);
    const { modelId } = await inquirer.prompt([
      {
        type: "list",
        name: "modelId",
        message: `为节点 ${nodeId} 选择模型:`,
        choices: models.map((m) => ({
          name: `${m.name} (${m.provider})`,
          value: m.id
        })),
        default: selectedModels[nodeId] || defaultModelId || models[0]?.id
      }
    ]);
    selectedModels[nodeId] = modelId;
  }

  for (const nodeId of nodes) {
    if (!(overrideNodes as string[]).includes(nodeId)) {
      delete selectedModels[nodeId];
    }
  }

  updateConfig((config) => {
    config.nodes = config.nodes || {};
    for (const nodeId of overrideNodes as string[]) {
      const modelId = selectedModels[nodeId];
      if (!modelId) {
        continue;
      }
      config.nodes[nodeId] = config.nodes[nodeId] || { model: modelId };
      config.nodes[nodeId].model = modelId;
    }
  });

  console.log("✓ 已更新节点模型覆盖配置并写入 config/llm.yaml");

  return {
    decisions: {
      ...state.decisions,
      selectedModel: undefined,
      selectedModels
    }
  };
}
