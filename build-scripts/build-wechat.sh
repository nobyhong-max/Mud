#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/build/wechat"

find_cocos_creator() {
  if [[ -n "${COCOS_CREATOR_PATH:-}" && -x "${COCOS_CREATOR_PATH}" ]]; then
    echo "${COCOS_CREATOR_PATH}"
    return 0
  fi

  if command -v CocosCreator >/dev/null 2>&1; then
    command -v CocosCreator
    return 0
  fi

  local base_dir="/Applications/CocosCreator/Creator"
  if [[ -d "${base_dir}" ]]; then
    local latest_version=""
    latest_version="$(ls -1 "${base_dir}" | sort -V | tail -n 1 || true)"
    if [[ -n "${latest_version}" ]]; then
      local candidate="${base_dir}/${latest_version}/CocosCreator.app/Contents/MacOS/CocosCreator"
      if [[ -x "${candidate}" ]]; then
        echo "${candidate}"
        return 0
      fi
    fi

    local legacy_candidate="${base_dir}/CocosCreator.app/Contents/MacOS/CocosCreator"
    if [[ -x "${legacy_candidate}" ]]; then
      echo "${legacy_candidate}"
      return 0
    fi
  fi

  return 1
}

echo "[build-wechat] Project root: ${PROJECT_ROOT}"
cd "${PROJECT_ROOT}"

COCOS_BIN="$(find_cocos_creator || true)"
if [[ -z "${COCOS_BIN}" ]]; then
  echo "[build-wechat] Error: Cocos Creator not found."
  echo "[build-wechat] Please install Cocos Creator v3.x or set COCOS_CREATOR_PATH."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[build-wechat] Error: node is required to run build-scripts/build-wechat.js"
  exit 1
fi

echo "[build-wechat] Detected Cocos Creator: ${COCOS_BIN}"
mkdir -p "${OUTPUT_DIR}"

export COCOS_CREATOR_PATH="${COCOS_BIN}"
node "${PROJECT_ROOT}/build-scripts/build-wechat.js" "$@"

if [[ ! -d "${OUTPUT_DIR}" ]]; then
  echo "[build-wechat] Error: output directory missing: ${OUTPUT_DIR}"
  exit 1
fi

if [[ -z "$(ls -A "${OUTPUT_DIR}" 2>/dev/null)" ]]; then
  echo "[build-wechat] Error: build output directory is empty: ${OUTPUT_DIR}"
  exit 1
fi

echo "[build-wechat] Build output validated at ${OUTPUT_DIR}"
