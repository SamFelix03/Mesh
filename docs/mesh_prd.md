**MESH**

Reactive Workflow Engine for Somnia Protocols

Full Product Requirements Document

Version 1.0 \| Somnia Testnet

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Built on Somnia Reactivity</strong></p>
<p>On-chain event handlers · WebSocket push · Atomic state bundles</p></td>
</tr>
</tbody>
</table>

**1. Executive Summary**

Mesh is a reactive workflow engine for protocol developers building on Somnia. It solves the hardest unsolved problem in cross-protocol EVM coordination: how do you make Protocol A automatically react to something Protocol B does, without a centralized off-chain bot, without polling, and without race conditions on state reads?

The answer is Somnia Reactivity. Somnia is the only EVM chain that pushes event data and contract state together in a single atomic notification --- in the same block, with no lag. Mesh is the developer tooling layer built on top of that primitive.

A developer defines a workflow as a directed acyclic graph (DAG) of triggers, conditions, and actions using a simple TypeScript DSL. Mesh compiles this into deployed SomniaEventHandler contracts wired together with on-chain subscriptions. A real-time trace dashboard powered by off-chain WebSocket subscriptions shows every workflow execution as it happens --- which event fired, which branch was taken, which contracts were called, and the latency of every hop.

|                                                                                                           |
|-----------------------------------------------------------------------------------------------------------|
| **Core Value Propositions**                                                                               |
| Decentralized cross-contract automation --- no servers, no bots, no liveness assumptions                  |
| Atomic conditional branching --- state reads and event triggers from the same block, zero race conditions |
| Real-time observability --- every workflow run traced live via WebSocket push                             |
| Developer-first --- define workflows in TypeScript, Mesh handles the Solidity and subscriptions           |
| Composable --- workflows can trigger other workflows, enabling complex multi-protocol pipelines           |

**2. Somnia Reactivity Feature Map**

Every Somnia Reactivity feature used in Mesh is catalogued below with its exact role in the system. This section is the canonical reference for where each primitive is consumed.

|                                      |                                 |                                                                                                                                                                                                       |
|--------------------------------------|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reactivity Feature**               | **Where Used in Mesh**          | **Purpose**                                                                                                                                                                                           |
| **SomniaEventHandler                 
 (on-chain)**                          | Workflow Node Contracts         | Each node in a compiled workflow DAG is a deployed SomniaEventHandler. The \_onEvent() override contains the node\'s branch logic and downstream calls.                                               |
| **createSoliditySubscription         
 (SDK)**                               | Workflow Compiler output        | After compiling a workflow, the SDK registers an on-chain subscription for each handler node, binding it to the trigger event topic and emitter address.                                              |
| **ethCalls bundle                    
 (off-chain)**                         | Condition Evaluator             | When a trigger fires, the off-chain wildcard subscription includes ethCall results from the same block. These are used to evaluate conditions (e.g. TVL below threshold) without a separate RPC call. |
| **sdk.subscribe() wildcard           
 (off-chain WebSocket)**               | Execution Trace Engine          | A single wildcard WebSocket subscription captures all handler invocations across all deployed workflows. This powers the real-time trace dashboard.                                                   |
| **BlockTick system event             
 (on-chain)**                          | Cron Trigger type               | Workflow trigger type \'cron:block\' maps to the BlockTick system event, enabling workflows that fire on every block or a specific block number without any off-chain scheduler.                      |
| **Schedule system event              
 (on-chain)**                          | One-shot Trigger type           | Workflow trigger type \'cron:timestamp\' maps to the Schedule system event, enabling workflows that fire exactly once at a future Unix timestamp.                                                     |
| **createOnchainBlockTickSubscription 
 (SDK)**                               | Compiler: block trigger         | When a workflow uses the cron:block trigger, the compiler calls this SDK convenience function instead of manual SubscriptionData construction.                                                        |
