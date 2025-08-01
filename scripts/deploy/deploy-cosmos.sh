#!/bin/bash

echo "🚀 Deploying Cosmos Cross-chain Swap Module..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed. Please install Go 1.21 or later.${NC}"
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo -e "${BLUE}📦 Using Go version: ${GO_VERSION}${NC}"

# Navigate to cosmos contracts directory
cd contracts/cosmos

echo -e "${YELLOW}📝 Generating protobuf files...${NC}"
# In a real deployment, you would run:
# buf generate
# Or use protoc to generate the .pb.go files from proto definitions
echo "Note: In production, run 'buf generate' or use protoc to generate protobuf files"

echo -e "${YELLOW}📦 Building Cosmos module...${NC}"
go mod tidy
if ! go build ./...; then
    echo -e "${RED}❌ Failed to build Cosmos module${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cosmos module built successfully${NC}"

echo -e "${YELLOW}🧪 Running tests...${NC}"
if ! go test ./...; then
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All tests passed${NC}"

# Create deployment instructions
cat > deployment-instructions.md << EOF
# Cosmos Module Deployment Instructions

## Prerequisites
1. Go 1.21+ installed
2. Cosmos SDK v0.50+ compatible chain
3. Access to validator node or full node with governance permissions

## Deployment Steps

### 1. Build the Module
\`\`\`bash
cd contracts/cosmos
go mod tidy
go build ./...
\`\`\`

### 2. Generate Protobuf Files
\`\`\`bash
# Install buf if not already installed
# go install github.com/bufbuild/buf/cmd/buf@latest

# Generate protobuf files
buf generate
\`\`\`

### 3. Integration with Cosmos Chain

#### Option A: New Chain Integration
1. Add the module to your chain's app.go:
\`\`\`go
import "github.com/unitedefi/crosschain-swap/x/crosschainswap"

// In NewApp function:
app.CrossChainSwapKeeper = crosschainswap.NewKeeper(
    appCodec,
    keys[crosschainswap.StoreKey],
    app.GetSubspace(crosschainswap.ModuleName),
    app.BankKeeper,
    authtypes.NewModuleAddress(govtypes.ModuleName).String(),
)

app.ModuleManager = module.NewManager(
    // ... other modules
    crosschainswap.NewAppModule(appCodec, app.CrossChainSwapKeeper),
)
\`\`\`

#### Option B: Governance Proposal (Existing Chain)
1. Create a software upgrade proposal
2. Include the module in the upgrade handler
3. Submit governance proposal for chain upgrade

### 4. Configure Module Parameters
\`\`\`bash
# Set minimum timelock duration (example: 1 hour = 3600 seconds)
gaiad tx gov submit-proposal param-change proposal.json

# Enable supported denominations
gaiad tx crosschainswap update-params --supported-denoms=uatom,stake
\`\`\`

### 5. Test the Module
\`\`\`bash
# Create test atomic swap
gaiad tx crosschainswap lock-tokens \\
  --participant=cosmos1... \\
  --amount=1000000uatom \\
  --hashlock=0x1234... \\
  --timelock=1640995200 \\
  --ethereum-recipient=0x1234... \\
  --ethereum-chain-id=1 \\
  --swap-id=test-swap-1

# Query swap status
gaiad query crosschainswap atomic-swap test-swap-1

# Claim tokens with secret
gaiad tx crosschainswap claim-tokens \\
  --swap-id=test-swap-1 \\
  --secret=0xabcd...
\`\`\`

## Configuration Files

### Genesis Configuration
\`\`\`json
{
  "crosschainswap": {
    "params": {
      "min_timelock_duration": "3600",
      "max_timelock_duration": "604800",
      "minimum_safety_deposit": [{"denom": "uatom", "amount": "1000000"}],
      "supported_denoms": ["uatom", "stake"]
    },
    "atomic_swaps": []
  }
}
\`\`\`

### Module Parameters
- \`min_timelock_duration\`: Minimum timelock duration in seconds (default: 1 hour)
- \`max_timelock_duration\`: Maximum timelock duration in seconds (default: 1 week)  
- \`minimum_safety_deposit\`: Minimum safety deposit required for swaps
- \`supported_denoms\`: List of supported token denominations

## Security Considerations
1. Ensure proper testing on testnet before mainnet deployment
2. Audit smart contract integration points
3. Set appropriate governance parameters
4. Monitor for unusual swap patterns
5. Implement rate limiting if necessary

## Monitoring
- Track swap creation and completion rates
- Monitor timelock expirations and refunds
- Watch for failed secret revelations
- Alert on large value swaps

EOF

echo -e "${GREEN}✅ Deployment instructions created: deployment-instructions.md${NC}"

# Create example governance proposal
cat > example-gov-proposal.json << EOF
{
  "title": "Enable Cross-Chain Swap Module",
  "description": "This proposal enables the cross-chain swap module for atomic swaps between Cosmos and Ethereum networks. The module provides secure, trustless cross-chain asset transfers using hashlock and timelock mechanisms.",
  "changes": [
    {
      "subspace": "crosschainswap",
      "key": "MinTimelockDuration",
      "value": "3600"
    },
    {
      "subspace": "crosschainswap", 
      "key": "MaxTimelockDuration",
      "value": "604800"
    },
    {
      "subspace": "crosschainswap",
      "key": "SupportedDenoms",
      "value": ["uatom", "stake"]
    }
  ],
  "deposit": "10000000uatom"
}
EOF

echo -e "${GREEN}✅ Example governance proposal created: example-gov-proposal.json${NC}"

echo -e "${BLUE}📋 COSMOS DEPLOYMENT SUMMARY${NC}"
echo "================================="
echo -e "Module: ${GREEN}CrossChainSwap${NC}"
echo -e "Status: ${GREEN}Built Successfully${NC}"
echo -e "Tests: ${GREEN}Passed${NC}"
echo -e "Files Created:"
echo "  - deployment-instructions.md"
echo "  - example-gov-proposal.json"
echo ""
echo -e "${YELLOW}📝 NEXT STEPS:${NC}"
echo "1. Review deployment-instructions.md"
echo "2. Integrate with your Cosmos chain"
echo "3. Test on testnet first"
echo "4. Submit governance proposal if needed"
echo ""
echo -e "${GREEN}🎉 Cosmos module deployment preparation completed!${NC}"