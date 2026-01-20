import { displayImageInTerminal } from "../src/utils/terminal-image.js";
import { resolve } from "path";
import { promises as fs } from "fs";

async function test() {
  console.log("🧪 Testing terminal image display...\n");

  const testImage = resolve(process.cwd(), "output", "test-images", "test_1.png");

  console.log("Test image path:", testImage);
  console.log("TERM_PROGRAM:", process.env.TERM_PROGRAM);

  try {
    const stats = await fs.stat(testImage);
    console.log("File stats:", { size: stats.size, isFile: stats.isFile() });
  } catch (error) {
    console.log("Stat error:", error);
  }

  try {
    await displayImageInTerminal(testImage, 0);
    console.log("\n✅ Test complete!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

test();
