// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Atomically collects Base USDC and sends 90% to a creator and 10% to the platform treasury.
/// @dev Deploy specifically with the canonical Base USDC contract and the Crypto Sugar treasury.
contract BaseUsdcSplitter {
    IERC20 public immutable usdc;
    address public immutable treasury;
    mapping(bytes32 => bool) public settledQuotes;
    uint256 private locked = 1;

    event PaymentSplit(bytes32 indexed quoteId, address indexed payer, address indexed creator, uint256 grossAmount, uint256 creatorAmount, uint256 platformAmount);

    constructor(address usdcAddress, address treasuryAddress) {
        require(usdcAddress != address(0) && treasuryAddress != address(0), "zero address");
        usdc = IERC20(usdcAddress);
        treasury = treasuryAddress;
    }

    function payAndSplit(bytes32 quoteId, address creator, uint256 grossAmount) external {
        require(locked == 1, "reentrant");
        require(!settledQuotes[quoteId], "quote settled");
        require(creator != address(0) && grossAmount > 0, "invalid payment");
        locked = 2;
        settledQuotes[quoteId] = true;

        uint256 platformAmount = (grossAmount + 5) / 10;
        uint256 creatorAmount = grossAmount - platformAmount;
        require(usdc.transferFrom(msg.sender, address(this), grossAmount), "collection failed");
        require(usdc.transfer(creator, creatorAmount), "creator transfer failed");
        require(usdc.transfer(treasury, platformAmount), "treasury transfer failed");

        locked = 1;
        emit PaymentSplit(quoteId, msg.sender, creator, grossAmount, creatorAmount, platformAmount);
    }
}

