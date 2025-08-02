# 🚀 HACKATHON DEPLOYMENT GUIDE
## Production-Ready Cross-Chain Atomic Swaps: Ethereum ↔ Cosmos

This guide provides step-by-step instructions for deploying and demonstrating the 1inch Cross-chain Swap extension with **REAL onchain execution** on Sepolia and Juno testnets.

## 🎯 Hackathon Success Criteria

✅ **Real onchain execution** - No simulations, real transactions only  
✅ **Bidirectional swaps** - ETH ↔ JUNO with atomic completion  
✅ **Hashlock/timelock preserved** - Full atomic swap security  
✅ **Real transaction hashes** - Verifiable on block explorers  
✅ **Production-ready code** - CosmWasm + Solidity contracts  

## 📋 Prerequisites

### Required Tools
```bash
# Install Node.js 18+
node --version

# Install Rust for CosmWasm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Docker for contract optimization
docker --version

# Install Hardhat globally
npm install -g hardhat

# Install CosmWasm tools
cargo install cosmwasm-check
```

### Required Accounts & Funds

1. **Ethereum Sepolia Account**
   - Get testnet ETH: https://sepoliafaucet.com/
   - Minimum: 0.1 ETH for deployment + demos

2. **Juno Testnet Account**
   - Get testnet JUNO: https://faucet.uni.junonetwork.io/
   - Minimum: 10 JUNO for deployment + demos

3. **API Keys**
   - Infura/Alchemy for Ethereum RPC
   - Optional: Etherscan API for verification

## 🔧 Environment Setup

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/your-repo/FusionXCosmos.git
cd FusionXCosmos
npm install
```

### 2. Configure Environment Variables
Create `.env` file:
```bash
# Ethereum Configuration
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-infura-key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Cosmos Configuration  
JUNO_MNEMONIC="your twelve word mnemonic phrase here"
JUNO_RPC_URL=https://rpc.uni.junonetwork.io

# Contract Addresses (filled after deployment)
SEPOLIA_ATOMIC_SWAP_ADDRESS=
SEPOLIA_CROSS_CHAIN_MANAGER_ADDRESS=
JUNO_CONTRACT_ADDRESS=
```

### 3. Update Hardhat Configuration
Ensure `hardhat.config.js` includes Sepolia:
```javascript
module.exports = {
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.ETHEREUM_PRIVATE_KEY],
      chainId: 11155111
    }
  }
};
```

## 🚀 Step 1: Deploy Ethereum Contracts to Sepolia

### Build and Deploy
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run deploy-sepolia.js --network sepolia
```

### Expected Output
```
🚀 Deploying to Sepolia testnet for hackathon demo...
✅ HashlockTimelock deployed: 0x1234...
✅ AtomicSwapEthereum deployed: 0x5678...
✅ CrossChainSwapManager deployed: 0x9abc...

🔗 ETHERSCAN LINKS (for hackathon verification):
HashlockTimelock: https://sepolia.etherscan.io/address/0x1234...
AtomicSwapEthereum: https://sepolia.etherscan.io/address/0x5678...
CrossChainSwapManager: https://sepolia.etherscan.io/address/0x9abc...
```

### Update Environment
Add deployed addresses to `.env`:
```bash
SEPOLIA_ATOMIC_SWAP_ADDRESS=0x5678...
SEPOLIA_CROSS_CHAIN_MANAGER_ADDRESS=0x9abc...
```

## 🌌 Step 2: Deploy CosmWasm Contract to Juno Testnet

### Build CosmWasm Contract
```bash
# Navigate to contract directory
cd contracts/cosmwasm/atomic-swap

# Build optimized WASM
cargo wasm
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer:0.15.0

# Return to project root
cd ../../..
```

### Deploy to Juno Testnet
```bash
# Deploy CosmWasm contract
node deploy-juno-testnet.js
```

### Expected Output
```
🚀 Deploying CosmWasm contract to Juno testnet...
✅ Contract uploaded! Code ID: 1234
✅ Contract instantiated!
Contract address: juno1abcdef...

🔗 MINTSCAN LINKS (for hackathon verification):
Contract: https://www.mintscan.io/juno-testnet/contracts/juno1abcdef...
Upload TX: https://www.mintscan.io/juno-testnet/txs/ABC123...
Instantiate TX: https://www.mintscan.io/juno-testnet/txs/DEF456...
```

### Update Environment
Add contract address to `.env`:
```bash
JUNO_CONTRACT_ADDRESS=juno1abcdef...
```

## 🔄 Step 3: Run Cross-Chain Relayer (Optional)

