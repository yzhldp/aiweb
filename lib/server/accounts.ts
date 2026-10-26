import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dataDir, isMemoryStorage } from "@/lib/server/data-dir";
import type {
  ModelRuntimeConfig,
  PublicUser,
  UserModelInfo,
} from "@/lib/types";

interface StoredModelConfig {
  baseURL: string;
  model: string;
  label: string;
  apiKeyEnc: string;
  apiKeyHint: string;
  temperature: number;
  updatedAt: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  model?: StoredModelConfig;
}

interface AccountsData {
  version: 1;
  users: UserRecord[];
}

const EMPTY: AccountsData = { version: 1, users: [] };

let cache: AccountsData | null = null;
let loadPromise: Promise<AccountsData> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
let storageMode: "local" | "memory" = isMemoryStorage() ? "memory" : "local";

function accountsPath() {
  return path.join(dataDir(), "accounts.json");
}

function isValid(value: unknown): value is AccountsData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AccountsData>;
  return data.version === 1 && Array.isArray(data.users);
}

async function persist(data: AccountsData) {
  if (storageMode === "memory") return;
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const tmp = path.join(
      dataDir(),
      `accounts.${process.pid}.${Date.now()}.tmp`
    );
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    await fs.rename(tmp, accountsPath());
  } catch (error) {
    storageMode = "memory";
    console.warn("[learnmate] 账号存储不可用，已切换为内存模式：", error);
  }
}

async function readFromDisk(): Promise<AccountsData> {
  try {
    const raw = await fs.readFile(accountsPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) throw new Error("invalid accounts schema");
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("[learnmate] 读取账号数据失败，将使用空账号集：", error);
    }
    return { version: 1, users: [] };
  }
}

async function getData(): Promise<AccountsData> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = readFromDisk().then((data) => {
      cache = data;
      return data;
    });
  }
  return loadPromise;
}

// JSON 文件的读改写必须串行，否则并发注册或保存模型会互相覆盖。
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const secretCache = new Map<string, Buffer>();

async function getSecret(
  envNames: string[],
  fileName: string,
  scope: string
): Promise<Buffer> {
  const cached = secretCache.get(scope);
  if (cached) return cached;

  const envValue = envNames
    .map((name) => process.env[name]?.trim())
    .find((value) => Boolean(value));
  let secret: Buffer;

  if (envValue) {
    secret = crypto.createHash("sha256").update(`${scope}:${envValue}`).digest();
  } else {
    const file = path.join(dataDir(), fileName);
    try {
      const stored = Buffer.from((await fs.readFile(file, "utf8")).trim(), "base64");
      if (stored.length < 32) throw new Error("secret too short");
      secret = stored;
    } catch {
      secret = crypto.randomBytes(48);
      try {
        await fs.mkdir(dataDir(), { recursive: true });
        await fs.writeFile(file, secret.toString("base64"), { mode: 0o600 });
      } catch (error) {
        console.warn("[learnmate] 无法持久化密钥，重启后会话将失效：", error);
      }
    }
  }

  if (secret.length < 32) {
    secret = crypto.createHash("sha256").update(secret).digest();
  }
  secretCache.set(scope, secret);
  return secret;
}

export function getSessionSecret() {
  return getSecret(["AUTH_SECRET"], "session.secret", "session");
}

async function getModelKey() {
  return getSecret(
    ["MODEL_SECRET", "AUTH_SECRET"],
    "model.secret",
    "model"
  );
}

const scryptAsync = (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number
) =>
  new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  const prefix = trimmed.slice(0, Math.min(5, trimmed.length - 4));
  return `${prefix}••••${trimmed.slice(-4)}`;
}

