import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import crypto from "crypto";

function parseBytes32(value: string): string {
  if (!value.startsWith("0x") || value.length !== 66) {
    throw new Error(`Expected a bytes32 value (0x + 64 hex chars)`);
  }
  return value;
}

task("task:docs:address", "Prints the SafeHavenDocs contract address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const deployment = await hre.deployments.get("SafeHavenDocs");
  console.log("SafeHavenDocs address is " + deployment.address);
});

task("task:docs:create", "Creates a new document with a random 10-digit secret")
  .addParam("name", "The document filename (unique)")
  .addOptionalParam("secret", "Optional 10-digit secret (as a number)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("SafeHavenDocs");
    const signers = await ethers.getSigners();
    const signer = signers[0];

    const contract = await ethers.getContractAt("SafeHavenDocs", deployment.address);

    const secret =
      taskArguments.secret !== undefined
        ? BigInt(taskArguments.secret)
        : BigInt(crypto.randomInt(1_000_000_000, 10_000_000_000));

    const encryptedInput = await fhevm.createEncryptedInput(deployment.address, signer.address).add64(secret).encrypt();

    const tx = await contract.connect(signer).createDocument(taskArguments.name, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const documentId = await contract.computeDocumentId(taskArguments.name);
    console.log(`documentId: ${documentId}`);
    console.log(`secret (cleartext): ${secret.toString()}`);
  });

task("task:docs:decrypt-key", "Decrypts the stored secret for a document (requires ACL permission)")
  .addOptionalParam("address", "Optionally specify the SafeHavenDocs contract address")
  .addOptionalParam("documentid", "Document id as bytes32 (0x...)")
  .addOptionalParam("name", "Compute the document id from a filename")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SafeHavenDocs");
    const contract = await ethers.getContractAt("SafeHavenDocs", deployment.address);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const documentId =
      taskArguments.documentid !== undefined
        ? parseBytes32(taskArguments.documentid)
        : taskArguments.name !== undefined
          ? await contract.computeDocumentId(taskArguments.name)
          : (() => {
              throw new Error(`Provide --documentid or --name`);
            })();

    const doc = await contract.getDocument(documentId);

    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, doc.encryptedKey, deployment.address, signer);
    console.log(`documentId: ${documentId}`);
    console.log(`secret (cleartext): ${clear.toString()}`);
  });

task("task:docs:update-body", "Updates the encrypted body string for a document")
  .addOptionalParam("address", "Optionally specify the SafeHavenDocs contract address")
  .addParam("documentid", "Document id as bytes32 (0x...)")
  .addParam("encryptedbody", "Encrypted body string to store on-chain")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SafeHavenDocs");
    const contract = await ethers.getContractAt("SafeHavenDocs", deployment.address);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const documentId = parseBytes32(taskArguments.documentid);

    const tx = await contract.connect(signer).updateEncryptedBody(documentId, taskArguments.encryptedbody);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:docs:grant", "Grants edit + decrypt permission to another address (owner only)")
  .addOptionalParam("address", "Optionally specify the SafeHavenDocs contract address")
  .addParam("documentid", "Document id as bytes32 (0x...)")
  .addParam("grantee", "Address to grant access to")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SafeHavenDocs");
    const contract = await ethers.getContractAt("SafeHavenDocs", deployment.address);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const documentId = parseBytes32(taskArguments.documentid);

    const tx = await contract.connect(signer).grantAccess(documentId, taskArguments.grantee);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

