// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title WorkflowRegistry
/// @notice On-chain source of truth for deployed Mesh workflow DAGs: node addresses and subscription IDs.
/// @dev Subscription cancellation uses the Reactivity SDK (`cancelSoliditySubscription`) from the workflow owner EOA;
///      this contract records lifecycle state so APIs and indexers stay consistent.
contract WorkflowRegistry {
    enum WorkflowStatus {
        None,
        Active,
        Paused,
        Deleted
    }

    struct Workflow {
        address owner;
        WorkflowStatus status;
        address[] nodes;
        uint256[] subscriptionIds;
    }

    mapping(bytes32 workflowId => Workflow) private _workflows;

    event WorkflowRegistered(
        bytes32 indexed workflowId, address indexed owner, address[] nodes, uint256[] subscriptionIds
    );
    event WorkflowPaused(bytes32 indexed workflowId, address indexed owner);
    event WorkflowDeleted(bytes32 indexed workflowId, address indexed owner);

    error WorkflowNotFound();
    error Unauthorized();
    error InvalidWorkflow();
    error WorkflowAlreadyExists();

    modifier onlyWorkflowOwner(bytes32 workflowId) {
        if (_workflows[workflowId].status == WorkflowStatus.None) revert WorkflowNotFound();
        if (_workflows[workflowId].owner != msg.sender) revert Unauthorized();
        _;
    }

    /// @notice Register a workflow after node deployment and on-chain subscription creation.
    function registerWorkflow(bytes32 workflowId, address[] calldata nodes, uint256[] calldata subscriptionIds)
        external
    {
        if (workflowId == bytes32(0)) revert InvalidWorkflow();
        if (nodes.length == 0) revert InvalidWorkflow();
        if (nodes.length != subscriptionIds.length) revert InvalidWorkflow();
        if (_workflows[workflowId].status != WorkflowStatus.None) revert WorkflowAlreadyExists();

        Workflow storage w = _workflows[workflowId];
        w.owner = msg.sender;
        w.status = WorkflowStatus.Active;
        for (uint256 i = 0; i < nodes.length; i++) {
            w.nodes.push(nodes[i]);
            w.subscriptionIds.push(subscriptionIds[i]);
        }

        emit WorkflowRegistered(workflowId, msg.sender, nodes, subscriptionIds);
    }

    function pauseWorkflow(bytes32 workflowId) external onlyWorkflowOwner(workflowId) {
        Workflow storage w = _workflows[workflowId];
        if (w.status != WorkflowStatus.Active) revert InvalidWorkflow();
        w.status = WorkflowStatus.Paused;
        emit WorkflowPaused(workflowId, msg.sender);
    }

    function deleteWorkflow(bytes32 workflowId) external onlyWorkflowOwner(workflowId) {
        Workflow storage w = _workflows[workflowId];
        if (w.status == WorkflowStatus.Deleted) revert InvalidWorkflow();
        w.status = WorkflowStatus.Deleted;
        emit WorkflowDeleted(workflowId, msg.sender);
    }

    /// @notice Resume a paused workflow after subscriptions are re-created or re-attached off-chain.
    function resumeWorkflow(bytes32 workflowId) external onlyWorkflowOwner(workflowId) {
        Workflow storage w = _workflows[workflowId];
        if (w.status != WorkflowStatus.Paused) revert InvalidWorkflow();
        w.status = WorkflowStatus.Active;
    }

    function updateSubscriptionIds(bytes32 workflowId, uint256[] calldata subscriptionIds)
        external
        onlyWorkflowOwner(workflowId)
    {
        Workflow storage w = _workflows[workflowId];
        if (w.status == WorkflowStatus.Deleted) revert InvalidWorkflow();
        if (subscriptionIds.length != w.nodes.length) revert InvalidWorkflow();
        delete w.subscriptionIds;
        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            w.subscriptionIds.push(subscriptionIds[i]);
        }
    }

    function getWorkflow(bytes32 workflowId)
        external
        view
        returns (address owner, WorkflowStatus status, address[] memory nodes, uint256[] memory subscriptionIds)
    {
        Workflow storage w = _workflows[workflowId];
        if (w.status == WorkflowStatus.None) revert WorkflowNotFound();
        owner = w.owner;
        status = w.status;
        nodes = new address[](w.nodes.length);
        subscriptionIds = new uint256[](w.subscriptionIds.length);
        for (uint256 i = 0; i < w.nodes.length; i++) {
            nodes[i] = w.nodes[i];
        }
        for (uint256 i = 0; i < w.subscriptionIds.length; i++) {
            subscriptionIds[i] = w.subscriptionIds[i];
        }
    }

    function workflowExists(bytes32 workflowId) external view returns (bool) {
        return _workflows[workflowId].status != WorkflowStatus.None;
    }
}