| **scheduleOnchainCronJob             
 (SDK)**                               | Compiler: timestamp trigger     | When a workflow uses the cron:timestamp trigger, the compiler calls this SDK function to register the one-shot schedule subscription.                                                                 |
| **isGuaranteed flag                  
 (subscription param)**                | All workflow subscriptions      | Set to true on all Mesh-compiled subscriptions so handler invocations are retried on failure, ensuring workflow steps are never silently dropped.                                                     |
| **isCoalesced flag                   
 (subscription param)**                | All workflow subscriptions      | Set to false on all Mesh subscriptions so each event gets its own handler invocation, preserving per-event workflow semantics.                                                                        |
| **simulationResults\[\]              
 (push payload)**                      | Condition Evaluator (off-chain) | Off-chain condition checks decode simulationResults from the push payload to inspect contract state from the exact block of the trigger event.                                                        |
| **data.result.topics + data          
 (push payload)**                      | Event Decoder                   | The off-chain event router decodes topics and data fields using viem decodeEventLog to identify event type, emitter, and arguments for routing and display.                                           |
| **cancelSoliditySubscription         
 (SDK)**                               | Workflow Manager: pause/delete  | When a developer pauses or deletes a workflow, the manager calls this to deregister all on-chain subscriptions associated with that workflow\'s nodes.                                                |
| **getSubscriptionInfo                
 (SDK)**                               | Workflow Manager: status        | Used by the workflow status panel to display live subscription health --- whether each node\'s subscription is active, funded, and receiving invocations.                                             |

**3. System Architecture**

**3.1 High-Level Layers**

Mesh is structured across three layers that map directly to Somnia\'s hybrid reactivity model.

|                         |                                                                                              |
|-------------------------|----------------------------------------------------------------------------------------------|
| **Layer**               | **Responsibility**                                                                           |
| **Workflow DSL**        | Developer-facing TypeScript API for defining triggers, conditions, and actions as a DAG      |
| **Compiler + Registry** | Translates DSL into deployed SomniaEventHandler contracts and registered subscriptions       |
| **Trace Engine**        | Off-chain wildcard WebSocket subscription that observes all handler invocations in real time |

**3.2 On-Chain Components**

**3.2.1 WorkflowNode Contract (base)**

Abstract Solidity contract inheriting from SomniaEventHandler. Every compiled workflow node deploys a concrete instance of this base.

|                   |                                                                  |
|-------------------|------------------------------------------------------------------|
| **⚡ Reactivity** | **SomniaEventHandler ---** Base contract for every workflow node |

- Overrides \_onEvent(address emitter, bytes32\[\] calldata eventTopics, bytes calldata data)

- Decodes the incoming event using the ABI registered at compile time

- Evaluates the condition defined for this node (may read local storage set via ethCall at trigger time)

- On condition pass: calls the next node(s) in the DAG via external contract calls

- On condition fail: emits WorkflowNoOp event for trace capture, exits

- Emits WorkflowStepExecuted(workflowId, nodeId, timestamp) on every invocation for observability

**3.2.2 WorkflowRegistry Contract**

On-chain registry that tracks all deployed workflow DAGs, their node addresses, and subscription IDs. Serves as the source of truth for the off-chain manager.

- registerWorkflow(workflowId, nodeAddresses\[\], subscriptionIds\[\]) --- called by compiler after deployment

- pauseWorkflow(workflowId) --- cancels subscriptions via precompile, preserves node contracts

- deleteWorkflow(workflowId) --- full teardown

- getWorkflow(workflowId) --- returns full DAG descriptor for the trace dashboard

|                   |                                                                                                                          |
|-------------------|--------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **cancelSoliditySubscription (SDK) ---** Called by pauseWorkflow and deleteWorkflow to deregister all node subscriptions |

**3.2.3 Trigger Types**

**Event Trigger**

Listens for a specific event emitted by a specified contract address. This is the standard on-chain subscription pattern.

|                   |                                                                                                           |
|-------------------|-----------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **createSoliditySubscription ---** Registers the subscription with eventTopics filter and emitter address |

