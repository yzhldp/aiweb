# CS-LearnMate · 计算机专业智能学习助手

基于 **RAG 检索增强** 与 **AI Agent** 的计算机专业课智能学习平台。上传 PDF、Word、Markdown、网页、纯文本或课件截图构建私有知识库，完成可溯源的精准问答、考点总结、智能出题与代码批改。

![Tech](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-4.x-000)

## 功能

- **账号体系**：邮箱注册 / 登录，scrypt 加盐哈希存储密码，HttpOnly 会话 Cookie，未登录访问工作台自动跳转登录页。
- **多格式私有 + 公共知识库**：支持 PDF、Word（.docx）、Markdown、TXT、HTML 与 PNG / JPG / BMP 图片；文件头校验 → 文本提取（图片走中英文 OCR）→ 清洗 → 520 字重叠切片（90 字重叠）→ 向量化 → 检索。每份上传文档与切片都绑定所属账号，公共示例课件人人可读、只读。
- **个人模型管理**：在问答 / Agent 页配置任意 OpenAI 兼容模型（Base URL、模型名、API Key），密钥 AES-256-GCM 加密保存，仅本人可用，接口只返回掩码。
- **RAG 问答**：Top-K 混合检索（余弦相似度 + 关键词覆盖 + 短语加权），流式生成，回答附带原文片段与相关度，支持停止生成、按账号隔离的历史会话与清空。
- **AI Agent**：自动识别「复习 / 出题 / 批改」复合意图，拆解任务并按序调用工具；实时展示规划、步骤状态与耗时。
- **三大学习工具**：考点总结、智能出题（选择 / 简答 / 代码题 + 解析）、C / Python 代码批改（语法、边界、逻辑与逐行讲解）。
- **工程化**：Next.js 14 App Router、TypeScript 严格模式、Tailwind CSS、Zustand、SSE 流式协议、统一错误与空状态。

## 支持的资料格式

| 格式 | 扩展名 | 处理方式 |
| --- | --- | --- |
| PDF | `.pdf` | 读取文本层，清洗页码、页眉与断行 |
| Word | `.docx` | 通过 mammoth 提取段落与标题 |
| Markdown | `.md` `.markdown` | 去除标记符号，保留正文与代码内容 |
| 纯文本 | `.txt` | 解码 UTF-8 / UTF-16，拒绝二进制内容 |
| 网页 | `.html` `.htm` | 剔除脚本、样式与标签，解码 HTML 实体 |
| 图片 | `.png` `.jpg` `.jpeg` `.bmp` | Tesseract 中英文 OCR 识别后入库 |

上传时会校验扩展名与文件头（PDF `%PDF-`、DOCX `PK`、图片魔数），不匹配直接拒绝；旧版 `.doc` 需先另存为 `.docx`。单文件默认上限 20 MB，可通过 `MAX_UPLOAD_MB` 调整。图片 OCR 首次运行会加载语言包，耗时明显长于文本类文件；识别质量取决于截图清晰度，复杂公式与手写体建议同时上传原始讲义。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 ，先注册账号再进入工作台。

### 依赖清单

| 类别 | 主要依赖 | 用途 |
| --- | --- | --- |
| 框架 | `next@14.2.35`、`react@18.3`、`typescript@5.6` | App Router、页面渲染与类型检查 |
| 样式 | `tailwindcss@3.4`、`clsx`、`tailwind-merge`、`lucide-react` | 设计系统、类名合并与图标 |
| AI | `ai@4.3`、`@ai-sdk/openai@1.3` | OpenAI 兼容协议的流式问答与结构化生成 |
| 文档解析 | `pdf-parse`、`mammoth`、`tesseract.js`、`@tesseract.js-data/*` | PDF / Word 文本提取与中英文图片 OCR |
| 前端状态 | `zustand@5`、`react-markdown`、`remark-gfm`、`sonner` | 会话持久化、Markdown 渲染与消息提示 |

