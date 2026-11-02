import { EventEmitter } from "node:events";
import path from "node:path";
import fsPromises from "node:fs/promises";
import fs from "node:fs";
import { pipeline } from "stream/promises";

import getFilesList from "../utils/getFilesList.js";
import getFileStats from "../utils/getFileStats.js";
import imitateDelay from "../utils/imitateDelay.js";

const categories = {
  Documents: [".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".pptx"],
  Images: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"],
  Archives: [".zip", ".rar", ".tar", ".gz", ".7z"],
  Code: [".js", ".py", ".java", ".cpp", ".html", ".css", ".json"],
  Videos: [".mp4", ".avi", ".mkv", ".mov", ".webm"],
  Other: [],
};

export default class Organizer extends EventEmitter {
  categories = categories;

  async organize(sourceDir, targetDir) {
    this.emit("copy-start", sourceDir, targetDir);
    const files = await getFilesList(sourceDir);
    const statistics = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {},
    };

    for (const category of Object.keys(this.categories)) {
      const categoryDir = path.join(targetDir, category);
      try {
        await fsPromises.mkdir(categoryDir, { recursive: true });
        await imitateDelay(50); // imitates delay 20 ms for visualization purposes
        this.emit("folder-created", category);
      } catch (error) {
        this.emit("copy-error", { file: categoryDir, error });
        throw error;
      }
    }

    for (const [index, file] of files.entries()) {
      const ext = path.extname(file).toLowerCase() || "(other)";
      let category = "Other";
      for (const [cat, extensions] of Object.entries(this.categories)) {
        if (extensions.includes(ext)) {
          category = cat;
          break;
        }
      }

      const categoryDir = path.join(targetDir, category);
      const fileName = path.basename(file);
      let targetPath = path.join(categoryDir, fileName);

      let counter = 1;
      while (true) {
        try {
          await fsPromises.access(targetPath);
          const parsed = path.parse(fileName);
          targetPath = path.join(
            categoryDir,
            `${parsed.name}(${counter})${parsed.ext}`,
          );
          counter++;
        } catch (error) {
          if (error.code === "ENOENT") {
            break;
          }
          this.emit("copy-error", { file: targetPath, error });
          throw error;
        }
      }

      try {
        const fileStats = await getFileStats(file);

        await imitateDelay(20); //imitates delay 20 ms for visualization purposes

        if (fileStats.size < 10 * 1024 * 1024) {
          await fsPromises.copyFile(file, targetPath);
        } else {
          await pipeline(
            fs.createReadStream(file),
            fs.createWriteStream(targetPath),
          );
        }

        statistics.totalFiles++;
        statistics.totalSize += fileStats.size;
        if (!statistics.byCategory[category]) {
          statistics.byCategory[category] = {
            count: 1,
            targetDir: categoryDir,
          };
        } else {
          statistics.byCategory[category].count++;
        }

        this.emit("file-copied", {
          current: statistics.totalFiles,
          total: files.length,
        });
      } catch (error) {
        this.emit("copy-error", { file, error });
      }
    }

    this.emit("copy-complete", statistics);
  }
}
