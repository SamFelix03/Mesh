// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { SomniaExtensions } from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";
import { MeshSimpleStepNode } from "../src/compiler/MeshSimpleStepNode.sol";

contract MeshSimpleStepNodeTest is Test {
    bytes32 internal constant WF = keccak256(bytes("wf"));
    bytes32 internal constant NID = keccak256(bytes("step-a"));

    function test_noop_emits_trace() public {
        MeshSimpleStepNode n = new MeshSimpleStepNode(WF, NID, address(0), "", bytes32(0));
        vm.recordLogs();
        vm.prank(SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS);
        n.onEvent(address(0xBEEF), new bytes32[](0), "");
        assertGt(vm.getRecordedLogs().length, 0);
    }
}
