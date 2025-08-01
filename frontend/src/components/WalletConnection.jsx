import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { getNetworkConfig, isSupportedNetwork, ATOMIC_SWAP_ABI, loadContractAddresses } from '../config/contracts.js'

const WalletConnection = ({ 
  account, 
  setAccount, 
  provider, 
  setProvider, 
  contract, 
  setContract,
  network,
  setNetwork 
}) => {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [contractStatus, setContractStatus] = useState('')

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not found! Please install MetaMask.')
      return
    }

    setConnecting(true)
    setError('')
    setContractStatus('')

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      const signer = await provider.getSigner()

      const chainId = network.chainId.toString()
      const networkConfig = getNetworkConfig(chainId)

      setAccount(accounts[0])
      setProvider(provider)
      setNetwork({
        name: network.name,
        chainId: chainId,
        config: networkConfig
      })

      // Try to connect to deployed contract
      await connectToContract(signer, networkConfig, network.name)

      console.log('Connected to:', accounts[0])
      console.log('Network:', network.name, chainId)

    } catch (error) {
      console.error('Connection error:', error)
      setError(`Failed to connect: ${error.message}`)
    } finally {
      setConnecting(false)
    }
  }

  const connectToContract = async (signer, networkConfig, networkName) => {
    if (!networkConfig) {
      setContractStatus('⚠️ Unsupported network')
      return
    }

    setContractStatus('🔍 Looking for deployed contracts...')

    try {
      let contractAddress = null

      // Try to get contract address from network config
      if (networkConfig.contracts.AtomicSwapEthereum) {
        contractAddress = networkConfig.contracts.AtomicSwapEthereum
      } else {
        // Try to load from deployment file (for local development)
        const deployedAddresses = await loadContractAddresses(networkName.toLowerCase())
        if (deployedAddresses && deployedAddresses.AtomicSwapEthereum) {
          contractAddress = deployedAddresses.AtomicSwapEthereum
        }
      }

      if (contractAddress && contractAddress !== '0x742d35Cc6634C0532925a3b8D23eA9d2eeBF9Be8') {
        // Create contract instance
        const contract = new ethers.Contract(contractAddress, ATOMIC_SWAP_ABI, signer)
        
        // Test contract connection
        await contract.minimumSafetyDeposit()
        
        setContract(contract)
        setContractStatus(`✅ Connected to contract: ${contractAddress.slice(0, 8)}...`)
      } else {
        setContractStatus('⚠️ No deployed contract found - running in demo mode')
      }

    } catch (error) {
      console.error('Contract connection error:', error)
      setContractStatus(`❌ Contract connection failed: ${error.message}`)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setProvider(null)
    setContract(null)
    setNetwork(null)
    setError('')
    setContractStatus('')
  }

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
      })
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia Testnet',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          })
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError)
        }
      }
    }
  }

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          setAccount(accounts[0])
        }
      })

      window.ethereum.on('chainChanged', () => {
        window.location.reload()
      })
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged')
        window.ethereum.removeAllListeners('chainChanged')
      }
    }
  }, [])

  return (
    <div className="card">
      <h2>🔐 Wallet Connection</h2>
      
      {!account ? (
        <div>
          <p>Connect your MetaMask wallet to start swapping</p>
          <button 
            className="button" 
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <span className="loading"></span> Connecting...
              </>
            ) : (
              '🦊 Connect MetaMask'
            )}
          </button>
        </div>
      ) : (
        <div>
          <div className="status success">
            <strong>✅ Wallet Connected</strong>
            <br />
            <strong>Account:</strong> {account.slice(0, 6)}...{account.slice(-4)}
            <br />
            {network && (
              <>
                <strong>Network:</strong> 
                <span className="network-badge">
                  {network.name} ({network.chainId})
                </span>
              </>
            )}
          </div>
          
          {network && !isSupportedNetwork(network.chainId) && (
            <div className="status warning">
              <strong>⚠️ Unsupported Network</strong>
              <br />
              Please switch to a supported network (Sepolia, Hardhat)
              <br />
              <button className="button" onClick={switchToSepolia}>
                Switch to Sepolia
              </button>
            </div>
          )}

          {contractStatus && (
            <div className="status" style={{
              background: contractStatus.includes('✅') ? '#d4edda' : 
                         contractStatus.includes('⚠️') ? '#fff3cd' : '#f8d7da',
              color: contractStatus.includes('✅') ? '#155724' :
                     contractStatus.includes('⚠️') ? '#856404' : '#721c24',
              border: contractStatus.includes('✅') ? '1px solid #c3e6cb' :
                      contractStatus.includes('⚠️') ? '1px solid #ffeaa7' : '1px solid #f5c6cb'
            }}>
              <strong>Contract Status:</strong> {contractStatus}
            </div>
          )}
          
          <button className="button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}

      {error && (
        <div className="status error">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
        <strong>Supported Networks:</strong>
        <ul>
          <li>Ethereum Sepolia Testnet (ChainID: 11155111)</li>
          <li>Local Hardhat Network (ChainID: 31337)</li>
        </ul>
      </div>
    </div>
  )
}

export default WalletConnection