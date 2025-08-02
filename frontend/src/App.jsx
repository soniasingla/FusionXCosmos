import React, { useState } from 'react'
import './App.css'

function App() {
  const [account, setAccount] = useState(null)
  const [amount, setAmount] = useState('0.005')
  const [recipient, setRecipient] = useState('neutron1at23g9fv3eqcsxj68fstfn0qhhqw0k0s54e7ky')
  const [swapResult, setSwapResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState(null)
  const [swapDetails, setSwapDetails] = useState(null)

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!')
      return
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      // Switch to Sepolia if not already there
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
        })
      } catch (switchError) {
        // Chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          })
        }
      }

      // Get network info
      const { ethers } = await import('ethers')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      const balance = await provider.getBalance(accounts[0])
      
      setAccount(accounts[0])
      setNetworkInfo({
        name: network.name,
        chainId: network.chainId.toString(),
        balance: ethers.formatEther(balance)
      })
      
      if (network.chainId.toString() === '11155111') {
        setSwapResult(`✅ Connected to Sepolia! Ready for real cross-chain swap`)
      } else {
        setSwapResult(`⚠️ Please switch to Sepolia testnet for real demo`)
      }

    } catch (error) {
      alert('Failed to connect wallet: ' + error.message)
    }
  }

  const doSwap = async () => {
    if (!amount || !recipient) {
      alert('Please fill in all fields')
      return
    }

    if (networkInfo?.chainId !== '11155111') {
      alert('Please connect to Sepolia testnet first!')
      return
    }

    setLoading(true)
    setSwapResult('🔄 Initiating cross-chain atomic swap...')
    
    try {
      const { ethers } = await import('ethers')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Contract addresses
      const ATOMIC_SWAP_ADDRESS = '0x24E962383cf5B4eBE43B97247a791f960Fa141Fe'
      const CROSS_CHAIN_MANAGER_ADDRESS = '0x1eC67BE0a430074c4b2a487d3e0DD11BD668f1BB'
      
      // Simple contract ABI for the function we need
      const crossChainManagerABI = [
        "function createCrossChainOrder(address _participant, address _token, uint256 _ethereumAmount, bytes32 _hashlock, uint256 _timelock, string calldata _cosmosRecipient, string calldata _cosmosChainId, uint256 _cosmosAmount, string calldata _cosmosDenom) external payable returns (bytes32)"
      ]
      
      const contract = new ethers.Contract(CROSS_CHAIN_MANAGER_ADDRESS, crossChainManagerABI, signer)
      
      // Generate swap parameters
      const secret = ethers.randomBytes(32)
      const hashlock = ethers.keccak256(secret)
      const timelock = Math.floor(Date.now() / 1000) + 7200 // 2 hours
      const swapAmount = ethers.parseEther(amount)
      const totalAmount = swapAmount + ethers.parseEther('0.005') // Add safety deposit
      
      setSwapResult(`🔐 Generated secret and hashlock
⏰ Timelock: ${new Date(timelock * 1000).toLocaleString()}
💰 Swapping ${amount} ETH for 5 NTRN
📡 Submitting transaction...`)
      
      // Execute the swap
      const tx = await contract.createCrossChainOrder(
        account, // participant
        '0x0000000000000000000000000000000000000000', // ETH
        swapAmount,
        hashlock,
        timelock,
        recipient,
        'pion-1',
        '5000000', // 5 NTRN
        'untrn',
        { 
          value: totalAmount,
          gasLimit: 1000000
        }
      )
      
      setSwapResult(`⏳ Transaction submitted!
Hash: ${tx.hash}
🌐 View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}
⏳ Waiting for confirmation...`)
      
      const receipt = await tx.wait()
      
      const secretHex = ethers.hexlify(secret)
      
      setSwapDetails({
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        secret: secretHex,
        hashlock: hashlock,
        amount: amount,
        recipient: recipient
      })
      
      setSwapResult(`🎉 CROSS-CHAIN ATOMIC SWAP SUCCESS!
        
✅ Transaction confirmed in block ${receipt.blockNumber}
🔗 Transaction: https://sepolia.etherscan.io/tx/${tx.hash}
💰 Locked: ${amount} ETH for 5 NTRN
🔐 Secret: ${secretHex}
🏠 Recipient: ${recipient}

🌉 Your cross-chain atomic swap is now active!`)
      
    } catch (error) {
      console.error('Swap failed:', error)
      setSwapResult(`❌ Swap failed: ${error.message}`)
    }
    
    setLoading(false)
  }

  const resetForm = () => {
    setAmount('0.005')
    setRecipient('neutron1at23g9fv3eqcsxj68fstfn0qhhqw0k0s54e7ky')
    setSwapResult('')
    setSwapDetails(null)
  }

  return (
    <div className="app">
      <h1>🌉 FusionXCosmos</h1>
      <div className="subtitle">Cross-Chain Atomic Swap: Ethereum ↔ Neutron</div>
      
      {/* Wallet Connection */}
      <div className="card">
        <h2>1. Connect Wallet</h2>
        {!account ? (
          <button onClick={connectWallet} className="button">
            Connect MetaMask & Switch to Sepolia
          </button>
        ) : (
          <div className="success">
            ✅ Connected: {account.slice(0, 6)}...{account.slice(-4)}
            <br />
            💰 Balance: {parseFloat(networkInfo?.balance || 0).toFixed(4)} ETH
            <br />
            🌐 Network: {networkInfo?.chainId === '11155111' ? 'Sepolia Testnet ✅' : `Unknown (${networkInfo?.chainId})`}
          </div>
        )}
      </div>

      {/* Swap Interface */}
      {account && networkInfo?.chainId === '11155111' && (
        <div className="card">
          <h2>2. Cross-Chain Atomic Swap</h2>
          
          <div className="form">
            <label>ETH Amount:</label>
            <input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
            />

            <label>Neutron Recipient:</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={loading}
            />

            <div className="swap-info">
              <p>💱 Swap: {amount} ETH → 5 NTRN</p>
              <p>🔒 Safety Deposit: 0.005 ETH</p>
              <p>💰 Total Cost: {(parseFloat(amount) + 0.005).toFixed(3)} ETH</p>
            </div>

            <div className="buttons">
              <button
                onClick={doSwap}
                disabled={loading || !amount || !recipient || parseFloat(networkInfo?.balance || 0) < (parseFloat(amount) + 0.005)}
                className="button primary"
              >
                {loading ? 'Creating Atomic Swap...' : '🚀 Execute Cross-Chain Swap'}
              </button>
              
              <button onClick={resetForm} className="button" disabled={loading}>
                Reset
              </button>
            </div>
          </div>

          {swapResult && (
            <div className="result">
              <pre style={{whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: '12px'}}>
                {swapResult}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Wrong Network Warning */}
      {account && networkInfo?.chainId !== '11155111' && (
        <div className="card" style={{background: '#ffe6e6', border: '1px solid #ff9999'}}>
          <h2>⚠️ Wrong Network</h2>
          <p>Please connect to <strong>Sepolia Testnet</strong> to use the real cross-chain swap.</p>
          <button onClick={connectWallet} className="button">
            Switch to Sepolia
          </button>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <h2>🔍 About This Demo</h2>
        <p>This UI connects to <strong>real smart contracts</strong> on Sepolia testnet:</p>
        <ul style={{textAlign: 'left', fontSize: '12px'}}>
          <li><strong>AtomicSwap:</strong> 0x24E962383cf5B4eBE43B97247a791f960Fa141Fe</li>
          <li><strong>CrossChainManager:</strong> 0x1eC67BE0a430074c4b2a487d3e0DD11BD668f1BB</li>
          <li><strong>Neutron Contract:</strong> neutron139dut25xmh2tzdp63vrneptt86e74vqxwdl0f3aea9a4td4g5d4qm3z0ue</li>
        </ul>
        <p><strong>All transactions are real and verifiable on blockchain explorers!</strong></p>
      </div>
    </div>
  )
}

export default App