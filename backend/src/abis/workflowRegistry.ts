export const workflowRegistryAbi = [
  {
    type: "function",
    name: "getWorkflow",
    stateMutability: "view",
    inputs: [{ name: "workflowId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "status", type: "uint8" },
      { name: "nodes", type: "address[]" },
      { name: "subscriptionIds", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "workflowExists",
    stateMutability: "view",
    inputs: [{ name: "workflowId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "registerWorkflow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "workflowId", type: "bytes32" },
      { name: "nodes", type: "address[]" },
      { name: "subscriptionIds", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pauseWorkflow",
    stateMutability: "nonpayable",
    inputs: [{ name: "workflowId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "deleteWorkflow",
    stateMutability: "nonpayable",
    inputs: [{ name: "workflowId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "updateSubscriptionIds",
    stateMutability: "nonpayable",
    inputs: [
      { name: "workflowId", type: "bytes32" },
      { name: "subscriptionIds", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;
