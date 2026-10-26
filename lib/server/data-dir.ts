import os from "os";
import path from "path";

export function dataDir() {
  if (process.env.VERCEL) return path.join(os.tmpdir(), "cs-learnmate");
  const configured = process.env.DATA_DIR ?? ".data";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export function isMemoryStorage() {
  return Boolean(
    process.env.VERCEL || process.env.LEARNMATE_MEMORY_STORE === "true"
  );
}
