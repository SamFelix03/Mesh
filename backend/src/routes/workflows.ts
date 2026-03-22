import type { FastifyInstance } from "fastify";
import { getAddress, isAddress, isHex, zeroAddress, type Address } from "viem";
import { compileWorkflowDefinition } from "../compiler/compileWorkflow.js";
import { validateWorkflowForCompiler } from "../compiler/validateForCompiler.js";
import {
  normalizeWorkflowDefinition,
  validateWorkflowDefinition,
  WorkflowValidationError,
} from "../dsl/validateWorkflow.js";
import {
  assertNoOrphanEvaluationHooks,
  definitionForOnChainCompile,
  needsHybridEvaluation,
  validateHybridWorkflow,
} from "../hybridWorkflow.js";
import type { WorkflowDefinition } from "../dsl/types.js";
import { createPublicHttpClient } from "../sdk.js";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import { workflowIdFromString } from "../workflowId.js";
import { deployCompiledWorkflow } from "../services/deployCompiledWorkflow.js";
import { deployPerNodeFanoutWorkflow } from "../services/deployPerNodeFanout.js";
import { deployDemoWorkflow } from "../services/deployDemoWorkflow.js";
import { deleteWorkflowOnChain, pauseWorkflowOnChain, resolveWorkflowIdParam } from "../services/workflowLifecycle.js";
import {
  findWorkflowIndexEntry,
  indexDeployedWorkflow,
  loadWorkflowIndex,
  updateWorkflowIndexStatus,
} from "../services/workflowIndex.js";

const STATUS = ["None", "Active", "Paused", "Deleted"] as const;

function registryAddress(): `0x${string}` | null {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw) as `0x${string}`;
}

