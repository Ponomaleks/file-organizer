export default function drawProgressBar({
  message = null,
  current,
  total,
  width = 20,
}) {
  const percentage = current / total;
  const filled = Math.round(percentage * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `\r${message ? message + " " : ""}[${bar}] ${current}/${total} files`;
}
