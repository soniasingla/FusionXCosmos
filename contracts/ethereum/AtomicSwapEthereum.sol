// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HashlockTimelock.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AtomicSwapEthereum is HashlockTimelock, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_TIMELOCK_DURATION = 3600; // 1 hour
    uint256 public constant MAX_TIMELOCK_DURATION = 7 * 24 * 3600; // 1 week
    
    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => uint256) public safetyDeposits;
    
    uint256 public minimumSafetyDeposit = 0.01 ether;

    event TokenSupported(address indexed token, bool supported);
    event SafetyDepositUpdated(uint256 newMinimum);

    constructor() Ownable(msg.sender) {
        supportedTokens[address(0)] = true; // Support ETH
    }

    function setSupportedToken(address _token, bool _supported) external onlyOwner {
        supportedTokens[_token] = _supported;
        emit TokenSupported(_token, _supported);
    }

    function setMinimumSafetyDeposit(uint256 _minimum) external onlyOwner {
        minimumSafetyDeposit = _minimum;
        emit SafetyDepositUpdated(_minimum);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function initiateSwap(
        address _participant,
        address _token,
        uint256 _amount,
        bytes32 _hashlock,
        uint256 _timelock,
        string calldata _cosmosRecipient
    ) external payable whenNotPaused nonReentrant returns (bytes32 swapId) {
        require(_participant != address(0), "Invalid participant address");
        require(_amount > 0, "Amount must be greater than 0");
        require(_timelock > block.timestamp + MIN_TIMELOCK_DURATION, "Timelock too short");
        require(_timelock < block.timestamp + MAX_TIMELOCK_DURATION, "Timelock too long");
        require(supportedTokens[_token], "Token not supported");
        require(msg.value >= minimumSafetyDeposit, "Insufficient safety deposit");

        swapId = generateSwapId(msg.sender, _participant, _hashlock, _timelock);
        require(swaps[swapId].state == SwapState.INVALID, "Swap already exists");

        if (_token == address(0)) {
            require(msg.value >= _amount + minimumSafetyDeposit, "Insufficient ETH sent");
            safetyDeposits[swapId] = msg.value - _amount; // Store only the safety deposit portion
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            safetyDeposits[swapId] = msg.value; // For ERC20, entire msg.value is safety deposit
        }

        swaps[swapId] = AtomicSwap({
            initiator: msg.sender,
            participant: _participant,
            token: _token,
            amount: _amount,
            hashlock: _hashlock,
            timelock: _timelock,
            state: SwapState.INITIATED,
            secret: bytes32(0)
        });

        emit SwapInitiated(
            swapId,
            msg.sender,
            _participant,
            _token,
            _amount,
            _hashlock,
            _timelock
        );

        return swapId;
    }

    function completeSwap(
        bytes32 _swapId,
        bytes32 _secret
    ) external 
        whenNotPaused 
        nonReentrant 
        swapExists(_swapId) 
        swapInitiated(_swapId) 
        swapNotExpired(_swapId) 
        onlyParticipant(_swapId) 
    {
        AtomicSwap storage swap = swaps[_swapId];
        require(verifySecret(swap.hashlock, _secret), "Invalid secret");

        swap.state = SwapState.COMPLETED;
        swap.secret = _secret;

        if (swap.token == address(0)) {
            payable(swap.participant).transfer(swap.amount);
        } else {
            IERC20(swap.token).safeTransfer(swap.participant, swap.amount);
        }

        // Return safety deposit to initiator
        uint256 deposit = safetyDeposits[_swapId];
        safetyDeposits[_swapId] = 0;
        payable(swap.initiator).transfer(deposit);

        emit SwapCompleted(_swapId, _secret);
    }

    function refundSwap(
        bytes32 _swapId
    ) external 
        whenNotPaused 
        nonReentrant 
        swapExists(_swapId) 
        swapInitiated(_swapId) 
        swapExpired(_swapId) 
        onlyInitiator(_swapId) 
    {
        AtomicSwap storage swap = swaps[_swapId];
        swap.state = SwapState.REFUNDED;

        if (swap.token == address(0)) {
            payable(swap.initiator).transfer(swap.amount);
        } else {
            IERC20(swap.token).safeTransfer(swap.initiator, swap.amount);
        }

        // Return safety deposit to initiator
        uint256 deposit = safetyDeposits[_swapId];
        safetyDeposits[_swapId] = 0;
        payable(swap.initiator).transfer(deposit);

        emit SwapRefunded(_swapId);
    }

    function emergencyRefund(
        bytes32 _swapId
    ) external 
        onlyOwner 
        swapExists(_swapId) 
        swapInitiated(_swapId) 
    {
        AtomicSwap storage swap = swaps[_swapId];
        swap.state = SwapState.REFUNDED;

        if (swap.token == address(0)) {
            payable(swap.initiator).transfer(swap.amount);
        } else {
            IERC20(swap.token).safeTransfer(swap.initiator, swap.amount);
        }

        uint256 deposit = safetyDeposits[_swapId];
        safetyDeposits[_swapId] = 0;
        payable(swap.initiator).transfer(deposit);

        emit SwapRefunded(_swapId);
    }

    receive() external payable {}
    
    fallback() external payable {}
}