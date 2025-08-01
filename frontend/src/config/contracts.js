// Contract configuration for different networks

export const NETWORKS = {
  HARDHAT: {
    chainId: '31337',
    name: 'Hardhat',
    rpcUrl: 'http://localhost:8545',
    contracts: {
      // These will be set dynamically for local deployment
      AtomicSwapEthereum: null,
      CrossChainSwapManager: null,
    }
  },
  SEPOLIA: {
    chainId: '11155111', 
    name: 'Sepolia',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    contracts: {
      // These will be filled after testnet deployment
      // Update these addresses after running: npm run deploy:sepolia
      AtomicSwapEthereum: '0x742d35Cc6634C0532925a3b8D23eA9d2eeBF9Be8', // PLACEHOLDER
      CrossChainSwapManager: '0x742d35Cc6634C0532925a3b8D23eA9d2eeBF9Be8', // PLACEHOLDER
    }
  },
  MAINNET: {
    chainId: '1',
    name: 'Ethereum',
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/',
    contracts: {
      // Mainnet deployment (not ready yet)
      AtomicSwapEthereum: null,
      CrossChainSwapManager: null,
    }
  }
}

// Contract ABI definitions
export const ATOMIC_SWAP_ABI = [
  "function initiateSwap(address _participant, address _token, uint256 _amount, bytes32 _hashlock, uint256 _timelock, string calldata _cosmosRecipient) external payable returns (bytes32 swapId)",
  "function completeSwap(bytes32 _swapId, bytes32 _secret) external",
  "function refundSwap(bytes32 _swapId) external",
  "function getSwap(bytes32 _swapId) external view returns (tuple(address initiator, address participant, address token, uint256 amount, bytes32 hashlock, uint256 timelock, uint8 state, bytes32 secret))",
  "function generateSwapId(address _initiator, address _participant, bytes32 _hashlock, uint256 _timelock) external pure returns (bytes32)",
  "function verifySecret(bytes32 _hashlock, bytes32 _secret) external pure returns (bool)",
  "function minimumSafetyDeposit() external view returns (uint256)",
  "event SwapInitiated(bytes32 indexed swapId, address indexed initiator, address indexed participant, address token, uint256 amount, bytes32 hashlock, uint256 timelock)",
  "event SwapCompleted(bytes32 indexed swapId, bytes32 secret)",
  "event SwapRefunded(bytes32 indexed swapId)"
]

export const CROSS_CHAIN_MANAGER_ABI = [
  "function createCrossChainOrder(string calldata _cosmosRecipient, address _token, uint256 _amount, uint256 _timelock) external payable returns (bytes32 orderId)",
  "function fulfillOrder(bytes32 _orderId, bytes32 _secret) external",
  "function addResolver(address _resolver) external",
  "function stakeAsResolver() external payable",
  "function RESOLVER_ROLE() external view returns (bytes32)",
  "event CrossChainOrderCreated(bytes32 indexed orderId, address indexed initiator, string cosmosRecipient, address token, uint256 amount, uint256 timelock)",
  "event OrderFulfilled(bytes32 indexed orderId, address indexed resolver, bytes32 secret)"
]

// Helper function to get network config
export const getNetworkConfig = (chainId) => {
  switch (chainId.toString()) {
    case '31337':
      return NETWORKS.HARDHAT
    case '11155111':
      return NETWORKS.SEPOLIA
    case '1':
      return NETWORKS.MAINNET
    default:
      return null
  }
}

// Helper function to check if network is supported
export const isSupportedNetwork = (chainId) => {
  return getNetworkConfig(chainId) !== null
}

// Load contract addresses from deployment files (for local development)
export const loadContractAddresses = async (networkName) => {
  try {
    const response = await fetch(`/deployments/${networkName}-deployment.json`)
    if (response.ok) {
      const deployment = await response.json()
      return deployment.contracts
    }
  } catch (error) {
    console.log('Could not load deployment file:', error)
  }
  return null
}