import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { SafeHavenDocs, SafeHavenDocs__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SafeHavenDocs")) as SafeHavenDocs__factory;
  const contract = (await factory.deploy()) as SafeHavenDocs;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("SafeHavenDocs", function () {
  let signers: Signers;
  let contract: SafeHavenDocs;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("creates a document and allows the owner to decrypt the key", async function () {
    const name = "hello.txt";
    const secret10Digits = 1234567890n;

    const documentId = await contract.computeDocumentId(name);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(secret10Digits)
      .encrypt();

    await (await contract.connect(signers.alice).createDocument(name, encryptedInput.handles[0], encryptedInput.inputProof)).wait();

    const doc = await contract.getDocument(documentId);
    expect(doc.name).to.eq(name);
    expect(doc.encryptedBody).to.eq("");
    expect(doc.owner).to.eq(signers.alice.address);
    expect(doc.version).to.eq(0);

    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      doc.encryptedKey,
      contractAddress,
      signers.alice,
    );
    expect(decryptedKey).to.eq(secret10Digits);
  });

  it("rejects duplicate document names", async function () {
    const name = "duplicate.md";
    const secret10Digits = 9876543210n;

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(secret10Digits)
      .encrypt();

    await (await contract.connect(signers.alice).createDocument(name, encryptedInput.handles[0], encryptedInput.inputProof)).wait();

    await expect(
      contract.connect(signers.alice).createDocument(name, encryptedInput.handles[0], encryptedInput.inputProof),
    )
      .to.be.revertedWithCustomError(contract, "DocumentAlreadyExists")
      .withArgs(await contract.computeDocumentId(name));
  });

  it("grants access to another user who can decrypt the key and edit the document", async function () {
    const name = "shared.txt";
    const secret10Digits = 1000000000n;
    const documentId = await contract.computeDocumentId(name);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(secret10Digits)
      .encrypt();

    await (await contract.connect(signers.alice).createDocument(name, encryptedInput.handles[0], encryptedInput.inputProof)).wait();

    await (await contract.connect(signers.alice).grantAccess(documentId, signers.bob.address)).wait();

    expect(await contract.isEditor(documentId, signers.bob.address)).to.eq(true);

    const doc = await contract.getDocument(documentId);
    const decryptedKey = await fhevm.userDecryptEuint(FhevmType.euint64, doc.encryptedKey, contractAddress, signers.bob);
    expect(decryptedKey).to.eq(secret10Digits);

    const encryptedBody = "ciphertext:v1:base64";
    await (await contract.connect(signers.bob).updateEncryptedBody(documentId, encryptedBody)).wait();

    const updated = await contract.getDocument(documentId);
    expect(updated.encryptedBody).to.eq(encryptedBody);
    expect(updated.version).to.eq(1);

    await expect(contract.connect(signers.deployer).updateEncryptedBody(documentId, "x"))
      .to.be.revertedWithCustomError(contract, "NotEditor")
      .withArgs(documentId, signers.deployer.address);
  });
});

