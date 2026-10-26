import { promises as fs } from "fs";
import path from "path";
import { createWorker } from "tesseract.js";
import { dataDir } from "@/lib/server/data-dir";

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

const LANGUAGE_PACKAGES = [
  { name: "chi_sim", pkg: "@tesseract.js-data/chi_sim" },
  { name: "eng", pkg: "@tesseract.js-data/eng" },
];

let workerPromise: Promise<OcrWorker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function prepareLanguagePath(): Promise<string | undefined> {
  const langDir = path.join(dataDir(), "ocr-lang");
  await fs.mkdir(langDir, { recursive: true });

  try {
    for (const language of LANGUAGE_PACKAGES) {
      const target = path.join(
        langDir,
        `${language.name}.traineddata.gz`
      );
      try {
        await fs.access(target);
        continue;
      } catch {
        // copy below
      }
      const source = path.join(
        process.cwd(),
        "node_modules",
        language.pkg,
        "4.0.0",
        `${language.name}.traineddata.gz`
      );
      await fs.copyFile(source, target);
    }
    return langDir;
  } catch {
    // Fall back to tesseract.js' remote language host when local data is absent.
    return undefined;
  }
}

async function createOcrWorker(): Promise<OcrWorker> {
  const langPath = await prepareLanguagePath();
  const cachePath = path.join(dataDir(), "ocr-cache");
  await fs.mkdir(cachePath, { recursive: true });
  return createWorker(
    process.env.OCR_LANGS?.trim() || "chi_sim+eng",
    1,
    {
      ...(langPath ? { langPath } : {}),
      cachePath,
      gzip: true,
    }
  );
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

async function recognizeOnce(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  try {
    const { data } = await worker.recognize(buffer);
    return data.text ?? "";
  } catch (error) {
    workerPromise = null;
    await worker.terminate().catch(() => undefined);
    throw error;
  }
}

/**
 * 串行执行 OCR：tesseract worker 不支持并发 recognize，
 * 上传限流已限制频率，这里再用队列避免同一 worker 被并发调用。
 */
export function recognizeImage(buffer: Buffer): Promise<string> {
  const run = queue.then(
    () => recognizeOnce(buffer),
    () => recognizeOnce(buffer)
  );
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
