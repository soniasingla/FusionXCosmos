const { ethers } = require("hardhat");
const crypto = require('crypto');
require('dotenv').config();

class CrossChainDemo {
    constructor() {
        this.secret = null;
        this.hashlock = null;
        this.swapId = null;
        this.contracts = {};
    }

    async initialize() {
        console.log("🚀 Initializing Cross-Chain Swap Demo...");
        
        // Get signers
        const [deployer, user, resolver] = await ethers.getSigners();
        this.deployer = deployer;
        this.user = user;
        this.resolver = resolver;
        
        console.log("Deployer:", deployer.address);
        console.log("User:", user.address);
        console.log("Resolver:", resolver.address);

        // Generate secret and hashlock
        this.secret = ethers.hexlify(crypto.randomBytes(32));
        this.hashlock = ethers.keccak256(this.secret);
        
        console.log("Secret generated:", this.secret);
        console.log("Hashlock:", this.hashlock);

        // Deploy contracts if not already deployed
        await this.deployContracts();
        
        console.log("✅ Demo initialized successfully");
    }

    async deployContracts() {
        console.log("\n📝 Deploying demo contracts...");
        
        // Deploy AtomicSwapEthereum
        const AtomicSwapEthereum = await ethers.getContractFactory("AtomicSwapEthereum");
        this.contracts.atomicSwap = await AtomicSwapEthereum.deploy();
        await this.contracts.atomicSwap.waitForDeployment();
        console.log("AtomicSwapEthereum deployed to:", await this.contracts.atomicSwap.getAddress());

        // Deploy CrossChainSwapManager
        const CrossChainSwapManager = await ethers.getContractFactory("CrossChainSwapManager");
        this.contracts.crossChainManager = await CrossChainSwapManager.deploy(await this.contracts.atomicSwap.getAddress());
        await this.contracts.crossChainManager.waitForDeployment();
        console.log("CrossChainSwapManager deployed to:", await this.contracts.crossChainManager.getAddress());

        // Setup resolver
        await this.contracts.crossChainManager.addResolver(this.resolver.address);
        await this.contracts.crossChainManager.connect(this.resolver).stakeAsResolver({ 
            value: ethers.parseEther("1.0") 
        });
        
        console.log("✅ Contracts deployed and configured");
    }

    async demonstrateEthereumToCosmosSwap() {
        console.log("\n🔄 Demonstrating Ethereum → Cosmos Swap...");
        
        const swapAmount = ethers.parseEther("0.1"); // 0.1 ETH
        const currentBlock = await ethers.provider.getBlock('latest');
        const timelock = currentBlock.timestamp + 7200; // 2 hours from now
        const safetyDeposit = ethers.parseEther("0.01");
        
        // Step 1: User initiates swap on Ethereum
        console.log("👤 User initiating Ethereum swap...");
        const tx = await this.contracts.atomicSwap.connect(this.user).initiateSwap(
            this.resolver.address, // participant (resolver)
            ethers.ZeroAddress, // ETH
            swapAmount,
            this.hashlock,
            timelock,
            "cosmos1useraddress", // Cosmos recipient
            { value: swapAmount + safetyDeposit }
        );
        
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
        this.swapId = event.args.swapId;
        
        console.log("✅ Ethereum swap initiated");
        console.log("Swap ID:", this.swapId);
        console.log("Transaction hash:", receipt.transactionHash);
        console.log("Block number:", receipt.blockNumber);

        // Step 2: Verify swap state
        const swap = await this.contracts.atomicSwap.getSwap(this.swapId);
        console.log("Swap details:", {
            initiator: swap.initiator,
            participant: swap.participant,
            amount: ethers.formatEther(swap.amount),
            state: swap.state,
            timelock: new Date(Number(swap.timelock) * 1000).toISOString()
        });

        // Step 3: Simulate resolver creating corresponding Cosmos swap
        console.log("🤖 Resolver would now create corresponding Cosmos swap...");
        console.log("Cosmos swap parameters:");
        console.log("- Initiator: cosmos_resolver_address");
        console.log("- Participant: cosmos1useraddress");
        console.log("- Amount: equivalent ATOM tokens");
        console.log("- Hashlock:", this.hashlock);
        console.log("- Timelock:", Number(timelock) - 1800); // 30 min buffer

        // Step 4: Simulate user claiming on Cosmos (reveals secret)
        console.log("👤 User would claim tokens on Cosmos, revealing secret...");
        console.log("Secret revealed:", this.secret);

        // Step 5: Resolver uses secret to claim on Ethereum
        console.log("🤖 Resolver claiming Ethereum tokens with revealed secret...");
        const claimTx = await this.contracts.atomicSwap.connect(this.resolver).completeSwap(
            this.swapId,
            this.secret
        );
        
        const claimReceipt = await claimTx.wait();
        console.log("✅ Ethereum swap completed by resolver");
        console.log("Transaction hash:", claimReceipt.transactionHash);

        // Verify final state
        const finalSwap = await this.contracts.atomicSwap.getSwap(this.swapId);
        console.log("Final swap state:", finalSwap.state); // Should be 2 (COMPLETED)
        console.log("Revealed secret:", finalSwap.secret);

        console.log("🎉 Ethereum → Cosmos swap demonstration completed!");
    }

