// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Records handler invocations for Mesh Shannon E2E demos and tests.
contract ReactionSink {
    address public owner;
    address public trustedHandler;
    address public lastEmitter;
    bytes32 public lastTopic0;
    uint256 public hitCount;

    error Unauthorized();
    error HandlerAlreadySet();

    constructor() {
        owner = msg.sender;
    }

    function setTrustedHandler(address handler) external {
        if (msg.sender != owner) revert Unauthorized();
        if (trustedHandler != address(0)) revert HandlerAlreadySet();
        trustedHandler = handler;
    }

    function touch(address emitter, bytes32 topic0) external {
        if (msg.sender != trustedHandler) revert Unauthorized();
        lastEmitter = emitter;
        lastTopic0 = topic0;
        unchecked {
            hitCount++;
        }
    }
}