// 明文密钥不落盘：AES-256-GCM 加密后按 v1.iv.tag.cipher 存储，客户端只拿到掩码。
async function encryptSecret(value: string) {
  const key = (await getModelKey()).subarray(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

async function decryptSecret(payload: string) {
  const [version, ivRaw, tagRaw, dataRaw] = payload.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) return null;
  try {
    const key = (await getModelKey()).subarray(0, 32);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivRaw, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function toModelInfo(record: UserRecord): UserModelInfo | null {
  if (!record.model) return null;
  return {
    baseURL: record.model.baseURL,
    model: record.model.model,
    label: record.model.label,
    apiKeyHint: record.model.apiKeyHint,
    temperature: record.model.temperature,
    updatedAt: record.model.updatedAt,
  };
}

function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    createdAt: record.createdAt,
    model: toModelInfo(record),
  };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const data = await getData();
  const record = data.users.find((user) => user.id === id);
  return record ? toPublicUser(record) : null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const name = input.name.trim().slice(0, 24);
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!name) throw new Error("请输入昵称");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("请输入有效的邮箱地址");
  }
  if (password.length < 6 || password.length > 72) {
    throw new Error("密码长度需为 6-72 位");
  }

  return exclusive(async () => {
    const data = await getData();
    if (data.users.some((user) => user.email === email)) {
      throw new Error("该邮箱已注册，请直接登录");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scryptAsync(password, salt, 64);
    const record: UserRecord = {
      id: `usr_${crypto.randomBytes(10).toString("hex")}`,
      name,
      email,
      salt,
      passwordHash: hash.toString("hex"),
      createdAt: new Date().toISOString(),
    };
    data.users.push(record);
    await persist(data);
    return toPublicUser(record);
  });
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<PublicUser | null> {
  const normalized = normalizeEmail(email);
  const data = await getData();
  const record = data.users.find((user) => user.email === normalized);
  if (!record) return null;

  const hash = await scryptAsync(password, record.salt, 64);
  const expected = Buffer.from(record.passwordHash, "hex");
  if (expected.length !== hash.length) return null;
  if (!crypto.timingSafeEqual(expected, hash)) return null;
  return toPublicUser(record);
}

export async function getUserModelInfo(
  userId: string
): Promise<UserModelInfo | null> {
  const data = await getData();
  const record = data.users.find((user) => user.id === userId);
  return record ? toModelInfo(record) : null;
}

export async function getUserRuntimeModel(
  userId: string
): Promise<ModelRuntimeConfig | null> {
  const data = await getData();
  const record = data.users.find((user) => user.id === userId);
  if (!record?.model) return null;
  const apiKey = await decryptSecret(record.model.apiKeyEnc);
  if (!apiKey) return null;
  return {
    baseURL: record.model.baseURL,
    model: record.model.model,
    apiKey,
    temperature: record.model.temperature,
  };
}

export interface SaveModelInput {
  baseURL: string;
  model: string;
  label: string;
  temperature: number;
  apiKey?: string;
}

export async function saveUserModel(
  userId: string,
  input: SaveModelInput
): Promise<UserModelInfo> {
  return exclusive(async () => {
    const data = await getData();
    const record = data.users.find((user) => user.id === userId);
    if (!record) throw new Error("账号不存在");

    const apiKey = input.apiKey?.trim();
    if (
      !apiKey &&
      record.model &&
      record.model.baseURL !== input.baseURL
    ) {
      throw new Error("更换 Base URL 时需重新填写 API Key，避免密钥被发送到其他地址");
    }
    let encrypted = record.model?.apiKeyEnc;
    let hint = record.model?.apiKeyHint;
    if (apiKey) {
      encrypted = await encryptSecret(apiKey);
      hint = maskApiKey(apiKey);
    }
    if (!encrypted || !hint) {
      throw new Error("首次配置需要填写 API Key");
    }

    record.model = {
      baseURL: input.baseURL,
      model: input.model,
      label: input.label,
      temperature: input.temperature,
      apiKeyEnc: encrypted,
      apiKeyHint: hint,
      updatedAt: new Date().toISOString(),
    };
    await persist(data);
    return toModelInfo(record)!;
  });
}

export async function removeUserModel(userId: string): Promise<boolean> {
  return exclusive(async () => {
    const data = await getData();
    const record = data.users.find((user) => user.id === userId);
    if (!record?.model) return false;
    delete record.model;
    await persist(data);
    return true;
  });
}

export async function hasUserModel(userId: string) {
  return Boolean(await getUserModelInfo(userId));
}

export function getAccountsStorageMode() {
  return storageMode;
}
