const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet, makeCosmoshubPath } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const fs = require('fs');
require('dotenv').config();

const JUNO_TESTNET_RPC = "https://rpc.uni.junonetwork.io";
const JUNO_TESTNET_CHAIN_ID = "uni-6";
const JUNO_PREFIX = "juno";

async function main() {
    console.log("🚀 Deploying CosmWasm contract to Juno testnet...");
    
    if (!process.env.JUNO_MNEMONIC) {
        console.error("❌ JUNO_MNEMONIC environment variable required");
        console.log("Set your mnemonic: export JUNO_MNEMONIC='your mnemonic here'");
        process.exit(1);
    }

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        process.env.JUNO_MNEMONIC,
        { prefix: JUNO_PREFIX, hdPaths: [makeCosmoshubPath(0)] }
    );
    
    const [account] = await wallet.getAccounts();
    console.log("Deploying with account:", account.address);

    const gasPrice = GasPrice.fromString("0.075ujuno");
    const client = await SigningCosmWasmClient.connectWithSigner(
        JUNO_TESTNET_RPC,
        wallet,
        { gasPrice }
    );

    const balance = await client.getBalance(account.address, "ujuno");
    console.log("Account balance:", balance.amount, balance.denom);
    
    if (parseInt(balance.amount) < 1000000) {
        console.log("⚠️  WARNING: Low balance. Get testnet JUNO from:");
        console.log("https://faucet.uni.junonetwork.io/");
    }

    console.log("\n📦 Reading compiled CosmWasm contract...");
    
    if (!fs.existsSync('./artifacts/atomic_swap.wasm')) {
        console.log("❌ Contract wasm file not found. Building contract...");
        
        const { execSync } = require('child_process');
        
        try {
            console.log("🔨 Building CosmWasm contract...");
            execSync('cd contracts/cosmwasm/atomic-swap && cargo wasm', { stdio: 'inherit' });
            
            console.log("🎯 Optimizing contract...");
            execSync('cd contracts/cosmwasm/atomic-swap && docker run --rm -v "$(pwd)":/code --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry cosmwasm/rust-optimizer:0.15.0', { stdio: 'inherit' });
            
            if (!fs.existsSync('./contracts/cosmwasm/atomic-swap/artifacts/atomic_swap.wasm')) {
                throw new Error("Failed to build contract");
            }
            
            fs.copyFileSync('./contracts/cosmwasm/atomic-swap/artifacts/atomic_swap.wasm', './artifacts/atomic_swap.wasm');
            
        } catch (error) {
            console.error("❌ Failed to build contract:", error.message);
            console.log("Manual build steps:");
            console.log("1. cd contracts/cosmwasm/atomic-swap");
            console.log("2. cargo wasm");
            console.log("3. docker run --rm -v \"$(pwd)\":/code --mount type=volume,source=\"$(basename \"$(pwd)\")_cache\",target=/code/target --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry cosmwasm/rust-optimizer:0.15.0");
            process.exit(1);
        }
    }

    const wasmCode = fs.readFileSync('./artifacts/atomic_swap.wasm');
    console.log("✅ Contract size:", wasmCode.length, "bytes");

    console.log("\n📤 Uploading contract to Juno testnet...");
    const uploadResult = await client.upload(
        account.address,
        wasmCode,
        "auto",
        "Atomic Swap Cross-chain Contract"
    );
    
    console.log("✅ Contract uploaded! Code ID:", uploadResult.codeId);
    console.log("Upload TX:", uploadResult.transactionHash);

    console.log("\n🏗️ Instantiating contract...");
    const instantiateMsg = {
        admin: account.address,
        minimum_safety_deposit: "1000000", // 1 JUNO
        min_timelock_duration: 3600, // 1 hour
        max_timelock_duration: 604800, // 1 week
    };

    const instantiateResult = await client.instantiate(
        account.address,
        uploadResult.codeId,
        instantiateMsg,
        "atomic-swap-hackathon",
        "auto",
        { admin: account.address }
    );

    console.log("✅ Contract instantiated!");
    console.log("Contract address:", instantiateResult.contractAddress);
    console.log("Instantiate TX:", instantiateResult.transactionHash);

    const deploymentInfo = {
        network: "juno-testnet",
        chainId: JUNO_TESTNET_CHAIN_ID,
        rpcUrl: JUNO_TESTNET_RPC,
        deployer: account.address,
        timestamp: new Date().toISOString(),
        contract: {
            codeId: uploadResult.codeId,
            address: instantiateResult.contractAddress,
            label: "atomic-swap-hackathon"
        },
        transactions: {
            upload: uploadResult.transactionHash,
            instantiate: instantiateResult.transactionHash
        },
        explorerUrls: {
            contract: `https://www.mintscan.io/juno-testnet/contracts/${instantiateResult.contractAddress}`,
            uploadTx: `https://www.mintscan.io/juno-testnet/txs/${uploadResult.transactionHash}`,
            instantiateTx: `https://www.mintscan.io/juno-testnet/txs/${instantiateResult.transactionHash}`
        },
        config: {
            minimumSafetyDeposit: "1000000",
            minTimelockDuration: "3600",
            maxTimelockDuration: "604800"
        }
    };

    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync('./deployments/juno-testnet-deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to ./deployments/juno-testnet-deployment.json");

    console.log("\n🎯 JUNO TESTNET DEPLOYMENT COMPLETE");
    console.log("===================================");
    console.log(`Network: ${JUNO_TESTNET_CHAIN_ID}`);
    console.log(`Deployer: ${account.address}`);
    console.log(`Code ID: ${uploadResult.codeId}`);
    console.log(`Contract: ${instantiateResult.contractAddress}`);
    
    console.log("\n🔗 MINTSCAN LINKS (for hackathon verification):");
    console.log(`Contract: https://www.mintscan.io/juno-testnet/contracts/${instantiateResult.contractAddress}`);
    console.log(`Upload TX: https://www.mintscan.io/juno-testnet/txs/${uploadResult.transactionHash}`);
    console.log(`Instantiate TX: https://www.mintscan.io/juno-testnet/txs/${instantiateResult.transactionHash}`);

    console.log("\n🔧 ENVIRONMENT VARIABLES FOR DEMO:");
    console.log(`export JUNO_CONTRACT_ADDRESS=${instantiateResult.contractAddress}`);
    console.log(`export JUNO_CODE_ID=${uploadResult.codeId}`);
    console.log(`export JUNO_CHAIN_ID=${JUNO_TESTNET_CHAIN_ID}`);
    console.log(`export JUNO_RPC_URL=${JUNO_TESTNET_RPC}`);
    
    console.log("\n🧪 READY FOR CROSS-CHAIN DEMO");
    console.log("Next step: Run bidirectional swap demo");

    console.log("\n⚡ QUICK TEST:");
    console.log(`junod query wasm contract-state smart ${instantiateResult.contractAddress} '{"config":{}}'`);
}

main()
    .then(() => {
        console.log("\n✅ Juno deployment successful - ready for hackathon!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Juno deployment failed:", error);
        process.exit(1);
    });