    async demonstrateCosmosToEthereumSwap() {
        console.log("\n🔄 Demonstrating Cosmos → Ethereum Swap...");
        
        // Generate new secret for reverse swap
        const reverseSecret = ethers.hexlify(crypto.randomBytes(32));
        const reverseHashlock = ethers.keccak256(reverseSecret);
        const currentBlock = await ethers.provider.getBlock('latest');
        const timelock = currentBlock.timestamp + 7200;
        
        console.log("New secret for reverse swap:", reverseSecret);
        console.log("New hashlock:", reverseHashlock);

        // Step 1: Simulate user initiating swap on Cosmos
        console.log("👤 User would initiate Cosmos swap...");
        console.log("Cosmos swap parameters:");
        console.log("- Initiator: cosmos1useraddress");
        console.log("- Participant: cosmos_resolver_address");
        console.log("- Amount: 100 ATOM");
        console.log("- Hashlock:", reverseHashlock);
        console.log("- Timelock:", Number(timelock));
        console.log("- Ethereum recipient:", this.user.address);

        // Step 2: Resolver responds with Ethereum swap
        console.log("🤖 Resolver creating corresponding Ethereum swap...");
        const swapAmount = ethers.parseEther("0.05"); // 0.05 ETH equivalent
        const safetyDeposit = ethers.parseEther("0.01");
        
        const tx = await this.contracts.atomicSwap.connect(this.resolver).initiateSwap(
            this.user.address, // participant (user)
            ethers.ZeroAddress, // ETH
            swapAmount,
            reverseHashlock,
            Number(timelock) - 1800, // 30 min buffer
            "cosmos_resolver_address", // Cosmos recipient
            { value: swapAmount + safetyDeposit }
        );
        
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
        const reverseSwapId = event.args.swapId;
        
        console.log("✅ Ethereum response swap created");
        console.log("Reverse Swap ID:", reverseSwapId);

        // Step 3: Simulate resolver claiming on Cosmos (reveals secret)
        console.log("🤖 Resolver would claim ATOM tokens on Cosmos, revealing secret...");
        console.log("Secret revealed:", reverseSecret);

        // Step 4: User uses secret to claim on Ethereum
        console.log("👤 User claiming Ethereum tokens with revealed secret...");
        const claimTx = await this.contracts.atomicSwap.connect(this.user).completeSwap(
            reverseSwapId,
            reverseSecret
        );
        
        const claimReceipt = await claimTx.wait();
        console.log("✅ Ethereum swap completed by user");
        console.log("Transaction hash:", claimReceipt.transactionHash);

        console.log("🎉 Cosmos → Ethereum swap demonstration completed!");
    }