For automated cross-chain coordination:
```bash
# Start the relayer
node cross-chain-relayer.js
```

The relayer monitors both chains and facilitates atomic swap completion.

## 🎪 Step 4: Execute Hackathon Demo

### Run Bidirectional Demo
```bash
# Execute complete bidirectional demo
node demo-bidirectional-swap.js
```

### Demo Flow

**Demo 1: ETH → JUNO**
1. ✅ Initiate ETH swap on Sepolia
2. ✅ Create corresponding JUNO swap  
3. ✅ Complete swaps with secret reveal
4. ✅ Real transaction hashes generated

**Demo 2: JUNO → ETH**
1. ✅ Initiate JUNO swap on testnet
2. ✅ Create corresponding ETH swap
3. ✅ Complete swaps with secret reveal  
4. ✅ Real transaction hashes generated

### Expected Demo Output
```
🚀 HACKATHON DEMO: Bidirectional Cross-Chain Atomic Swaps
=========================================================

🔥 DEMO 1: ETH → JUNO Cross-Chain Swap
✅ ETH swap initiated!
TX Hash: 0xabc123...
🔗 Etherscan: https://sepolia.etherscan.io/tx/0xabc123...

✅ JUNO swap created!
TX Hash: DEF456...
🔗 Mintscan: https://www.mintscan.io/juno-testnet/txs/DEF456...

🎉 ETH → JUNO swap completed successfully!

🔥 DEMO 2: JUNO → ETH Cross-Chain Swap
✅ JUNO swap initiated!
✅ ETH swap created!
🎉 JUNO → ETH swap completed successfully!

🏆 HACKATHON DEMO SUMMARY
✅ Real onchain execution (no simulations)
✅ Bidirectional swaps (ETH ↔ JUNO)
✅ Real transaction hashes on real testnets
```

## 🔍 Verification Steps

### 1. Verify Ethereum Transactions
- Visit Sepolia Etherscan links from deployment/demo output
- Confirm contract deployments and swap transactions
- Verify secret reveals in transaction logs

### 2. Verify Cosmos Transactions  
- Visit Mintscan links from deployment/demo output
- Confirm contract upload/instantiation
- Verify swap initiation and completion

### 3. Contract Interaction
```bash
# Query Ethereum contract
npx hardhat console --network sepolia
> const contract = await ethers.getContractAt("AtomicSwapEthereum", "0x5678...")
> await contract.supportedTokens("0x0000000000000000000000000000000000000000")

# Query Cosmos contract
junod query wasm contract-state smart juno1abcdef... '{"config":{}}'
```

## 🛠️ Troubleshooting

### Common Issues

**"Insufficient funds" Error**
- Ensure adequate testnet tokens
- Check gas estimation settings

**"Contract not found" Error**  
- Verify contract addresses in `.env`
- Confirm successful deployment

**"Transaction failed" Error**
- Check timelock parameters
- Verify hashlock format (64-char hex)

**CosmWasm Build Issues**
```bash
# Clear cache and rebuild
cargo clean
rm -rf target/
cargo wasm
```

### Network Issues
- **Sepolia RPC**: Use Infura/Alchemy for reliability
- **Juno RPC**: Switch to `https://rpc.juno.strange.love` if needed

## 📊 Demo Results Structure

The demo generates `hackathon-demo-results.json`:
```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "demo1": {
    "ethereumTx": "0xabc123...",
    "cosmosTx": "DEF456...",
    "secret": "secret123...",
    "success": true
  },
  "demo2": {
    "ethereumTx": "0xghi789...",
    "cosmosTx": "JKL012...",
    "secret": "secret456...",
    "success": true
  },
  "networks": {
    "ethereum": "Sepolia Testnet",
    "cosmos": "Juno Testnet"  
  }
}
```

## 🎯 Hackathon Checklist

Before demo presentation:

- [ ] Ethereum contracts deployed to Sepolia ✅
- [ ] CosmWasm contract deployed to Juno testnet ✅  
- [ ] Environment variables configured ✅
- [ ] Bidirectional demo executed successfully ✅
- [ ] Real transaction hashes collected ✅
- [ ] Block explorer links verified ✅
- [ ] Demo results saved ✅

## 🔗 Important Links

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Juno Testnet Faucet**: https://faucet.uni.junonetwork.io/
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **Juno Explorer**: https://www.mintscan.io/juno-testnet/
- **CosmWasm Docs**: https://docs.cosmwasm.com/

## 🆘 Support

For hackathon support:
1. Check troubleshooting section above
2. Review demo output logs
3. Verify environment configuration
4. Confirm testnet fund availability

**Ready for hackathon demo! 🚀**