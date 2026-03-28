// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockUSDC - Test stablecoin with EIP-2612 Permit support
/// @notice Allows anyone to mint tokens for testing on Monad Testnet
contract MockUSDC is ERC20, ERC20Permit {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USDC", "mUSDC") ERC20Permit("Mock USDC") {}

    /// @notice Mint tokens to the caller (faucet function)
    /// @param amount The amount of tokens to mint (in smallest unit)
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Mint tokens to a specific address
    /// @param to The address to mint tokens to
    /// @param amount The amount of tokens to mint
    function mintTo(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}
