# File Organizer

A Node.js command-line utility for scanning, organizing, finding duplicate files, and cleaning up old files.

## Requirements

- Node.js 20.1 or later (recursive `fs.readdir` is used)
- npm

## Installation

```bash
git clone https://github.com/Ponomaleks/nodejs-file-organizer.git
cd nodejs-file-organizer/file-organizer
npm install
```

Run the CLI directly or through npm scripts:

```bash
node file-organizer.js --help
npm run scan -- "C:\Users\Alice\Downloads"
```

On macOS/Linux, use paths such as `/home/alice/Downloads`. Quote paths that contain spaces.

## Commands

### `scan`

Recursively scans a directory and prints total file count and size, grouping by extension and age, the three largest files, and the oldest file.

```bash
node file-organizer.js scan "C:\Users\Alice\Downloads"
```

The `<directory>` argument is required and must point to an existing directory.

### `duplicates`

Recursively calculates SHA-256 hashes using read streams, groups files with identical content, and reports wasted space. Files are not deleted.

```bash
node file-organizer.js duplicates "C:\Users\Alice\Downloads"
```

The output includes each group’s copy count, hash, file paths, wasted space, and total wasted space.

### `organize`

Copies files into category folders. The target directory and category folders are created when needed.

```bash
node file-organizer.js organize "C:\Users\Alice\Downloads" --output "C:\Users\Alice\Organized"
```

Arguments:

- `<directory>`: source directory;
- `-o, --output <targetDirectory>`: required destination directory.

Supported categories:

| Category | Extensions |
|---|---|
| `Documents` | `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, `.xlsx`, `.pptx` |
| `Images` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp` |
| `Archives` | `.zip`, `.rar`, `.tar`, `.gz`, `.7z` |
| `Code` | `.js`, `.py`, `.java`, `.cpp`, `.html`, `.css`, `.json` |
| `Videos` | `.mp4`, `.avi`, `.mkv`, `.mov`, `.webm` |
| `Other` | unsupported extensions and files without an extension |

Files smaller than 10 MB use `fs.copyFile`. Files of 10 MB or larger use a stream pipeline. Name conflicts are resolved as `report.pdf`, `report(1).pdf`, `report(2).pdf`, and so on.

### `cleanup`

Finds files older than the specified number of days. Without `--confirm`, it is a dry run and does not change the filesystem.

```bash
node file-organizer.js cleanup "C:\Users\Alice\Downloads" --older-than 90
```

Arguments:

- `<directory>`: directory to scan;
- `-o, --older-than <days>`: required age threshold;
- `-c, --confirm`: actually delete the files found.

Preview first, then delete:

```bash
node file-organizer.js cleanup "C:\Users\Alice\Downloads" --older-than 90
node file-organizer.js cleanup "C:\Users\Alice\Downloads" --older-than 90 --confirm
```

Use `--confirm` carefully: deleted files are not moved to the recycle bin.

## Project structure

```text
file-organizer/
├── file-organizer.js          # CLI, argument parsing, output, and event listeners
├── lib/
│   ├── scanner.js             # Recursive scanning and statistics
│   ├── duplicates.js          # Streaming SHA-256 hashing and duplicate groups
│   ├── organizer.js           # Categorization, copying, streams, and conflicts
│   └── cleanup.js             # Age filtering, dry run, and deletion
├── utils/
│   ├── drawProgressBar.js     # Progress-bar formatting
│   ├── formatSize.js          # Human-readable byte formatting
│   ├── getFileStats.js        # Safe stat lookup and error reporting
│   ├── getFilesList.js        # Recursive discovery and error reporting
│   └── imitateDelay.js         # Delay used for visible progress updates
├── package.json               # Metadata, scripts, and dependencies
└── package-lock.json          # Locked dependency versions
```

## Architecture and error handling

Each command is implemented as an `EventEmitter`-based class. The CLI subscribes to lifecycle events to display progress bars, summaries, and errors.

File discovery and stat operations report specific `ENOENT` (not found) and `EACCES` (permission denied) errors, then rethrow them so failures cannot silently continue with invalid data. Copying, hashing, directory creation, and deletion also report the affected path. The CLI exits with status code `1` when an operation fails.

## npm scripts

```bash
npm run scan       # Pass command arguments after --
npm run duplicates # Pass command arguments after --
npm run organize   # Pass command arguments after --
npm run cleanup    # Pass command arguments after --
npm run help       # Show CLI help
npm start          # Start the CLI
```

Example:

```bash
npm run duplicates -- "C:\Users\Alice\Downloads"
```