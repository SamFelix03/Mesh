// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Emits `Ping` for Somnia reactivity subscriptions (Shannon testnet demos).
contract TriggerEmitter {
    event Ping(uint256 indexed seq);

    function ping(uint256 seq) external {
        emit Ping(seq);
    }
}
