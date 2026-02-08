// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FullMath} from "v4-core/src/libraries/FullMath.sol";

/// @title SwapMath
/// @notice Math utilities for swap calculations
library SwapMath {
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant Q192 = 2 ** 192;

    /// @notice Calculate the output amount for a swap
    /// @param sqrtPriceX96 The current sqrt price (X96 format)
    /// @param liquidity The pool liquidity
    /// @param amountIn The input amount
    /// @param zeroForOne Whether token0 is being swapped for token1
    /// @return amountOut The expected output amount
    function calculateSwapOutput(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amountIn,
        bool zeroForOne
    ) internal pure returns (uint256 amountOut) {
        liquidity;
        if (zeroForOne) {
            // token0 -> token1
            uint256 priceX96 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), Q96);
            amountOut = (amountIn * priceX96) / Q96;
        } else {
            // token1 -> token0
            uint256 priceX96 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), Q96);
            amountOut = (amountIn * Q96) / priceX96;
        }
    }

    /// @notice Calculate price from sqrtPriceX96
    /// @param sqrtPriceX96 The sqrt price in X96 format
    /// @return price The price scaled by 1e18
    function getPriceFromSqrtPriceX96(
        uint160 sqrtPriceX96
    ) internal pure returns (uint256 price) {
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        uint256 ratioX192 = FullMath.mulDiv(sqrtPrice, sqrtPrice, 1);
        price = FullMath.mulDiv(ratioX192, 1e18, Q192);
    }

    /// @notice Calculate minimum output with slippage protection
    /// @param amountOut The expected output amount
    /// @param slippageBps The slippage tolerance in basis points (e.g., 50 = 0.5%)
    /// @return minAmountOut The minimum acceptable output
    function applySlippage(
        uint256 amountOut,
        uint16 slippageBps
    ) internal pure returns (uint256 minAmountOut) {
        require(slippageBps <= 10000, "Slippage too high");
        minAmountOut = amountOut * (10000 - slippageBps) / 10000;
    }

    /// @notice Calculate liquidity amount for given token amounts
    /// @param sqrtPriceX96 The current sqrt price
    /// @param sqrtPriceLowerX96 The lower price boundary
    /// @param sqrtPriceUpperX96 The upper price boundary
    /// @param amount0 The amount of token0
    /// @param amount1 The amount of token1
    /// @return liquidity The calculated liquidity
    function getLiquidityForAmounts(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceX96 <= sqrtPriceLowerX96) {
            // Current price is below the range, use amount0
            uint256 numerator = FullMath.mulDiv(amount0, uint256(sqrtPriceLowerX96), Q96);
            uint256 rawLiquidity = FullMath.mulDiv(
                numerator,
                uint256(sqrtPriceUpperX96),
                uint256(sqrtPriceUpperX96) - uint256(sqrtPriceLowerX96)
            );
            liquidity = _toUint128(rawLiquidity);
        } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
            // Current price is within the range, use both amounts
            uint256 numerator0 = FullMath.mulDiv(amount0, uint256(sqrtPriceX96), Q96);
            uint256 rawLiquidity0 = FullMath.mulDiv(
                numerator0,
                uint256(sqrtPriceUpperX96),
                uint256(sqrtPriceUpperX96) - uint256(sqrtPriceX96)
            );
            uint256 rawLiquidity1 = FullMath.mulDiv(
                amount1,
                Q96,
                uint256(sqrtPriceX96) - uint256(sqrtPriceLowerX96)
            );
            liquidity = _toUint128(rawLiquidity0 < rawLiquidity1 ? rawLiquidity0 : rawLiquidity1);
        } else {
            // Current price is above the range, use amount1
            uint256 rawLiquidity = FullMath.mulDiv(
                amount1,
                Q96,
                uint256(sqrtPriceUpperX96) - uint256(sqrtPriceLowerX96)
            );
            liquidity = _toUint128(rawLiquidity);
        }
    }

    function _toUint128(uint256 value) private pure returns (uint128) {
        if (value > type(uint128).max) return type(uint128).max;
        return uint128(value);
    }

    /// @notice Calculate token amounts for given liquidity
    /// @param sqrtPriceX96 The current sqrt price
    /// @param sqrtPriceLowerX96 The lower price boundary
    /// @param sqrtPriceUpperX96 The upper price boundary
    /// @param liquidity The liquidity amount
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        if (sqrtPriceX96 <= sqrtPriceLowerX96) {
            amount0 = uint256(liquidity) * Q96 * (uint256(sqrtPriceUpperX96) - uint256(sqrtPriceLowerX96)) /
                      (uint256(sqrtPriceLowerX96) * uint256(sqrtPriceUpperX96));
            amount1 = 0;
        } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
            amount0 = uint256(liquidity) * Q96 * (uint256(sqrtPriceUpperX96) - uint256(sqrtPriceX96)) /
                      (uint256(sqrtPriceX96) * uint256(sqrtPriceUpperX96));
            amount1 = uint256(liquidity) * (uint256(sqrtPriceX96) - uint256(sqrtPriceLowerX96)) / Q96;
        } else {
            amount0 = 0;
            amount1 = uint256(liquidity) * (uint256(sqrtPriceUpperX96) - uint256(sqrtPriceLowerX96)) / Q96;
        }
    }
}
