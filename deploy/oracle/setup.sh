#!/usr/bin/env bash
set -euo pipefail

# CS-LearnMate Oracle Cloud Always Free 一键部署脚本
# 适用：Ubuntu 22.04 / 24.04 ARM64（VM.Standard.A1.Flex）
# 用法：
#   sudo bash deploy/oracle/setup.sh
#   sudo bash deploy/oracle/setup.sh --domain learn.example.com
#   sudo bash deploy/oracle/setup.sh --http-only
#   sudo bash deploy/oracle/setup.sh --repo <git-url> --branch master

APP_DIR="/opt/cs-learnmate"
DATA_DIR="/var/lib/cs-learnmate"
ENV_FILE="/etc/cs-learnmate.env"
REPO_URL="https://gitee.com/yang-zuhuan/ai-web-website.git"
BRANCH="master"
DOMAIN=""
HTTP_ONLY="false"
SKIP_CLONE="false"

usage() {
  cat <<'EOF'
CS-LearnMate Oracle Cloud 部署脚本

选项：
  --domain <域名>    使用 HTTPS 域名；不填时自动生成 <公网IP>.nip.io
  --http-only        只监听 80 端口，不申请 HTTPS 证书
  --repo <地址>      Git 仓库地址，默认 Gitee
  --branch <分支>    默认 master
  --dir <目录>       安装目录，默认 /opt/cs-learnmate
  --data-dir <目录>  持久化数据目录，默认 /var/lib/cs-learnmate
  --skip-clone       跳过 git clone / pull，使用 --dir 中已有代码
  -h, --help         显示帮助

示例：
  sudo bash deploy/oracle/setup.sh
  sudo bash deploy/oracle/setup.sh --domain 140.238.1.2.nip.io
  sudo bash deploy/oracle/setup.sh --http-only
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --http-only)
      HTTP_ONLY="true"
      shift
      ;;
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --data-dir)
      DATA_DIR="${2:-}"
      shift 2
      ;;
    --skip-clone)
      SKIP_CLONE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo bash deploy/oracle/setup.sh" >&2
  exit 1
fi

DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%/}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates git openssl caddy

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  echo "安装 Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v) / npm: $(npm -v)"

if ! id -u learnmate >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash learnmate
fi

install -d -m 755 -o learnmate -g learnmate "$APP_DIR"
install -d -m 750 -o learnmate -g learnmate "$DATA_DIR"

if [[ "$SKIP_CLONE" != "true" ]]; then
  if [[ -d "$APP_DIR/.git" ]]; then
    runuser -u learnmate -- git -C "$APP_DIR" fetch origin "$BRANCH"
    runuser -u learnmate -- git -C "$APP_DIR" checkout "$BRANCH"
    runuser -u learnmate -- git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  else
    runuser -u learnmate -- git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
fi

if [[ "$HTTP_ONLY" == "true" ]]; then
  DOMAIN=":80"
fi
if [[ -z "$DOMAIN" ]]; then
  PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://ifconfig.me/ip 2>/dev/null || true)"
  fi
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://ipv4.icanhazip.com 2>/dev/null || true)"
  fi
  if [[ -n "$PUBLIC_IP" ]]; then
    DOMAIN="${PUBLIC_IP}.nip.io"
    echo "未指定域名，自动使用 nip.io 域名：$DOMAIN"
  else
    echo "无法获取公网 IP，请加 --domain <域名> 或 --http-only" >&2
    exit 1
  fi
fi

if [[ "$DOMAIN" == ":80" ]]; then
  COOKIE_SECURE="false"
else
  COOKIE_SECURE="true"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  AUTH_SECRET="$(openssl rand -hex 48)"
  MODEL_SECRET="$(openssl rand -hex 48)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
DATA_DIR=$DATA_DIR
AUTH_SECRET=$AUTH_SECRET
MODEL_SECRET=$MODEL_SECRET
COOKIE_SECURE=$COOKIE_SECURE
NEXT_TELEMETRY_DISABLED=1

# 可选：服务端默认大模型（也可在网页中为每个账号配置个人模型）
# DEEPSEEK_API_KEY=
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_CHAT_MODEL=deepseek-chat

# 可选：远程 Embedding（默认使用内置本地哈希向量引擎）
# EMBEDDING_API_KEY=
# EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
# EMBEDDING_MODEL=BAAI/bge-m3
# EMBEDDING_DIM=1024

# OCR_LANGS=chi_sim+eng
# MAX_UPLOAD_MB=20
EOF
  chmod 600 "$ENV_FILE"
  echo "已生成 $ENV_FILE（包含随机 AUTH_SECRET 与 MODEL_SECRET）"
else
  if grep -q '^DATA_DIR=' "$ENV_FILE"; then
    sed -i "s|^DATA_DIR=.*|DATA_DIR=$DATA_DIR|" "$ENV_FILE"
  else
    printf '\nDATA_DIR=%s\n' "$DATA_DIR" >> "$ENV_FILE"
  fi
  if grep -q '^COOKIE_SECURE=' "$ENV_FILE"; then
    sed -i "s|^COOKIE_SECURE=.*|COOKIE_SECURE=$COOKIE_SECURE|" "$ENV_FILE"
  else
    printf 'COOKIE_SECURE=%s\n' "$COOKIE_SECURE" >> "$ENV_FILE"
  fi
  echo "保留已有 $ENV_FILE（仅同步 DATA_DIR / COOKIE_SECURE）"
fi

echo "安装依赖并构建（首次约 3-8 分钟）..."
runuser -u learnmate -- env HOME=/home/learnmate DATA_DIR="$DATA_DIR" NODE_ENV=production NODE_OPTIONS=--max-old-space-size=3072 npm --prefix "$APP_DIR" ci
runuser -u learnmate -- env HOME=/home/learnmate DATA_DIR="$DATA_DIR" NODE_ENV=production NODE_OPTIONS=--max-old-space-size=3072 npm --prefix "$APP_DIR" run build

sed -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__DATA_DIR__|$DATA_DIR|g" \
    "$APP_DIR/deploy/oracle/cs-learnmate.service" > /etc/systemd/system/cs-learnmate.service
systemctl daemon-reload
systemctl enable cs-learnmate
systemctl restart cs-learnmate

sed "s|__DOMAIN__|$DOMAIN|g" "$APP_DIR/deploy/oracle/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

open_port() {
  local port="$1"
  if command -v iptables >/dev/null 2>&1; then
    if ! iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
    fi
  fi
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$port/tcp" >/dev/null || true
  fi
}
open_port 80
if [[ "$DOMAIN" != ":80" ]]; then
  open_port 443
fi
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  apt-get install -y iptables-persistent >/dev/null 2>&1 || true
fi
netfilter-persistent save >/dev/null 2>&1 || true

sleep 2
if curl -fsS --max-time 10 http://127.0.0.1:3000/ >/dev/null; then
  echo "应用已在本机 3000 端口启动"
else
  echo "应用尚未就绪，请查看日志：journalctl -u cs-learnmate -n 100 --no-pager" >&2
fi

if [[ "$DOMAIN" == ":80" ]]; then
  PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  echo "访问地址：http://${PUBLIC_IP:-<公网IP>}"
  echo "请确认 OCI 安全列表已放行 TCP 80。"
else
  echo "访问地址：https://$DOMAIN"
  echo "请确认 OCI 安全列表已放行 TCP 80 与 443，且域名已解析到本机。"
fi
echo "持久化数据：$DATA_DIR"
echo "环境配置：$ENV_FILE"
echo "配置默认模型：sudo nano $ENV_FILE && sudo systemctl restart cs-learnmate"
