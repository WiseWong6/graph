/**
 * Excel 文章库解析脚本
 *
 * 将 Excel 文件转换为 JSONL 格式，便于后续向量化
 *
 * 使用方式:
 *   npm run parse-articles
 */

import xlsx from "xlsx";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";

const INPUT_DIR = join(process.cwd(), "data/articles");
const OUTPUT_DIR = join(process.cwd(), "data/articles");

/**
 * 解析单个 Excel 文件
 */
function parseExcel(filePath: string): void {
  console.log(`[parse-articles] 正在解析: ${basename(filePath)}`);

  try {
    // 读取 Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 转换为 JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log(`[parse-articles]   读取到 ${data.length} 行数据`);

    // 转换为 JSONL
    const jsonlLines: string[] = [];

    for (const row of data as any[]) {
      // 提取关键字段
      const record = {
        title: row["文章标题"] || "",
        content: row["文章内容"] || "",
        author: row["公众号"] || "",
        publish_time: row["发布时间"] || "",
        url: row["文章链接"] || "",
        is_original: row["原创"] || "",
        author_name: row["作者"] || "",
        summary: row["文章摘要"] || ""
      };

      // 跳过空内容
      if (!record.title && !record.content) {
        continue;
      }

      jsonlLines.push(JSON.stringify(record));
    }

    // 写入文件
    const outputFile = join(OUTPUT_DIR, basename(filePath, ".xlsx") + ".jsonl");
    writeFileSync(outputFile, jsonlLines.join("\n"), "utf-8");

    console.log(`[parse-articles]   ✅ 输出: ${basename(outputFile)} (${jsonlLines.length} 条记录)`);
  } catch (error) {
    console.error(`[parse-articles] ❌ 解析失败: ${error}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log("[parse-articles] 开始解析文章库...\n");

  // 确保输出目录存在
  if (!readdirSync(OUTPUT_DIR).some(f => f.endsWith(".xlsx"))) {
    console.error(`[parse-articles] ❌ 未找到 Excel 文件: ${INPUT_DIR}`);
    console.log("[parse-articles] 提示: 请先将 Excel 文件复制到 data/articles/ 目录");
    process.exit(1);
  }

  // 获取所有 Excel 文件
  const files = readdirSync(INPUT_DIR).filter(f => f.endsWith(".xlsx"));

  console.log(`[parse-articles] 找到 ${files.length} 个 Excel 文件\n`);

  // 解析每个文件
  for (const file of files) {
    const filePath = join(INPUT_DIR, file);
    parseExcel(filePath);
  }

  console.log("\n[parse-articles] ✅ 所有文件解析完成!");
}

// 运行
main();
