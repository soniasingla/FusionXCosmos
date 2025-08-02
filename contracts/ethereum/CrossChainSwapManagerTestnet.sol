// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AtomicSwapEthereum.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract CrossChainSwapManagerTestnet is AccessControl, Pausable {
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    AtomicSwapEthereum public immutable atomicSwap;
    
    struct CrossChainOrder {
        bytes32 swapId;
        address initiator;
        string cosmosRecipient;
        string cosmosChainId;
        uint256 cosmosAmount;
        string cosmosDenom;
        bool isProcessed;
        uint256 createdAt;
    }

    mapping(bytes32 => CrossChainOrder) public crossChainOrders;
    mapping(address => uint256) public resolverStakes;
    
    // Reduced minimum stake for testnet: 0.01 ETH instead of 1.0 ETH
    uint256 public constant MINIMUM_RESOLVER_STAKE = 0.01 ether;
    uint256 public constant ORDER_EXPIRY_TIME = 24 hours;
    
    event CrossChainOrderCreated(
        bytes32 indexed orderId,
        bytes32 indexed swapId,
        address indexed initiator,
        string cosmosRecipient,
        string cosmosChainId,
        uint256 cosmosAmount,
        string cosmosDenom
    );
    
    event OrderProcessed(
        bytes32 indexed orderId,
        address indexed resolver
    );
    
    event ResolverStakeUpdated(
        address indexed resolver,
        uint256 newStake
    );

    constructor(address payable _atomicSwap) {
        atomicSwap = AtomicSwapEthereum(_atomicSwap);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function addResolver(address _resolver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RESOLVER_ROLE, _resolver);
    }

    function removeResolver(address _resolver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(RESOLVER_ROLE, _resolver);
    }

    function addRelayer(address _relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RELAYER_ROLE, _relayer);
    }

    function stakeAsResolver() external payable {
        require(hasRole(RESOLVER_ROLE, msg.sender), "Not authorized as resolver");
        require(msg.value >= MINIMUM_RESOLVER_STAKE, "Insufficient stake");
        
        resolverStakes[msg.sender] += msg.value;
        emit ResolverStakeUpdated(msg.sender, resolverStakes[msg.sender]);
    }

    function withdrawStake(uint256 _amount) external {
        require(resolverStakes[msg.sender] >= _amount, "Insufficient stake");
        require(resolverStakes[msg.sender] - _amount >= MINIMUM_RESOLVER_STAKE || !hasRole(RESOLVER_ROLE, msg.sender), "Must maintain minimum stake");
        
        resolverStakes[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        
        emit ResolverStakeUpdated(msg.sender, resolverStakes[msg.sender]);
    }

    function createCrossChainOrder(
        address _participant,
        address _token,
        uint256 _ethereumAmount,
        bytes32 _hashlock,
        uint256 _timelock,
        string calldata _cosmosRecipient,
        string calldata _cosmosChainId,
        uint256 _cosmosAmount,
        string calldata _cosmosDenom
    ) external payable whenNotPaused returns (bytes32 orderId) {
        bytes32 swapId = atomicSwap.initiateSwap{value: msg.value}(
            _participant,
            _token,
            _ethereumAmount,
            _hashlock,
            _timelock,
            _cosmosRecipient
        );

        orderId = keccak256(abi.encodePacked(swapId, _cosmosRecipient, _cosmosChainId));
        
        crossChainOrders[orderId] = CrossChainOrder({
            swapId: swapId,
            initiator: msg.sender,
            cosmosRecipient: _cosmosRecipient,
            cosmosChainId: _cosmosChainId,
            cosmosAmount: _cosmosAmount,
            cosmosDenom: _cosmosDenom,
            isProcessed: false,
            createdAt: block.timestamp
        });

        emit CrossChainOrderCreated(
            orderId,
            swapId,
            msg.sender,
            _cosmosRecipient,
            _cosmosChainId,
            _cosmosAmount,
            _cosmosDenom
        );

        return orderId;
    }

    function processOrder(
        bytes32 _orderId,
        string calldata _cosmosTransactionHash
    ) external onlyRole(RESOLVER_ROLE) whenNotPaused {
        CrossChainOrder storage order = crossChainOrders[_orderId];
        require(!order.isProcessed, "Order already processed");
        require(block.timestamp < order.createdAt + ORDER_EXPIRY_TIME, "Order expired");
        require(resolverStakes[msg.sender] >= MINIMUM_RESOLVER_STAKE, "Insufficient resolver stake");

        order.isProcessed = true;
        
        emit OrderProcessed(_orderId, msg.sender);
    }

    function reportCosmosSwapCompletion(
        bytes32 _orderId,
        bytes32 _secret,
        string calldata _cosmosTransactionHash
    ) external onlyRole(RELAYER_ROLE) whenNotPaused {
        CrossChainOrder storage order = crossChainOrders[_orderId];
        require(order.isProcessed, "Order not processed by resolver");
        
        // This would trigger the completion on Ethereum side
        // In a real implementation, this would verify the Cosmos transaction
        // and then call atomicSwap.completeSwap with the secret
    }

    function getCrossChainOrder(bytes32 _orderId) external view returns (CrossChainOrder memory) {
        return crossChainOrders[_orderId];
    }

    function isOrderExpired(bytes32 _orderId) external view returns (bool) {
        return block.timestamp >= crossChainOrders[_orderId].createdAt + ORDER_EXPIRY_TIME;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    receive() external payable {}
}