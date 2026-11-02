import fs from "node:fs/promises";
import path from "node:path";

export default async function getFilesList(directory) {
  try {
    const entries = await fs.readdir(directory, {
      recursive: true,
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`❌ Error: Directory not found: ${directory}`);
    } else if (error.code === "EACCES") {
      console.error(`❌ Error: Permission denied: ${directory}`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
    throw error;
  }
}
