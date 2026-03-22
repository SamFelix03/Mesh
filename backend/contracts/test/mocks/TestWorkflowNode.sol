// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { WorkflowNode } from "../../src/WorkflowNode.sol";

/// @dev Forge-only concrete handler for registry unit tests (not used on Shannon).
contract TestWorkflowNode is WorkflowNode {
    constructor(bytes32 workflowId_, bytes32 nodeId_) WorkflowNode(workflowId_, nodeId_) { }

    function _onEvent(address, bytes32[] calldata, bytes calldata) internal override {
        _emitStepExecuted();
    }
}