export function registerWorkflowRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { full?: string };
  }>("/workflows", async (request) => {
    const full = request.query.full === "1" || request.query.full === "true";
    const { workflows } = loadWorkflowIndex();
    if (full) return { workflows };
    return {
      workflows: workflows.map((w) => {
        const { definition: _omit, ...rest } = w;
        return rest;
      }),
    };
  });

  app.post<{
    Body: { definition?: WorkflowDefinition; deployMode?: "executor" | "perNodeFanout" };
  }>("/workflows/compile", async (request, reply) => {
    const raw = request.body?.definition;
    if (!raw) {
      return reply.code(400).send({ error: "Body must include definition (WorkflowDefinition)" });
    }
    const def = normalizeWorkflowDefinition(raw);
    const deployMode = request.body.deployMode ?? "executor";
    try {
      if (deployMode === "perNodeFanout") {
        const { validatePerNodeFanout } = await import("../services/perNodeFanoutValidate.js");
        validatePerNodeFanout(def);
        const compiled = compileWorkflowDefinition(def);
        return JSON.parse(
          JSON.stringify(
            {
              deployMode: "perNodeFanout" as const,
              workflowId: compiled.workflowId,
              nodeCount: compiled.steps.length,
              stepNodeIds: compiled.stepNodeIds,
              rootTrigger: compiled.rootTrigger,
              hybridEvaluation: false,
            },
            (_, v) => (typeof v === "bigint" ? v.toString() : v),
          ),
        );
      }

      if (needsHybridEvaluation(def)) validateHybridWorkflow(def);
      else {
        validateWorkflowDefinition(def);
        assertNoOrphanEvaluationHooks(def);
      }
      const compiled = compileWorkflowDefinition(definitionForOnChainCompile(def));
      const hybridEvaluation = needsHybridEvaluation(def);
      return JSON.parse(
        JSON.stringify(
          {
            deployMode: "executor" as const,
            workflowId: compiled.workflowId,
            rootStepNodeId: compiled.rootStepNodeId,
            stepNodeIds: compiled.stepNodeIds,
            steps: compiled.steps.map((s) => ({
              target: s.target,
              data: s.data,
              logTopic0: s.logTopic0,
              nextIndices: [...s.nextIndices],
            })),
            rootTrigger: compiled.rootTrigger,
            hybridEvaluation,
          },
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      );
    } catch (e) {
      if (e instanceof WorkflowValidationError) {
        return reply.code(400).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  app.post<{
    Body: { definition?: WorkflowDefinition; forCompiler?: boolean; forHybrid?: boolean };
  }>("/workflows/validate", async (request, reply) => {
    const raw = request.body?.definition;
    if (!raw) {
      return reply.code(400).send({ error: "Body must include definition (WorkflowDefinition)" });
    }
    const def = normalizeWorkflowDefinition(raw);
    try {
      if (request.body?.forHybrid) {
        validateHybridWorkflow(def);
        if (request.body?.forCompiler) {
          validateWorkflowForCompiler(definitionForOnChainCompile(def));
        }
        return {
          ok: true as const,
          forHybrid: true as const,
          forCompiler: !!request.body?.forCompiler,
          hybridEvaluation: true,
        };
      }
      if (request.body?.forCompiler) {
        if (needsHybridEvaluation(def)) validateHybridWorkflow(def);
        else assertNoOrphanEvaluationHooks(def);
        validateWorkflowForCompiler(definitionForOnChainCompile(def));
      } else {
        validateWorkflowDefinition(def);
        assertNoOrphanEvaluationHooks(def);
      }
      return {
        ok: true as const,
        forCompiler: !!request.body?.forCompiler,
        hybridEvaluation: needsHybridEvaluation(def),
      };
    } catch (e) {
      if (e instanceof WorkflowValidationError) {
        return reply.code(400).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  app.post<{
    Body: { workflowStringId?: string; emitterAddress?: string };
  }>("/workflows", async (request, reply) => {
    const reg = registryAddress();
    if (!reg) {
      return reply.code(503).send({ error: "WORKFLOW_REGISTRY_ADDRESS is not set or invalid" });
    }
    if (!process.env.PRIVATE_KEY) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required to deploy workflows" });
    }

    const workflowStringId = request.body?.workflowStringId?.trim();
    if (!workflowStringId) {
      return reply.code(400).send({ error: "Body must include workflowStringId (string)" });
    }

    let emitterAddress: `0x${string}` | undefined;
    if (request.body.emitterAddress !== undefined && request.body.emitterAddress !== "") {
      if (!isAddress(request.body.emitterAddress)) {
        return reply.code(400).send({ error: "emitterAddress must be a valid address" });
      }
      emitterAddress = getAddress(request.body.emitterAddress) as `0x${string}`;
    }

    try {
      const result = await deployDemoWorkflow({ workflowStringId, emitterAddress });
      indexDeployedWorkflow({
        workflowStringId,
        workflowId: result.workflowId,
        status: "active",
        emitter: result.emitter,
        sink: result.sink,
        workflowNode: result.workflowNode,
        subscriptionId: result.subscriptionId,
        registeredAt: new Date().toISOString(),
        kind: "demo",
        transactionHashes: result.transactionHashes,
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already registered")) {
        return reply.code(409).send({ error: msg });
      }
      request.log.error(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.post<{
    Body: { definition?: WorkflowDefinition; deployMode?: "executor" | "perNodeFanout" };
  }>("/workflows/from-definition", async (request, reply) => {
    const reg = registryAddress();
    if (!reg) {
      return reply.code(503).send({ error: "WORKFLOW_REGISTRY_ADDRESS is not set or invalid" });
    }
    if (!process.env.PRIVATE_KEY) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required" });
    }

    const raw = request.body?.definition;
    if (!raw) {
      return reply.code(400).send({ error: "Body must include definition (WorkflowDefinition)" });
    }
    const def = normalizeWorkflowDefinition(raw);

    const deployMode = request.body.deployMode ?? "executor";

    try {
      if (deployMode === "perNodeFanout") {
        validateWorkflowDefinition(def);
        assertNoOrphanEvaluationHooks(def);
        const result = await deployPerNodeFanoutWorkflow(def);
        const emitter: Address =
          result.rootTrigger.type === "event" ? result.rootTrigger.emitter : zeroAddress;
        indexDeployedWorkflow({
          workflowStringId: def.id,
          workflowId: result.workflowId,
          status: "active",
          emitter,
          sink: zeroAddress,
          workflowNode: result.nodeAddresses[0]!,
          subscriptionId: result.subscriptionIds[0]!,
          subscriptionIds: result.subscriptionIds,
          nodeAddresses: result.nodeAddresses,
          registeredAt: new Date().toISOString(),
          name: def.name,
          kind: "compiled",
          transactionHashes: result.transactionHashes,
          definition: def,
          hybridEvaluation: false,
          deployMode: "perNodeFanout",
        });
        return { ...result, hybridEvaluation: false as const, deployMode: "perNodeFanout" as const };
      }

      if (needsHybridEvaluation(def)) validateHybridWorkflow(def);
      else {
        validateWorkflowDefinition(def);
        assertNoOrphanEvaluationHooks(def);
      }
      const hybridEvaluation = needsHybridEvaluation(def);
      const result = await deployCompiledWorkflow(definitionForOnChainCompile(def));
      const emitter: Address =
        result.rootTrigger.type === "event" ? result.rootTrigger.emitter : zeroAddress;
      indexDeployedWorkflow({
        workflowStringId: def.id,
        workflowId: result.workflowId,
        status: "active",
        emitter,
        sink: zeroAddress,
        workflowNode: result.executor,
        subscriptionId: result.subscriptionId,
        registeredAt: new Date().toISOString(),
        name: def.name,
        kind: "compiled",
        transactionHashes: result.transactionHashes,
        definition: def,
        hybridEvaluation,
        deployMode: "executor",
      });
      return { ...result, hybridEvaluation, deployMode: "executor" as const };
    } catch (e) {
      if (e instanceof WorkflowValidationError) {
        return reply.code(400).send({ error: e.message, code: e.code });
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already registered")) {
        return reply.code(409).send({ error: msg });
      }
      request.log.error(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.get<{
    Params: { id: string };
  }>("/workflows/:id/resolved-id", async (request, reply) => {
    try {
      const workflowId = resolveWorkflowIdParam(request.params.id);
      return { workflowId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get<{
    Params: { id: string; subId: string };
  }>("/workflows/:id/subscriptions/:subId", async (request, reply) => {
    const subId = BigInt(request.params.subId);
    const { createMeshSdk } = await import("../sdk.js");
    const sdk = createMeshSdk();
    const info = await sdk.getSubscriptionInfo(subId);
    if (info instanceof Error) {
      return reply.code(502).send({ error: info.message });
    }
    return { subscriptionId: subId.toString(), info };
  });

  app.get<{
    Params: { id: string };
  }>("/workflows/:id", async (request, reply) => {
    const reg = registryAddress();
    if (!reg) {
      return reply.code(503).send({
        error: "WORKFLOW_REGISTRY_ADDRESS not configured",
      });
    }

    const { id } = request.params;
    let workflowId: `0x${string}`;
    try {
      workflowId = id.startsWith("0x") && isHex(id) && id.length === 66 ? (id as `0x${string}`) : workflowIdFromString(id);
    } catch {
      return reply.code(400).send({ error: "Invalid workflow id" });
    }

    const client = createPublicHttpClient();
    const exists = await client.readContract({
      address: reg,
      abi: workflowRegistryAbi,
      functionName: "workflowExists",
      args: [workflowId],
    });
    if (!exists) {
      return reply.code(404).send({ error: "Workflow not found" });
    }

    const [owner, status, nodes, subscriptionIds] = await client.readContract({
      address: reg,
      abi: workflowRegistryAbi,
      functionName: "getWorkflow",
      args: [workflowId],
    });

    const indexRow = findWorkflowIndexEntry({ workflowId, idParam: id });
    const indexMeta =
      indexRow === null
        ? null
        : {
            workflowStringId: indexRow.workflowStringId,
            name: indexRow.name,
            kind: indexRow.kind,
            registeredAt: indexRow.registeredAt,
            indexStatus: indexRow.status,
            definition: indexRow.definition,
            hybridEvaluation: indexRow.hybridEvaluation === true,
            deployMode: indexRow.deployMode ?? "executor",
            subscriptionIds: indexRow.subscriptionIds,
            nodeAddresses: indexRow.nodeAddresses,
            emitter: indexRow.emitter,
            sink: indexRow.sink,
            workflowNode: indexRow.workflowNode,
            subscriptionId: indexRow.subscriptionId,
            transactionHashes: indexRow.transactionHashes,
          };

    return {
      workflowId,
      registryAddress: reg,
      owner,
      status: STATUS[status] ?? `Unknown(${status})`,
      nodes,
      subscriptionIds: subscriptionIds.map((s) => s.toString()),
      indexMeta,
    };
  });

  app.post<{
    Params: { id: string };
  }>("/workflows/:id/pause", async (request, reply) => {
    if (!process.env.PRIVATE_KEY) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required" });
    }
    if (!registryAddress()) {
      return reply.code(503).send({ error: "WORKFLOW_REGISTRY_ADDRESS not configured" });
    }
    try {
      const r = await pauseWorkflowOnChain(request.params.id);
      updateWorkflowIndexStatus(request.params.id, "paused");
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/workflows/:id", async (request, reply) => {
    if (!process.env.PRIVATE_KEY) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required" });
    }
    if (!registryAddress()) {
      return reply.code(503).send({ error: "WORKFLOW_REGISTRY_ADDRESS not configured" });
    }
    try {
      const r = await deleteWorkflowOnChain(request.params.id);
      updateWorkflowIndexStatus(request.params.id, "deleted");
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.code(400).send({ error: msg });
    }
  });
}
