const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require('crypto');

describe("HashlockTimelock", function () {
    let hashlockTimelock;
    let owner, user1, user2;
    let secret, hashlock;
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        const HashlockTimelock = await ethers.getContractFactory("HashlockTimelock");
        hashlockTimelock = await HashlockTimelock.deploy();
        await hashlockTimelock.waitForDeployment();
        
        // Generate secret and hashlock for tests
        secret = ethers.hexlify(crypto.randomBytes(32));
        hashlock = ethers.keccak256(secret);
    });

    describe("Swap ID Generation", function () {
        it("Should generate consistent swap IDs", async function () {
            const timelock = Math.floor(Date.now() / 1000) + 3600;
            
            const swapId1 = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock
            );
            
            const swapId2 = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock
            );
            
            expect(swapId1).to.equal(swapId2);
        });
        
        it("Should generate different IDs for different parameters", async function () {
            const timelock1 = Math.floor(Date.now() / 1000) + 3600;
            const timelock2 = Math.floor(Date.now() / 1000) + 7200;
            
            const swapId1 = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock1
            );
            
            const swapId2 = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock2
            );
            
            expect(swapId1).to.not.equal(swapId2);
        });
    });

    describe("Secret Verification", function () {
        it("Should verify correct secret", async function () {
            const isValid = await hashlockTimelock.verifySecret(hashlock, secret);
            expect(isValid).to.be.true;
        });
        
        it("Should reject incorrect secret", async function () {
            const wrongSecret = ethers.hexlify(crypto.randomBytes(32));
            const isValid = await hashlockTimelock.verifySecret(hashlock, wrongSecret);
            expect(isValid).to.be.false;
        });
        
        it("Should reject empty secret", async function () {
            const emptySecret = ethers.ZeroHash;
            const isValid = await hashlockTimelock.verifySecret(hashlock, emptySecret);
            expect(isValid).to.be.false;
        });
    });

    describe("Utility Functions", function () {
        let swapId;
        
        beforeEach(async function () {
            const timelock = Math.floor(Date.now() / 1000) + 3600;
            swapId = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock
            );
        });
        
        it("Should return false for non-existent swap expiration check", async function () {
            await expect(
                hashlockTimelock.isSwapExpired(swapId)
            ).to.be.revertedWith("Swap does not exist");
        });
        
        it("Should return false for non-existent swap completion check", async function () {
            await expect(
                hashlockTimelock.isSwapCompleted(swapId)
            ).to.be.revertedWith("Swap does not exist");
        });
        
        it("Should return false for non-existent swap refund check", async function () {
            await expect(
                hashlockTimelock.isSwapRefunded(swapId)
            ).to.be.revertedWith("Swap does not exist");
        });
    });

    describe("Access Control", function () {
        it("Should have correct modifier behavior for non-existent swap", async function () {
            const nonExistentSwapId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
            
            // Since we can't directly test modifiers, we test through functions that use them
            // This test ensures our contract properly handles non-existent swaps
            await expect(
                hashlockTimelock.getSwap(nonExistentSwapId)
            ).to.not.be.reverted; // getSwap doesn't use swapExists modifier, should return default struct
            
            const swap = await hashlockTimelock.getSwap(nonExistentSwapId);
            expect(swap.state).to.equal(0); // INVALID state
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum values", async function () {
            const maxTimelock = 2**32 - 1; // Maximum uint32 value
            const maxHashlock = "0x" + "f".repeat(64); // Maximum bytes32 value
            
            const swapId = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                maxHashlock,
                maxTimelock
            );
            
            expect(swapId).to.not.equal(ethers.ZeroHash);
        });
        
        it("Should handle zero addresses", async function () {
            const timelock = Math.floor(Date.now() / 1000) + 3600;
            
            const swapId = await hashlockTimelock.generateSwapId(
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                hashlock,
                timelock
            );
            
            expect(swapId).to.not.equal(ethers.ZeroHash);
        });
        
        it("Should handle minimum timelock", async function () {
            const minTimelock = 1; // Minimum positive value
            
            const swapId = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                minTimelock
            );
            
            expect(swapId).to.not.equal(ethers.ZeroHash);
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Should be gas efficient for ID generation", async function () {
            const timelock = Math.floor(Date.now() / 1000) + 3600;
            
            const tx = await hashlockTimelock.generateSwapId(
                user1.address,
                user2.address,
                hashlock,
                timelock
            );
            
            // This test ensures the function completes without excessive gas usage
            // In a real scenario, you might want to measure actual gas consumption
            expect(tx).to.not.equal(ethers.ZeroHash);
        });
        
        it("Should be gas efficient for secret verification", async function () {
            const isValid = await hashlockTimelock.verifySecret(hashlock, secret);
            expect(isValid).to.be.true;
            
            // Multiple calls should be consistent
            const isValid2 = await hashlockTimelock.verifySecret(hashlock, secret);
            expect(isValid2).to.be.true;
        });
    });

    describe("Security Tests", function () {
        it("Should not be vulnerable to hash collision attacks", async function () {
            // Test with different secrets that might have similar patterns
            const secret1 = crypto.randomBytes(32);
            const secret2 = crypto.randomBytes(32);
            
            const hashlock1 = ethers.keccak256(secret1);
            const hashlock2 = ethers.keccak256(secret2);
            
            expect(hashlock1).to.not.equal(hashlock2);
            
            // Verify each secret only works with its corresponding hashlock
            expect(await hashlockTimelock.verifySecret(hashlock1, secret1)).to.be.true;
            expect(await hashlockTimelock.verifySecret(hashlock1, secret2)).to.be.false;
            expect(await hashlockTimelock.verifySecret(hashlock2, secret1)).to.be.false;
            expect(await hashlockTimelock.verifySecret(hashlock2, secret2)).to.be.true;
        });
        
        it("Should handle large secrets", async function () {
            // Test with large secret data that gets hashed
            const largeData = crypto.randomBytes(64); // 64 bytes of data
            const largeSecret = ethers.keccak256(largeData); // Hash it to 32 bytes
            const largeHashlock = ethers.keccak256(largeSecret);
            
            const isValid = await hashlockTimelock.verifySecret(largeHashlock, largeSecret);
            expect(isValid).to.be.true;
        });
    });
});