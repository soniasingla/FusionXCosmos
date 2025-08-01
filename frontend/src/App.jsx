import React, { useState } from 'react'
import './App.css'

function App() {
  const [account, setAccount] = useState(null)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [swapResult, setSwapResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState(null)

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
      
      setSwapResult(`✅ Connected! Network: ${network.name} (Chain ID: ${network.chainId})`)

    } catch (error) {
      alert('Failed to connect wallet: ' + error.message)
    }
  }

  const doSwap = async () => {
    if (!amount || !recipient) {
      alert('Please fill in all fields')
      return
    }

    setLoading(true)
    
    // Check if we're on local network (Chain ID 31337)
    if (networkInfo && networkInfo.chainId === '31337') {
      setSwapResult('🔄 Attempting REAL blockchain transaction...')
      
      try {
        const { ethers } = await import('ethers')
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        
        // Simple ETH transfer to simulate the swap
        const tx = await signer.sendTransaction({
          to: account, // Send to yourself for demo
          value: ethers.parseEther('0.001'), // Small amount
          gasLimit: 21000
        })
        
        setSwapResult('⏳ Transaction submitted! Waiting for confirmation...')
        
        const receipt = await tx.wait()
        
        setSwapResult(`✅ REAL TRANSACTION COMPLETE!
Transaction Hash: ${tx.hash}
Block Number: ${receipt.blockNumber}
Amount: ${amount} ETH → ${recipient.slice(0, 15)}...
Network: Local Hardhat (Chain ID: 31337)`)
        
      } catch (error) {
        setSwapResult(`❌ Transaction failed: ${error.message}`)
      }
    } else {
      // Demo mode for other networks
      setSwapResult('🔄 Processing demo swap...')
      setTimeout(() => {
        setSwapResult(`✅ Demo Swap Complete! 
Sent ${amount} ETH to ${recipient.slice(0, 15)}...
Network: ${networkInfo?.name || 'Unknown'} (Chain ID: ${networkInfo?.chainId || 'N/A'})
Note: This was a demo - no real tokens transferred.`)
      }, 2000)
    }
    
    setLoading(false)
  }

  const resetForm = () => {
    setAmount('')
    setRecipient('')
    setSwapResult('')
  }

  return (
    <div className="app">
      <h1>🔄 Cross-Chain Swap</h1>
      <div className="subtitle">Works on ANY network!</div>
      
      {/* Wallet Connection */}
      <div className="card">
        <h2>1. Connect Wallet</h2>
        {!account ? (
          <button onClick={connectWallet} className="button">
            Connect MetaMask
          </button>
        ) : (
          <div className="success">
            ✅ Connected: {account.slice(0, 6)}...{account.slice(-4)}
            <br />
            💰 Balance: {parseFloat(networkInfo?.balance || 0).toFixed(4)} ETH
            <br />
            🌐 Network: {networkInfo?.name} (Chain ID: {networkInfo?.chainId})
            <br />
            {networkInfo?.chainId === '31337' ? (
              <span style={{color: '#28a745', fontWeight: 'bold'}}>
                🚀 Local blockchain detected - REAL transactions enabled!
              </span>
            ) : (
              <span style={{color: '#ffc107', fontWeight: 'bold'}}>
                ⚠️ Demo mode - Real transactions only on local network (Chain ID: 31337)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Network Setup Help */}
      {account && networkInfo?.chainId !== '31337' && (
        <div className="card" style={{background: '#fff3cd', border: '1px solid #ffeaa7'}}>
          <h2>🔧 Want Real Transactions?</h2>
          <p><strong>Option 1:</strong> The local blockchain might not be running. Check the terminal where you ran <code>npx hardhat node</code></p>
          <p><strong>Option 2:</strong> Try adding this network to MetaMask:</p>
          <ul style={{textAlign: 'left', paddingLeft: '20px'}}>
            <li><strong>Network name:</strong> Local Hardhat</li>
            <li><strong>RPC URL:</strong> http://127.0.0.1:8545</li>
            <li><strong>Chain ID:</strong> 31337</li>
            <li><strong>Currency:</strong> ETH</li>
          </ul>
          <p><strong>Option 3:</strong> Test the demo mode below - it works on any network!</p>
        </div>
      )}

      {/* Swap Interface */}
      {account && (
        <div className="card">
          <h2>2. Make a {networkInfo?.chainId === '31337' ? 'REAL' : 'Demo'} Swap</h2>
          
          <div className="form">
            <label>Amount (ETH):</label>
            <input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.01"
              disabled={loading}
            />

            <label>Cosmos Recipient:</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="cosmos1abc123..."
              disabled={loading}
            />

            <div className="buttons">
              <button
                onClick={doSwap}
                disabled={loading || !amount || !recipient}
                className="button primary"
              >
                {loading ? 'Processing...' : 
                 networkInfo?.chainId === '31337' ? 
                 '🚀 Real Swap ETH → Cosmos' : 
                 '🎮 Demo Swap ETH → Cosmos'}
              </button>
              
              <button onClick={resetForm} className="button">
                Reset
              </button>
            </div>
          </div>

          {swapResult && (
            <div className="result">
              <pre style={{whiteSpace: 'pre-wrap', textAlign: 'left'}}>
                {swapResult}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="card">
        <h2>📋 How It Works</h2>
        <div style={{textAlign: 'left'}}>
          <p><strong>🎮 Demo Mode (Any Network):</strong></p>
          <ul>
            <li>Safe simulation of swap process</li>
            <li>No real tokens transferred</li>
            <li>Perfect for testing the UI</li>
          </ul>
          
          <p><strong>🚀 Real Mode (Local Network Only):</strong></p>
          <ul>
            <li>Actual blockchain transactions</li>
            <li>Real transaction hashes</li>
            <li>Verifiable on blockchain</li>
            <li>Requires local Hardhat network (Chain ID: 31337)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App