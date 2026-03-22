// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Emits `Ping` for Somnia reactivity subscriptions (Shannon testnet demos).
/// @dev `pingCount()` is a cheap `ethCall` target for hybrid off-chain evaluation demos (uint256 return).
contract TriggerEmitter {
    event Ping(uint256 indexed seq);

    uint256 public pingCount;

    function ping(uint256 seq) external {
        unchecked {
            pingCount++;
        }
        emit Ping(seq);
    }
}
