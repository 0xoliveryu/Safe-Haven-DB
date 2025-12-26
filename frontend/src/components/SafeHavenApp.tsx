import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Contract } from "ethers";
import type { Address, Hex } from "viem";
import { isAddress, keccak256, toBytes } from "viem";

import { SAFE_HAVEN_DOCS_ABI, SAFE_HAVEN_DOCS_ADDRESS } from "../config/contracts";
import { useEthersSigner } from "../hooks/useEthersSigner";
import { useZamaInstance } from "../hooks/useZamaInstance";
import { decryptDocumentBody, encryptDocumentBody } from "../lib/docCrypto";
import { shortHex, formatTimestamp } from "../lib/format";
import { sepoliaPublicClient } from "../lib/viemClient";
import { Header } from "./Header";
import "../styles/SafeHavenApp.css";

type DocumentRow = {
  id: Hex;
  name: string;
  encryptedBody: string;
  encryptedKey: Hex;
  owner: Address;
  createdAt: bigint;
  updatedAt: bigint;
  version: bigint;
};

function isBytes32(value: string): value is Hex {
  return value.startsWith("0x") && value.length === 66;
}

function generate10DigitSecret(): bigint {
  const maxExclusive = 9_000_000_000n;
  const minInclusive = 1_000_000_000n;
  const range = maxExclusive;
  const random = crypto.getRandomValues(new Uint32Array(2));
  const x = (BigInt(random[0]) << 32n) + BigInt(random[1]);
  return minInclusive + (x % range);
}

async function readDocument(contractAddress: Address, documentId: Hex): Promise<DocumentRow> {
  const result = await sepoliaPublicClient.readContract({
    address: contractAddress,
    abi: SAFE_HAVEN_DOCS_ABI,
    functionName: "getDocument",
    args: [documentId],
  });

  const [name, encryptedBody, encryptedKey, owner, createdAt, updatedAt, version] = result as unknown as [
    string,
    string,
    Hex,
    Address,
    bigint,
    bigint,
    bigint,
  ];

  return { id: documentId, name, encryptedBody, encryptedKey, owner, createdAt, updatedAt, version };
}

