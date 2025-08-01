const { ethers } = require('ethers');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { SigningStargateClient } = require('@cosmjs/stargate');
const { Registry } = require('@cosmjs/proto-signing');
const EventEmitter = require('events');

class CrossChainCoordinator extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ethereumProvider = null;
        this.ethereumSigner = null;
        this.cosmosClient = null;
        this.atomicSwapContract = null;
        this.crossChainManager = null;
        
        this.initialize();
    }

    async initialize() {
        try {
            await this.setupEthereum();
            await this.setupCosmos();
            
            this.emit('initialized');
            console.log('Cross-chain coordinator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize coordinator:', error);
            this.emit('error', error);
        }
    }

    async setupEthereum() {
        this.ethereumProvider = new ethers.JsonRpcProvider(this.config.ethereum.rpcUrl);
        this.ethereumSigner = new ethers.Wallet(this.config.ethereum.privateKey, this.ethereumProvider);
        
        // Load contract ABIs and create contract instances
        const atomicSwapABI = require('../artifacts/contracts/ethereum/AtomicSwapEthereum.sol/AtomicSwapEthereum.json');
        const crossChainManagerABI = require('../artifacts/contracts/ethereum/CrossChainSwapManager.sol/CrossChainSwapManager.json');
        
        this.atomicSwapContract = new ethers.Contract(
            this.config.ethereum.atomicSwapAddress,
            atomicSwapABI.abi,
            this.ethereumSigner
        );
        
        this.crossChainManager = new ethers.Contract(
            this.config.ethereum.crossChainManagerAddress,
            crossChainManagerABI.abi,
            this.ethereumSigner
        );
        
        this.setupEthereumEventListeners();
    }

    async setupCosmos() {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
            this.config.cosmos.mnemonic,
            { prefix: this.config.cosmos.prefix }
        );
        
        this.cosmosClient = await SigningStargateClient.connectWithSigner(
            this.config.cosmos.rpcUrl,
            wallet
        );
        
        this.setupCosmosEventListeners();
    }

    setupEthereumEventListeners() {
        // Listen for Ethereum swap initiation
        this.atomicSwapContract.on('SwapInitiated', async (swapId, initiator, participant, token, amount, hashlock, timelock, event) => {
            console.log('Ethereum swap initiated:', {
                swapId: swapId.toString(),
                initiator,
                participant,
                token,
                amount: amount.toString(),
                hashlock,
                timelock: timelock.toString()
            });
            
            this.emit('ethereumSwapInitiated', {
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

        // Listen for Ethereum swap completion
        this.atomicSwapContract.on('SwapCompleted', async (swapId, secret, event) => {
            console.log('Ethereum swap completed:', {
                swapId: swapId.toString(),
                secret
            });
            
            this.emit('ethereumSwapCompleted', {
                swapId: swapId.toString(),
                secret,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });

        // Listen for cross-chain orders
        this.crossChainManager.on('CrossChainOrderCreated', async (orderId, swapId, initiator, cosmosRecipient, cosmosChainId, cosmosAmount, cosmosDenom, event) => {
            console.log('Cross-chain order created:', {
                orderId: orderId.toString(),
                swapId: swapId.toString(),
                initiator,
                cosmosRecipient,
                cosmosChainId,
                cosmosAmount: cosmosAmount.toString(),
                cosmosDenom
            });
            
            this.emit('crossChainOrderCreated', {
                orderId: orderId.toString(),
                swapId: swapId.toString(),
                initiator,
                cosmosRecipient,
                cosmosChainId,
                cosmosAmount: cosmosAmount.toString(),
                cosmosDenom,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
    }

    setupCosmosEventListeners() {
        // In a real implementation, this would use WebSocket or gRPC streaming
        // to listen for Cosmos events. For now, we'll use polling.
        setInterval(async () => {
            await this.pollCosmosEvents();
        }, this.config.cosmos.pollingInterval || 10000);
    }

    async pollCosmosEvents() {
        try {
            // Get latest block height
            const latestBlock = await this.cosmosClient.getHeight();
            
            // Query for crosschain swap events in recent blocks
            // This is a simplified implementation
            const events = await this.queryCosmosSwapEvents(latestBlock - 10, latestBlock);
            
            for (const event of events) {
                this.handleCosmosEvent(event);
            }
        } catch (error) {
            console.error('Error polling Cosmos events:', error);
        }
    }

    async queryCosmosSwapEvents(fromBlock, toBlock) {
        // This would query the Cosmos blockchain for crosschain swap events
        // Implementation depends on the specific Cosmos SDK version and indexing
        return [];
    }

    handleCosmosEvent(event) {
        switch (event.type) {
            case 'atomic_swap_locked':
                this.emit('cosmosSwapLocked', event);
                break;
            case 'atomic_swap_completed':
                this.emit('cosmosSwapCompleted', event);
                break;
            case 'atomic_swap_refunded':
                this.emit('cosmosSwapRefunded', event);
                break;
        }
    }

    // Ethereum -> Cosmos swap coordination
    async handleEthereumToCosmos(ethereumSwapData) {
        try {
            console.log('Handling Ethereum to Cosmos swap:', ethereumSwapData);
            
            // As a resolver, respond to the Ethereum swap by creating a Cosmos swap
            const cosmosSwapMsg = {
                typeUrl: '/crosschainswap.v1.MsgLockTokens',
                value: {
                    initiator: this.config.cosmos.resolverAddress,
                    participant: ethereumSwapData.cosmosRecipient,
                    amount: `${ethereumSwapData.cosmosAmount}${ethereumSwapData.cosmosDenom}`,
                    hashlock: ethereumSwapData.hashlock,
                    timelock: ethereumSwapData.timelock - this.config.safetyBuffer,
                    ethereumRecipient: ethereumSwapData.initiator,
                    ethereumChainId: this.config.ethereum.chainId.toString(),
                    swapId: ethereumSwapData.swapId
                }
            };
            
            const fee = {
                amount: [{ denom: 'uatom', amount: '5000' }],
                gas: '200000'
            };
            
            const result = await this.cosmosClient.signAndBroadcast(
                this.config.cosmos.resolverAddress,
                [cosmosSwapMsg],
                fee,
                'Cross-chain swap response'
            );
            
            console.log('Cosmos swap created:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('Error handling Ethereum to Cosmos swap:', error);
            throw error;
        }
    }

    // Cosmos -> Ethereum swap coordination  
    async handleCosmosToEthereum(cosmosSwapData) {
        try {
            console.log('Handling Cosmos to Ethereum swap:', cosmosSwapData);
            
            // As a resolver, respond to the Cosmos swap by creating an Ethereum swap
            const ethereumAmount = ethers.parseEther(cosmosSwapData.ethereumAmount);
            const timelock = cosmosSwapData.timelock - this.config.safetyBuffer;
            
            const tx = await this.atomicSwapContract.initiateSwap(
                cosmosSwapData.ethereumRecipient,
                cosmosSwapData.ethereumToken,
                ethereumAmount,
                cosmosSwapData.hashlock,
                timelock,
                cosmosSwapData.initiator,
                {
                    value: this.config.ethereum.safetyDeposit,
                    gasLimit: 300000
                }
            );
            
            const receipt = await tx.wait();
            console.log('Ethereum swap created:', receipt.transactionHash);
            return receipt;
            
        } catch (error) {
            console.error('Error handling Cosmos to Ethereum swap:', error);
            throw error;
        }
    }

    // Complete swap when secret is revealed
    async completeSwapWithSecret(swapData, secret) {
        try {
            if (swapData.chain === 'ethereum') {
                const tx = await this.atomicSwapContract.completeSwap(swapData.swapId, secret);
                return await tx.wait();
            } else if (swapData.chain === 'cosmos') {
                const msg = {
                    typeUrl: '/crosschainswap.v1.MsgClaimTokens',
                    value: {
                        claimer: this.config.cosmos.resolverAddress,
                        swapId: swapData.swapId,
                        secret: secret
                    }
                };
                
                const fee = {
                    amount: [{ denom: 'uatom', amount: '5000' }],
                    gas: '200000'
                };
                
                return await this.cosmosClient.signAndBroadcast(
                    this.config.cosmos.resolverAddress,
                    [msg],
                    fee,
                    'Complete cross-chain swap'
                );
            }
        } catch (error) {
            console.error('Error completing swap with secret:', error);
            throw error;
        }
    }

    // Monitor and handle timeouts
    async monitorTimeouts() {
        // This would monitor active swaps and handle timeouts/refunds
        console.log('Monitoring timeouts...');
    }

    async start() {
        console.log('Starting cross-chain coordinator...');
        
        // Set up event handlers
        this.on('ethereumSwapInitiated', this.handleEthereumToCosmos.bind(this));
        this.on('cosmosSwapLocked', this.handleCosmosToEthereum.bind(this));
        this.on('ethereumSwapCompleted', (data) => {
            console.log('Ethereum swap completed, secret revealed:', data.secret);
        });
        this.on('cosmosSwapCompleted', (data) => {
            console.log('Cosmos swap completed, secret revealed:', data.secret);
        });
        
        // Start monitoring
        setInterval(() => {
            this.monitorTimeouts();
        }, 60000); // Check every minute
        
        console.log('Cross-chain coordinator started successfully');
    }

    async stop() {
        console.log('Stopping cross-chain coordinator...');
        this.removeAllListeners();
        if (this.cosmosClient) {
            this.cosmosClient.disconnect();
        }
    }
}

module.exports = CrossChainCoordinator;