    async demonstrateTimeoutScenario() {
        console.log("\n⏰ Demonstrating Timeout/Refund Scenario...");
        
        const swapAmount = ethers.parseEther("0.01");
        const currentBlock = await ethers.provider.getBlock('latest');
        const shortTimelock = currentBlock.timestamp + 3700; // Just over 1 hour (3600 + 100)
        const safetyDeposit = ethers.parseEther("0.01");
        const tempSecret = ethers.hexlify(crypto.randomBytes(32));
        const tempHashlock = ethers.keccak256(tempSecret);
        
        // Create a swap with timelock that we can expire
        console.log("👤 Creating swap for timeout demo...");
        const tx = await this.contracts.atomicSwap.connect(this.user).initiateSwap(
            this.resolver.address,
            ethers.ZeroAddress,
            swapAmount,
            tempHashlock,
            shortTimelock,
            "cosmos1testaddress",
            { value: swapAmount + safetyDeposit }
        );
        
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
        const timeoutSwapId = event.args.swapId;
        
        console.log("✅ Timeout test swap created:", timeoutSwapId);
        
        // Fast forward time to expire the swap (Hardhat allows this)
        console.log("⏳ Fast-forwarding time to expire swap...");
        await ethers.provider.send("evm_increaseTime", [3701]); // Move forward past expiration
        await ethers.provider.send("evm_mine");
        
        // Attempt refund
        console.log("💰 User attempting refund after expiration...");
        const refundTx = await this.contracts.atomicSwap.connect(this.user).refundSwap(timeoutSwapId);
        const refundReceipt = await refundTx.wait();
        
        console.log("✅ Refund successful");
        console.log("Transaction hash:", refundReceipt.transactionHash);
        
        // Verify refund
        const refundedSwap = await this.contracts.atomicSwap.getSwap(timeoutSwapId);
        console.log("Final swap state:", refundedSwap.state); // Should be 3 (REFUNDED)
        
        console.log("🎉 Timeout/refund demonstration completed!");
    }

    async generateReport() {
        console.log("\n📊 DEMO EXECUTION REPORT");
        console.log("========================");
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`Network: ${hre.network.name}`);
        console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
        console.log("");
        console.log("PARTICIPANTS:");
        console.log(`Deployer: ${this.deployer.address}`);
        console.log(`User: ${this.user.address}`);
        console.log(`Resolver: ${this.resolver.address}`);
        console.log("");
        console.log("CONTRACTS:");
        console.log(`AtomicSwapEthereum: ${await this.contracts.atomicSwap.getAddress()}`);
        console.log(`CrossChainSwapManager: ${await this.contracts.crossChainManager.getAddress()}`);
        console.log("");
        console.log("DEMO SCENARIOS EXECUTED:");
        console.log("✅ Ethereum → Cosmos Swap");
        console.log("✅ Cosmos → Ethereum Swap");
        console.log("✅ Timeout/Refund Scenario");
        console.log("");
        console.log("KEY FEATURES DEMONSTRATED:");
        console.log("✅ Hashlock/Timelock functionality");
        console.log("✅ Bidirectional swap capability");
        console.log("✅ Atomic swap guarantees");
        console.log("✅ Safety deposit mechanism");
        console.log("✅ Timeout/refund protection");
        console.log("✅ Cross-chain coordination patterns");
    }

    async run() {
        try {
            await this.initialize();
            await this.demonstrateEthereumToCosmosSwap();
            await this.demonstrateCosmosToEthereumSwap();
            await this.demonstrateTimeoutScenario();
            await this.generateReport();
            
            console.log("\n🎉 ALL DEMONSTRATIONS COMPLETED SUCCESSFULLY!");
            
        } catch (error) {
            console.error("❌ Demo failed:", error);
            throw error;
        }
    }
}

async function main() {
    const demo = new CrossChainDemo();
    await demo.run();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = CrossChainDemo;