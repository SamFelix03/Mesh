// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { WorkflowNode } from "../WorkflowNode.sol";

/// @title MeshWorkflowExecutor
/// @notice One `SomniaEventHandler` per compiled workflow DAG: step 0 is the subscription entry; each step may `call`, emit an anonymous **LOG1** (topic0 + payload), or noop, then fans out to child indices.
/// @dev Compiler supplies a topological order where index 0 is the unique root. Per-step trace uses `WorkflowStepExecuted` with `stepNodeId` = keccak256(utf8(nodeId)).
///      **Emit steps:** `logTopic0 != 0`, `target == address(0)`, `data` = opaque log payload (ABI-encoded args for your integrators). Emits EVM `LOG1` with that topic and data (data length may be 0).
contract MeshWorkflowExecutor is WorkflowNode {
    struct Step {
        address target;
        bytes data;
        /// @notice If non-zero, this step emits `LOG1(data, logTopic0)` and must not perform an external `call` (`target` must be zero).
        bytes32 logTopic0;
        uint8[] nextIndices;
    }

    Step[] private _steps;
    bytes32[] private _stepNodeIds;

    constructor(bytes32 workflowId_, bytes32 rootStepNodeId_, bytes32[] memory stepNodeIds_, Step[] memory steps)
        WorkflowNode(workflowId_, rootStepNodeId_)
    {
        require(steps.length > 0, "Mesh: no steps");
        require(steps.length <= 255, "Mesh: too many steps");
        require(stepNodeIds_.length == steps.length, "Mesh: id len");
        for (uint256 i = 0; i < stepNodeIds_.length; i++) {
            _stepNodeIds.push(stepNodeIds_[i]);
        }
        for (uint256 i = 0; i < steps.length; i++) {
            bool isEmit = steps[i].logTopic0 != bytes32(0);
            bool isCall = steps[i].target != address(0) && steps[i].data.length > 0;
            require(!(isEmit && isCall), "Mesh: emit xor call");
            if (isEmit) {
                require(steps[i].target == address(0), "Mesh: emit needs zero target");
            }
            _steps.push();
            Step storage s = _steps[i];
            s.target = steps[i].target;
            s.data = steps[i].data;
            s.logTopic0 = steps[i].logTopic0;
            for (uint256 j = 0; j < steps[i].nextIndices.length; j++) {
                require(steps[i].nextIndices[j] < steps.length, "Mesh: bad edge");
                s.nextIndices.push(steps[i].nextIndices[j]);
            }
        }
    }

    function stepCount() external view returns (uint256) {
        return _steps.length;
    }

    function stepNodeIdAt(uint256 i) external view returns (bytes32) {
        return _stepNodeIds[i];
    }

    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) internal override {
        _runStep(0, emitter, eventTopics, data);
    }

    function _runStep(uint8 idx, address emitter, bytes32[] calldata eventTopics, bytes calldata logData) internal {
        require(idx < _steps.length, "Mesh: bad idx");
        Step storage s = _steps[idx];
        if (s.logTopic0 != bytes32(0)) {
            _emitLog1(s.logTopic0, s.data);
        } else if (s.target != address(0) && s.data.length > 0) {
            (bool ok,) = s.target.call(s.data);
            require(ok, "Mesh: call failed");
        }
        emit WorkflowStepExecuted(workflowId, _stepNodeIds[idx], block.timestamp);
        for (uint256 j = 0; j < s.nextIndices.length; j++) {
            _runStep(s.nextIndices[j], emitter, eventTopics, logData);
        }
    }

    /// @dev Anonymous `LOG1` with `topic0` equal to the standard event hash: keccak256 of the canonical ABI event signature string (e.g. `Notify(uint256)` — same rule as Solidity `event` topic0).
    function _emitLog1(bytes32 topic0, bytes memory payload) private {
        assembly ("memory-safe") {
            let len := mload(payload)
            let ptr := add(payload, 0x20)
            log1(ptr, len, topic0)
        }
    }
}
