const CrossChainCoordinator = require('./cross-chain-coordinator');
require('dotenv').config();

const config = {
    ethereum: {
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
        privateKey: process.env.RELAYER_PRIVATE_KEY,
        chainId: 11155111, // Sepolia
        atomicSwapAddress: process.env.ATOMIC_SWAP_ADDRESS,
        crossChainManagerAddress: process.env.CROSS_CHAIN_MANAGER_ADDRESS,
        safetyDeposit: '0.01' // ETH
    },
    cosmos: {
        rpcUrl: process.env.COSMOS_RPC_URL || 'https://rpc.cosmos.network:443',
        mnemonic: process.env.COSMOS_MNEMONIC,
        prefix: 'cosmos',
        resolverAddress: process.env.COSMOS_RESOLVER_ADDRESS,
        pollingInterval: 10000 // 10 seconds
    },
    safetyBuffer: parseInt(process.env.SAFETY_BUFFER_SECONDS) || 43200 // 12 hours
};

async function main() {
    console.log('Starting 1inch Cross-chain Swap Relayer...');
    
    // Validate configuration
    if (!config.ethereum.privateKey) {
        console.error('RELAYER_PRIVATE_KEY is required');
        process.exit(1);
    }
    
    if (!config.cosmos.mnemonic) {
        console.error('COSMOS_MNEMONIC is required');
        process.exit(1);
    }
    
    try {
        const coordinator = new CrossChainCoordinator(config);
        
        coordinator.on('initialized', () => {
            console.log('✅ Cross-chain coordinator initialized');
        });
        
        coordinator.on('error', (error) => {
            console.error('❌ Coordinator error:', error);
        });
        
        coordinator.on('ethereumSwapInitiated', (data) => {
            console.log('🔄 Ethereum swap initiated:', data.swapId);
        });
        
        coordinator.on('cosmosSwapLocked', (data) => {
            console.log('🔄 Cosmos swap locked:', data.swapId);
        });
        
        coordinator.on('crossChainOrderCreated', (data) => {
            console.log('📋 Cross-chain order created:', data.orderId);
        });
        
        await coordinator.start();
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 Shutting down gracefully...');
            await coordinator.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('🛑 Shutting down gracefully...');
            await coordinator.stop();
            process.exit(0);
        });
        
        console.log('🚀 Relayer is running...');
        
    } catch (error) {
        console.error('Failed to start relayer:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}