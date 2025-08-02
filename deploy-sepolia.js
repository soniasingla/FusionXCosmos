const { ethers } = require("hardhat");
require('dotenv').config();
const fs = require('fs');

async function main() {
    console.log("🚀 Deploying to Sepolia testnet for hackathon demo...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.1")) {
        console.log("⚠️  WARNING: Low balance. Make sure you have enough Sepolia ETH");
        console.log("Get testnet ETH from: https://sepoliafaucet.com/");
    }

    console.log("\n📝 Deploying HashlockTimelock...");
    const HashlockTimelock = await ethers.getContractFactory("HashlockTimelock");
    const hashlockTimelock = await HashlockTimelock.deploy();
    await hashlockTimelock.waitForDeployment();
    const hashlockAddress = await hashlockTimelock.getAddress();
    console.log("✅ HashlockTimelock deployed:", hashlockAddress);

    console.log("\n📝 Deploying AtomicSwapEthereum...");
    const AtomicSwapEthereum = await ethers.getContractFactory("AtomicSwapEthereum");
    const atomicSwapEthereum = await AtomicSwapEthereum.deploy();
    await atomicSwapEthereum.waitForDeployment();
    const atomicSwapAddress = await atomicSwapEthereum.getAddress();
    console.log("✅ AtomicSwapEthereum deployed:", atomicSwapAddress);

    console.log("\n📝 Deploying CrossChainSwapManager...");
    const CrossChainSwapManager = await ethers.getContractFactory("CrossChainSwapManager");
    const crossChainManager = await CrossChainSwapManager.deploy(atomicSwapAddress);
    await crossChainManager.waitForDeployment();
    const managerAddress = await crossChainManager.getAddress();
    console.log("✅ CrossChainSwapManager deployed:", managerAddress);

    console.log("\n⚙️ Configuring contracts for production use...");
    
    await atomicSwapEthereum.setSupportedToken(ethers.ZeroAddress, true);
    console.log("✅ ETH support enabled");
    
    const RESOLVER_ROLE = await crossChainManager.RESOLVER_ROLE();
    await crossChainManager.addResolver(deployer.address);
    console.log("✅ Deployer added as resolver");

    const stakeAmount = ethers.parseEther("1.0");
    await crossChainManager.stakeAsResolver({ value: stakeAmount });
    console.log("✅ Resolver stake of 1.0 ETH deposited");

    const network = await ethers.provider.getNetwork();
    const deploymentInfo = {
        network: "sepolia",
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            HashlockTimelock: hashlockAddress,
            AtomicSwapEthereum: atomicSwapAddress,
            CrossChainSwapManager: managerAddress
        },
        explorerUrls: {
            HashlockTimelock: `https://sepolia.etherscan.io/address/${hashlockAddress}`,
            AtomicSwapEthereum: `https://sepolia.etherscan.io/address/${atomicSwapAddress}`,
            CrossChainSwapManager: `https://sepolia.etherscan.io/address/${managerAddress}`
        },
        config: {
            minimumSafetyDeposit: "0.01",
            minTimelockDuration: "3600",
            maxTimelockDuration: "604800"
        }
    };

    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync('./deployments/sepolia-deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to ./deployments/sepolia-deployment.json");

    console.log("\n🎯 SEPOLIA TESTNET DEPLOYMENT COMPLETE");
    console.log("=====================================");
    console.log(`Network: Sepolia (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`HashlockTimelock: ${hashlockAddress}`);
    console.log(`AtomicSwapEthereum: ${atomicSwapAddress}`);
    console.log(`CrossChainSwapManager: ${managerAddress}`);
    
    console.log("\n🔗 ETHERSCAN LINKS (for hackathon verification):");
    console.log(`HashlockTimelock: https://sepolia.etherscan.io/address/${hashlockAddress}`);
    console.log(`AtomicSwapEthereum: https://sepolia.etherscan.io/address/${atomicSwapAddress}`);
    console.log(`CrossChainSwapManager: https://sepolia.etherscan.io/address/${managerAddress}`);

    console.log("\n🔧 ENVIRONMENT VARIABLES FOR DEMO:");
    console.log(`export SEPOLIA_ATOMIC_SWAP_ADDRESS=${atomicSwapAddress}`);
    console.log(`export SEPOLIA_CROSS_CHAIN_MANAGER_ADDRESS=${managerAddress}`);
    console.log(`export SEPOLIA_CHAIN_ID=${network.chainId}`);
    
    console.log("\n🧪 READY FOR CROSS-CHAIN DEMO");
    console.log("Next step: Deploy CosmWasm contract to Juno testnet");
}

main()
    .then(() => {
        console.log("\n✅ Sepolia deployment successful - ready for hackathon!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Sepolia deployment failed:", error);
        process.exit(1);
    });