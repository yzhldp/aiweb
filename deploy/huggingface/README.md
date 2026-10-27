---
title: CS-LearnMate
emoji: 🎓
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: 基于 RAG 与 AI Agent 的计算机专业学习助手
---

# CS-LearnMate · 计算机专业智能学习助手

基于 **RAG + AI Agent** 的全栈学习工作台：上传课件资料，获得带引用的问答、考点总结、分层练习与代码批改。

## 功能

- 多格式知识库：PDF、Word（.docx）、Markdown、TXT、HTML、图片（OCR）
- 混合检索问答：向量 + 关键词召回，Top-K 可调，流式输出并标注引用
- AI Agent：考点总结、智能出题、C/C++ 与 Python 代码批改，规划过程可见
- 账号体系：公共资料共享，私有资料与个人模型密钥按账号隔离
- 个人模型：填写自己的 OpenAI 兼容 API（Base URL / Key / 模型名），密钥服务端加密保存

## 使用说明

1. 首次访问请注册账号（密码 scrypt 加盐哈希保存）。
2. 知识库为空时，在知识库页面点击「载入示例资料」写入公共演示文档。
3. 未配置任何模型密钥时自动使用本地演示回答；在问答/Agent 页面右上角配置个人模型后可调用外部大模型。

## 数据持久化（重要）

免费 Space 的磁盘为**临时存储**：Space 重启、休眠唤醒或重新构建后，账号、知识库、会话与密钥都会被重置。

- 需要保留数据时，在 Space 设置中开启 **Persistent Storage**（付费），数据目录已固定为 `/data`，无需改代码；
- 或按 README 将 `lib/server/accounts.ts`、`lib/server/store.ts` 替换为数据库 / 对象存储。

## 环境变量与 Secrets

在 Space 的 **Settings → Variables and secrets** 中按需配置：

| 名称 | 说明 |
| --- | --- |
| `AUTH_SECRET` | 会话签名密钥，建议固定 |
| `MODEL_SECRET` | 个人模型密钥加密主密钥，建议固定 |
| `DEEPSEEK_API_KEY` | 可选，服务端默认模型 |
| `EMBEDDING_API_KEY` | 可选，外部 Embedding 服务 |
| `DATA_DIR` | 默认 `/data`，一般无需修改 |
| `COOKIE_SECURE` | 默认 `true`，HTTPS 环境保持开启 |

## 源码与许可

- 仓库：<https://gitee.com/yang-zuhuan/ai-web-website>
- 团队：CS-LearnMate 开发团队
- 说明：仓库内不包含任何真实 API Key、账号数据或本地向量库文件。
