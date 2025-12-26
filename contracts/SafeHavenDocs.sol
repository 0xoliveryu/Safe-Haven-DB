// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SafeHavenDocs
/// @notice Stores encrypted document keys (FHE) and encrypted document bodies (client-side).
/// @dev The 10-digit secret is stored as an encrypted euint64. The document body is encrypted off-chain using that secret.
contract SafeHavenDocs is ZamaEthereumConfig {
    struct Document {
        string name;
        string encryptedBody;
        euint64 encryptedKey;
        address owner;
        uint40 createdAt;
        uint40 updatedAt;
        uint32 version;
    }

    error InvalidName();
    error InvalidAddress();
    error DocumentAlreadyExists(bytes32 documentId);
    error DocumentNotFound(bytes32 documentId);
    error NotOwner(bytes32 documentId, address caller);
    error NotEditor(bytes32 documentId, address caller);

    event DocumentCreated(bytes32 indexed documentId, address indexed owner, string name);
    event DocumentUpdated(bytes32 indexed documentId, address indexed editor, uint32 version);
    event AccessGranted(bytes32 indexed documentId, address indexed owner, address indexed grantee);

    mapping(bytes32 => Document) private _documents;
    mapping(bytes32 => mapping(address => bool)) private _editors;
    bytes32[] private _documentIds;

    /// @notice Computes a document id from the filename.
    function computeDocumentId(string calldata name) public pure returns (bytes32) {
        return keccak256(bytes(name));
    }

    /// @notice Creates a new document with an empty encrypted body and an encrypted key.
    /// @param name The document filename.
    /// @param encryptedKey External encrypted input containing the 10-digit secret.
    /// @param inputProof Proof for the external encrypted input.
    function createDocument(string calldata name, externalEuint64 encryptedKey, bytes calldata inputProof)
        external
        returns (bytes32 documentId)
    {
        if (bytes(name).length == 0) revert InvalidName();

        documentId = computeDocumentId(name);
        if (_documents[documentId].owner != address(0)) revert DocumentAlreadyExists(documentId);

        euint64 key = FHE.fromExternal(encryptedKey, inputProof);

        _documents[documentId] = Document({
            name: name,
            encryptedBody: "",
            encryptedKey: key,
            owner: msg.sender,
            createdAt: uint40(block.timestamp),
            updatedAt: uint40(block.timestamp),
            version: 0
        });

        _documentIds.push(documentId);
        _editors[documentId][msg.sender] = true;

        FHE.allowThis(key);
        FHE.allow(key, msg.sender);

        emit DocumentCreated(documentId, msg.sender, name);
    }

    /// @notice Updates the encrypted body for an existing document.
    /// @dev The body must be encrypted client-side with the decrypted secret.
    function updateEncryptedBody(bytes32 documentId, string calldata encryptedBody) external {
        Document storage doc = _documents[documentId];
        if (doc.owner == address(0)) revert DocumentNotFound(documentId);
        if (!_editors[documentId][msg.sender]) revert NotEditor(documentId, msg.sender);

        doc.encryptedBody = encryptedBody;
        doc.updatedAt = uint40(block.timestamp);
        doc.version += 1;

        emit DocumentUpdated(documentId, msg.sender, doc.version);
    }

    /// @notice Grants edit permission and FHE key decryption permission to a user.
    function grantAccess(bytes32 documentId, address grantee) external {
        if (grantee == address(0)) revert InvalidAddress();

        Document storage doc = _documents[documentId];
        if (doc.owner == address(0)) revert DocumentNotFound(documentId);
        if (doc.owner != msg.sender) revert NotOwner(documentId, msg.sender);

        _editors[documentId][grantee] = true;
        FHE.allow(doc.encryptedKey, grantee);

        emit AccessGranted(documentId, msg.sender, grantee);
    }

    /// @notice Returns the full on-chain document data.
    /// @dev View functions must not rely on msg.sender; callers should pass their address to isEditor().
    function getDocument(bytes32 documentId)
        external
        view
        returns (
            string memory name,
            string memory encryptedBody,
            euint64 encryptedKey,
            address owner,
            uint40 createdAt,
            uint40 updatedAt,
            uint32 version
        )
    {
        Document storage doc = _documents[documentId];
        if (doc.owner == address(0)) revert DocumentNotFound(documentId);

        return (doc.name, doc.encryptedBody, doc.encryptedKey, doc.owner, doc.createdAt, doc.updatedAt, doc.version);
    }

    /// @notice Checks whether an address can edit a document.
    function isEditor(bytes32 documentId, address user) external view returns (bool) {
        return _editors[documentId][user];
    }

    /// @notice Returns the number of documents ever created.
    function getDocumentCount() external view returns (uint256) {
        return _documentIds.length;
    }

    /// @notice Paged list of document ids for UI consumption.
    function getDocumentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory ids) {
        uint256 total = _documentIds.length;
        if (offset >= total) return new bytes32[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        ids = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _documentIds[i];
        }
    }
}

