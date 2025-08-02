const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const fs = require('fs');
require('dotenv').config();

async function main() {
    console.log("🚀 Deploying CosmWasm contract to Neutron testnet...");
    
    if (!process.env.COSMOS_MNEMONIC) {
        console.error("❌ COSMOS_MNEMONIC environment variable required");
        process.exit(1);
    }

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        process.env.COSMOS_MNEMONIC,
        { prefix: process.env.COSMOS_PREFIX }
    );
    
    const [account] = await wallet.getAccounts();
    console.log("Deploying with account:", account.address);

    const gasPrice = GasPrice.fromString(`0.025${process.env.COSMOS_DENOM}`);
    const client = await SigningCosmWasmClient.connectWithSigner(
        process.env.COSMOS_RPC_URL,
        wallet,
        { gasPrice }
    );

    const balance = await client.getBalance(account.address, process.env.COSMOS_DENOM);
    console.log("Account balance:", balance.amount, balance.denom);

    console.log("\n📦 Building CosmWasm contract...");
    
    // Build contract if not exists
    if (!fs.existsSync('./artifacts/atomic_swap.wasm')) {
        const { execSync } = require('child_process');
        
        try {
            console.log("🔨 Building CosmWasm contract...");
            execSync('cd contracts/cosmwasm/atomic-swap && cargo wasm', { stdio: 'inherit' });
            
            // Simple copy without optimization for now
            if (fs.existsSync('./contracts/cosmwasm/atomic-swap/target/wasm32-unknown-unknown/release/atomic_swap.wasm')) {
                if (!fs.existsSync('./artifacts')) {
                    fs.mkdirSync('./artifacts');
                }
                fs.copyFileSync(
                    './contracts/cosmwasm/atomic-swap/target/wasm32-unknown-unknown/release/atomic_swap.wasm',
                    './artifacts/atomic_swap.wasm'
                );
            }
            
        } catch (error) {
            console.error("❌ Failed to build contract:", error.message);
            process.exit(1);
        }
    }

    const wasmCode = fs.readFileSync('./artifacts/atomic_swap.wasm');
    console.log("✅ Contract size:", wasmCode.length, "bytes");

    console.log("\n📤 Uploading contract to Neutron testnet...");
    try {
        const uploadResult = await client.upload(
            account.address,
            wasmCode,
            "auto",
            "Atomic Swap Cross-chain Contract - Hackathon Demo"
        );
        
        console.log("✅ Contract uploaded! Code ID:", uploadResult.codeId);
        console.log("Upload TX:", uploadResult.transactionHash);

        console.log("\n🏗️ Instantiating contract...");
        const instantiateMsg = {
            admin: account.address,
            minimum_safety_deposit: "10000", // 0.01 NTRN
            min_timelock_duration: 3600, // 1 hour
            max_timelock_duration: 604800, // 1 week
        };

        const instantiateResult = await client.instantiate(
            account.address,
            uploadResult.codeId,
            instantiateMsg,
            "atomic-swap-hackathon-neutron",
            "auto",
            { admin: account.address }
        );

        console.log("✅ Contract instantiated!");
        console.log("Contract address:", instantiateResult.contractAddress);
        console.log("Instantiate TX:", instantiateResult.transactionHash);

        // Update .env file
        const envContent = fs.readFileSync('.env', 'utf8');
        const updatedEnv = envContent.replace(
            'COSMOS_CONTRACT_ADDRESS=',
            `COSMOS_CONTRACT_ADDRESS=${instantiateResult.contractAddress}`
        );
        fs.writeFileSync('.env', updatedEnv);

        const deploymentInfo = {
            network: "neutron-testnet",
            chainId: process.env.COSMOS_CHAIN_ID,
            rpcUrl: process.env.COSMOS_RPC_URL,
            deployer: account.address,
            timestamp: new Date().toISOString(),
            contract: {
                codeId: uploadResult.codeId,
                address: instantiateResult.contractAddress,
                label: "atomic-swap-hackathon-neutron"
            },
            transactions: {
                upload: uploadResult.transactionHash,
                instantiate: instantiateResult.transactionHash
            },
            explorerUrls: {
                contract: `https://neutron.celat.one/pion-1/contracts/${instantiateResult.contractAddress}`,
                uploadTx: `https://neutron.celat.one/pion-1/txs/${uploadResult.transactionHash}`,
                instantiateTx: `https://neutron.celat.one/pion-1/txs/${instantiateResult.transactionHash}`
            }
        };

        if (!fs.existsSync('./deployments')) {
            fs.mkdirSync('./deployments');
        }
        
        fs.writeFileSync('./deployments/neutron-testnet-deployment.json', JSON.stringify(deploymentInfo, null, 2));

        console.log("\n🎯 NEUTRON TESTNET DEPLOYMENT COMPLETE");
        console.log("======================================");
        console.log(`Network: ${process.env.COSMOS_CHAIN_ID}`);
        console.log(`Deployer: ${account.address}`);
        console.log(`Code ID: ${uploadResult.codeId}`);
        console.log(`Contract: ${instantiateResult.contractAddress}`);
        
        console.log("\n🔗 EXPLORER LINKS:");
        console.log(`Contract: https://neutron.celat.one/pion-1/contracts/${instantiateResult.contractAddress}`);
        console.log(`Upload TX: https://neutron.celat.one/pion-1/txs/${uploadResult.transactionHash}`);
        console.log(`Instantiate TX: https://neutron.celat.one/pion-1/txs/${instantiateResult.transactionHash}`);

        console.log("\n✅ .env file updated with contract address");
        console.log("\n🧪 READY FOR CROSS-CHAIN DEMO");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => {
        console.log("\n🎉 Neutron deployment successful - ready for hackathon!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Neutron deployment failed:", error);
        process.exit(1);
    });