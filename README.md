# FusionXCosmos

**Cross chain atomic swaps between Ethereum and Cosmos with real on chain execution — no bridges, no trust required.**

## 🔮 Overview

FusionXCosmos is a production ready system enabling atomic swaps between Ethereum and Cosmos ecosystem chains. It allows users to trade tokens like ETH and NTRN trustlessly, without relying on bridges or custodians.

Using cryptographic hash time locks, FusionXCosmos guarantees atomic execution, either both sides complete successfully or nothing happens. This removes all counterparty, bridge, and custody risks common in cross chain DeFi today.

## 🏓 Live Demo

Try it out yourself here: [FusionXCosmos Demo](https://fusionxcosmos.vercel.app/)

## ⚒️ How It Works

1. User locks ETH on Ethereum in a smart contract with a hashlock and timelock.
2. Counterparty locks NTRN on Cosmos chain using the same hashlock.
3. User claims the NTRN by revealing the secret.
4. Counterparty claims the locked ETH with the revealed secret.

All transactions are live and verifiable on Ethereum Sepolia and Cosmos Neutron testnets.

## 🌟 Key Features

* **Trustless:** No bridges or custodians required.
* **Atomic:** Cryptographically guaranteed all or nothing swap.
* **Cross chain:** Direct interoperability between Ethereum and Cosmos.
* **User friendly:** Simple UI abstracts the complex cryptography.
* **Verifiable:** Transactions are transparent and auditable on chain.

## 🍋 Architecture

### Ethereum

* Custom Solidity contracts handle locking ETH using hash time locks.
* Contracts store Cosmos chain details (recipient, amounts) on chain to prove swap intent.
* Deployed on Sepolia testnet.

### Cosmos

* Instead of CosmWasm contracts, memo based coordination in Cosmos bank send transactions handles swap state.
* This pattern matches production Cosmos chains like Osmosis and leverages IBC design principles.
* Runs on Neutron testnet.

### Frontend

* Built with React and Vite.
* Dual wallet support: MetaMask (Ethereum) and Keplr (Cosmos).
* Orchestrates swap steps with seamless user flow and real time updates.

## 💡 Tech Stack

* Solidity
* Ethers.js
* CosmJS
* React
* Vite
* MetaMask
* Keplr
* Sepolia and Neutron testnets
* Hosted on Vercel

## 🎮 How To Use

1. Connect MetaMask and switch to Sepolia network.
2. Connect Keplr and select Neutron testnet.
3. Follow the UI steps to lock ETH, lock NTRN, reveal secret, and claim tokens.
4. Verify transactions on Etherscan (Sepolia) and Neutron explorer.

## 🚧 Future Plans

* Add order book systems for multi party swaps.
* Support more Cosmos chains like Osmosis and Juno.
* Enable ERC20 token swaps.
* Build relayer networks for automated execution.
