import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'

const SwapInterface = ({ account, provider, contract, network }) => {
  const [fromChain, setFromChain] = useState('ethereum')
  const [toChain, setToChain] = useState('cosmos')
  const [amount, setAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapStatus, setSwapStatus] = useState('')
  const [swapResult, setSwapResult] = useState(null)
  const [error, setError] = useState('')

  const handleSwapDirection = () => {
    setFromChain(toChain)
    setToChain(fromChain)
    setRecipientAddress('')
    setSwapResult(null)
    setError('')
  }

  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return false
    }
    
    if (!recipientAddress) {
      setError('Please enter recipient address')
      return false
    }

    if (fromChain === 'cosmos' && !recipientAddress.startsWith('cosmos')) {
      setError('Cosmos address should start with "cosmos"')
      return false
    }

    if (fromChain === 'ethereum' && !ethers.isAddress(recipientAddress)) {
      setError('Please enter a valid Ethereum address')
      return false
    }

    return true
  }

  const generateRandomSecret = () => {
    return ethers.hexlify(ethers.randomBytes(32))
  }

  const initiateSwap = async () => {
    if (!validateInputs()) return

    setIsSwapping(true)
    setError('')
    setSwapStatus('Initiating swap...')

    try {
      // For demo purposes - this would need real contract integration
      if (!contract) {
        // Simulate swap process for demo
        setSwapStatus('🔄 Creating atomic swap...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        const secret = generateRandomSecret()
        const hashlock = ethers.keccak256(secret)
        
        setSwapStatus('✅ Swap initiated successfully!')
        setSwapResult({
          swapId: ethers.keccak256(ethers.toUtf8Bytes(`swap-${Date.now()}`)),
          secret: secret,
          hashlock: hashlock,
          amount: amount,
          fromChain: fromChain,
          toChain: toChain,
          recipient: recipientAddress,
          status: 'initiated',
          timestamp: new Date().toISOString()
        })

        // Simulate completion after a delay
        setTimeout(() => {
          setSwapStatus('🎉 Swap completed! Tokens transferred successfully.')
        }, 3000)

      } else {
        // Real contract interaction would go here
        setSwapStatus('Interacting with smart contract...')
        // const tx = await contract.initiateSwap(...)
        // await tx.wait()
      }

    } catch (error) {
      console.error('Swap error:', error)
      setError(`Swap failed: ${error.message}`)
      setSwapStatus('')
    } finally {
      setIsSwapping(false)
    }
  }

  const resetForm = () => {
    setAmount('')
    setRecipientAddress('')
    setSwapResult(null)
    setSwapStatus('')
    setError('')
  }

  return (
    <div className="card">
      <h2>🔄 Cross-Chain Swap</h2>
      
      <div className="swap-form">
        {/* Swap Direction */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
          <div className="network-badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {fromChain === 'ethereum' ? '🔷 Ethereum' : '⚛️ Cosmos'}
          </div>
          
          <button 
            className="button" 
            onClick={handleSwapDirection}
            style={{ padding: '0.5rem 1rem', fontSize: '1.2rem' }}
          >
            ↔️
          </button>
          
          <div className="network-badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {toChain === 'ethereum' ? '🔷 Ethereum' : '⚛️ Cosmos'}
          </div>
        </div>

        {/* Amount Input */}
        <div className="form-group">
          <label>
            Amount to Swap ({fromChain === 'ethereum' ? 'ETH' : 'ATOM'})
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            className="input"
            placeholder={`Enter ${fromChain === 'ethereum' ? 'ETH' : 'ATOM'} amount`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSwapping}
          />
        </div>

        {/* Recipient Address */}
        <div className="form-group">
          <label>
            {toChain === 'ethereum' ? 'Ethereum' : 'Cosmos'} Recipient Address
          </label>
          <input
            type="text"
            className="input"
            placeholder={
              toChain === 'ethereum' 
                ? '0x742d35Cc6634C0532925a3b8D23eA9d2e'
                : 'cosmos1abc123def456...'
            }
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            disabled={isSwapping}
          />
        </div>

        {/* Swap Summary */}
        {amount && recipientAddress && (
          <div className="status" style={{ background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb' }}>
            <strong>📋 Swap Summary:</strong>
            <br />
            • Send: {amount} {fromChain === 'ethereum' ? 'ETH' : 'ATOM'} from {fromChain}
            <br />
            • Receive: ~{amount} {toChain === 'ethereum' ? 'ETH' : 'ATOM'} on {toChain}
            <br />
            • Recipient: {recipientAddress.slice(0, 20)}...
            <br />
            • Est. Time: 5-10 minutes
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            className="button"
            onClick={initiateSwap}
            disabled={isSwapping || !amount || !recipientAddress}
          >
            {isSwapping ? (
              <>
                <span className="loading"></span> Processing...
              </>
            ) : (
              `🚀 Initiate ${fromChain} → ${toChain} Swap`
            )}
          </button>
          
          <button
            className="button"
            onClick={resetForm}
            disabled={isSwapping}
            style={{ background: '#6c757d' }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {swapStatus && (
        <div className="status success">
          {swapStatus}
        </div>
      )}

      {error && (
        <div className="status error">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Swap Result */}
      {swapResult && (
        <div className="status success">
          <h3>🎉 Swap Details</h3>
          <div style={{ fontSize: '0.9rem', textAlign: 'left' }}>
            <strong>Swap ID:</strong> {swapResult.swapId.slice(0, 10)}...
            <br />
            <strong>Amount:</strong> {swapResult.amount} {fromChain === 'ethereum' ? 'ETH' : 'ATOM'}
            <br />
            <strong>From:</strong> {swapResult.fromChain} → <strong>To:</strong> {swapResult.toChain}
            <br />
            <strong>Recipient:</strong> {swapResult.recipient.slice(0, 20)}...
            <br />
            <strong>Status:</strong> {swapResult.status}
            <br />
            <strong>Time:</strong> {new Date(swapResult.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="status warning">
        <strong>🚧 Demo Mode</strong>
        <br />
        This is a demonstration interface. Real swaps require:
        <br />
        • Deployed contracts on testnet
        • Real testnet tokens (ETH/ATOM)
        • Cross-chain relayer service
      </div>
    </div>
  )
}

export default SwapInterface