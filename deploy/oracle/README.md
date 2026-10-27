# Oracle Cloud Always Free 部署指南

面向 **Ubuntu 22.04 / 24.04 ARM64** 的 `VM.Standard.A1.Flex` 实例，使用 systemd 常驻 Next.js，Caddy 自动申请 HTTPS 证书。知识库、账号与个人模型配置保存在 `/var/lib/cs-learnmate`，重启和重新部署不会丢失。

## 1. 创建实例

在 Oracle Cloud 控制台创建：

- **Shape**：`VM.Standard.A1.Flex`
- **OCPU / 内存**：2 OCPU / 12 GB（Always Free 额度内）
- **镜像**：Canonical Ubuntu 22.04 或 24.04（ARM64）
- **引导卷**：50–100 GB
- **公网 IP**：分配 Public IPv4
- **SSH 密钥**：创建时上传你的公钥

> Always Free ARM 在部分区域可能暂时缺货，可换可用域重试；实例创建后不要随意停止，停止后公网 IP 可能变化，`nip.io` 域名与证书会失效。

## 2. 放行端口

两处都要放行：

1. **OCI 安全列表**：VCN → Security Lists → Default Security List，添加入站规则：
   - TCP 22，来源你的公网 IP（SSH）
   - TCP 80，来源 `0.0.0.0/0`
   - TCP 443，来源 `0.0.0.0/0`
2. **实例系统防火墙**：部署脚本会自动向 iptables 插入 80/443 规则并尝试持久化。

## 3. 一键部署

SSH 登录实例后执行：

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://gitee.com/yang-zuhuan/ai-web-website.git
cd ai-web-website
sudo bash deploy/oracle/setup.sh
```

脚本会自动：

- 安装 Node.js 22、Caddy、构建工具
- 创建 `learnmate` 系统用户与持久化目录
- 生成随机 `AUTH_SECRET`、`MODEL_SECRET`
- 拉取代码、`npm ci`、`next build`
- 写入 systemd 服务并启动
- 使用 `<公网IP>.nip.io` 自动申请 HTTPS 证书
- 将应用绑定在 `127.0.0.1:3000`，由 Caddy 对外代理

部署完成后访问：

```text
https://<公网IP>.nip.io
```

### 自定义域名

把域名的 A 记录指向实例公网 IP，然后重新执行：

```bash
sudo bash deploy/oracle/setup.sh --domain learn.example.com
```

### 只用 HTTP

如果暂时无法开放 443 或证书申请失败：

```bash
sudo bash deploy/oracle/setup.sh --http-only
```

访问 `http://<公网IP>`。HTTP 模式下登录 Cookie 不启用 Secure，仅建议短期演示使用。

## 4. 配置模型

编辑环境文件并重启：

```bash
sudo nano /etc/cs-learnmate.env
sudo systemctl restart cs-learnmate
```

可配置：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_CHAT_MODEL=deepseek-chat
```

不配置也能运行：系统进入本地演示模式。也可以在网页中为每个账号单独配置个人模型，密钥会加密保存在服务器持久化目录中。

## 5. 常用运维命令

```bash
# 服务状态
systemctl status cs-learnmate caddy --no-pager

# 应用日志
journalctl -u cs-learnmate -n 100 --no-pager -f

# 重启应用
sudo systemctl restart cs-learnmate

# 更新代码并重新部署
cd /opt/cs-learnmate
sudo bash deploy/oracle/setup.sh

# 健康检查（本机）
curl -I http://127.0.0.1:3000/
```

## 6. 数据与备份

- 账号、会话密钥、个人模型密钥、知识库与向量数据：`/var/lib/cs-learnmate`
- 环境变量：`/etc/cs-learnmate.env`（权限 600）
- 应用代码：`/opt/cs-learnmate`

建议定期备份：

```bash
sudo tar -czf /root/cs-learnmate-$(date +%F).tar.gz \
  /var/lib/cs-learnmate /etc/cs-learnmate.env
```

## 7. 常见问题

**Caddy 申请证书失败**
确认 OCI 安全列表和实例防火墙都放行了 80/443，且域名解析到当前公网 IP。可先用 `--http-only` 上线，再排查 DNS。

**ARM 实例创建失败**
Always Free ARM 可能缺货。换可用域重试，或等待一段时间再创建；不要为此升级为付费 Shape。

**上传大文件失败**
默认单文件 20 MB，可通过 `/etc/cs-learnmate.env` 的 `MAX_UPLOAD_MB` 调整；Caddy 默认不限制请求体，Next.js 路由会按配置校验。

**图片 OCR 很慢**
首次识别需要加载语言包，之后会缓存在 `/var/lib/cs-learnmate/ocr-cache`。2 OCPU / 12 GB 实例足够，建议上传清晰截图。

## 8. 安全说明

- `AUTH_SECRET`、`MODEL_SECRET` 由脚本随机生成，不写入 Git。
- 个人模型 API Key 使用 AES-256-GCM 加密后落盘，客户端只返回掩码。
- 应用只监听 `127.0.0.1:3000`，公网只暴露 Caddy 的 80/443。
- 建议 SSH 仅放行自己的 IP，并定期执行系统更新。
