// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

/// @title WorkflowNode
/// @notice Abstract base for Mesh workflow step contracts. Compiler-generated nodes inherit this and implement `_onEvent`.
/// @dev Emits trace events consumed by the off-chain trace engine (wildcard `sdk.subscribe`).
abstract contract WorkflowNode is SomniaEventHandler {
    bytes32 public immutable workflowId;
    bytes32 public immutable nodeId;

    event WorkflowStepExecuted(bytes32 indexed workflowId, bytes32 indexed nodeId, uint256 timestamp);
    event WorkflowNoOp(bytes32 indexed workflowId, bytes32 indexed nodeId, string reason);

    constructor(bytes32 workflowId_, bytes32 nodeId_) {
        workflowId = workflowId_;
        nodeId = nodeId_;
    }

    function _emitStepExecuted() internal {
        emit WorkflowStepExecuted(workflowId, nodeId, block.timestamp);
    }

    function _emitNoOp(string memory reason) internal {
        emit WorkflowNoOp(workflowId, nodeId, reason);
    }
}
