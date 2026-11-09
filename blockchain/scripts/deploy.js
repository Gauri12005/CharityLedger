
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const CharityLedger = await hre.ethers.getContractFactory(
    "CharityLedger"
  );

  const charityLedger = await CharityLedger.deploy();
  await charityLedger.waitForDeployment();

  const address = await charityLedger.getAddress();

  console.log("CharityLedger deployed at:", address);

  const artifact = await hre.artifacts.readArtifact("CharityLedger");

  const outputDir = path.join(__dirname, "../../frontend/src");
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "contract.json"),
    JSON.stringify({ address, abi: artifact.abi }, null, 2)
  );

  console.log("Contract details exported to frontend/src/contract.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
