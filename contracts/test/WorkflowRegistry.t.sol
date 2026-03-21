// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { WorkflowRegistry } from "../src/WorkflowRegistry.sol";
import { TestWorkflowNode } from "./mocks/TestWorkflowNode.sol";

contract WorkflowRegistryTest is Test {
    WorkflowRegistry internal registry;
    address internal alice = address(0xA11CE);
    bytes32 internal constant WF = keccak256("liquidity-guard");

    function setUp() public {
        registry = new WorkflowRegistry();
    }

    function test_register_pause_delete_flow() public {
        vm.startPrank(alice);
        address n1 = address(new TestWorkflowNode(WF, keccak256("n1")));
        address n2 = address(new TestWorkflowNode(WF, keccak256("n2")));
        address[] memory nodes = new address[](2);
        nodes[0] = n1;
        nodes[1] = n2;
        uint256[] memory subs = new uint256[](2);
        subs[0] = 1;
        subs[1] = 2;

        registry.registerWorkflow(WF, nodes, subs);

        (address owner, WorkflowRegistry.WorkflowStatus status,,) = registry.getWorkflow(WF);
        assertEq(owner, alice);
        assertEq(uint256(status), uint256(WorkflowRegistry.WorkflowStatus.Active));

        registry.pauseWorkflow(WF);
        (, status,,) = registry.getWorkflow(WF);
        assertEq(uint256(status), uint256(WorkflowRegistry.WorkflowStatus.Paused));

        registry.deleteWorkflow(WF);
        (, status,,) = registry.getWorkflow(WF);
        assertEq(uint256(status), uint256(WorkflowRegistry.WorkflowStatus.Deleted));
        vm.stopPrank();
    }

    function test_revert_non_owner_pause() public {
        vm.startPrank(alice);
        address n = address(new TestWorkflowNode(WF, keccak256("n1")));
        address[] memory nodes = new address[](1);
        nodes[0] = n;
        uint256[] memory subs = new uint256[](1);
        subs[0] = 1;
        registry.registerWorkflow(WF, nodes, subs);
        vm.stopPrank();

        address bob = address(0xB0B);
        vm.prank(bob);
        vm.expectRevert(WorkflowRegistry.Unauthorized.selector);
        registry.pauseWorkflow(WF);
    }
}
