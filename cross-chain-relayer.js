const { ethers } = require('ethers');
const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const EventEmitter = require('events');
const fs = require('fs');
require('dotenv').config();

class CrossChainRelayer extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ethereumProvider = null;
        this.ethereumSigner = null;
        this.cosmosClient = null;
        this.atomicSwapContract = null;
        this.crossChainManager = null;
        this.cosmosContract = null;
        
        this.pendingSwaps = new Map();
        this.processedEvents = new Set();
        
        this.isRunning = false;
        this.lastEthereumBlock = 0;
        this.lastCosmosHeight = 0;
    }

    async initialize() {
        try {
            console.log("🔧 Initializing cross-chain relayer...");
            
            await this.setupEthereum();
            await this.setupCosmos();
            
            this.emit('initialized');
            console.log("✅ Cross-chain relayer initialized successfully");
            return true;
        } catch (error) {
            console.error("❌ Failed to initialize relayer:", error);
            this.emit('error', error);
            return false;
        }
    }

    async setupEthereum() {
        console.log("🔗 Setting up Ethereum connection...");
        
        this.ethereumProvider = new ethers.JsonRpcProvider(this.config.ethereum.rpcUrl);
        this.ethereumSigner = new ethers.Wallet(this.config.ethereum.privateKey, this.ethereumProvider);
        
        console.log("Ethereum account:", this.ethereumSigner.address);
        
        const balance = await this.ethereumProvider.getBalance(this.ethereumSigner.address);
        console.log("Ethereum balance:", ethers.formatEther(balance), "ETH");

        const atomicSwapABI = JSON.parse(fs.readFileSync('./artifacts/contracts/ethereum/AtomicSwapEthereum.sol/AtomicSwapEthereum.json')).abi;
        const crossChainManagerABI = JSON.parse(fs.readFileSync('./artifacts/contracts/ethereum/CrossChainSwapManager.sol/CrossChainSwapManager.json')).abi;
        
        this.atomicSwapContract = new ethers.Contract(
            this.config.ethereum.atomicSwapAddress,
            atomicSwapABI,
            this.ethereumSigner
        );
        
        this.crossChainManager = new ethers.Contract(
            this.config.ethereum.crossChainManagerAddress,
            crossChainManagerABI,
            this.ethereumSigner
        );
        
        this.lastEthereumBlock = await this.ethereumProvider.getBlockNumber();
        console.log("✅ Ethereum setup complete, monitoring from block:", this.lastEthereumBlock);
    }

    async setupCosmos() {
        console.log("🌌 Setting up Cosmos connection...");
        
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
            this.config.cosmos.mnemonic,
            { prefix: this.config.cosmos.prefix }
        );
        
        const [account] = await wallet.getAccounts();
        console.log("Cosmos account:", account.address);
        
        const gasPrice = GasPrice.fromString(`${this.config.cosmos.gasPrice}${this.config.cosmos.denom}`);
        this.cosmosClient = await SigningCosmWasmClient.connectWithSigner(
            this.config.cosmos.rpcUrl,
            wallet,
            { gasPrice }
        );
        
        const balance = await this.cosmosClient.getBalance(account.address, this.config.cosmos.denom);
        console.log("Cosmos balance:", balance.amount, balance.denom);
        
        this.cosmosContract = this.config.cosmos.contractAddress;
        this.lastCosmosHeight = await this.cosmosClient.getHeight();
        console.log("✅ Cosmos setup complete, monitoring from height:", this.lastCosmosHeight);
    }

    async start() {
        if (this.isRunning) {
            console.log("⚠️ Relayer is already running");
            return;
        }

        console.log("🚀 Starting cross-chain relayer...");
        this.isRunning = true;
        
        this.setupEthereumEventListeners();
        this.startCosmosMonitoring();
        
        console.log("✅ Cross-chain relayer started successfully");
        console.log("📡 Monitoring both chains for atomic swap events...");
    }

    setupEthereumEventListeners() {
        console.log("👂 Setting up Ethereum event listeners...");
        
        this.atomicSwapContract.on('SwapInitiated', async (...args) => {
            const event = args[args.length - 1];
            const eventId = `eth_init_${event.transactionHash}_${event.logIndex}`;
            
            if (this.processedEvents.has(eventId)) return;
            this.processedEvents.add(eventId);
            
            const [swapId, initiator, participant, token, amount, hashlock, timelock] = args.slice(0, -1);
            
            console.log("\n🔥 ETHEREUM SWAP INITIATED");
            console.log("Swap ID:", swapId);
            console.log("Initiator:", initiator);
            console.log("Amount:", ethers.formatEther(amount), "ETH");
            console.log("TX Hash:", event.transactionHash);
            
            await this.handleEthereumSwapInitiated({
                swapId: swapId.toString(),
                initiator,
                participant,
                token,
                amount: amount.toString(),
                hashlock,
                timelock: timelock.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });

        this.atomicSwapContract.on('SwapCompleted', async (...args) => {
            const event = args[args.length - 1];
            const eventId = `eth_complete_${event.transactionHash}_${event.logIndex}`;
            
            if (this.processedEvents.has(eventId)) return;
            this.processedEvents.add(eventId);
            
            const [swapId, secret] = args.slice(0, -1);
            
            console.log("\n✅ ETHEREUM SWAP COMPLETED");
            console.log("Swap ID:", swapId);
            console.log("Secret revealed:", secret);
            console.log("TX Hash:", event.transactionHash);
            
            await this.handleSecretRevealed({
                chain: 'ethereum',
                swapId: swapId.toString(),
                secret,
                transactionHash: event.transactionHash
            });
        });
    }

    async startCosmosMonitoring() {
        console.log("👂 Starting Cosmos event monitoring...");
        
        setInterval(async () => {
            if (!this.isRunning) return;
            
            try {
                await this.pollCosmosEvents();
            } catch (error) {
                console.error("Error polling Cosmos events:", error);
            }
        }, this.config.cosmos.pollingInterval || 10000);
    }

    async pollCosmosEvents() {
        const currentHeight = await this.cosmosClient.getHeight();
        
        if (currentHeight <= this.lastCosmosHeight) return;
        
        for (let height = this.lastCosmosHeight + 1; height <= currentHeight; height++) {
            try {
                const block = await this.cosmosClient.forceGetTmClient().block(height);
                
                for (const tx of block.block.data.txs) {
                    const txHash = Buffer.from(tx).toString('hex').toUpperCase();
                    await this.processCosmosTx(txHash, height);
                }
            } catch (error) {
                console.error(`Error processing Cosmos block ${height}:`, error);
            }
        }
        
        this.lastCosmosHeight = currentHeight;
    }

    async processCosmosTx(txHash, height) {
        try {
            const txResponse = await this.cosmosClient.getTx(txHash);
            if (!txResponse) return;

            const events = txResponse.events || [];
            
            for (const event of events) {
                if (event.type === 'wasm' && event.attributes) {
                    const contractAddr = event.attributes.find(attr => attr.key === '_contract_address')?.value;
                    
                    if (contractAddr === this.cosmosContract) {
                        const action = event.attributes.find(attr => attr.key === 'action')?.value;
                        
                        if (action === 'initiate_swap') {
                            await this.handleCosmosSwapInitiated(event.attributes, txHash, height);
                        } else if (action === 'complete_swap') {
                            await this.handleCosmosSwapCompleted(event.attributes, txHash, height);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing Cosmos TX ${txHash}:`, error);
        }
    }

    async handleEthereumSwapInitiated(swapData) {
        try {
            console.log("🔄 Handling Ethereum → Cosmos swap...");
            
            const cosmosAmount = this.calculateCosmosAmount(swapData.amount);
            const cosmosTimelock = parseInt(swapData.timelock) - this.config.safetyBuffer;
            
            const msg = {
                initiate_swap: {
                    participant: swapData.participant,
                    amount: {
                        denom: this.config.cosmos.denom,
                        amount: cosmosAmount.toString()
                    },
                    hashlock: swapData.hashlock,
                    timelock: cosmosTimelock,
                    ethereum_recipient: swapData.initiator,
                    ethereum_chain_id: this.config.ethereum.chainId.toString()
                }
            };

            const [account] = await this.cosmosClient.getSignerAccounts();
            const funds = [{ denom: this.config.cosmos.denom, amount: (cosmosAmount + 1000000).toString() }];
            
            const result = await this.cosmosClient.execute(
                account.address,
                this.cosmosContract,
                msg,
                "auto",
                "Cross-chain swap response",
                funds
            );
            
            console.log("✅ Cosmos swap created:", result.transactionHash);
            console.log("🔗 Mintscan:", `https://www.mintscan.io/juno-testnet/txs/${result.transactionHash}`);
            
        } catch (error) {
            console.error("❌ Failed to handle Ethereum swap:", error);
        }
    }

    async handleCosmosSwapInitiated(attributes, txHash, height) {
        const eventId = `cosmos_init_${txHash}`;
        if (this.processedEvents.has(eventId)) return;
        this.processedEvents.add(eventId);
        
        console.log("\n🔥 COSMOS SWAP INITIATED");
        console.log("TX Hash:", txHash);
        console.log("Height:", height);
        
        const swapId = attributes.find(attr => attr.key === 'swap_id')?.value;
        const hashlock = attributes.find(attr => attr.key === 'hashlock')?.value;
        const amount = attributes.find(attr => attr.key === 'amount')?.value;
        const timelock = attributes.find(attr => attr.key === 'timelock')?.value;
        const ethereumRecipient = attributes.find(attr => attr.key === 'ethereum_recipient')?.value;
        
        if (swapId && hashlock && ethereumRecipient) {
            console.log("🔄 Handling Cosmos → Ethereum swap...");
            
            const ethereumAmount = this.calculateEthereumAmount(amount);
            const ethereumTimelock = parseInt(timelock) - this.config.safetyBuffer;
            
            try {
                const tx = await this.atomicSwapContract.initiateSwap(
                    ethereumRecipient,
                    ethers.ZeroAddress,
                    ethereumAmount,
                    hashlock,
                    ethereumTimelock,
                    "cosmos-response",
                    {
                        value: ethereumAmount.add(ethers.parseEther("0.01")),
                        gasLimit: 300000
                    }
                );
                
                const receipt = await tx.wait();
                console.log("✅ Ethereum swap created:", receipt.hash);
                console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/tx/${receipt.hash}`);
                
            } catch (error) {
                console.error("❌ Failed to handle Cosmos swap:", error);
            }
        }
    }

    async handleCosmosSwapCompleted(attributes, txHash, height) {
        const eventId = `cosmos_complete_${txHash}`;
        if (this.processedEvents.has(eventId)) return;
        this.processedEvents.add(eventId);
        
        const secret = attributes.find(attr => attr.key === 'secret')?.value;
        const swapId = attributes.find(attr => attr.key === 'swap_id')?.value;
        
        console.log("\n✅ COSMOS SWAP COMPLETED");
        console.log("Swap ID:", swapId);
        console.log("Secret revealed:", secret);
        console.log("TX Hash:", txHash);
        
        await this.handleSecretRevealed({
            chain: 'cosmos',
            swapId,
            secret,
            transactionHash: txHash
        });
    }

    async handleSecretRevealed(secretData) {
        console.log(`🔑 Secret revealed on ${secretData.chain}:`, secretData.secret);
        
        if (secretData.chain === 'ethereum') {
            const pendingCosmos = Array.from(this.pendingSwaps.values())
                .find(swap => swap.hashlock && this.verifySecret(swap.hashlock, secretData.secret));
            
            if (pendingCosmos) {
                console.log("🚀 Completing corresponding Cosmos swap...");
                
                try {
                    const [account] = await this.cosmosClient.getSignerAccounts();
                    const msg = {
                        complete_swap: {
                            swap_id: pendingCosmos.swapId,
                            secret: secretData.secret
                        }
                    };
                    
                    const result = await this.cosmosClient.execute(
                        account.address,
                        this.cosmosContract,
                        msg,
                        "auto",
                        "Complete cross-chain swap"
                    );
                    
                    console.log("✅ Cosmos swap completed:", result.transactionHash);
                    
                } catch (error) {
                    console.error("❌ Failed to complete Cosmos swap:", error);
                }
            }
        } else if (secretData.chain === 'cosmos') {
            console.log("🚀 Attempting to complete corresponding Ethereum swap...");
            
            try {
                const tx = await this.atomicSwapContract.completeSwap(
                    secretData.swapId,
                    secretData.secret,
                    { gasLimit: 200000 }
                );
                
                const receipt = await tx.wait();
                console.log("✅ Ethereum swap completed:", receipt.hash);
                
            } catch (error) {
                console.error("❌ Failed to complete Ethereum swap:", error);
            }
        }
    }

    calculateCosmosAmount(ethAmount) {
        const ethValue = parseFloat(ethers.formatEther(ethAmount));
        return Math.floor(ethValue * 1000000); // 1 ETH = 1 JUNO (simplified for demo)
    }

    calculateEthereumAmount(cosmosAmount) {
        const cosmosValue = parseFloat(cosmosAmount) / 1000000;
        return ethers.parseEther(cosmosValue.toString());
    }

    verifySecret(hashlock, secret) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(secret).digest('hex');
        return hash === hashlock.toLowerCase().replace('0x', '');
    }

    async stop() {
        console.log("🛑 Stopping cross-chain relayer...");
        this.isRunning = false;
        
        if (this.atomicSwapContract) {
            this.atomicSwapContract.removeAllListeners();
        }
        
        this.removeAllListeners();
        console.log("✅ Cross-chain relayer stopped");
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            processedEvents: this.processedEvents.size,
            pendingSwaps: this.pendingSwaps.size,
            lastEthereumBlock: this.lastEthereumBlock,
            lastCosmosHeight: this.lastCosmosHeight
        };
    }
}

module.exports = CrossChainRelayer;

if (require.main === module) {
    const config = {
        ethereum: {
            rpcUrl: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/your-key",
            privateKey: process.env.ETHEREUM_PRIVATE_KEY,
            atomicSwapAddress: process.env.SEPOLIA_ATOMIC_SWAP_ADDRESS,
            crossChainManagerAddress: process.env.SEPOLIA_CROSS_CHAIN_MANAGER_ADDRESS,
            chainId: 11155111
        },
        cosmos: {
            rpcUrl: process.env.JUNO_RPC_URL || "https://rpc.uni.junonetwork.io",
            mnemonic: process.env.JUNO_MNEMONIC,
            contractAddress: process.env.JUNO_CONTRACT_ADDRESS,
            prefix: "juno",
            denom: "ujuno",
            gasPrice: "0.075",
            pollingInterval: 10000
        },
        safetyBuffer: 300 // 5 minutes
    };

    async function main() {
        console.log("🚀 Starting Cross-Chain Relayer for Hackathon Demo");
        console.log("================================================");
        
        const relayer = new CrossChainRelayer(config);
        
        const initialized = await relayer.initialize();
        if (!initialized) {
            console.error("❌ Failed to initialize relayer");
            process.exit(1);
        }
        
        await relayer.start();
        
        process.on('SIGINT', async () => {
            console.log("\n🛑 Received shutdown signal...");
            await relayer.stop();
            process.exit(0);
        });
        
        setInterval(() => {
            const stats = relayer.getStats();
            console.log("\n📊 RELAYER STATS:", JSON.stringify(stats, null, 2));
        }, 60000);
    }

    main().catch(console.error);
}