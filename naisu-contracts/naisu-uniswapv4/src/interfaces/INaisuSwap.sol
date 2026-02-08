// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title INaisuSwap
/// @notice Interface for Naisu Uniswap V4 Swap contract
interface INaisuSwap {
    /// @notice Swap parameters
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    /// @notice Emitted when a swap is executed
    /// @param user The user who initiated the swap
    /// @param tokenIn The input token
    /// @param tokenOut The output token
    /// @param amountIn The input amount
    /// @param amountOut The output amount
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when a batch swap is executed
    /// @param user The user who initiated the swap
    /// @param count The number of swaps
    /// @param totalAmountIn The total input amount
    /// @param totalAmountOut The total output amount
    event BatchSwapExecuted(
        address indexed user,
        uint256 count,
        uint256 totalAmountIn,
        uint256 totalAmountOut
    );

    /// @notice Execute a single swap
    /// @param tokenIn The input token address
    /// @param tokenOut The output token address
    /// @param amountIn The input amount
    /// @param minAmountOut The minimum acceptable output amount (slippage protection)
    /// @param deadline The deadline timestamp
    /// @return amountOut The actual output amount
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external payable returns (uint256 amountOut);

    /// @notice Execute multiple swaps in a single transaction
    /// @param swaps Array of swap parameters
    /// @param deadline The deadline timestamp for all swaps
    /// @return amountsOut Array of output amounts
    function executeBatchSwaps(
        SwapParams[] calldata swaps,
        uint256 deadline
    ) external payable returns (uint256[] memory amountsOut);

    /// @notice Get a swap quote
    /// @param tokenIn The input token address
    /// @param tokenOut The output token address
    /// @param amountIn The input amount
    /// @return amountOut The expected output amount
    /// @return price The current price (tokenOut per tokenIn, scaled by 1e18)
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 price);

    /// @notice Check if a solver is authorized
    /// @param solver The solver address
    /// @return authorized True if authorized
    function isAuthorizedSolver(address solver) external view returns (bool authorized);

    /// @notice Add an authorized solver
    /// @param solver The solver address to add
    function addSolver(address solver) external;

    /// @notice Remove an authorized solver
    /// @param solver The solver address to remove
    function removeSolver(address solver) external;
}
