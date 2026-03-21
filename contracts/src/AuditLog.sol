// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title AuditLog
/// @notice Append-only log for governance / workflow audit trails (e.g. governance relay template in Mesh PRD).
contract AuditLog {
    struct Entry {
        uint256 index;
        bytes32 topic;
        bytes payload;
        address writer;
        uint256 timestamp;
    }

    Entry[] private _entries;
    mapping(address => bool) public isWriter;

    address public owner;

    event EntryAppended(uint256 indexed index, bytes32 indexed topic, address indexed writer);
    event WriterUpdated(address indexed writer, bool allowed);

    error Unauthorized();

    constructor() {
        owner = msg.sender;
        isWriter[msg.sender] = true;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setWriter(address writer, bool allowed) external onlyOwner {
        isWriter[writer] = allowed;
        emit WriterUpdated(writer, allowed);
    }

    function append(bytes32 topic, bytes calldata payload) external {
        if (!isWriter[msg.sender]) revert Unauthorized();
        uint256 idx = _entries.length;
        _entries.push(
            Entry({ index: idx, topic: topic, payload: payload, writer: msg.sender, timestamp: block.timestamp })
        );
        emit EntryAppended(idx, topic, msg.sender);
    }

    function entryCount() external view returns (uint256) {
        return _entries.length;
    }

    function getEntry(uint256 index) external view returns (Entry memory) {
        return _entries[index];
    }
}
