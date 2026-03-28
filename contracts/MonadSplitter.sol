// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MonadSplitter - Roulette-based bill settlement on Monad
/// @notice Uses EIP-2612 permits for gasless approval + payment execution
contract MonadSplitter {
    IERC20 public token;

    event PaymentExecuted(
        address indexed loser,
        address indexed host,
        uint256 amount
    );

    constructor(address _token) {
        token = IERC20(_token);
    }

    /// @notice Execute payment using a pre-signed EIP-2612 permit
    /// @param loser The address of the person who lost the roulette
    /// @param host The address of the host who receives the payment
    /// @param amount The amount of tokens to transfer
    /// @param deadline The deadline for the permit signature
    /// @param v The v component of the permit signature
    /// @param r The r component of the permit signature
    /// @param s The s component of the permit signature
    function executePayment(
        address loser,
        address host,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Use the permit to approve this contract to spend loser's tokens
        IERC20Permit(address(token)).permit(
            loser,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        // Transfer tokens from loser to host
        require(
            token.transferFrom(loser, host, amount),
            "Transfer failed"
        );

        emit PaymentExecuted(loser, host, amount);
    }
}
