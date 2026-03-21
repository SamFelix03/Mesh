// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { WorkflowRegistry } from "../src/WorkflowRegistry.sol";
import { AuditLog } from "../src/AuditLog.sol";

contract DeployMeshScript is Script {
    function run() external {
        vm.startBroadcast();

        WorkflowRegistry registry = new WorkflowRegistry();
        AuditLog auditLog = new AuditLog();

        console2.log("WorkflowRegistry:", address(registry));
        console2.log("AuditLog:", address(auditLog));

        vm.stopBroadcast();
    }
}
