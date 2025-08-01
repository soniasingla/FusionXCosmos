import React, { useState, useEffect } from 'react'

const SwapHistory = ({ account, contract }) => {
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(false)

  // Demo data for swap history
  const demoSwaps = [
    {
      id: '0x1a2b3c...',
      fromChain: 'ethereum',
      toChain: 'cosmos',
      amount: '0.5',
      token: 'ETH',
      status: 'completed',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      txHash: '0xabc123...',
    },
    {
      id: '0x4d5e6f...',
      fromChain: 'cosmos',
      toChain: 'ethereum',
      amount: '100',
      token: 'ATOM',
      status: 'pending',
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      txHash: '0xdef456...',
    },
    {
      id: '0x7g8h9i...',
      fromChain: 'ethereum',
      toChain: 'cosmos',
      amount: '0.1',
      token: 'ETH',
      status: 'refunded',
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      txHash: '0xghi789...',
    }
  ]

  useEffect(() => {
    if (account) {
      loadSwapHistory()
    }
  }, [account, contract])

  const loadSwapHistory = async () => {
    setLoading(true)
    
    try {
      if (contract) {
        // Real contract interaction would go here
        // const events = await contract.queryFilter('SwapInitiated')
        // Process events and set swaps
        setSwaps([])
      } else {
        // Demo mode - show sample data
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
        setSwaps(demoSwaps)
      }
    } catch (error) {
      console.error('Error loading swap history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'pending':
        return '⏳'
      case 'refunded':
        return '🔄'
      case 'failed':
        return '❌'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#28a745'
      case 'pending':
        return '#ffc107'
      case 'refunded':
        return '#6c757d'
      case 'failed':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now - past
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else {
      return past.toLocaleDateString()
    }
  }

  return (
    <div className="card">
      <h2>📈 Swap History</h2>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Your recent cross-chain swaps
        </p>
        <button 
          className="button" 
          onClick={loadSwapHistory}
          disabled={loading}
          style={{ padding: '0.5rem 1rem' }}
        >
          {loading ? <span className="loading"></span> : '🔄'} Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="loading"></span>
          <p>Loading swap history...</p>
        </div>
      ) : swaps.length === 0 ? (
        <div className="status" style={{ background: '#f8f9fa', color: '#6c757d', border: '1px solid #dee2e6' }}>
          <strong>📭 No swaps found</strong>
          <br />
          Your completed swaps will appear here
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {swaps.map((swap, index) => (
            <div 
              key={swap.id} 
              style={{
                padding: '1rem',
                border: '2px solid #e9ecef',
                borderRadius: '12px',
                background: '#f8f9fa'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>
                    {getStatusIcon(swap.status)} 
                    {swap.fromChain === 'ethereum' ? '🔷' : '⚛️'} → {swap.toChain === 'ethereum' ? '🔷' : '⚛️'}
                  </strong>
                  <br />
                  <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                    {swap.amount} {swap.token}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span 
                    style={{ 
                      color: getStatusColor(swap.status),
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '0.8rem'
                    }}
                  >
                    {swap.status}
                  </span>
                  <br />
                  <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                    {formatTimeAgo(swap.timestamp)}
                  </span>
                </div>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                <strong>Swap ID:</strong> {swap.id}
                <br />
                <strong>TX Hash:</strong> {swap.txHash}
              </div>
              
              {swap.status === 'pending' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ 
                    background: '#fff3cd', 
                    color: '#856404', 
                    padding: '0.5rem', 
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}>
                    ⏳ Waiting for cross-chain confirmation...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Demo Notice */}
      {!contract && (
        <div className="status warning" style={{ marginTop: '1rem' }}>
          <strong>🚧 Demo Data</strong>
          <br />
          This shows sample swap history. Real history will load from blockchain events when connected to deployed contracts.
        </div>
      )}
    </div>
  )
}

export default SwapHistory