完整版本与锁文件见 [package.json](./package.json) 与 [package-lock.json](./package-lock.json)。

> 未配置任何密钥时，系统自动进入**本地演示模式**：使用本地哈希向量进行检索，并以检索片段 + 结构化模板完成问答与 Agent 工具输出。所有核心流程均可离线演示。

首次登录后可在知识库点击「载入公共示例」获得四门示范课件；新注册账号默认看到公共课件，自己上传的资料仅本人可见。

## 配置服务端默认模型与安全密钥（可选）

复制 `.env.example` 为 `.env.local`：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AUTH_SECRET` | 生产必填 | 会话签名密钥；未设置时自动生成 `.data/session.secret` |
| `MODEL_SECRET` | 生产必填 | 个人模型密钥加密密钥；未设置时回退 `AUTH_SECRET` 或本地文件 |
| `DEEPSEEK_API_KEY` | 可选 | 服务端默认模型密钥；为空则使用本地演示模式 |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_CHAT_MODEL` | 可选 | 默认模型地址与名称，兼容任意 OpenAI 协议服务 |
| `EMBEDDING_API_KEY` / `EMBEDDING_*` | 可选 | 远程 Embedding；未配置时使用本地哈希向量引擎 |
| `RAG_TOP_K` / `RAG_MIN_SCORE` | 可选 | 检索条数与相关度阈值 |
| `MAX_UPLOAD_MB` | 可选 | 单文件大小上限，默认 20 MB |
| `OCR_LANGS` | 可选 | Tesseract OCR 语言，默认 `chi_sim+eng` |
| `DATA_DIR` | 可选 | 本地数据目录，默认 `.data` |

```bash
# 生产环境必须设置；用于签名会话与加密个人模型密钥
AUTH_SECRET=<随机长字符串>
MODEL_SECRET=<随机长字符串>

# 服务端默认模型（用户未配置个人模型时生效）
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_CHAT_MODEL=deepseek-chat
```

若未设置 `AUTH_SECRET` / `MODEL_SECRET`，系统会在 `.data/` 下生成随机密钥文件（已 gitignore）。本地开发足够；**Serverless 多实例部署必须显式设置**，否则不同实例的登录态与模型密钥无法互认。

配置默认模型后，未配置个人模型的账号会使用服务端模型生成；请求失败会自动回退到本地演示输出。每个账号配置的个人模型优先于服务端默认模型。

可选接入任意 OpenAI 兼容的 Embedding 服务：

```bash
EMBEDDING_API_KEY=...
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIM=1024
```

未配置时使用内置 768 维本地哈希向量引擎。

## 账号、数据隔离与个人模型

- **隔离边界**：知识库文档与切片均带 `ownerId`。检索、列表、片段预览、删除、清空全部在服务端按当前会话用户过滤；访问他人私有文档统一返回 404。
- **公共资源**：示例课件标记为 `public`，所有账号可检索、可查看，但不可删除或清空。
- **对话记录**：Zustand 持久化按用户 ID 分区（`learnmate.conversations.<userId>.v1`），切换账号不会串会话。
- **个人模型**：每个账号可独立保存一套 Base URL / 模型名 / API Key。密钥使用 AES-256-GCM 加密后写入服务端，客户端只能读到 `sk-ab••••1234` 形式的掩码；问答与 Agent 仅以当前登录用户的配置调用模型。
- **防密钥外带**：修改 Base URL 时必须重新输入 API Key，避免已保存密钥被发送到其他地址；Base URL 仅允许 http/https，拒绝内嵌凭据、查询串和云元数据 / 内网地址。
- **密码与会话**：密码使用 scrypt 加盐哈希；会话为 HMAC-SHA256 签名的 HttpOnly、SameSite=Lax Cookie，默认 7 天。

## 技术架构

