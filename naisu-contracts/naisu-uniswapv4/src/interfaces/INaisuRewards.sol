// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title INaisuRewards
/// @notice Interface for Naisu Uniswap V4 liquidity and fee collection contract
interface INaisuRewards {
    /// @notice LP position structure
    struct Position {
        bytes32 poolId;
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @notice Pool information structure
    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
    }

    /// @notice Emitted when liquidity is added
    /// @param user The user who added liquidity
    /// @param poolId The pool ID
    /// @param liquidity The amount of liquidity added
    /// @param amount0 The amount of token0 added
    /// @param amount1 The amount of token1 added
    event LiquidityAdded(
        address indexed user,
        bytes32 indexed poolId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    /// @notice Emitted when liquidity is removed
    /// @param user The user who removed liquidity
    /// @param poolId The pool ID
    /// @param liquidity The amount of liquidity removed
    /// @param amount0 The amount of token0 removed
    /// @param amount1 The amount of token1 removed
    event LiquidityRemoved(
        address indexed user,
        bytes32 indexed poolId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    /// @notice Emitted when fees are collected
    /// @param user The user who collected fees
    /// @param poolId The pool ID
    /// @param amount0 The amount of token0 collected
    /// @param amount1 The amount of token1 collected
    event FeesCollected(
        address indexed user,
        bytes32 indexed poolId,
        uint256 amount0,
        uint256 amount1
    );

    /// @notice Add liquidity to a pool
    /// @param token0 The first token address
    /// @param token1 The second token address
    /// @param amount0 The amount of token0 to add
    /// @param amount1 The amount of token1 to add
    /// @param tickLower The lower tick boundary
    /// @param tickUpper The upper tick boundary
    /// @param minLiquidity The minimum acceptable liquidity (slippage protection)
    /// @return liquidity The amount of liquidity added
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 tickLower,
        int24 tickUpper,
        uint128 minLiquidity
    ) external returns (uint128 liquidity);

    /// @notice Remove liquidity from a pool
    /// @param poolId The pool ID
    /// @param liquidity The amount of liquidity to remove
    /// @param amount0Min The minimum acceptable amount0 (slippage protection)
    /// @param amount1Min The minimum acceptable amount1 (slippage protection)
    /// @return amount0 The amount of token0 removed
    /// @return amount1 The amount of token1 removed
    function removeLiquidity(
        bytes32 poolId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Collect accrued fees for a position
    /// @param poolId The pool ID
    /// @return amount0 The amount of token0 collected
    /// @return amount1 The amount of token1 collected
    function collectFees(
        bytes32 poolId
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Get user's LP position
    /// @param user The user address
    /// @param poolId The pool ID
    /// @return position The user's position
    function getUserPosition(
        address user,
        bytes32 poolId
    ) external view returns (Position memory position);

    /// @notice Get pool information
    /// @param poolId The pool ID
    /// @return info The pool information
    function getPoolInfo(
        bytes32 poolId
    ) external view returns (PoolInfo memory info);
}
