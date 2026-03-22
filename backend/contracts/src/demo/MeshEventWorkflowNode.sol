// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { WorkflowNode } from "../WorkflowNode.sol";
import { ReactionSink } from "./ReactionSink.sol";

/// @notice Production-style workflow step: records the trigger on a sink and emits Mesh trace events.
contract MeshEventWorkflowNode is WorkflowNode {
    ReactionSink public immutable sink;

    constructor(bytes32 workflowId_, bytes32 nodeId_, address sink_) WorkflowNode(workflowId_, nodeId_) {
        sink = ReactionSink(sink_);
    }

    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata) internal override {
        bytes32 t0 = eventTopics.length > 0 ? eventTopics[0] : bytes32(0);
        sink.touch(emitter, t0);
        _emitStepExecuted();
    }
}
