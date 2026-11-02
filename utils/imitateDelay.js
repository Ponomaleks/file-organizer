// додаємо затримку 100 мс після створення кожної директорії, щоб уникнути проблем з файловою системою

export default function imitateDelay(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
