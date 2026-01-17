import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { ArticleState } from "../state";

/**
 * Save generated text to file system
 * Creates a unique run directory and persists the generated content
 *
 * @param state - Current article workflow state with generatedText
 * @returns Partial state with outputPath and updated status
 */
export async function saveOutputNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  console.log("[save_output] Saving all generated texts to file");

  // Generate unique run ID
  const runId = `article-${Date.now()}-${uuidv4().substring(0, 8)}`;

  // Create output directory
  const outputDir = join(process.cwd(), "output", runId);
  mkdirSync(outputDir, { recursive: true });

  // Save all generated texts to separate files
  const files = [];

  if (state.generatedText) {
    const path1 = join(outputDir, "01_standard.txt");
    writeFileSync(path1, state.generatedText, "utf-8");
    files.push("01_standard.txt");
  }

  if (state.generatedText2) {
    const path2 = join(outputDir, "02_concise.txt");
    writeFileSync(path2, state.generatedText2, "utf-8");
    files.push("02_concise.txt");
  }

  if (state.generatedText3) {
    const path3 = join(outputDir, "03_creative.txt");
    writeFileSync(path3, state.generatedText3, "utf-8");
    files.push("03_creative.txt");
  }

  // Also create a combined file
  const combinedPath = join(outputDir, "all_versions.txt");
  const combinedContent = [
    "# 标准版本 (Node 1)\n\n",
    state.generatedText || "[未生成]",
    "\n\n---\n\n",
    "# 简洁版本 (Node 2)\n\n",
    state.generatedText2 || "[未生成]",
    "\n\n---\n\n",
    "# 创意版本 (Node 3)\n\n",
    state.generatedText3 || "[未生成]"
  ].join("");

  writeFileSync(combinedPath, combinedContent, "utf-8");
  files.push("all_versions.txt");

  console.log("[save_output] Saved files:", files.join(", "));
  console.log("[save_output] Output directory:", outputDir);

  return {
    outputPath: outputDir,
    status: "saved"
  };
}
