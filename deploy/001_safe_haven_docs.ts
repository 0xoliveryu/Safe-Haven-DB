import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed = await deploy("SafeHavenDocs", {
    from: deployer,
    log: true,
  });

  console.log(`SafeHavenDocs contract: ${deployed.address}`);
};

export default func;
func.id = "deploy_safe_haven_docs";
func.tags = ["SafeHavenDocs"];

