#!/usr/bin/env bash
# Deploy WorkflowRegistry + AuditLog to Shannon with a fixed high gas limit per tx.
# `forge script` uses RPC gas estimates that can be too low on Shannon (OOG on CREATE).
#
# Usage (from repo root or contracts/):
#   export PRIVATE_KEY=0x...
#   export SOMNIA_RPC_URL=https://dream-rpc.somnia.network   # optional
#   ./script/deploy-mesh-shannon.sh
#
# Override gas cap (wei per gas is from the network; this is only the tx gas limit):
#   export MESH_DEPLOY_GAS_LIMIT=50000000

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RPC_URL="${SOMNIA_RPC_URL:-https://dream-rpc.somnia.network}"
GAS_LIMIT="${MESH_DEPLOY_GAS_LIMIT:-30000000}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "error: set PRIVATE_KEY in the environment" >&2
  exit 1
fi

echo "RPC:       $RPC_URL"
echo "Gas limit: $GAS_LIMIT (per transaction)"
echo ""

echo "==> WorkflowRegistry"
forge create src/WorkflowRegistry.sol:WorkflowRegistry \
  --broadcast \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --gas-limit "$GAS_LIMIT"

echo ""
echo "==> AuditLog"
forge create src/AuditLog.sol:AuditLog \
  --broadcast \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --gas-limit "$GAS_LIMIT"

echo ""
echo "Done. Set WORKFLOW_REGISTRY_ADDRESS (and note AuditLog) in the backend .env."
