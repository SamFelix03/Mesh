// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { SomniaExtensions } from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";
import { MeshWorkflowExecutor } from "../src/compiler/MeshWorkflowExecutor.sol";

contract MeshWorkflowExecutorTest is Test {
    bytes32 internal constant WF = keccak256(bytes("wf"));
    bytes32 internal constant ROOT = keccak256(bytes("root"));

    function test_deploy_linear_noop_chain() public {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = keccak256(bytes("a"));
        ids[1] = keccak256(bytes("b"));

        MeshWorkflowExecutor.Step[] memory steps = new MeshWorkflowExecutor.Step[](2);
        steps[0].target = address(0);
        steps[0].data = "";
        steps[0].logTopic0 = bytes32(0);
        steps[0].nextIndices = new uint8[](1);
        steps[0].nextIndices[0] = 1;

        steps[1].target = address(0);
        steps[1].data = "";
        steps[1].logTopic0 = bytes32(0);
        steps[1].nextIndices = new uint8[](0);

        MeshWorkflowExecutor ex = new MeshWorkflowExecutor(WF, ROOT, ids, steps);
        assertEq(ex.stepCount(), 2);
        assertEq(ex.stepNodeIdAt(0), ids[0]);
        assertEq(ex.stepNodeIdAt(1), ids[1]);
    }

    function test_emit_step_emits_log1() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = keccak256(bytes("root"));

        bytes32 topic0 = keccak256(bytes("Notify(uint256)"));
        bytes memory payload = abi.encode(uint256(99));

        MeshWorkflowExecutor.Step[] memory steps = new MeshWorkflowExecutor.Step[](1);
        steps[0].target = address(0);
        steps[0].data = payload;
        steps[0].logTopic0 = topic0;
        steps[0].nextIndices = new uint8[](0);

        MeshWorkflowExecutor ex = new MeshWorkflowExecutor(WF, ROOT, ids, steps);

        vm.recordLogs();
        vm.prank(SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS);
        ex.onEvent(address(0xBEEF), new bytes32[](0), "");
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length == 1 && logs[i].topics[0] == topic0) {
                assertEq(logs[i].data, payload, "LOG1 data must match payload");
                found = true;
                break;
            }
        }
        assertTrue(found, "expected anonymous LOG1 with event topic0");
    }
}
