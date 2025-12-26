# Safe Haven Docs (FHEVM)

Safe Haven Docs is a privacy-preserving document registry and collaborative editor for the Ethereum Sepolia testnet. It stores an encrypted document key on-chain using Zama FHEVM while the document body is encrypted client-side with that key and stored on-chain as ciphertext. Ownership, edits, and key decryption permissions are enforced on-chain.

## Project Goals

- Keep document content confidential on a public blockchain without trusting a centralized server.
- Allow owners to share decryption access and editing rights with specific collaborators.
- Preserve an on-chain audit trail of document creation, updates, and versions.
- Keep the frontend and contract flows explicit and verifiable.

## Problems Solved

- Public chains are transparent; this project protects document confidentiality using FHE for key management and client-side encryption for content.
- Traditional sharing flows require out-of-band key exchange; this project uses on-chain allowlists to share the encrypted key.
- Collaboration often lacks immutable audit logs; this project stores versions and timestamps on-chain.

## Key Advantages

- Encrypted key on-chain using FHE (euint64) with explicit allowlists for decryption.
- Client-side encryption of document content, so plaintext never touches the chain.
- Deterministic document id computed from filename for consistent retrieval.
- On-chain ownership and editor roles with clear event logs.
- Minimal on-chain storage for privacy-sensitive data: only ciphertext and metadata.
- Frontend reads with viem and writes with ethers, matching web3 best practices for FHEVM.

## Core Workflows

1. Create a document
   - Generate a random 10-digit numeric secret A locally.
   - Encrypt A with Zama FHE, producing an encrypted euint64.
   - Submit: filename, empty encrypted body, and encrypted A to the chain.
2. Read and edit a document
   - Fetch the filename and encrypted A from the chain.
   - Decrypt A (if allowed) and use it to encrypt the document body client-side.
   - Submit the encrypted body to the chain and increment the version.
3. Share access
   - The owner grants access to a collaborator address.
   - The collaborator can decrypt A and submit encrypted updates.

## On-Chain Data Model

Document fields in `SafeHavenDocs`:

- `name` (string): document filename.
- `encryptedBody` (string): ciphertext of the document body (client-side encrypted).
- `encryptedKey` (euint64): FHE-encrypted 10-digit secret A.
- `owner` (address): document owner.
- `createdAt` (uint40): creation timestamp.
- `updatedAt` (uint40): last update timestamp.
- `version` (uint32): incremented on each update.

Access control:

- `isEditor(documentId, user)` returns whether a user can edit.
- `grantAccess` adds editor permission and FHE decryption permission for the key.
- No revoke flow exists yet; access is append-only in the current version.

## Smart Contract Interface

Core functions in `contracts/SafeHavenDocs.sol`:

- `computeDocumentId(name)` => `bytes32`
- `createDocument(name, encryptedKey, inputProof)` => `documentId`
- `updateEncryptedBody(documentId, encryptedBody)`
- `grantAccess(documentId, grantee)`
- `getDocument(documentId)` returns full document data
- `getDocumentIds(offset, limit)` returns paged ids

Events:

- `DocumentCreated(documentId, owner, name)`
- `DocumentUpdated(documentId, editor, version)`
- `AccessGranted(documentId, owner, grantee)`

## Architecture Overview

- On-chain: `SafeHavenDocs` stores metadata, the FHE-encrypted key, and encrypted body.
- Client-side: generates a 10-digit secret, encrypts/decrypts content with that secret.
- FHE permissions: the contract allows decryption for specific addresses.
- Frontend: uses viem for reads and ethers for writes to the contract.

## Technology Stack

- Solidity + Hardhat for smart contracts and tests.
- Zama FHEVM libraries for encrypted key handling.
- React + Vite for the frontend UI.
- viem for read-only contract calls.
- ethers for contract write transactions.
- rainbow (RainbowKit) for wallet connections.

## Repository Layout

```
contracts/   Smart contract source code
deploy/      Deployment scripts
tasks/       Hardhat tasks
test/        Hardhat tests
frontend/    React + Vite frontend (Sepolia)
docs/        Zama integration docs
scripts/     Utility scripts (ABI/address sync)
```

## Setup and Development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install --no-package-lock
```

### Compile and test

```bash
npm run compile
npm run test
```

### Local development

The contracts can be deployed to a local Hardhat node for testing, but the frontend targets Sepolia only.

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

## Deployment

### Sepolia deployment

1. Create a `.env` in the repository root:
   - `PRIVATE_KEY` (deploy key, no mnemonic)
   - `INFURA_API_KEY`
   - `ETHERSCAN_API_KEY` (optional for verify)
2. Run deployment:

```bash
npm run deploy:sepolia
```

3. Sync ABI and address to the frontend:

```bash
node scripts/sync-frontend-contracts.cjs
```

This script reads `deployments/sepolia` and writes a TypeScript module to
`frontend/src/config/contracts.ts` so the frontend does not consume JSON files.

### Sepolia verification (optional)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend Notes and Constraints

- Reads use viem; writes use ethers.
- No frontend environment variables.
- No localhost network configuration in the frontend.
- No frontend JSON files; contract ABI is imported from a TypeScript module.
- Do not modify `frontend/hooks` (hooks are treated as read-only).

## Documentation

- Zama FHEVM guide: `docs/zama_llm.md`
- Zama doc relayer guide: `docs/zama_doc_relayer.md`
- Official FHEVM docs: https://docs.zama.ai/fhevm

## Security and Privacy Considerations

- The 10-digit secret A is the only key to decrypt the document body. Protect it on the client.
- The encrypted body is stored on-chain; plaintext is never sent to the contract.
- Access is granted via FHE allowlists; the contract currently does not provide a revoke mechanism.
- On-chain data is immutable; incorrect uploads cannot be removed, only superseded by new versions.

## Future Roadmap

- Add access revocation and audit-friendly access history.
- Improve document listing filters and pagination UX.
- Add optional metadata encryption (title and tags) to reduce leakage.
- Add multi-device key handling flows without local storage.
- Extend test coverage for edge cases and permissions.

## License

BSD-3-Clause-Clear. See `LICENSE`.
