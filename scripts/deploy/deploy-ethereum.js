const { ethers } = require("hardhat");
require('dotenv').config();
const fs = require('fs');

async function main() {
    console.log("🚀 Deploying Ethereum contracts for 1inch Cross-chain Swap...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    // Deploy HashlockTimelock
    console.log("\n📝 Deploying HashlockTimelock...");
    const HashlockTimelock = await ethers.getContractFactory("HashlockTimelock");
    const hashlockTimelock = await HashlockTimelock.deploy();
    await hashlockTimelock.waitForDeployment();
    console.log("✅ HashlockTimelock deployed to:", await hashlockTimelock.getAddress());

    // Deploy AtomicSwapEthereum
    console.log("\n📝 Deploying AtomicSwapEthereum...");
    const AtomicSwapEthereum = await ethers.getContractFactory("AtomicSwapEthereum");
    const atomicSwapEthereum = await AtomicSwapEthereum.deploy();
    await atomicSwapEthereum.waitForDeployment();
    console.log("✅ AtomicSwapEthereum deployed to:", await atomicSwapEthereum.getAddress());

    // Deploy CrossChainSwapManager
    console.log("\n📝 Deploying CrossChainSwapManager...");
    const CrossChainSwapManager = await ethers.getContractFactory("CrossChainSwapManager");
    const crossChainSwapManager = await CrossChainSwapManager.deploy(await atomicSwapEthereum.getAddress());
    await crossChainSwapManager.waitForDeployment();
    console.log("✅ CrossChainSwapManager deployed to:", await crossChainSwapManager.getAddress());

    // Configure contracts
    console.log("\n⚙️ Configuring contracts...");
    
    // Set supported tokens (ETH and some test tokens)
    await atomicSwapEthereum.setSupportedToken(ethers.ZeroAddress, true); // ETH
    console.log("✅ ETH support enabled");
    
    // Add initial resolver role to deployer
    const RESOLVER_ROLE = await crossChainSwapManager.RESOLVER_ROLE();
    await crossChainSwapManager.addResolver(deployer.address);
    console.log("✅ Deployer added as resolver");

    // Stake as resolver
    const stakeAmount = ethers.parseEther("1.0");
    await crossChainSwapManager.stakeAsResolver({ value: stakeAmount });
    console.log("✅ Initial resolver stake of 1 ETH deposited");

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const networkName = hre.network.name;
    console.log("Network:", networkName);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Save deployment addresses
    const network = await ethers.provider.getNetwork()
    const deploymentInfo = {
        network: networkName,
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        contracts: {
            HashlockTimelock: await hashlockTimelock.getAddress(),
            AtomicSwapEthereum: await atomicSwapEthereum.getAddress(),
            CrossChainSwapManager: await crossChainSwapManager.getAddress()
        },
        transactionHashes: {
            HashlockTimelock: hashlockTimelock.deploymentTransaction()?.hash || 'N/A',
            AtomicSwapEthereum: atomicSwapEthereum.deploymentTransaction()?.hash || 'N/A',
            CrossChainSwapManager: crossChainSwapManager.deploymentTransaction()?.hash || 'N/A'
        },
        deployedAt: new Date().toISOString()
    };

    const deploymentPath = `./deployments/${networkName}-deployment.json`;
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Deployment info saved to ${deploymentPath}`);

    // Print summary
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("====================");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`HashlockTimelock: ${await hashlockTimelock.getAddress()}`);
    console.log(`AtomicSwapEthereum: ${await atomicSwapEthereum.getAddress()}`);
    console.log(`CrossChainSwapManager: ${await crossChainSwapManager.getAddress()}`);

    console.log("\n📝 ENVIRONMENT VARIABLES TO SET:");
    console.log(`ATOMIC_SWAP_ADDRESS=${await atomicSwapEthereum.getAddress()}`);
    console.log(`CROSS_CHAIN_MANAGER_ADDRESS=${await crossChainSwapManager.getAddress()}`);
    
    console.log("\n🎉 Ethereum deployment completed successfully!");

    // Verify contracts on Etherscan if on testnet/mainnet
    if (networkName !== 'hardhat' && networkName !== 'localhost') {
        console.log("\n🔍 Verifying contracts on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: await hashlockTimelock.getAddress(),
                constructorArguments: [],
            });
            console.log("✅ HashlockTimelock verified");
        } catch (error) {
            console.log("❌ HashlockTimelock verification failed:", error.message);
        }

        try {
            await hre.run("verify:verify", {
                address: await atomicSwapEthereum.getAddress(),
                constructorArguments: [],
            });
            console.log("✅ AtomicSwapEthereum verified");
        } catch (error) {
            console.log("❌ AtomicSwapEthereum verification failed:", error.message);
        }

        try {
            await hre.run("verify:verify", {
                address: await crossChainSwapManager.getAddress(),
                constructorArguments: [await atomicSwapEthereum.getAddress()],
            });
            console.log("✅ CrossChainSwapManager verified");
        } catch (error) {
            console.log("❌ CrossChainSwapManager verification failed:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });