const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet, makeCosmoshubPath } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const fs = require('fs');
require('dotenv').config();

const OSMOSIS_TESTNET_RPC = process.env.COSMOS_RPC_URL || "https://rpc.testnet.osmosis.zone";
const OSMOSIS_TESTNET_CHAIN_ID = process.env.COSMOS_CHAIN_ID || "osmo-test-5";
const OSMOSIS_PREFIX = process.env.COSMOS_PREFIX || "osmo";
const OSMOSIS_DENOM = process.env.COSMOS_DENOM || "uosmo";

async function main() {
    console.log("🚀 Deploying CosmWasm contract to Osmosis testnet...");
    
    if (!process.env.COSMOS_MNEMONIC) {
        console.error("❌ COSMOS_MNEMONIC environment variable required");
        console.log("Set your mnemonic in .env file");
        process.exit(1);
    }

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        process.env.COSMOS_MNEMONIC,
        { prefix: OSMOSIS_PREFIX, hdPaths: [makeCosmoshubPath(0)] }
    );
    
    const [account] = await wallet.getAccounts();
    console.log("Deploying with account:", account.address);

    const gasPrice = GasPrice.fromString(`0.075${OSMOSIS_DENOM}`);
    const client = await SigningCosmWasmClient.connectWithSigner(
        OSMOSIS_TESTNET_RPC,
        wallet,
        { gasPrice }
    );

    const balance = await client.getBalance(account.address, OSMOSIS_DENOM);
    console.log("Account balance:", balance.amount, balance.denom);
    
    if (parseInt(balance.amount) < 1000000) {
        console.log("⚠️  WARNING: Low balance. Get testnet OSMO from:");
        console.log("https://faucet.testnet.osmosis.zone/");
        console.log("Address:", account.address);
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
            console.log("3. Run docker optimization command");
            process.exit(1);
        }
    }

    const wasmCode = fs.readFileSync('./artifacts/atomic_swap.wasm');
    console.log("✅ Contract size:", wasmCode.length, "bytes");

    console.log("\n📤 Uploading contract to Osmosis testnet...");
    const uploadResult = await client.upload(
        account.address,
        wasmCode,
        "auto",
        "Atomic Swap Cross-chain Contract for Hackathon"
    );
    
    console.log("✅ Contract uploaded! Code ID:", uploadResult.codeId);
    console.log("Upload TX:", uploadResult.transactionHash);

    console.log("\n🏗️ Instantiating contract...");
    const instantiateMsg = {
        admin: account.address,
        minimum_safety_deposit: "100000", // 0.1 OSMO
        min_timelock_duration: 3600, // 1 hour
        max_timelock_duration: 604800, // 1 week
    };

    const instantiateResult = await client.instantiate(
        account.address,
        uploadResult.codeId,
        instantiateMsg,
        "atomic-swap-hackathon-osmosis",
        "auto",
        { admin: account.address }
    );

    console.log("✅ Contract instantiated!");
    console.log("Contract address:", instantiateResult.contractAddress);
    console.log("Instantiate TX:", instantiateResult.transactionHash);

    const deploymentInfo = {
        network: "osmosis-testnet",
        chainId: OSMOSIS_TESTNET_CHAIN_ID,
        rpcUrl: OSMOSIS_TESTNET_RPC,
        deployer: account.address,
        timestamp: new Date().toISOString(),
        contract: {
            codeId: uploadResult.codeId,
            address: instantiateResult.contractAddress,
            label: "atomic-swap-hackathon-osmosis"
        },
        transactions: {
            upload: uploadResult.transactionHash,
            instantiate: instantiateResult.transactionHash
        },
        explorerUrls: {
            contract: `https://testnet.mintscan.io/osmosis-testnet/contracts/${instantiateResult.contractAddress}`,
            uploadTx: `https://testnet.mintscan.io/osmosis-testnet/txs/${uploadResult.transactionHash}`,
            instantiateTx: `https://testnet.mintscan.io/osmosis-testnet/txs/${instantiateResult.transactionHash}`
        },
        config: {
            minimumSafetyDeposit: "100000",
            minTimelockDuration: "3600",
            maxTimelockDuration: "604800"
        }
    };

    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync('./deployments/osmosis-testnet-deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to ./deployments/osmosis-testnet-deployment.json");

    console.log("\n🎯 OSMOSIS TESTNET DEPLOYMENT COMPLETE");
    console.log("======================================");
    console.log(`Network: ${OSMOSIS_TESTNET_CHAIN_ID}`);
    console.log(`Deployer: ${account.address}`);
    console.log(`Code ID: ${uploadResult.codeId}`);
    console.log(`Contract: ${instantiateResult.contractAddress}`);
    
    console.log("\n🔗 MINTSCAN LINKS (for hackathon verification):");
    console.log(`Contract: https://testnet.mintscan.io/osmosis-testnet/contracts/${instantiateResult.contractAddress}`);
    console.log(`Upload TX: https://testnet.mintscan.io/osmosis-testnet/txs/${uploadResult.transactionHash}`);
    console.log(`Instantiate TX: https://testnet.mintscan.io/osmosis-testnet/txs/${instantiateResult.transactionHash}`);

    console.log("\n🔧 UPDATE YOUR .env FILE:");
    console.log(`COSMOS_CONTRACT_ADDRESS=${instantiateResult.contractAddress}`);
    console.log(`COSMOS_CODE_ID=${uploadResult.codeId}`);
    
    console.log("\n🧪 READY FOR CROSS-CHAIN DEMO");
    console.log("Next step: Run bidirectional swap demo");

    console.log("\n⚡ QUICK TEST:");
    console.log(`osmosisd query wasm contract-state smart ${instantiateResult.contractAddress} '{"config":{}}' --node ${OSMOSIS_TESTNET_RPC}`);
}

main()
    .then(() => {
        console.log("\n✅ Osmosis deployment successful - ready for hackathon!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Osmosis deployment failed:", error);
        process.exit(1);
    });