**Block Trigger (Cron: every block)**

Fires the workflow handler at the end of every block, or at a specific block number. Requires no off-chain scheduler.

|                   |                                                                                                                                      |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **BlockTick system event + createOnchainBlockTickSubscription ---** Compiler calls this SDK function when trigger type is cron:block |

**Timestamp Trigger (Cron: one-shot)**

Fires the workflow handler exactly once at a specified future Unix timestamp in milliseconds. Subscription is automatically deleted after firing.

|                   |                                                                                                                             |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **Schedule system event + scheduleOnchainCronJob ---** Compiler calls this SDK function when trigger type is cron:timestamp |

**3.3 Off-Chain Components**

**3.3.1 Workflow Compiler (TypeScript)**

The compiler takes a WorkflowDefinition object (TypeScript DSL) and produces deployable artifacts. It is the core developer-facing tool in Mesh.

- Parses the DAG: validates nodes, edges, trigger types, condition schemas, and action targets

- Generates Solidity source for each workflow node via a template engine

- Deploys node contracts using Hardhat or Foundry programmatically

- Registers subscriptions using the Reactivity SDK based on trigger type

- Writes the deployed addresses and subscription IDs to WorkflowRegistry on-chain

|                   |                                                                                                                                                                                            |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **createSoliditySubscription / createOnchainBlockTickSubscription / scheduleOnchainCronJob ---** Compiler selects the correct SDK function based on the trigger type of each workflow node |

**3.3.2 Execution Trace Engine**

A persistent TypeScript process that subscribes to all Mesh workflow events using a wildcard off-chain subscription. This is the foundation of the real-time dashboard.

|                   |                                                                                                                                                   |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **sdk.subscribe() wildcard (no filters) ---** Single subscription captures WorkflowStepExecuted and WorkflowNoOp from all deployed workflow nodes |

- Receives atomic push payload: event data + ethCall results from the same block

- Decodes topics and data using viem decodeEventLog with the Mesh ABI

- Routes decoded events to the correct workflow trace buffer by workflowId

- Streams trace updates to the dashboard UI via a local WebSocket server

|                   |                                                                                                                                                    |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **data.result.topics + data.result.data ---** Decoded by the trace engine to extract workflowId, nodeId, branch taken, and downstream call targets |

**3.3.3 Condition Evaluator (off-chain)**

Conditions in Mesh can be evaluated either on-chain (in \_onEvent Solidity logic) or off-chain using the ethCall bundle from the push payload. The off-chain evaluator handles complex or multi-source conditions that are impractical in Solidity.

|                   |                                                                                                                                                                |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **ethCalls bundle in sdk.subscribe() ---** Condition ethCalls are defined at subscription time; results arrive atomically in data.result.simulationResults\[\] |

|                   |                                                                                                                            |
|-------------------|----------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **simulationResults\[\] decoding ---** decodeFunctionResult from viem decodes each ethCall result for condition evaluation |

- Evaluates conditions like: TVL below threshold, price ratio outside band, balance insufficient

- Results are passed to the action dispatcher; no separate RPC call needed --- all from the same block

**3.3.4 Workflow Manager API**

A REST/WebSocket API that the dashboard and CLI use to manage workflows. Wraps the Reactivity SDK and WorkflowRegistry contract.

- POST /workflows --- compile and deploy a new workflow from a DSL definition

- GET /workflows/:id --- return current status including subscription health

- POST /workflows/:id/pause --- cancel subscriptions, preserve contracts

- DELETE /workflows/:id --- full teardown including contract deregistration

|                   |                                                                                                                                          |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **getSubscriptionInfo (SDK) ---** Used by GET /workflows/:id to report per-node subscription status, funding level, and invocation count |

**3.3.5 Real-Time Dashboard (UI)**

A browser-based developer dashboard that gives full visibility into deployed workflows and their live execution traces.

- Workflow list --- all deployed workflows with status (active/paused/errored), trigger type, and last run

