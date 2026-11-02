import { EventEmitter } from "events";
import path from "node:path";
import getFilesList from "../utils/getFilesList.js";
import getFileStats from "../utils/getFileStats.js";
import imitateDelay from "../utils/imitateDelay.js";

export default class Scanner extends EventEmitter {
  async scan(directory) {
    const statistics = {
      totalFiles: 0,
      totalSize: 0,
      byType: new Map(),
      byAge: {
        last7Days: 0,
        last30Days: 0,
        olderThan90Days: 0,
      },
      largestFiles: [],
      oldestFile: null,
    };

    this.emit("scan-start", directory);

    const files = await getFilesList(directory);
    statistics.totalFiles = files.length;

    for (const [index, file] of files.entries()) {
      const stats = await getFileStats(file);

      statistics.totalSize += stats.size;

      const ext = path.extname(file).toLowerCase() || "(other)";
      if (!statistics.byType.has(ext)) {
        statistics.byType.set(ext, { count: 1, totalSize: stats.size });
      } else {
        const typeStats = statistics.byType.get(ext);
        typeStats.count += 1;
        typeStats.totalSize += stats.size;
      }

      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageInDays <= 7) {
        statistics.byAge.last7Days += 1;
      } else if (ageInDays <= 30) {
        statistics.byAge.last30Days += 1;
      } else if (ageInDays > 90) {
        statistics.byAge.olderThan90Days += 1;
      }

      if (
        !statistics.oldestFile ||
        stats.mtimeMs < statistics.oldestFile.mtime
      ) {
        statistics.oldestFile = { path: file, mtime: stats.mtimeMs };
      }

      statistics.largestFiles.push({ path: file, size: stats.size });

      await imitateDelay(20); // imitates delay 20 ms for visualization purposes
      this.emit("file-found", { current: index + 1, total: files.length }, {});
    }

    statistics.largestFiles.sort((a, b) => b.size - a.size);
    statistics.largestFiles = statistics.largestFiles.slice(0, 3);

    this.emit("scan-complete", statistics);
  }
}
