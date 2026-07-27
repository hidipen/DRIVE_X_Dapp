const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const CarRental = await ethers.getContractFactory("CarRental");
  const carRental = await CarRental.deploy();
  await carRental.waitForDeployment();

  const address = await carRental.getAddress();
  const network = await ethers.provider.getNetwork();
  console.log("✅ CarRental deployed to:", address);

  // Save ABI + address for frontend & backend
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/CarRental.sol/CarRental.json"),
      "utf8"
    )
  );

  const deploymentInfo = {
    address,
    abi: artifact.abi,
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  };

  // Write to frontend ABI folder
  const frontendPath = path.join(__dirname, "../frontend/src/abi/CarRental.json");
  fs.mkdirSync(path.dirname(frontendPath), { recursive: true });
  fs.writeFileSync(frontendPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📁 ABI written to frontend/src/abi/CarRental.json");

  // Write to backend
  const backendPath = path.join(__dirname, "../backend/abi/CarRental.json");
  fs.mkdirSync(path.dirname(backendPath), { recursive: true });
  fs.writeFileSync(backendPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📁 ABI written to backend/abi/CarRental.json");

  // Write .env snippet
  console.log("\n─── Add to your .env files ───");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`REACT_APP_CHAIN_ID=${Number(network.chainId)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