- DAG visualizer --- interactive graph view of a workflow\'s nodes, edges, and condition logic

- Live trace feed --- real-time stream of workflow step executions as they happen on-chain

- Node inspector --- click any node to see its contract address, subscription ID, condition logic, and invocation history

- Block timeline --- shows which blocks triggered workflow steps, latency from event to handler invocation

- Subscription health panel --- funding status (SOMI balance), guaranteed/coalesced flags, active state

|                   |                                                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **sdk.subscribe() wildcard ---** Dashboard backend subscribes once; all workflow events for all users arrive through this single connection |

**4. Workflow DSL Specification**

Developers define workflows using a TypeScript object that describes the full DAG. The compiler consumes this object and handles all on-chain deployment.

**4.1 WorkflowDefinition schema**

|                             |                                                                                            |
|-----------------------------|--------------------------------------------------------------------------------------------|
| **Field**                   | **Description**                                                                            |
| **id: string**              | Unique identifier for this workflow (used in registry and traces)                          |
| **name: string**            | Human-readable label shown in the dashboard                                                |
| **nodes: WorkflowNode\[\]** | Ordered array of nodes in the DAG                                                          |
| **edges: WorkflowEdge\[\]** | Directed connections between nodes with optional condition labels                          |
| **gasConfig: GasConfig**    | Shared gas params (priorityFeePerGas, maxFeePerGas, gasLimit) applied to all subscriptions |

**4.2 WorkflowNode schema**

|                                 |                                                                             |
|---------------------------------|-----------------------------------------------------------------------------|
| **Field**                       | **Description**                                                             |
| **id: string**                  | Node identifier, unique within the workflow                                 |
| **trigger: TriggerConfig**      | Defines what fires this node (event, cron:block, or cron:timestamp)         |
| **condition?: ConditionConfig** | Optional condition evaluated at trigger time using ethCall results          |
| **action: ActionConfig**        | What this node does when condition passes --- contract call, emit, or no-op |
| **ethCalls?: EthCall\[\]**      | State reads to bundle with the trigger notification (off-chain path)        |

**4.3 TriggerConfig variants**

|                    |                                    |                                                 |
|--------------------|------------------------------------|-------------------------------------------------|
| **Trigger type**   | **Reactivity primitive**           | **Key fields**                                  |
| **event**          | createSoliditySubscription         | emitter: address, eventTopic: bytes32, abi: ABI |
| **cron:block**     | createOnchainBlockTickSubscription | blockNumber?: bigint (omit for every block)     |
| **cron:timestamp** | scheduleOnchainCronJob             | timestampMs: number (must be \>12s in future)   |

**5. End-User Story**

The following narrative traces a protocol developer through their complete Mesh experience, from discovery to a running workflow on Somnia testnet.

**5.1 Persona**

Priya is a smart contract developer at a DeFi protocol launching on Somnia. Her DEX contract emits a LiquidityWarning event when pool depth drops below a configurable threshold. She wants that event to automatically pause her DEX and notify her lending protocol to adjust borrow limits --- without deploying a centralized bot.

**5.2 The Journey**

**Step 1 --- Installation**

Priya installs the Mesh CLI and SDK into her existing Hardhat project.

- npm install @mesh-protocol/cli @mesh-protocol/sdk

- mesh init --- scaffolds a workflows/ directory with an example definition and her Somnia testnet config

- She connects her wallet (which holds 32+ SOMI for subscription funding)

**Step 2 --- Defining the workflow**

