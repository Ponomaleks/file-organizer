import { EventEmitter } from "events";
import path from "node:path";
import fs from "node:fs/promises";

import getFilesList from "../utils/getFilesList.js";
import getFileStats from "../utils/getFileStats.js";
import imitateDelay from "../utils/imitateDelay.js";

export default class Cleanup extends EventEmitter {
  async cleanup(directoryPath, days, confirm) {
    const filesToDelete = [];
    const files = await getFilesList(directoryPath);

    for (const file of files) {
      const stats = await getFileStats(file);
      const fileAge = Date.now() - stats.mtime.getTime();
      const daysOld = fileAge / (1000 * 60 * 60 * 24);
      const basename = path.basename(file);

      if (daysOld > days) {
        filesToDelete.push({
          path: file,
          name: basename,
          size: stats.size,
          mtime: stats.mtime,
        });
      }
    }
    this.emit("file-found", filesToDelete);

    if (confirm) {
      for (const [index, file] of filesToDelete.entries()) {
        try {
          await imitateDelay(20); //imitates delay 20 ms for visualization purposes
          await fs.unlink(file.path);

          this.emit("file-deleted", {
            current: index + 1,
            total: filesToDelete.length,
          });
        } catch (error) {
          if (error.code === "ENOENT") {
            console.error(`❌ Error: File not found: ${file.path}`);
          } else if (error.code === "EACCES") {
            console.error(`❌ Error: Permission denied: ${file.path}`);
          } else {
            console.error(
              `❌ Unexpected error deleting "${file.path}": ${error.message}`,
            );
          }
        }
      }
    }

    if (confirm) {
      this.emit("cleanup-complete", {
        filesToDelete: filesToDelete.length,
        freedSpace: filesToDelete.reduce((acc, file) => acc + file.size, 0),
        confirm: true,
      });
    } else {
      this.emit("cleanup-complete", {
        filesToDelete: filesToDelete.length,
        freedSpace: filesToDelete.reduce((acc, file) => acc + file.size, 0),
        confirm: false,
      });
    }
  }
}
