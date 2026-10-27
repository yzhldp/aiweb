#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="${ROOT}/.tmp/hf-space"
SPACE="${HF_SPACE:-}"

usage() {
  cat <<'EOF'
用法：bash deploy/huggingface/deploy.sh <用户名>/<Space 名称>

示例：
  bash deploy/huggingface/deploy.sh yourname/cs-learnmate

首次推送会提示输入 Hugging Face 用户名与 Access Token（Write 权限）。
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SPACE="${1:-$SPACE}"
if [[ -z "$SPACE" ]]; then
  usage
  exit 1
fi
if [[ "$SPACE" != */* ]]; then
  echo "Space 名称格式应为 用户名/空间名" >&2
  exit 1
fi

command -v git >/dev/null || {
  echo "需要 git，请先安装 Git for Windows。" >&2
  exit 1
}

echo "[1/4] 克隆 Space 仓库 ${SPACE} ..."
rm -rf "$STAGE"
mkdir -p "$(dirname "$STAGE")"
git clone "https://huggingface.co/spaces/${SPACE}" "$STAGE"

echo "[2/4] 同步当前提交的源码 ..."
find "$STAGE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$ROOT" archive --format=tar HEAD | tar -x -C "$STAGE"
cp "$ROOT/deploy/huggingface/README.md" "$STAGE/README.md"

cd "$STAGE"
git add -A
if git diff --cached --quiet; then
  echo "源码与 Space 一致，无需提交。"
else
  git -c user.name="CS-LearnMate Deploy" \
      -c user.email="deploy@cs-learnmate.local" \
      commit -m "deploy: sync CS-LearnMate"
fi

echo "[3/4] 推送到 Hugging Face ..."
git push origin HEAD:main

echo "[4/4] 完成：https://huggingface.co/spaces/${SPACE}"
echo "Space 将自动构建，首次构建约 3-8 分钟，构建完成后可访问："
echo "https://${SPACE/\//-}.hf.space"
