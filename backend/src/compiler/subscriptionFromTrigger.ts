import { parseGwei, type Address, type Hex } from "viem";
import type { SDK } from "@somnia-chain/reactivity";
import type { TriggerConfig } from "../dsl/types.js";
import type { GasConfig } from "../dsl/types.js";

export type SubscriptionGas = {
  priorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  isGuaranteed: boolean;
  isCoalesced: boolean;
};

export function subscriptionGas(gas?: GasConfig): SubscriptionGas {
  return {
    priorityFeePerGas: gas?.priorityFeePerGas ?? parseGwei(process.env.MESH_PRIORITY_FEE_GWEI ?? "2"),
    maxFeePerGas: gas?.maxFeePerGas ?? parseGwei(process.env.MESH_MAX_FEE_GWEI ?? "10"),
    gasLimit: gas?.gasLimit ?? (process.env.MESH_SUBSCRIPTION_GAS_LIMIT ? BigInt(process.env.MESH_SUBSCRIPTION_GAS_LIMIT) : 2_000_000n),
    isGuaranteed: true,
    isCoalesced: false,
  };
}

/**
 * Create the on-chain subscription for the workflow root trigger (event, block tick, or schedule).
 * Returns tx hash; caller waits for receipt and parses `SubscriptionCreated`.
 */
export async function createSubscriptionForRootTrigger(
  sdk: SDK,
  trigger: TriggerConfig,
  handlerContractAddress: Address,
  gas: SubscriptionGas,
): Promise<Hex | Error> {
  const base = {
    handlerContractAddress,
    ...gas,
  };

  if (trigger.type === "event") {
    return sdk.createSoliditySubscription({
      ...base,
      emitter: trigger.emitter,
      eventTopics: [trigger.eventTopic0],
    });
  }

  if (trigger.type === "cron:block") {
    return sdk.createOnchainBlockTickSubscription({
      ...base,
      blockNumber: trigger.blockNumber,
    });
  }

  if (trigger.type === "cron:timestamp") {
    return sdk.scheduleOnchainCronJob({
      ...base,
      timestampMs: trigger.timestampMs,
    });
  }

  return new Error("unknown trigger type");
}