export function SafeHavenApp() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [contractAddressInput, setContractAddressInput] = useState<string>(SAFE_HAVEN_DOCS_ADDRESS);
  const contractAddress = useMemo(() => (isAddress(contractAddressInput) ? (contractAddressInput as Address) : null), [contractAddressInput]);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState<Hex | null>(null);
  const selectedDocument = useMemo(
    () => (selectedId ? documents.find((d) => d.id === selectedId) ?? null : null),
    [documents, selectedId],
  );

  const [knownSecrets, setKnownSecrets] = useState<Record<string, bigint>>({});
  const selectedSecret = selectedId ? knownSecrets[selectedId] : undefined;

  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  const [newName, setNewName] = useState("");
  const [createStatus, setCreateStatus] = useState<string>("");

  const [openId, setOpenId] = useState("");
  const [openStatus, setOpenStatus] = useState<string>("");

  const [decryptKeyStatus, setDecryptKeyStatus] = useState<string>("");

  const [decryptedBody, setDecryptedBody] = useState<string>("");
  const [draftBody, setDraftBody] = useState<string>("");
  const [bodyStatus, setBodyStatus] = useState<string>("");

  const [grantAddress, setGrantAddress] = useState<string>("");
  const [grantStatus, setGrantStatus] = useState<string>("");

  const refreshDocuments = useCallback(async () => {
    if (!contractAddress) return;

    const count = (await sepoliaPublicClient.readContract({
      address: contractAddress,
      abi: SAFE_HAVEN_DOCS_ABI,
      functionName: "getDocumentCount",
    })) as unknown as bigint;

    if (count === 0n) {
      setDocuments([]);
      setSelectedId(null);
      return;
    }

    const limit = 20n;
    const ids = (await sepoliaPublicClient.readContract({
      address: contractAddress,
      abi: SAFE_HAVEN_DOCS_ABI,
      functionName: "getDocumentIds",
      args: [0n, count < limit ? count : limit],
    })) as unknown as Hex[];

    const rows = await Promise.all(ids.map((id) => readDocument(contractAddress, id)));
    setDocuments(rows);
    setSelectedId((current) => current ?? (rows.length > 0 ? rows[0].id : null));
  }, [contractAddress]);

  const refreshCanEdit = useCallback(async () => {
    if (!contractAddress || !selectedId || !address) {
      setCanEdit(null);
      return;
    }

    const result = (await sepoliaPublicClient.readContract({
      address: contractAddress,
      abi: SAFE_HAVEN_DOCS_ABI,
      functionName: "isEditor",
      args: [selectedId, address as Address],
    })) as unknown as boolean;

    setCanEdit(result);
  }, [address, contractAddress, selectedId]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    void refreshCanEdit();
  }, [refreshCanEdit]);

  useEffect(() => {
    setDecryptedBody("");
    setDraftBody("");
    setBodyStatus("");
    setDecryptKeyStatus("");
    setGrantStatus("");
  }, [selectedId]);

  const createDocument = async () => {
    if (!contractAddress) {
      setCreateStatus("Enter a valid contract address.");
      return;
    }
    if (!address) {
      setCreateStatus("Connect your wallet first.");
      return;
    }
    if (!instance) {
      setCreateStatus("Encryption service is not ready yet.");
      return;
    }
    if (!signerPromise) {
      setCreateStatus("Wallet signer is not available.");
      return;
    }
    if (!newName.trim()) {
      setCreateStatus("Enter a document filename.");
      return;
    }

    setCreateStatus("Encrypting secret and submitting transaction...");
    try {
      const secret = generate10DigitSecret();
      const buffer = instance.createEncryptedInput(contractAddress, address);
      buffer.add64(secret);
      const encryptedInput = await buffer.encrypt();

      const signer = await signerPromise;
      const contract = new Contract(contractAddress, SAFE_HAVEN_DOCS_ABI, signer);

      const tx = await contract.createDocument(newName.trim(), encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const documentId = keccak256(toBytes(newName.trim())) as Hex;
      setKnownSecrets((prev) => ({ ...prev, [documentId]: secret }));
      setSelectedId(documentId);
      setCreateStatus(`Created. Secret (cleartext): ${secret.toString(10)}`);
      setNewName("");

      await refreshDocuments();
      await refreshCanEdit();
    } catch (err) {
      console.error(err);
      setCreateStatus(err instanceof Error ? err.message : "Failed to create document.");
    }
  };

  const openById = async () => {
    setOpenStatus("");
    if (!contractAddress) {
      setOpenStatus("Enter a valid contract address.");
      return;
    }
    if (!isBytes32(openId.trim())) {
      setOpenStatus("Enter a valid bytes32 document id.");
      return;
    }

    try {
      const row = await readDocument(contractAddress, openId.trim() as Hex);
      setDocuments((prev) => (prev.some((d) => d.id === row.id) ? prev : [row, ...prev]));
      setSelectedId(row.id);
      setOpenStatus("Loaded.");
      await refreshCanEdit();
    } catch (err) {
      console.error(err);
      setOpenStatus(err instanceof Error ? err.message : "Failed to load document.");
    }
  };

  const decryptKey = async () => {
    setDecryptKeyStatus("");
    if (!selectedDocument || !selectedId) return;
    if (!contractAddress) {
      setDecryptKeyStatus("Enter a valid contract address.");
      return;
    }
    if (!instance) {
      setDecryptKeyStatus("Encryption service is not ready yet.");
      return;
    }
    if (!signerPromise) {
      setDecryptKeyStatus("Wallet signer is not available.");
      return;
    }

    try {
      const signer = await signerPromise;
      const signerAddress = await signer.getAddress();

      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: selectedDocument.encryptedKey, contractAddress }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        signerAddress,
        startTimeStamp,
        durationDays,
      );

      const clear = result[selectedDocument.encryptedKey];
      const secret = typeof clear === "bigint" ? clear : BigInt(clear);
      setKnownSecrets((prev) => ({ ...prev, [selectedId]: secret }));
      setDecryptKeyStatus(`Decrypted. Secret (cleartext): ${secret.toString(10)}`);
    } catch (err) {
      console.error(err);
      setDecryptKeyStatus(err instanceof Error ? err.message : "Failed to decrypt key.");
    }
  };

  const decryptBody = async () => {
    setBodyStatus("");
    if (!selectedDocument || !selectedSecret) {
      setBodyStatus("Decrypt the secret first.");
      return;
    }

    try {
      const clear = await decryptDocumentBody(selectedSecret, selectedDocument.encryptedBody);
      setDecryptedBody(clear);
      setDraftBody(clear);
      setBodyStatus("Body decrypted.");
    } catch (err) {
      console.error(err);
      setBodyStatus(err instanceof Error ? err.message : "Failed to decrypt body.");
    }
  };

  const saveBody = async () => {
    setBodyStatus("");
    if (!selectedId || !selectedSecret) {
      setBodyStatus("Decrypt the secret first.");
      return;
    }
    if (!contractAddress) {
      setBodyStatus("Enter a valid contract address.");
      return;
    }
    if (!signerPromise) {
      setBodyStatus("Wallet signer is not available.");
      return;
    }
    if (canEdit === false) {
      setBodyStatus("You are not authorized to edit this document.");
      return;
    }

    try {
      setBodyStatus("Encrypting body and sending transaction...");
      const encryptedBody = await encryptDocumentBody(selectedSecret, draftBody);
      const signer = await signerPromise;
      const contract = new Contract(contractAddress, SAFE_HAVEN_DOCS_ABI, signer);
      const tx = await contract.updateEncryptedBody(selectedId, encryptedBody);
      await tx.wait();

      setBodyStatus("Saved.");
      await refreshDocuments();
    } catch (err) {
      console.error(err);
      setBodyStatus(err instanceof Error ? err.message : "Failed to save body.");
    }
  };

  const grantAccess = async () => {
    setGrantStatus("");
    if (!selectedId || !selectedDocument) return;
    if (!contractAddress) {
      setGrantStatus("Enter a valid contract address.");
      return;
    }
    if (!signerPromise) {
      setGrantStatus("Wallet signer is not available.");
      return;
    }
    if (!isAddress(grantAddress)) {
      setGrantStatus("Enter a valid grantee address.");
      return;
    }
    if (!address) {
      setGrantStatus("Connect your wallet first.");
      return;
    }
    if (selectedDocument.owner.toLowerCase() !== address.toLowerCase()) {
      setGrantStatus("Only the document owner can grant access.");
      return;
    }

    try {
      setGrantStatus("Sending transaction...");
      const signer = await signerPromise;
      const contract = new Contract(contractAddress, SAFE_HAVEN_DOCS_ABI, signer);
      const tx = await contract.grantAccess(selectedId, grantAddress as Address);
      await tx.wait();
      setGrantStatus("Granted.");
      setGrantAddress("");
      await refreshCanEdit();
    } catch (err) {
      console.error(err);
      setGrantStatus(err instanceof Error ? err.message : "Failed to grant access.");
    }
  };

  return (
    <div className="sh-app">
      <Header />

      <main className="sh-main">
        <section className="sh-card">
          <h2 className="sh-card-title">Network</h2>
          <div className="sh-row">
            <label className="sh-label">Contract Address (Sepolia)</label>
            <input
              className="sh-input"
              value={contractAddressInput}
              onChange={(e) => setContractAddressInput(e.target.value)}
              placeholder={SAFE_HAVEN_DOCS_ADDRESS}
            />
          </div>
          <div className="sh-muted">
            {zamaLoading ? "Encryption service: loading…" : zamaError ? `Encryption service error: ${zamaError}` : "Encryption service: ready"}
          </div>
        </section>

        <section className="sh-grid">
          <div className="sh-col">
            <div className="sh-card">
              <h2 className="sh-card-title">Create Document</h2>
              <div className="sh-row">
                <label className="sh-label">Filename</label>
                <input className="sh-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="notes.md" />
              </div>
              <button className="sh-button" onClick={createDocument}>
                Create
              </button>
              {createStatus && <div className="sh-status">{createStatus}</div>}
            </div>

            <div className="sh-card">
              <h2 className="sh-card-title">Open Document</h2>
              <div className="sh-row">
                <label className="sh-label">Document Id (bytes32)</label>
                <input className="sh-input" value={openId} onChange={(e) => setOpenId(e.target.value)} placeholder="0x…" />
              </div>
              <button className="sh-button-secondary" onClick={openById}>
                Open
              </button>
              {openStatus && <div className="sh-status">{openStatus}</div>}
            </div>

            <div className="sh-card">
              <h2 className="sh-card-title">Documents</h2>
              {documents.length === 0 ? (
                <div className="sh-muted">No documents loaded.</div>
              ) : (
                <ul className="sh-list">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button
                        className={doc.id === selectedId ? "sh-list-item sh-list-item-active" : "sh-list-item"}
                        onClick={() => setSelectedId(doc.id)}
                      >
                        <div className="sh-list-title">{doc.name}</div>
                        <div className="sh-list-sub">
                          {shortHex(doc.id)} • v{doc.version.toString()} • {shortHex(doc.owner)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="sh-col">
            <div className="sh-card">
              <h2 className="sh-card-title">Selected Document</h2>
              {!selectedDocument ? (
                <div className="sh-muted">Select a document.</div>
              ) : (
                <>
                  <div className="sh-kv">
                    <div className="sh-kv-row">
                      <span className="sh-kv-key">Id</span>
                      <span className="sh-kv-value">{shortHex(selectedDocument.id)}</span>
                    </div>
                    <div className="sh-kv-row">
                      <span className="sh-kv-key">Owner</span>
                      <span className="sh-kv-value">{shortHex(selectedDocument.owner)}</span>
                    </div>
                    <div className="sh-kv-row">
                      <span className="sh-kv-key">Updated</span>
                      <span className="sh-kv-value">{formatTimestamp(selectedDocument.updatedAt)}</span>
                    </div>
                    <div className="sh-kv-row">
                      <span className="sh-kv-key">Editor</span>
                      <span className="sh-kv-value">
                        {canEdit === null ? "-" : canEdit ? "yes" : "no"}
                      </span>
                    </div>
                    <div className="sh-kv-row">
                      <span className="sh-kv-key">Encrypted Key Handle</span>
                      <span className="sh-kv-value">{shortHex(selectedDocument.encryptedKey)}</span>
                    </div>
                  </div>

                  <div className="sh-actions">
                    <button className="sh-button-secondary" onClick={decryptKey}>
                      Decrypt Secret
                    </button>
                    {decryptKeyStatus && <div className="sh-status">{decryptKeyStatus}</div>}
                  </div>

                  <div className="sh-actions">
                    <button className="sh-button-secondary" onClick={decryptBody} disabled={!selectedSecret}>
                      Decrypt Body
                    </button>
                    {selectedSecret !== undefined && (
                      <div className="sh-muted">Secret available in-memory.</div>
                    )}
                  </div>

                  <div className="sh-row">
                    <label className="sh-label">Body (decrypted)</label>
                    <textarea
                      className="sh-textarea"
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Decrypt and edit..."
                      rows={10}
                    />
                  </div>

                  <div className="sh-actions">
                    <button className="sh-button" onClick={saveBody} disabled={!selectedSecret}>
                      Encrypt & Save
                    </button>
                    {bodyStatus && <div className="sh-status">{bodyStatus}</div>}
                    {decryptedBody && <div className="sh-muted">Last decrypt length: {decryptedBody.length} chars</div>}
                  </div>

                  <div className="sh-divider" />

                  <h3 className="sh-card-subtitle">Grant Access</h3>
                  <div className="sh-row">
                    <label className="sh-label">Grantee Address</label>
                    <input
                      className="sh-input"
                      value={grantAddress}
                      onChange={(e) => setGrantAddress(e.target.value)}
                      placeholder="0x…"
                    />
                  </div>
                  <button className="sh-button-secondary" onClick={grantAccess}>
                    Grant Edit + Decrypt
                  </button>
                  {grantStatus && <div className="sh-status">{grantStatus}</div>}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
