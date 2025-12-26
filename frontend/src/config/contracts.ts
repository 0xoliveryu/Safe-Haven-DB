export const SAFE_HAVEN_DOCS_ADDRESS = "0xF0CFD07f7450F18E2c2305A8d6Ed143bDadD1157" as const;

export const SAFE_HAVEN_DOCS_ABI = [
  { inputs: [{ internalType: "bytes32", name: "documentId", type: "bytes32" }], name: "DocumentAlreadyExists", type: "error" },
  { inputs: [{ internalType: "bytes32", name: "documentId", type: "bytes32" }], name: "DocumentNotFound", type: "error" },
  { inputs: [], name: "InvalidAddress", type: "error" },
  { inputs: [], name: "InvalidName", type: "error" },
  {
    inputs: [
      { internalType: "bytes32", name: "documentId", type: "bytes32" },
      { internalType: "address", name: "caller", type: "address" },
    ],
    name: "NotEditor",
    type: "error",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "documentId", type: "bytes32" },
      { internalType: "address", name: "caller", type: "address" },
    ],
    name: "NotOwner",
    type: "error",
  },
  { inputs: [], name: "ZamaProtocolUnsupported", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "documentId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: true, internalType: "address", name: "grantee", type: "address" },
    ],
    name: "AccessGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "documentId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
    ],
    name: "DocumentCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "documentId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "editor", type: "address" },
      { indexed: false, internalType: "uint32", name: "version", type: "uint32" },
    ],
    name: "DocumentUpdated",
    type: "event",
  },
  {
    inputs: [{ internalType: "string", name: "name", type: "string" }],
    name: "computeDocumentId",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "confidentialProtocolId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "externalEuint64", name: "encryptedKey", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "createDocument",
    outputs: [{ internalType: "bytes32", name: "documentId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "documentId", type: "bytes32" }],
    name: "getDocument",
    outputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "encryptedBody", type: "string" },
      { internalType: "euint64", name: "encryptedKey", type: "bytes32" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint40", name: "createdAt", type: "uint40" },
      { internalType: "uint40", name: "updatedAt", type: "uint40" },
      { internalType: "uint32", name: "version", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "getDocumentCount", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getDocumentIds",
    outputs: [{ internalType: "bytes32[]", name: "ids", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "documentId", type: "bytes32" },
      { internalType: "address", name: "grantee", type: "address" },
    ],
    name: "grantAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "documentId", type: "bytes32" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "isEditor",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "documentId", type: "bytes32" },
      { internalType: "string", name: "encryptedBody", type: "string" },
    ],
    name: "updateEncryptedBody",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

