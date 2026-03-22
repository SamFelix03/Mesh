import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/reactivity";
import { shannonTestnet } from "./shannonChain.js";

/** Normalize .env private key: trim, strip quotes, optional 0x, reject bad length. */
export function normalizePrivateKeyEnv(raw: string): Hex {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\s+/g, "");
  if (!s.startsWith("0x")) s = `0x${s}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(s)) {
    throw new Error(
      "PRIVATE_KEY must be 64 hex characters (optionally with 0x). Check .env for quotes, spaces, or newlines.",
    );
  }
  return s as Hex;
}

export function httpRpcUrl() {
  return process.env.SOMNIA_RPC_URL ?? shannonTestnet.rpcUrls.default.http[0];
}

/** Optional fixed gas for large `CREATE` txs on Shannon (RPC estimates are often too low). */
export function meshContractDeployGas(): bigint | undefined {
  const raw = process.env.MESH_CONTRACT_DEPLOY_GAS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  return BigInt(raw);
}

export function createPublicHttpClient(): PublicClient {
  return createPublicClient({
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
}

/** Public client with WebSocket transport — required for `sdk.subscribe` (trace engine). */
export function createPublicWsClient(): PublicClient {
  const wsUrl = shannonTestnet.rpcUrls.default.webSocket?.[0];
  if (!wsUrl) throw new Error("Shannon testnet config missing WebSocket URL");
  return createPublicClient({
    chain: shannonTestnet,
    transport: webSocket(wsUrl),
  });
}

export function requireDeployAccount(): PrivateKeyAccount {
  const raw = process.env.PRIVATE_KEY;
  if (!raw) throw new Error("PRIVATE_KEY is required for on-chain operations");
  return privateKeyToAccount(normalizePrivateKeyEnv(raw));
}

export function createMeshSdk(opts?: { account?: PrivateKeyAccount }) {
  const publicClient = createPublicWsClient();
  const account =
    opts?.account ??
    (process.env.PRIVATE_KEY ? requireDeployAccount() : undefined);
  const walletClient: WalletClient | undefined =
    account &&
    createWalletClient({
      account,
      chain: shannonTestnet,
      transport: http(httpRpcUrl()),
    });
  return new SDK({
    public: publicClient,
    wallet: walletClient,
  });
}

/** SDK with HTTP public client only — use for scripts that do not open WebSockets. */
export function createMeshSdkHttpPublic(opts?: { account?: PrivateKeyAccount }) {
  const publicClient = createPublicHttpClient();
  const account =
    opts?.account ??
    (process.env.PRIVATE_KEY ? requireDeployAccount() : undefined);
  const walletClient: WalletClient | undefined =
    account &&
    createWalletClient({
      account,
      chain: shannonTestnet,
      transport: http(httpRpcUrl()),
    });
  return new SDK({
    public: publicClient,
    wallet: walletClient,
  });
}
