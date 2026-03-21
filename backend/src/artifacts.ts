import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi, Hex } from "viem";

type ForgeArtifact = {
  abi: Abi;
  bytecode: { object: Hex };
};

const here = dirname(fileURLToPath(import.meta.url));

/** Repo `contracts/` directory (mesh-somnia/contracts). */
export function contractsRootDir(): string {
  if (process.env.CONTRACTS_ROOT) return process.env.CONTRACTS_ROOT;
  return join(here, "..", "..", "contracts");
}

function readArtifact(relativePathFromOut: string): ForgeArtifact {
  const path = join(contractsRootDir(), "out", relativePathFromOut);
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as ForgeArtifact;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(
        `Missing Forge artifact at ${path} — run \`cd contracts && forge build\` (CONTRACTS_ROOT=${contractsRootDir()})`,
      );
    }
    throw e;
  }
}

export function meshEventWorkflowNodeArtifact(): ForgeArtifact {
  return readArtifact("MeshEventWorkflowNode.sol/MeshEventWorkflowNode.json");
}

export function reactionSinkArtifact(): ForgeArtifact {
  return readArtifact("ReactionSink.sol/ReactionSink.json");
}

export function triggerEmitterArtifact(): ForgeArtifact {
  return readArtifact("TriggerEmitter.sol/TriggerEmitter.json");
}

export function workflowRegistryArtifact(): ForgeArtifact {
  return readArtifact("WorkflowRegistry.sol/WorkflowRegistry.json");
}

export function meshWorkflowExecutorArtifact(): ForgeArtifact {
  return readArtifact("MeshWorkflowExecutor.sol/MeshWorkflowExecutor.json");
}

export function meshSimpleStepNodeArtifact(): ForgeArtifact {
  return readArtifact("MeshSimpleStepNode.sol/MeshSimpleStepNode.json");
}
