import { readFile } from "fs/promises";
import chalk from "chalk";
import { stat } from "fs/promises";

const ESC = "\x1b";
const BEL = "\x07";

function isIterm2(): boolean {
  return process.env.TERM_PROGRAM === "iTerm.app";
}

async function fileToBase64(filePath: string): Promise<string> {
  try {
    const buffer = await readFile(filePath);
    return buffer.toString("base64");
  } catch (error) {
    throw new Error(`Failed to read image file: ${error}`);
  }
  return "" as never;
}

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await readFile(filePath);
    if (buffer.length < 24) return null;

    const isPng = buffer.toString("ascii", 1, 4) === "PNG";
    if (isPng) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function displayImageInTerminal(imagePath: string, index: number = 0): Promise<void> {
  const title = `图片 ${index + 1}`;
  
  if (!isIterm2()) {
    console.log(`\n📸 ${title}:`);
    console.log(`   ${imagePath}`);
    try {
      const stats = await stat(imagePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`   ${chalk.gray(`大小: ${sizeKB} KB (非 iTerm2 终端，无法预览)`)}`);
    } catch {
      console.log(`   ${chalk.gray("无法读取文件信息")}`);
    }
    return;
  }

  try {
    const base64 = await fileToBase64(imagePath);
    const dims = await getImageDimensions(imagePath);
    const width = dims?.width || 800;
    const height = dims?.height || 450;

    console.log(`\n📸 ${title}:`);
    console.log(`   ${chalk.gray(imagePath)}`);
    process.stdout.write(
      `${ESC}]1337;File=name=${Buffer.from(imagePath).toString("base64")};width=${width};height=${height};inline=1:${base64}${BEL}\n`
    );
  } catch (error) {
    console.log(`\n📸 ${title}:`);
    console.log(`   ${imagePath}`);
    console.log(`   ${chalk.red(`显示失败: ${error}`)}`);
  }
}