```
app/
  page.tsx                 产品首页
  login/                   登录 / 注册
  (workspace)/             登录后工作台（服务端会话守卫）
    chat/                  RAG 流式问答
    agent/                 Agent 任务编排与工具结果
    knowledge/             知识库管理（全部 / 我的 / 公共）
  api/
    auth/                  注册、登录、退出、当前用户
    models/                个人模型读取、保存、移除、连通性测试
    chat/                  检索 + 流式回答（SSE）
    agent/                 规划 + 工具调用（SSE）
    knowledge/             资料上传、多格式解析与 OCR、列表、删除、清空、预览
    status/                系统、知识库与生效模型状态
lib/
  rag/                     清洗、切片、Embedding、混合检索
  ai/                      模型提供方、Prompt、工具、本地回退
  agent/                   规则 + 意图规划器
  server/                  账号、会话、模型加密、文档解析、OCR、JSON 向量库、限流
components/                页面组件与 shadcn 风格基础 UI
stores/                    按用户分区的会话状态（Zustand persist）
```

**数据流**：`上传 → 文件头校验 → PDF / DOCX / Markdown / TXT / HTML 文本提取或图片 OCR → cleanExtractedText → chunkText(520/90) → embedTexts → vector store → hybrid retrieve → prompt → streamText → citations`

**SSE 协议**：

- 问答：`sources` → `meta` → `delta*` → `done`
- Agent：`plan` → (`step` → `result`)* → `final` → `done`

## 常用命令

```bash
npm run dev        # 开发服务器
npm run typecheck  # TypeScript 检查
npm run build      # 生产构建
npm run start      # 运行生产构建
```

## 部署到 Vercel

1. 推送仓库到 GitHub / Gitee；
2. 在 Vercel 导入项目，Framework 选择 Next.js；
3. 在 Environment Variables 中配置 `AUTH_SECRET`、`MODEL_SECRET`，以及可选的 `DEEPSEEK_API_KEY`；
4. 部署完成后即可访问。

> 账号（`.data/accounts.json`）、知识库（`.data/store.json`）与会话 / 模型加密密钥默认持久化在本地 `.data/`。Vercel 等 Serverless 环境使用实例临时目录与内存回退，实例回收后可能重置；多实例间也不共享数据。生产部署建议使用长驻 Node 环境，或把 `lib/server/accounts.ts`、`lib/server/store.ts` 替换为数据库 / 对象存储与 KMS 托管密钥。

## 仓库与团队信息

- **代码仓库**：https://gitee.com/yang-zuhuan/ai-web-website
- **团队名称**：CS-LearnMate 开发团队
- **团队分工**：RAG 与知识库、Agent 与工具链、前端与交互、测试与部署
- **仓库维护**：yang-zuhuan
- **反馈渠道**：Gitee Issues
- **提交规范**：采用 Conventional Commits（`feat` / `fix` / `docs` / `chore`），按功能阶段拆分提交

> 参赛评审如需仓库访问权限，请通过 Gitee 联系维护者。仓库内不包含任何真实 API Key、账号数据或本地向量库文件。

## 设计取舍

- 多格式解析以**可提取文本**为前提：扫描版 PDF 未做版面 OCR，请改用图片上传；图片 OCR 使用 Tesseract 中英文模型，公式、表格与手写体识别率有限；
- `.doc`、`.pptx`、`.xlsx` 暂不支持，请分别另存为 `.docx`、导出 PDF 或复制为 Markdown / TXT；
- 账号、知识库与个人模型为轻量 JSON 文件存储，适合单实例演示；未实现找回密码、邮箱验证与管理员后台；
- 个人模型密钥由服务端托管加密，不是端到端加密；浏览器只接触掩码，但服务端进程在调用时可解密；
- 不包含错题本与社区功能，聚焦 RAG + Agent + 前端工程化核心链路。

---

AI 生成内容仅供学习参考，请以教材、课程原始课件与教师要求为准。
