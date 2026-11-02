import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import readline from "node:readline";

import Scanner from "./lib/scanner.js";
import DuplicateFinder from "./lib/duplicates.js";
import Organizer from "./lib/organizer.js";
import Cleanup from "./lib/cleanup.js";
import drawProgressBar from "./utils/drawProgressBar.js";
import formatSize from "./utils/formatSize.js";

const program = new Command();

const SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

program
  .name("file-organizer")
  .description("CLI tool to organize files")
  .version("1.0.0");

program
  .command("scan <directory>")
  .description("Scan directory and show statistics")
  .action(async (directory) => {
    const scanner = new Scanner();
    scanner.on("scan-start", (directory) => {
      console.log(`📂 Scanning: ${directory}`);
    });
    scanner.on("file-found", (loading) => {
      process.stdout.write(
        drawProgressBar({
          message: "Processing...",
          current: loading.current,
          total: loading.total,
        }),
      );
    });
    scanner.on("scan-complete", (data) => {
      console.log("\n\n📊 Scan Results:");
      console.log(SEPARATOR);
      console.log(`Total files: ${data.totalFiles}`);
      console.log(`Total size: ${formatSize(data.totalSize)}`);
      console.log("\nBy file type:");
      for (const [ext, stats] of data.byType.entries()) {
        const extFormatted = ext.padEnd(12, " ");
        const countFormatted = `${stats.count} files,`.padEnd(12, " ");
        console.log(
          `  ${extFormatted} ${countFormatted} ${formatSize(stats.totalSize)}`,
        );
      }
      console.log("\nBy file age:");
      console.log(`  Last 7 days: ${data.byAge.last7Days} files`);
      console.log(`  Last 30 days: ${data.byAge.last30Days} files`);
      console.log(`  Older than 90 days: ${data.byAge.olderThan90Days} files`);
      console.log("\nLargest files:");
      data.largestFiles.forEach((file, index) => {
        console.log(
          `  ${index + 1}. ${path.basename(file.path)} ${formatSize(file.size)}`,
        );
      });
      if (data.oldestFile) {
        console.log(
          `\nOldest file: ${path.basename(data.oldestFile.path)} (modified ${getDaysSince(data.oldestFile.mtime)} days ago)`,
        );
      }
    });

    const directoryPath = resolvePathFromArgs(directory);
    await scanner.scan(directoryPath);
  });

program
  .command("duplicates <directory>")
  .description("Scan directory and show duplicate files")
  .action(async (directory) => {
    const duplicateFinder = new DuplicateFinder();

    duplicateFinder.on("duplicate-finding-started", (directory) => {
      console.log(`🔍 Searching for duplicates in: ${directory}`);
    });

    duplicateFinder.on("file-processed", (loading) => {
      process.stdout.write(
        drawProgressBar({
          message: "Calculating hashes...",
          current: loading.current,
          total: loading.total,
        }),
      );
    });

    duplicateFinder.on("duplicates-found", (duplicates) => {
      const totalWastedSpace = duplicates.reduce(
        (acc, group) => acc + group.wastedSpace,
        0,
      );

      console.log(
        `\n\nFound ${duplicates.length} duplicate groups (${formatSize(totalWastedSpace)} wasted):`,
      );
      console.log("\n" + SEPARATOR);
      for (let i = 0; i < duplicates.length; i++) {
        const group = duplicates[i];
        const groupSize = group.filePaths.length;

        console.log(
          `Group ${i + 1} (${groupSize} copies, ${formatSize(group.fileSize)} each:`,
        );
        console.log(`  SHA-256: ${group.hash}`);
        console.log("  \n");
        group.filePaths.forEach((filePath) => {
          console.log(`    📄 ${filePath}`);
        });
        console.log("  \n");
        console.log(`  Wasted space: ${formatSize(group.wastedSpace)}`);
        console.log("\n" + SEPARATOR);
      }
      console.log(`💾 Total wasted space: ${formatSize(totalWastedSpace)}`);
    });

    const directoryPath = resolvePathFromArgs(directory);
    await duplicateFinder.processFiles(directoryPath);
  });

