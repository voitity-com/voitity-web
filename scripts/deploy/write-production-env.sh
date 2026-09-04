#!/usr/bin/env bash

set -euo pipefail

target_path="${1:?Target path is required}"
asm_exec_commit="1799aae50f30a8e97bab4faf38f2eadbd665028b"
asm_exec_checksum="d55eb38ad33a5b76f584ca180f633ecc120cf39b8fd29427ffbe11a8fbf19556"
asm_exec_url="https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/${asm_exec_commit}/plugins/aws-core/skills/aws-secrets-manager/references/asm-exec"
asm_exec_path="$(mktemp)"
provider_version="3.1.1"
provider_path="$(mktemp)"
provider_pid=""

cleanup() {
    if [ -n "$provider_pid" ]; then
        kill "$provider_pid" >/dev/null 2>&1 || true
        wait "$provider_pid" 2>/dev/null || true
    fi

    rm -f "$asm_exec_path" "$provider_path"
}

trap cleanup EXIT

curl --fail --silent --show-error --location "$asm_exec_url" --output "$asm_exec_path"
printf '%s  %s\n' "$asm_exec_checksum" "$asm_exec_path" | sha256sum --check --status
chmod 700 "$asm_exec_path"

case "$(uname -m)" in
    x86_64|amd64)
        provider_arch="x86_64-unknown-linux-gnu"
        provider_checksum="471c1978f8bf63a0aeefb425e974ac3c816c7e04feb302236512eea375160de4"
        ;;
    aarch64|arm64)
        provider_arch="aarch64-unknown-linux-gnu"
        provider_checksum="8b09dc4e58b84379f580a9ae179940bcb3de0338421f638a43376bf73380ffb6"
        ;;
    *)
        echo "Unsupported runner architecture: $(uname -m)" >&2
        exit 1
        ;;
esac

provider_url="https://artifacts.awcp.global.on.aws/${provider_version}/${provider_arch}/aws-workload-credentials-provider"
curl --fail --silent --show-error --location "$provider_url" --output "$provider_path"
printf '%s  %s\n' "$provider_checksum" "$provider_path" | sha256sum --check --status
chmod 700 "$provider_path"

"$provider_path" sm start >/dev/null 2>&1 &
provider_pid="$!"
sleep 1

if ! kill -0 "$provider_pid" >/dev/null 2>&1; then
    echo "AWS Workload Credentials Provider did not start." >&2
    exit 1
fi

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