Priya opens workflows/liquidity-guard.ts and writes her workflow definition using the TypeScript DSL. She defines two nodes: Node 1 listens for LiquidityWarning on her DEX contract and checks current TVL via an ethCall. Node 2 (triggered by Node 1\'s action) calls adjustBorrowLimit() on her lending protocol.

- Trigger: event --- emitter is her DEX address, topic is keccak256(\'LiquidityWarning(uint256)\')

- Condition: simulationResults\[0\] decoded as uint256 \< 500_000n (TVL below \$500k)

- Action on node 1: call pause() on her DEX contract

- Action chained to node 2: call adjustBorrowLimit(newLimit) on her lending protocol

**Step 3 --- Compiling and deploying**

Priya runs mesh deploy workflows/liquidity-guard.ts \--network somniaTestnet.

- The compiler validates her DAG --- checks that all addresses are valid, ABIs are present, gas config is set

- It generates two SomniaEventHandler Solidity contracts, one per node

- Deploys both contracts to Somnia testnet, printing their addresses

- Calls createSoliditySubscription for Node 1 (event trigger) and registers Node 2 as an action target

- Registers both in WorkflowRegistry on-chain

- Prints: Workflow liquidity-guard deployed. 2 nodes active. Subscription IDs: \[0x\..., 0x\...\]

**Step 4 --- Opening the dashboard**

Priya runs mesh dashboard and opens http://localhost:3000 in her browser.

- She sees her liquidity-guard workflow in the workflow list: status Active, trigger Event, last run Never

- She clicks into the DAG visualizer and sees both nodes rendered as a graph with the edge between them labeled with her condition

- The subscription health panel shows both nodes funded, isGuaranteed: true, invocation count: 0

- The live trace feed is empty but updating in real time via WebSocket

**Step 5 --- Triggering the workflow**

Priya uses her DEX\'s admin function to artificially push pool depth below the threshold, causing LiquidityWarning to be emitted on Somnia testnet.

**Step 6 --- Watching it execute**

Within the same block, Mesh reacts. Priya watches the dashboard light up:

- The live trace feed shows: Block 84201 --- LiquidityWarning emitted by 0xDEX\...

- Node 1 fires: condition evaluated (TVL = 312,000 \< 500,000) --- PASS

- Node 1 action: pause() called on DEX --- confirmed

- Node 2 fires: adjustBorrowLimit(200_000) called on lending protocol --- confirmed

- Total latency from event to final action: 1 block

- She sees the full execution trace, including the ethCall result that proved the TVL was below threshold --- from the same block as the trigger event, no race condition possible

**Step 7 --- Iterating**

Priya adjusts the TVL threshold in her workflow definition and reruns mesh deploy \--update liquidity-guard. The compiler cancels the old subscriptions, redeploys the updated node contracts, and registers new subscriptions --- all in one command. The dashboard immediately reflects the updated workflow.

**6. Example Workflows**

The following two workflows are designed to ship as built-in templates in the Mesh template library. They demonstrate the breadth of Somnia Reactivity primitives and serve as reference implementations for developers.

**6.1 Reactive Liquidity Guard**

|                                                                                                                                                                                                                                                                                                                       |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **What it does**                                                                                                                                                                                                                                                                                                      |
| Monitors a DEX pool for low liquidity events. When liquidity drops below a configurable threshold, it atomically verifies the TVL via an ethCall, pauses the DEX to prevent further trades, and notifies a connected lending protocol to tighten borrow limits --- all within the same block as the triggering event. |

**The problem it solves**

Without Mesh, this coordination requires an off-chain bot that polls liquidity every N seconds, reads TVL in a separate RPC call (potentially stale), and calls multiple contracts sequentially. By the time the bot acts, another block has passed. Mesh eliminates all of this.

**Workflow nodes**

|                               |                                          |                                                  |
|-------------------------------|------------------------------------------|--------------------------------------------------|
| **Node**                      | **Trigger / Reactivity Feature**         | **Action**                                       |
| **Node 1: Liquidity Monitor** | Event trigger on LiquidityWarning        
                                 createSoliditySubscription                
                                 ethCalls: \[pool.getTVL()\]               | If TVL \< threshold: call dex.pause()            
                                                                            Emit WorkflowStepExecuted                         
                                                                            Chain to Node 2                                   |
| **Node 2: Lending Notifier**  | Invoked by Node 1 action (internal call) 
                                 No separate subscription needed           | Call lendingProtocol.adjustBorrowLimit(newLimit) 
                                                                            Emit WorkflowStepExecuted                         |
| **Node 3: Cron Recheck**      | cron:block trigger (every 100 blocks)    
                                 createOnchainBlockTickSubscription        | If TVL recovered: call dex.unpause()             
                                                                            Log recovery event to trace                       |

**Somnia Reactivity features used**

|                   |                                                                                                       |
|-------------------|-------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **createSoliditySubscription ---** Node 1 --- subscribe to LiquidityWarning event on the DEX contract |

|                   |                                                                                                          |
|-------------------|----------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **ethCalls bundle ---** Node 1 --- getTVL() result arrives atomically with the event; no second RPC call |

|                   |                                                                                                                        |
|-------------------|------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **simulationResults\[\] decoding ---** Off-chain evaluator verifies TVL from the push payload and logs it in the trace |

|                   |                                                                                                                                |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **createOnchainBlockTickSubscription ---** Node 3 --- periodic recheck every 100 blocks to auto-resume when liquidity recovers |

|                   |                                                                                                                   |
|-------------------|-------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **sdk.subscribe() wildcard ---** Trace engine captures all three nodes\' events and streams them to the dashboard |

|                   |                                                                                                              |
|-------------------|--------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **isGuaranteed: true ---** All nodes --- ensures no invocation is silently dropped even under validator load |

**Why this is only possible on Somnia**

The TVL check in Node 1 happens on the ethCall bundle from the same block as the LiquidityWarning event. On any other EVM chain, you would call getTVL() after receiving the event --- which is a different block, potentially already stale. Mesh\'s condition evaluation is race-condition-free by construction.

**6.2 Governance Execution Relay**

|                                                                                                                                                                                                                                                                                                                                                              |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **What it does**                                                                                                                                                                                                                                                                                                                                             |
| Monitors a DAO governance contract for successful proposal execution. When a proposal passes and is marked Executed, Mesh automatically applies the downstream configuration changes to all registered protocol contracts --- without any multisig or manual admin transaction. A one-shot scheduled cleanup step runs 24 hours later to verify consistency. |

**The problem it solves**

Governance on EVM chains is famously manual. A proposal passes, then a human (or a multisig) has to remember to call the resulting configuration functions on every affected contract. Delays of hours or days are common. Mesh makes governance execution instant and trustless --- the moment the proposal is marked executed on-chain, the downstream effects happen in the same block.

**Workflow nodes**

|                                     |                                                 |                                                           |
|-------------------------------------|-------------------------------------------------|-----------------------------------------------------------|
| **Node**                            | **Trigger / Reactivity Feature**                | **Action**                                                |
| **Node 1: Proposal Watcher**        | Event trigger on ProposalExecuted(proposalId)   
                                       createSoliditySubscription                       
                                       ethCalls: \[governance.getProposalDetails(id)\]  | Decode proposal payload                                   
                                                                                         Extract target contracts and calldata                      
                                                                                         Chain to Node 2 and Node 3 in parallel                     |
| **Node 2: Protocol Config Updater** | Invoked by Node 1 (parallel branch A)           | Call each target contract with decoded calldata           
                                                                                         Emit ConfigApplied(contractAddress, paramKey, newValue)    |
| **Node 3: Audit Logger**            | Invoked by Node 1 (parallel branch B)           | Write execution record to an on-chain audit log contract  
                                                                                         Emit GovernanceRelayed(proposalId, blockNumber, executor)  |
| **Node 4: Consistency Check**       | cron:timestamp trigger (24h after Node 1)       
                                       scheduleOnchainCronJob                           
                                       ethCalls: \[each target.getParam()\]             | Re-read each updated param and compare to expected values 
                                                                                         If mismatch: emit ConsistencyAlert for off-chain alerting  |

**Somnia Reactivity features used**

|                   |                                                                                                                |
|-------------------|----------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **createSoliditySubscription ---** Node 1 --- subscribe to ProposalExecuted event on the DAO governor contract |

|                   |                                                                                                                                |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **ethCalls bundle ---** Node 1 --- getProposalDetails() returns the full proposal payload atomically; no separate fetch needed |

|                   |                                                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **scheduleOnchainCronJob ---** Node 4 --- scheduled exactly 24 hours (in ms) after Node 1 executes; automatically deregistered after firing |

|                   |                                                                                                                                                       |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **sdk.subscribe() wildcard ---** Trace engine observes all four nodes, rendering the full governance relay as a live execution graph in the dashboard |

|                   |                                                                                                                                                          |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **simulationResults\[\] decoding ---** Node 4\'s ethCall results are decoded off-chain to compare actual vs expected param values and surface mismatches |

|                   |                                                                                                             |
|-------------------|-------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **isGuaranteed: true ---** Critical for Nodes 1 and 2 --- governance execution must not be silently skipped |

|                   |                                                                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **⚡ Reactivity** | **cancelSoliditySubscription ---** Called automatically after Node 4 fires (Schedule is one-shot; SDK cleans up the subscription) |

**DAG shape: parallel fan-out**

This workflow demonstrates that Mesh DAGs are not limited to linear chains. Node 1 fans out to Node 2 and Node 3 simultaneously --- both are called in Node 1\'s \_onEvent action. Node 4 is registered as a completely independent subscription (Schedule-triggered) but is logically part of the same workflow in the registry and dashboard.

**Why this is only possible on Somnia**

Node 4\'s consistency check uses ethCalls bundled with the Schedule event. The parameter reads happen atomically at exactly the 24-hour block --- not \'sometime around 24 hours later depending on when the bot woke up.\' The timestamp is precise to the block, and the state reads are from that same block. No other EVM chain can offer this.

**7. Full Build Component Checklist**

Everything required to build Mesh end-to-end, grouped by layer.

**7.1 On-Chain (Solidity)**

|                                      |                                                                    |
|--------------------------------------|--------------------------------------------------------------------|
| **Component**                        | **Notes**                                                          |
| **WorkflowNode.sol (abstract)**      | Inherits SomniaEventHandler; template for compiler-generated nodes |
| **WorkflowRegistry.sol**             | Stores workflow DAG metadata, node addresses, subscription IDs     |
| **AuditLog.sol**                     | Simple append-only log used by governance relay workflow           |
| **Example: LiquidityGuardNode.sol**  | Concrete template demonstrating event trigger + ethCall condition  |
| **Example: GovernanceRelayNode.sol** | Concrete template demonstrating parallel fan-out action            |

**7.2 Off-Chain TypeScript**

|                              |                                                                                                       |
|------------------------------|-------------------------------------------------------------------------------------------------------|
| **Component**                | **Notes**                                                                                             |
| **Workflow DSL types**       | TypeScript interfaces: WorkflowDefinition, WorkflowNode, TriggerConfig, ConditionConfig, ActionConfig |
| **Workflow Compiler**        | Parses DSL, generates Solidity, deploys contracts, calls SDK to register subscriptions                |
| **Solidity Template Engine** | Generates \_onEvent() body from DSL condition + action definitions                                    |
| **Deployment Manager**       | Wraps Hardhat/ethers for programmatic contract deployment                                             |
| **Subscription Registrar**   | Calls correct SDK function (createSoliditySubscription / BlockTick / Schedule) per trigger type       |
| **Execution Trace Engine**   | Wildcard sdk.subscribe(); routes events to workflow trace buffers                                     |
| **Event Decoder**            | Uses viem decodeEventLog + decodeFunctionResult on push payloads                                      |
| **Condition Evaluator**      | Decodes simulationResults\[\], applies condition logic, returns pass/fail                             |
| **Workflow Manager API**     | REST + WebSocket API: deploy, pause, delete, status, stream                                           |
| **Somnia chain config**      | viem defineChain for Somnia testnet, WebSocket + HTTP RPC                                             |
| **SDK client factory**       | Creates public + wallet clients, initialises Reactivity SDK instance                                  |

**7.3 Dashboard (Frontend)**

|                               |                                                                        |
|-------------------------------|------------------------------------------------------------------------|
| **Component**                 | **Notes**                                                              |
| **Workflow list view**        | All workflows, status badges, trigger type labels, last execution time |
| **DAG visualizer**            | Interactive graph of nodes and edges; click node to inspect            |
| **Live trace feed**           | Real-time stream from trace engine WebSocket; colour-coded by branch   |
| **Node inspector panel**      | Contract address, subscription ID, condition logic, invocation history |
| **Block timeline**            | Visualizes which blocks triggered which workflow steps                 |
| **Subscription health panel** | SOMI balance, isGuaranteed, isCoalesced, active/paused state           |
| **Workflow composer (v2)**    | GUI for building workflow DAGs without writing DSL directly            |

**7.4 CLI**

|                                  |                                                      |
|----------------------------------|------------------------------------------------------|
| **Command**                      | **Function**                                         |
| **mesh init**                    | Scaffold workflows directory and config              |
| **mesh deploy \<file\>**         | Compile and deploy a workflow definition             |
| **mesh deploy \--update \<id\>** | Recompile and redeploy, cancelling old subscriptions |
| **mesh pause \<id\>**            | Cancel subscriptions, preserve contracts             |
| **mesh delete \<id\>**           | Full teardown                                        |
| **mesh status \<id\>**           | Print subscription health and last execution info    |
| **mesh dashboard**               | Start local dashboard server                         |
| **mesh logs \<id\>**             | Stream live trace to terminal                        |

**8. Dependencies and Tech Stack**

|                                        |                                                                                          |
|----------------------------------------|------------------------------------------------------------------------------------------|
| **Package / Tool**                     | **Role**                                                                                 |
| **@somnia-chain/reactivity**           | Core SDK --- subscribe, createSoliditySubscription, BlockTick, Schedule, cancel, getInfo |
| **@somnia-chain/reactivity-contracts** | SomniaEventHandler base contract for Solidity inheritance                                |
| **viem**                               | Chain config, WebSocket transport, ABI encoding/decoding, event log decoding             |
| **hardhat / foundry**                  | Contract compilation and programmatic deployment                                         |
| **ts-morph or handlebars**             | Solidity source generation from DSL templates                                            |
| **ws / socket.io**                     | WebSocket server for streaming trace events to dashboard                                 |
| **React + D3 or reactflow**            | DAG visualizer and live trace feed in the dashboard UI                                   |
| **ethers (optional)**                  | Fallback for contract deployment if Hardhat is primary tool                              |

**9. Open Questions and Constraints**

|                          |                                                                                                                                             |
|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **Question**             | **Notes**                                                                                                                                   |
| **SOMI funding model**   | Who funds the 32 SOMI minimum per subscription? Developer wallet at deploy time. Multi-node workflows need N × 32 SOMI minimum.             |
| **Gas limit per node**   | 2,000,000 recommended minimum; complex cross-contract actions may need more. Expose as per-node override in DSL.                            |
| **Handler reentrancy**   | Workflows that emit events their own nodes are subscribed to will create infinite loops. Compiler must detect and reject these cycles.      |
| **Upgrade path**         | Updating a workflow requires redeploying node contracts and re-registering subscriptions. Old subscription IDs must be cancelled first.     |
| **Parallel fan-out gas** | Node 1 calling Node 2 and Node 3 in \_onEvent means both calls happen within Node 1\'s gas limit. Fan-out width is constrained by gasLimit. |
| **Testnet only**         | Somnia Reactivity is currently testnet-only. Mesh ships targeting testnet; mainnet readiness depends on Somnia\'s rollout.                  |

Mesh --- Built on Somnia Reactivity \| v1.0 PRD
