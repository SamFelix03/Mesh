import { defineChain } from "viem";

/**
 * Somnia Shannon testnet (official testnet name per Somnia network docs).
 * Chain id and RPC match `docs/somnia-reactivity-docs` and `network-config.md`.
 */
export const shannonTestnet = defineChain({
  id: 50312,
  name: "Somnia Shannon Testnet",
  network: "somnia-shannon-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "STT",
    symbol: "STT",
  },
  rpcUrls: {
    default: {
      http: [process.env.SOMNIA_RPC_URL ?? "https://dream-rpc.somnia.network"],
      webSocket: [process.env.SOMNIA_WS_URL ?? "ws://api.infra.testnet.somnia.network/ws"],
    },
    public: {
      http: [process.env.SOMNIA_RPC_URL ?? "https://dream-rpc.somnia.network"],
      webSocket: [process.env.SOMNIA_WS_URL ?? "ws://api.infra.testnet.somnia.network/ws"],
    },
  },
});

/** @deprecated Use `shannonTestnet` */
export const somniaTestnet = shannonTestnet;
