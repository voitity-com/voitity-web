#!/usr/bin/env bash

set -euo pipefail

target_path="${1:?Target path is required}"
asm_exec_commit="1799aae50f30a8e97bab4faf38f2eadbd665028b"
asm_exec_checksum="d55eb38ad33a5b76f584ca180f633ecc120cf39b8fd29427ffbe11a8fbf19556"
asm_exec_url="https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/${asm_exec_commit}/plugins/aws-core/skills/aws-secrets-manager/references/asm-exec"
asm_exec_path="$(mktemp)"

cleanup() {
    rm -f "$asm_exec_path"
}

trap cleanup EXIT

curl --fail --silent --show-error --location "$asm_exec_url" --output "$asm_exec_path"
printf '%s  %s\n' "$asm_exec_checksum" "$asm_exec_path" | sha256sum --check --status
chmod 700 "$asm_exec_path"

export BIGMELO_WEB_ENV='{{resolve:secretsmanager:bigmelo/prod/web/env:SecretString::AWSCURRENT}}'
export BIGMELO_WEB_ENV_PATH="$target_path"

"$asm_exec_path" -- python3 -c '
import os
from pathlib import Path

content = os.environ["BIGMELO_WEB_ENV"]
target = Path(os.environ["BIGMELO_WEB_ENV_PATH"])

if not content.strip():
    raise SystemExit("Production web environment is empty.")

target.write_text(content.rstrip("\n") + "\n", encoding="utf-8")
os.chmod(target, 0o600)
'

unset BIGMELO_WEB_ENV
test -s "$target_path"
echo "Production web environment resolved securely."
