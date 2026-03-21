// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { AuditLog } from "../src/AuditLog.sol";

contract AuditLogTest is Test {
    function test_append_and_read() public {
        AuditLog log_ = new AuditLog();
        bytes32 topic = keccak256("GovernanceRelayed");
        bytes memory payload = abi.encode(uint256(42), address(0xBEEF));

        log_.append(topic, payload);
        assertEq(log_.entryCount(), 1);

        AuditLog.Entry memory e = log_.getEntry(0);
        assertEq(e.topic, topic);
        assertEq(e.writer, address(this));
        assertEq(e.payload, payload);
    }

    function test_revert_non_writer() public {
        AuditLog log_ = new AuditLog();
        vm.prank(address(0xBAD));
        vm.expectRevert(AuditLog.Unauthorized.selector);
        log_.append(keccak256("x"), bytes(""));
    }
}
