// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HashlockTimelock is ReentrancyGuard {

    enum SwapState {
        INVALID,
        INITIATED,
        COMPLETED,
        REFUNDED
    }

    struct AtomicSwap {
        address initiator;
        address participant;
        address token;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        SwapState state;
        bytes32 secret;
    }

    mapping(bytes32 => AtomicSwap) public swaps;
    
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed initiator,
        address indexed participant,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    
    event SwapCompleted(
        bytes32 indexed swapId,
        bytes32 secret
    );
    
    event SwapRefunded(
        bytes32 indexed swapId
    );

    modifier onlyInitiator(bytes32 _swapId) {
        require(swaps[_swapId].initiator == msg.sender, "Only initiator can call this");
        _;
    }

    modifier onlyParticipant(bytes32 _swapId) {
        require(swaps[_swapId].participant == msg.sender, "Only participant can call this");
        _;
    }

    modifier swapExists(bytes32 _swapId) {
        require(swaps[_swapId].state != SwapState.INVALID, "Swap does not exist");
        _;
    }

    modifier swapInitiated(bytes32 _swapId) {
        require(swaps[_swapId].state == SwapState.INITIATED, "Swap not in initiated state");
        _;
    }

    modifier swapNotExpired(bytes32 _swapId) {
        require(block.timestamp < swaps[_swapId].timelock, "Swap has expired");
        _;
    }

    modifier swapExpired(bytes32 _swapId) {
        require(block.timestamp >= swaps[_swapId].timelock, "Swap has not expired");
        _;
    }

    function generateSwapId(
        address _initiator,
        address _participant,
        bytes32 _hashlock,
        uint256 _timelock
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_initiator, _participant, _hashlock, _timelock));
    }

    function verifySecret(bytes32 _hashlock, bytes32 _secret) public pure returns (bool) {
        return _hashlock == keccak256(abi.encodePacked(_secret));
    }

    function getSwap(bytes32 _swapId) external view returns (AtomicSwap memory) {
        return swaps[_swapId];
    }

    function isSwapExpired(bytes32 _swapId) external view swapExists(_swapId) returns (bool) {
        return block.timestamp >= swaps[_swapId].timelock;
    }

    function isSwapCompleted(bytes32 _swapId) external view swapExists(_swapId) returns (bool) {
        return swaps[_swapId].state == SwapState.COMPLETED;
    }

    function isSwapRefunded(bytes32 _swapId) external view swapExists(_swapId) returns (bool) {
        return swaps[_swapId].state == SwapState.REFUNDED;
    }
}