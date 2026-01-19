// Model selection node
// Allows users to select which LLM model to use for all LLM nodes in the workflow
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This node simply captures user choice and stores it in state - minimal logic, clean data flow.

import inquirer from "inquirer";
import type { ArticleState } from "../state";
import { getAvailableModels } from "../../../config/llm.js";

/**
 * Model selection node (Gate A.5)
 *
 * Shows a CLI menu for selecting the LLM model to use.
 * The selected model ID is stored in state.decisions.selectedModel.
 *
 * Design principles:
 * - Check if already selected (skip if yes)
 * - Simple inquirer choice menu
 * - No business logic, just data capture
 * - Graceful degradation if no models available
 */
export async function selectModelNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  // 1. Check if already selected
  if (state.decisions?.selectedModel) {
    return {};
  }

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

  const { selectedModel } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedModel",
      message: "请选择要使用的模型:",
      choices: models.map((m: { id: string; name: string; provider: string }) => ({
        name: `${m.name} (${m.provider})`,
        value: m.id,
      })),
      default: models[0]?.id,
    },
  ]);

  const selectedModelConfig = models.find((m: { id: string; name: string; provider: string }) => m.id === selectedModel);
  console.log(`✓ 已选择: ${selectedModelConfig?.name}`);

  // 5. Save to state
  return {
    decisions: {
      ...state.decisions,
      selectedModel,
    },
  };
}
