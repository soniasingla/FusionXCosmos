const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require('crypto');

describe("Cross-Chain Atomic Swap", function () {
    let atomicSwap, crossChainManager;
    let owner, user, resolver, otherUser;
    let secret, hashlock, swapId;
    
    const swapAmount = ethers.parseEther("1.0");
    const safetyDeposit = ethers.parseEther("0.01");
    
    beforeEach(async function () {
        [owner, user, resolver, otherUser] = await ethers.getSigners();
        
        // Deploy AtomicSwapEthereum
        const AtomicSwapEthereum = await ethers.getContractFactory("AtomicSwapEthereum");
        atomicSwap = await AtomicSwapEthereum.deploy();
        await atomicSwap.waitForDeployment();
        
        // Deploy CrossChainSwapManager
        const CrossChainSwapManager = await ethers.getContractFactory("CrossChainSwapManager");
        crossChainManager = await CrossChainSwapManager.deploy(await atomicSwap.getAddress());
        await crossChainManager.waitForDeployment();
        
        // Setup resolver
        await crossChainManager.addResolver(resolver.address);
        await crossChainManager.connect(resolver).stakeAsResolver({ 
            value: ethers.parseEther("1.0") 
        });
        
        // Generate secret and hashlock for tests
        secret = ethers.hexlify(crypto.randomBytes(32));
        hashlock = ethers.keccak256(secret);
    });

    describe("AtomicSwapEthereum", function () {
        describe("Swap Initiation", function () {
            it("Should successfully initiate a swap", async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
                const timelock = currentBlock.timestamp + 7200; // 2 hours
                
                const tx = await atomicSwap.connect(user).initiateSwap(
                    resolver.address,
                    ethers.ZeroAddress, // ETH
                    swapAmount,
                    hashlock,
                    timelock,
                    "cosmos1recipient",
                    { value: swapAmount + safetyDeposit }
                );
                
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
                swapId = event.args.swapId;
                
                expect(event.args.initiator).to.equal(user.address);
                expect(event.args.participant).to.equal(resolver.address);
                expect(event.args.amount).to.equal(swapAmount);
                expect(event.args.hashlock).to.equal(hashlock);
                
                // Verify swap state
                const swap = await atomicSwap.getSwap(swapId);
                expect(swap.state).to.equal(1); // INITIATED
                expect(swap.initiator).to.equal(user.address);
                expect(swap.participant).to.equal(resolver.address);
            });
            
            it("Should reject swap with insufficient safety deposit", async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
                const timelock = currentBlock.timestamp + 7200; // 2 hours to ensure it's above minimum
                
                await expect(
                    atomicSwap.connect(user).initiateSwap(
                        resolver.address,
                        ethers.ZeroAddress,
                        swapAmount,
                        hashlock,
                        timelock,
                        "cosmos1recipient",
                        { value: swapAmount } // Missing safety deposit
                    )
                ).to.be.revertedWith("Insufficient ETH sent");
            });
            
            it("Should reject swap with timelock too short", async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
                const shortTimelock = currentBlock.timestamp + 1800; // 30 minutes (below 1 hour minimum)
                
                await expect(
                    atomicSwap.connect(user).initiateSwap(
                        resolver.address,
                        ethers.ZeroAddress,
                        swapAmount,
                        hashlock,
                        shortTimelock,
                        "cosmos1recipient",
                        { value: swapAmount + safetyDeposit }
                    )
                ).to.be.revertedWith("Timelock too short");
            });
        });

        describe("Swap Completion", function () {
            beforeEach(async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
            const timelock = currentBlock.timestamp + 7200;
                const tx = await atomicSwap.connect(user).initiateSwap(
                    resolver.address,
                    ethers.ZeroAddress,
                    swapAmount,
                    hashlock,
                    timelock,
                    "cosmos1recipient",
                    { value: swapAmount + safetyDeposit }
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
                swapId = event.args.swapId;
            });
            
            it("Should complete swap with valid secret", async function () {
                const initialBalance = await ethers.provider.getBalance(resolver.address);
                
                await atomicSwap.connect(resolver).completeSwap(swapId, secret);
                
                const swap = await atomicSwap.getSwap(swapId);
                expect(swap.state).to.equal(2); // COMPLETED
                expect(swap.secret).to.equal(secret);
                
                // Resolver should receive the swapped amount
                const finalBalance = await ethers.provider.getBalance(resolver.address);
                expect(finalBalance - initialBalance).to.be.above(swapAmount - ethers.parseEther("0.1")); // Account for gas
            });
            
            it("Should reject completion with invalid secret", async function () {
                const wrongSecret = ethers.hexlify(crypto.randomBytes(32));
                
                await expect(
                    atomicSwap.connect(resolver).completeSwap(swapId, wrongSecret)
                ).to.be.revertedWith("Invalid secret");
            });
            
            it("Should reject completion by unauthorized user", async function () {
                await expect(
                    atomicSwap.connect(otherUser).completeSwap(swapId, secret)
                ).to.be.revertedWith("Only participant can call this");
            });
        });

        describe("Swap Refund", function () {
            let expiredSwapId;
            
            beforeEach(async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
                const shortTimelock = currentBlock.timestamp + 7200; // 2 hours
                const tx = await atomicSwap.connect(user).initiateSwap(
                    resolver.address,
                    ethers.ZeroAddress,
                    swapAmount,
                    hashlock,
                    shortTimelock,
                    "cosmos1recipient",
                    { value: swapAmount + safetyDeposit }
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
                expiredSwapId = event.args.swapId;
                
                // Use hardhat to fast forward time
                await ethers.provider.send("evm_increaseTime", [7201]); // Move forward 2 hours + 1 second
                await ethers.provider.send("evm_mine");
            });
            
            it("Should allow refund after expiration", async function () {
                const initialBalance = await ethers.provider.getBalance(user.address);
                
                await atomicSwap.connect(user).refundSwap(expiredSwapId);
                
                const swap = await atomicSwap.getSwap(expiredSwapId);
                expect(swap.state).to.equal(3); // REFUNDED
                
                // User should get their money back
                const finalBalance = await ethers.provider.getBalance(user.address);
                expect(finalBalance - initialBalance).to.be.above(swapAmount - ethers.parseEther("0.1")); // Account for gas
            });
            
            it("Should reject refund before expiration", async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
            const timelock = currentBlock.timestamp + 7200;
                const tx = await atomicSwap.connect(user).initiateSwap(
                    resolver.address,
                    ethers.ZeroAddress,
                    swapAmount,
                    hashlock,
                    timelock,
                    "cosmos1recipient",
                    { value: swapAmount + safetyDeposit }
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'SwapInitiated');
                const activeSwapId = event.args.swapId;
                
                await expect(
                    atomicSwap.connect(user).refundSwap(activeSwapId)
                ).to.be.revertedWith("Swap has not expired");
            });
        });
    });

    describe("CrossChainSwapManager", function () {
        describe("Resolver Management", function () {
            it("Should allow owner to add resolver", async function () {
                const RESOLVER_ROLE = await crossChainManager.RESOLVER_ROLE();
                
                await crossChainManager.addResolver(otherUser.address);
                
                expect(await crossChainManager.hasRole(RESOLVER_ROLE, otherUser.address)).to.be.true;
            });
            
            it("Should require minimum stake for resolver", async function () {
                await crossChainManager.addResolver(otherUser.address);
                
                await expect(
                    crossChainManager.connect(otherUser).stakeAsResolver({ 
                        value: ethers.parseEther("0.5") // Below minimum
                    })
                ).to.be.revertedWith("Insufficient stake");
            });
            
            it("Should allow resolver to stake", async function () {
                await crossChainManager.addResolver(otherUser.address);
                
                await crossChainManager.connect(otherUser).stakeAsResolver({ 
                    value: ethers.parseEther("2.0") 
                });
                
                const stake = await crossChainManager.resolverStakes(otherUser.address);
                expect(stake).to.equal(ethers.parseEther("2.0"));
            });
        });

        describe("Cross-Chain Order Creation", function () {
            it("Should create cross-chain order", async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
            const timelock = currentBlock.timestamp + 7200;
                
                const tx = await crossChainManager.connect(user).createCrossChainOrder(
                    resolver.address,
                    ethers.ZeroAddress,
                    swapAmount,
                    hashlock,
                    timelock,
                    "cosmos1recipient",
                    "cosmoshub-4",
                    "1000000",
                    "uatom",
                    { value: swapAmount + safetyDeposit }
                );
                
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'CrossChainOrderCreated');
                
                expect(event.args.initiator).to.equal(user.address);
                expect(event.args.cosmosRecipient).to.equal("cosmos1recipient");
                expect(event.args.cosmosAmount).to.equal("1000000");
                expect(event.args.cosmosDenom).to.equal("uatom");
            });
        });

        describe("Order Processing", function () {
            let orderId;
            
            beforeEach(async function () {
                const currentBlock = await ethers.provider.getBlock('latest');
            const timelock = currentBlock.timestamp + 7200;
                
                const tx = await crossChainManager.connect(user).createCrossChainOrder(
                    resolver.address,
                    ethers.ZeroAddress,
                    swapAmount,
                    hashlock,
                    timelock,
                    "cosmos1recipient",
                    "cosmoshub-4",
                    "1000000",
                    "uatom",
                    { value: swapAmount + safetyDeposit }
                );
                
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'CrossChainOrderCreated');
                orderId = event.args.orderId;
            });
            
            it("Should allow resolver to process order", async function () {
                await crossChainManager.connect(resolver).processOrder(
                    orderId,
                    "cosmos_tx_hash_123"
                );
                
                const order = await crossChainManager.getCrossChainOrder(orderId);
                expect(order.isProcessed).to.be.true;
            });
            
            it("Should reject processing by non-resolver", async function () {
                await expect(
                    crossChainManager.connect(otherUser).processOrder(
                        orderId,
                        "cosmos_tx_hash_123"
                    )
                ).to.be.reverted;
            });
        });
    });

    describe("Integration Tests", function () {
        it("Should complete full cross-chain swap flow", async function () {
            const currentBlock = await ethers.provider.getBlock('latest');
            const timelock = currentBlock.timestamp + 7200;
            
            // Step 1: Create cross-chain order
            const orderTx = await crossChainManager.connect(user).createCrossChainOrder(
                resolver.address,
                ethers.ZeroAddress,
                swapAmount,
                hashlock,
                timelock,
                "cosmos1recipient",
                "cosmoshub-4", 
                "1000000",
                "uatom",
                { value: swapAmount + safetyDeposit }
            );
            
            const orderReceipt = await orderTx.wait();
            const orderEvent = orderReceipt.logs.find(log => log.fragment && log.fragment.name === 'CrossChainOrderCreated');
            const orderId = orderEvent.args.orderId;
            swapId = orderEvent.args.swapId;
            
            // Step 2: Resolver processes order
            await crossChainManager.connect(resolver).processOrder(
                orderId,
                "cosmos_tx_hash_123"
            );
            
            // Step 3: Complete the Ethereum side swap
            await atomicSwap.connect(resolver).completeSwap(swapId, secret);
            
            // Verify final state
            const swap = await atomicSwap.getSwap(swapId);
            expect(swap.state).to.equal(2); // COMPLETED
            expect(swap.secret).to.equal(secret);
            
            const order = await crossChainManager.getCrossChainOrder(orderId);
            expect(order.isProcessed).to.be.true;
        });
    });
});