#!/usr/bin/env node

const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

class SystemTester {
    constructor() {
        this.testResults = {
            environment: {},
            compilation: {},
            deployment: {},
            integration: {},
            crossChain: {}
        };
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',    // cyan
            success: '\x1b[32m', // green
            error: '\x1b[31m',   // red
            warning: '\x1b[33m', // yellow
            reset: '\x1b[0m'
        };
        
        const timestamp = new Date().toISOString();
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    async runCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: 'pipe',
                shell: true,
                ...options
            });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, output, error: errorOutput });
                } else {
                    reject({ success: false, output, error: errorOutput, code });
                }
            });
        });
    }

    async testEnvironment() {
        this.log('🔧 Testing Environment Setup...', 'info');
        
        const tests = [
            { name: 'Node.js', command: 'node', args: ['--version'] },
            { name: 'npm', command: 'npm', args: ['--version'] },
            { name: 'Rust', command: 'rustc', args: ['--version'] },
            { name: 'Cargo', command: 'cargo', args: ['--version'] },
            { name: 'Docker', command: 'docker', args: ['--version'] }
        ];

        for (const test of tests) {
            try {
                const result = await this.runCommand(test.command, test.args);
                this.testResults.environment[test.name] = {
                    success: true,
                    version: result.output.trim()
                };
                this.log(`✅ ${test.name}: ${result.output.trim()}`, 'success');
            } catch (error) {
                this.testResults.environment[test.name] = {
                    success: false,
                    error: error.error
                };
                this.log(`❌ ${test.name}: Not found or error`, 'error');
            }
        }

        // Check environment variables
        const requiredEnvVars = [
            'ETHEREUM_PRIVATE_KEY',
            'SEPOLIA_RPC_URL', 
            'JUNO_MNEMONIC'
        ];

        this.log('🔍 Checking Environment Variables...', 'info');
        for (const envVar of requiredEnvVars) {
            if (process.env[envVar]) {
                this.log(`✅ ${envVar}: Set`, 'success');
                this.testResults.environment[envVar] = { success: true };
            } else {
                this.log(`❌ ${envVar}: Missing`, 'error');
                this.testResults.environment[envVar] = { success: false };
            }
        }
    }

    async testCompilation() {
        this.log('🔨 Testing Contract Compilation...', 'info');

        try {
            // Test Solidity compilation
            this.log('Compiling Solidity contracts...', 'info');
            const solidityResult = await this.runCommand('npx', ['hardhat', 'compile']);
            this.testResults.compilation.solidity = {
                success: true,
                output: solidityResult.output
            };
            this.log('✅ Solidity contracts compiled successfully', 'success');
        } catch (error) {
            this.testResults.compilation.solidity = {
                success: false,
                error: error.error
            };
            this.log(`❌ Solidity compilation failed: ${error.error}`, 'error');
        }

        try {
            // Test CosmWasm compilation
            this.log('Compiling CosmWasm contract...', 'info');
            const wasmResult = await this.runCommand('cargo', ['wasm'], {
                cwd: './contracts/cosmwasm/atomic-swap'
            });
            this.testResults.compilation.cosmwasm = {
                success: true,
                output: wasmResult.output
            };
            this.log('✅ CosmWasm contract compiled successfully', 'success');
        } catch (error) {
            this.testResults.compilation.cosmwasm = {
                success: false,
                error: error.error
            };
            this.log(`❌ CosmWasm compilation failed: ${error.error}`, 'error');
        }
    }

    async testLocalHardhatNetwork() {
        this.log('🌐 Testing Local Hardhat Network...', 'info');

        try {
            // Start local hardhat network in background
            this.log('Starting local Hardhat network...', 'info');
            const hardhatProcess = spawn('npx', ['hardhat', 'node'], {
                stdio: 'pipe',
                detached: true
            });

            // Wait for network to start
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Test deployment on local network
            const deployResult = await this.runCommand('npx', [
                'hardhat', 'run', 'scripts/deploy/deploy-ethereum.js', '--network', 'localhost'
            ]);

            this.testResults.deployment.local = {
                success: true,
                output: deployResult.output
            };
            this.log('✅ Local deployment successful', 'success');

            // Kill hardhat process
            hardhatProcess.kill();

        } catch (error) {
            this.testResults.deployment.local = {
                success: false,
                error: error.error
            };
            this.log(`❌ Local deployment failed: ${error.error}`, 'error');
        }
    }

    async testContractInteractions() {
        this.log('🔗 Testing Contract Interactions...', 'info');

        try {
            // Test Ethereum contract interactions
            const interactionScript = `
                const { ethers } = require('hardhat');
                async function test() {
                    const [signer] = await ethers.getSigners();
                    console.log('Signer address:', signer.address);
                    
                    // Test basic contract calls
                    const HashlockTimelock = await ethers.getContractFactory('HashlockTimelock');
                    const contract = await HashlockTimelock.deploy();
                    await contract.waitForDeployment();
                    
                    const address = await contract.getAddress();
                    console.log('Test contract deployed to:', address);
                    
                    // Test basic functionality
                    const testHashlock = ethers.keccak256(ethers.toUtf8Bytes('test'));
                    const isValid = await contract.verifySecret(testHashlock, 'test');
                    console.log('Secret verification test:', isValid);
                    
                    return true;
                }
                test().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1)});
            `;

            fs.writeFileSync('./temp-test.js', interactionScript);
            
            const result = await this.runCommand('npx', ['hardhat', 'run', 'temp-test.js']);
            
            fs.unlinkSync('./temp-test.js');
            
            this.testResults.integration.ethereum = {
                success: true,
                output: result.output
            };
            this.log('✅ Ethereum contract interactions working', 'success');

        } catch (error) {
            this.testResults.integration.ethereum = {
                success: false,
                error: error.error
            };
            this.log(`❌ Ethereum interactions failed: ${error.error}`, 'error');
        }
    }

    async testDependencies() {
        this.log('📦 Testing Dependencies...', 'info');

        try {
            // Test npm dependencies
            const npmTest = await this.runCommand('npm', ['list', '--depth=0']);
            this.log('✅ npm dependencies installed', 'success');

            // Test specific dependencies
            const criticalDeps = [
                'ethers',
                '@cosmjs/cosmwasm-stargate',
                '@cosmjs/proto-signing',
                'hardhat'
            ];

            for (const dep of criticalDeps) {
                try {
                    require.resolve(dep);
                    this.log(`✅ ${dep}: Available`, 'success');
                } catch (e) {
                    this.log(`❌ ${dep}: Missing`, 'error');
                }
            }

        } catch (error) {
            this.log(`❌ Dependency check failed: ${error.error}`, 'error');
        }
    }

    async simulateDemo() {
        this.log('🎭 Simulating Demo Flow...', 'info');

        try {
            // Create a mock demo to test the flow
            const mockDemo = `
                console.log('🚀 Mock Demo Test');
                
                // Test secret generation
                const crypto = require('crypto');
                const secret = crypto.randomBytes(32).toString('hex');
                const hashlock = crypto.createHash('sha256').update(secret, 'hex').digest('hex');
                
                console.log('Secret generated:', secret.length === 64);
                console.log('Hashlock generated:', hashlock.length === 64);
                
                // Test ethers connection
                const { ethers } = require('ethers');
                const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/test');
                console.log('Ethers provider created successfully');
                
                // Test CosmJS imports
                const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
                console.log('CosmJS imports successful');
                
                console.log('✅ Mock demo flow completed');
            `;

            fs.writeFileSync('./temp-mock-demo.js', mockDemo);
            const result = await this.runCommand('node', ['temp-mock-demo.js']);
            fs.unlinkSync('./temp-mock-demo.js');

            this.testResults.integration.mockDemo = {
                success: true,
                output: result.output
            };
            this.log('✅ Demo simulation successful', 'success');

        } catch (error) {
            this.testResults.integration.mockDemo = {
                success: false,
                error: error.error
            };
            this.log(`❌ Demo simulation failed: ${error.error}`, 'error');
        }
    }

    async generateTestReport() {
        this.log('📊 Generating Test Report...', 'info');

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                percentage: 0
            },
            details: this.testResults,
            recommendations: []
        };

        // Calculate summary
        Object.keys(this.testResults).forEach(category => {
            Object.keys(this.testResults[category]).forEach(test => {
                report.summary.total++;
                if (this.testResults[category][test].success) {
                    report.summary.passed++;
                } else {
                    report.summary.failed++;
                }
            });
        });

        report.summary.percentage = Math.round((report.summary.passed / report.summary.total) * 100);

        // Generate recommendations
        if (!this.testResults.environment.ETHEREUM_PRIVATE_KEY?.success) {
            report.recommendations.push('Set ETHEREUM_PRIVATE_KEY in .env file');
        }
        if (!this.testResults.environment.JUNO_MNEMONIC?.success) {
            report.recommendations.push('Set JUNO_MNEMONIC in .env file');
        }
        if (!this.testResults.compilation?.solidity?.success) {
            report.recommendations.push('Fix Solidity compilation issues');
        }
        if (!this.testResults.compilation?.cosmwasm?.success) {
            report.recommendations.push('Install Rust and wasm target for CosmWasm');
        }

        fs.writeFileSync('./test-report.json', JSON.stringify(report, null, 2));
        
        this.log('📄 Test Report Summary:', 'info');
        this.log(`Total Tests: ${report.summary.total}`, 'info');
        this.log(`Passed: ${report.summary.passed}`, 'success');
        this.log(`Failed: ${report.summary.failed}`, 'error');
        this.log(`Success Rate: ${report.summary.percentage}%`, 'info');

        if (report.recommendations.length > 0) {
            this.log('📋 Recommendations:', 'warning');
            report.recommendations.forEach(rec => {
                this.log(`• ${rec}`, 'warning');
            });
        }

        return report;
    }

    async runFullTest() {
        this.log('🚀 Starting Complete System Test...', 'info');
        this.log('=====================================', 'info');

        await this.testEnvironment();
        await this.testDependencies();
        await this.testCompilation();
        await this.testContractInteractions();
        await this.simulateDemo();

        const report = await this.generateTestReport();
        
        this.log('🏁 Complete System Test Finished!', 'info');
        
        if (report.summary.percentage >= 80) {
            this.log('✅ System is ready for hackathon demo!', 'success');
        } else {
            this.log('⚠️  System needs fixes before demo', 'warning');
        }

        return report;
    }

    async runQuickHealthCheck() {
        this.log('⚡ Quick Health Check...', 'info');

        const checks = [
            { name: 'Node.js', test: () => require('fs').existsSync('./package.json') },
            { name: 'Dependencies', test: () => require('fs').existsSync('./node_modules') },
            { name: 'Contracts', test: () => require('fs').existsSync('./contracts') },
            { name: 'Scripts', test: () => require('fs').existsSync('./deploy-sepolia.js') },
            { name: 'Demo', test: () => require('fs').existsSync('./demo-bidirectional-swap.js') }
        ];

        let passed = 0;
        for (const check of checks) {
            try {
                if (check.test()) {
                    this.log(`✅ ${check.name}`, 'success');
                    passed++;
                } else {
                    this.log(`❌ ${check.name}`, 'error');
                }
            } catch (e) {
                this.log(`❌ ${check.name}`, 'error');
            }
        }

        const percentage = Math.round((passed / checks.length) * 100);
        this.log(`Health Score: ${percentage}% (${passed}/${checks.length})`, 'info');

        return percentage >= 80;
    }
}

// CLI Interface
async function main() {
    const tester = new SystemTester();
    const args = process.argv.slice(2);

    if (args.includes('--quick') || args.includes('-q')) {
        const healthy = await tester.runQuickHealthCheck();
        process.exit(healthy ? 0 : 1);
    } else {
        await tester.runFullTest();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SystemTester;