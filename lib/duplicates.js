import crypto from "node:crypto";
import fs from "node:fs";
import { EventEmitter } from "node:events";

import getFilesList from "../utils/getFilesList.js";
import getFileStats from "../utils/getFileStats.js";
import imitateDelay from "../utils/imitateDelay.js";

export default class DuplicateFinder extends EventEmitter {
  hashMap = new Map();

  async processFiles(directory) {
    this.emit("duplicate-finding-started", directory);
    const files = await getFilesList(directory);

    for (const [index, file] of files.entries()) {
      const hash = await this._calculateHash(file);
      await imitateDelay(20); // imitates delay 20 ms for visualization purposes
      this.emit("file-processed", { current: index + 1, total: files.length });

      if (!this.hashMap.has(hash)) {
        this.hashMap.set(hash, [file]);
      } else {
        this.hashMap.get(hash).push(file);
      }
    }

    const duplicates = Array.from(this.hashMap.entries())
      .filter(([_, filePaths]) => filePaths.length > 1)
      .map(([hash, filePaths]) => ({ hash, filePaths }));

    if (duplicates.length === 0) {
      console.log("\n✅ No duplicates found.");
      return;
    }

    for (const group of duplicates) {
      const fileSize = (await getFileStats(group.filePaths[0])).size;
      group.fileSize = fileSize;
      group.wastedSpace = fileSize * (group.filePaths.length - 1);
    }

    this.emit("duplicates-found", duplicates);
  }

  async _calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (error) => {
        if (error.code === "ENOENT") {
          reject(new Error(`File not found while hashing: ${filePath}`, { cause: error }));
        } else if (error.code === "EACCES") {
          reject(new Error(`Permission denied while hashing: ${filePath}`, { cause: error }));
        } else {
          reject(new Error(`Could not hash file "${filePath}": ${error.message}`, { cause: error }));
        }
      });
    });
  }
}