// node file-organizer.js organize /source/directory --output /target/directory
program
  .command("organize <directory>")
  .description("Organize files in the specified directory")
  .requiredOption(
    "-o, --output <targetDirectory>",
    "Target directory for organized files",
  )
  .action(async (directory, options) => {
    const targetDirectory = options.output;
    const organizer = new Organizer();

    organizer.on("copy-start", (sourceDir, targetDir) => {
      console.log(`📦 Organizing: ${sourceDir}`);
      console.log(`Target: ${targetDir}`);
      console.log("\nCreating folders...");
    });
    organizer.on("folder-created", (folder) => {
      console.log(`  ✓ ${folder}/`);
    });

    organizer.on("file-copied", (loading) => {
      process.stdout.write(
        drawProgressBar({
          message: "Copying files...",
          current: loading.current,
          total: loading.total,
        }),
      );
    });

    organizer.on("copy-complete", (data) => {
      console.log("\n\n✅ Organization complete!");
      console.log("\nSummary:");
      for (const [category, stats] of Object.entries(data.byCategory)) {
        console.log(`  ${category}: ${stats.count} files → ${stats.targetDir}`);
      }
      console.log(
        `\nTotal copied: ${data.totalFiles} files (${formatSize(data.totalSize)})`,
      );
    });

    organizer.on("copy-error", ({ file, error }) => {
      if (error.code === "ENOENT") {
        console.error(`❌ Error: File or directory not found: ${file}`);
      } else if (error.code === "EACCES") {
        console.error(`❌ Error: Permission denied: ${file}`);
      } else {
        console.error(`❌ Error processing "${file}": ${error.message}`);
      }
    });
    const sourceDir = resolvePathFromArgs(directory);
    const targetDir = resolvePathFromArgs(targetDirectory, true);

    await organizer.organize(sourceDir, targetDir);
  });

//Команду cleanup — пошук та видалення файлів старіших за вказану кількість днів з підтримкою режиму попереднього перегляду (dry run)
program
  .command("cleanup <directory>")
  .description("Cleanup files older than specified days")
  .requiredOption(
    "-o, --older-than <days>",
    "Specify the number of days to determine old files",
  )
  .option(
    "-c, --confirm",
    "Preview files to be deleted without actually deleting them",
  )
  .action(async (directory, options) => {
    const days = parseInt(options.olderThan, 10);
    const confirm = options.confirm || false;
    const directoryPath = resolvePathFromArgs(directory);

    const cleanup = new Cleanup();

    console.log(`🧹 Cleanup: ${directoryPath}`);
    console.log(`Looking for files older than ${days} days...\n`);

    cleanup.on("file-found", (filesToDelete) => {
      printCleanupStatistics(filesToDelete);
    });

    cleanup.on("file-deleted", (loading) => {
      process.stdout.write(
        drawProgressBar({
          message: "Deleting...",
          current: loading.current,
          total: loading.total,
        }),
      );
    });

    cleanup.on("cleanup-complete", ({ filesToDelete, freedSpace, confirm }) => {
      if (!confirm) {
        console.log(SEPARATOR);
        console.log(
          `Total: ${filesToDelete} files (${formatSize(freedSpace)})`,
        );
        console.log("\n\n⚠️  DRY RUN MODE: No files were deleted.");
        console.log("To actually delete these files, run with --confirm flag.");
      } else {
        console.log("\n\n✅ Cleanup complete!");
        console.log(
          `Deleted: ${filesToDelete} files (${formatSize(freedSpace)} freed)`,
        );
      }
    });

    await cleanup.cleanup(directoryPath, days, confirm);
  });

program.parseAsync().catch((error) => {
  if (error.code === "ENOENT") {
    console.error(
      `❌ Error: File or directory not found: ${error.path ?? error.message}`,
    );
  } else if (error.code === "EACCES") {
    console.error(
      `❌ Error: Permission denied: ${error.path ?? error.message}`,
    );
  } else {
    console.error(`❌ Error: ${error.message}`);
  }
  process.exit(1);
});

function resolvePathFromArgs(directoryPath, createIfNotExists = false) {
  const resolvedPath = path.resolve(directoryPath);

  // 1. Якщо директорія вже існує — одразу повертаємо шлях
  if (fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }

  if (!createIfNotExists) {
    console.error(`Error: Directory "${resolvedPath}" does not exist.`);
    process.exit(1);
  }

  try {
    fs.mkdirSync(resolvedPath, { recursive: true });
    console.log(`Created directory: ${resolvedPath}`);
    return resolvedPath;
  } catch (error) {
    console.error(
      `Error: Could not create directory "${resolvedPath}": ${error.message}`,
    );
    process.exit(1);
  }
}

function printCleanupStatistics(filesToDelete) {
  console.log(`Found ${filesToDelete.length} files to delete:`);
  console.log("\n" + SEPARATOR);
  for (const fileData of filesToDelete) {
    const { name, size, mtime } = fileData;
    const formattedSize = formatSize(size);
    const formattedDate = formatDate(mtime);
    const daysOld = getDaysSince(mtime);

    console.log(
      `${name}\n` +
        `  Size: ${formattedSize}\n` +
        `  Modified: ${daysOld} days ago (${formattedDate})\n`,
    );
  }
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getDaysSince(timestamp) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}
