#!/usr/bin/env node

const { ethers } = require('ethers');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const fs = require('fs');

async function generateWallets() {
    console.log('🚀 Generating wallets for hackathon demo...');
    console.log('');
    
    // Generate Ethereum wallet
    const ethWallet = ethers.Wallet.createRandom();
    console.log('📝 ETHEREUM WALLET GENERATED:');
    console.log('Address:', ethWallet.address);
    console.log('Private Key:', ethWallet.privateKey);
    console.log('');
    
    // Generate Cosmos wallet with 12-word mnemonic
    const cosmosWallet = await DirectSecp256k1HdWallet.generate(12, {prefix: 'juno'});
    const accounts = await cosmosWallet.getAccounts();
    console.log('📝 JUNO WALLET GENERATED:');
    console.log('Address:', accounts[0].address);
    console.log('Mnemonic (12 words):', cosmosWallet.mnemonic);
    console.log('');
    
    // Read current .env file
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Replace placeholder values with generated ones
    envContent = envContent.replace(
        'ETHEREUM_PRIVATE_KEY=your_ethereum_private_key_here',
        `ETHEREUM_PRIVATE_KEY=${ethWallet.privateKey}`
    );
    
    envContent = envContent.replace(
        'JUNO_MNEMONIC=your twelve word mnemonic phrase here',
        `JUNO_MNEMONIC=${cosmosWallet.mnemonic}`
    );
    
    // Use free RPC endpoint
    envContent = envContent.replace(
        'SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id',
        'SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com'
    );
    
    // Write updated .env file
    fs.writeFileSync('.env', envContent);
    
    console.log('✅ .env file updated with your wallet credentials!');
    console.log('');
    console.log('💰 NEXT: GET TESTNET FUNDS');
    console.log('========================');
    console.log('1. Get Sepolia ETH for:', ethWallet.address);
    console.log('   → https://sepoliafaucet.com/');
    console.log('   → https://faucet.quicknode.com/ethereum/sepolia');
    console.log('');
    console.log('2. Get Juno testnet tokens for:', accounts[0].address);
    console.log('   → https://faucet.uni.junonetwork.io/');
    console.log('');
    console.log('3. Then run: node test-complete-system.js --quick');
    console.log('');
    
    // Create a summary file
    const summary = {
        ethereum: {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey,
            faucets: [
                'https://sepoliafaucet.com/',
                'https://faucet.quicknode.com/ethereum/sepolia'
            ]
        },
        juno: {
            address: accounts[0].address,
            mnemonic: cosmosWallet.mnemonic,
            faucets: [
                'https://faucet.uni.junonetwork.io/'
            ]
        },
        nextSteps: [
            'Visit faucets to get testnet funds',
            'Run: node test-complete-system.js --quick',
            'Deploy contracts: node deploy-sepolia.js',
            'Deploy CosmWasm: node deploy-juno-testnet.js',
            'Run demo: node demo-bidirectional-swap.js'
        ]
    };
    
    fs.writeFileSync('wallet-setup-summary.json', JSON.stringify(summary, null, 2));
    console.log('💾 Wallet details saved to: wallet-setup-summary.json');
}

generateWallets().catch(console.error);