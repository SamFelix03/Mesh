// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { WorkflowNode } from "../WorkflowNode.sol";

/// @title MeshSimpleStepNode
/// @notice One PRD-style workflow step: optional `call`, optional anonymous `LOG1` emit, or noop; then `WorkflowStepExecuted`.
/// @dev Used by **per-node fan-out** deploy: N contracts + N subscriptions on the same root event filter.
contract MeshSimpleStepNode is WorkflowNode {
    address private immutable _target;
    bytes32 private immutable _logTopic0;
    /// @dev Stored (not immutable) — dynamic bytes are not allowed as immutables in Solidity.
    bytes private _data;

    constructor(
        bytes32 workflowId_,
        bytes32 nodeId_,
        address callTarget_,
        bytes memory callData_,
        bytes32 logTopic0_
    ) WorkflowNode(workflowId_, nodeId_) {
        bool isEmit = logTopic0_ != bytes32(0);
        bool isCall = callTarget_ != address(0) && callData_.length > 0;
        require(!(isEmit && isCall), "Mesh: emit xor call");
        if (isEmit) {
            require(callTarget_ == address(0), "Mesh: emit needs zero target");
        }
        _target = callTarget_;
        _logTopic0 = logTopic0_;
        _data = callData_;
    }

    function _emitLog1(bytes32 topic0, bytes memory payload) private {
        assembly ("memory-safe") {
            let len := mload(payload)
            let ptr := add(payload, 0x20)
            log1(ptr, len, topic0)
        }
    }

    function _onEvent(address, bytes32[] calldata, bytes calldata) internal override {
        if (_logTopic0 != bytes32(0)) {
            _emitLog1(_logTopic0, _data);
        } else if (_target != address(0) && _data.length > 0) {
            (bool ok,) = _target.call(_data);
            require(ok, "Mesh: call failed");
        }
        _emitStepExecuted();
    }
}
