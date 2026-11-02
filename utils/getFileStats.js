import fs from "node:fs/promises";

export default async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`❌ Error: File not found: ${filePath}`);
    } else if (error.code === "EACCES") {
      console.error(`❌ Error: Permission denied: ${filePath}`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
    throw error;
  }
}
