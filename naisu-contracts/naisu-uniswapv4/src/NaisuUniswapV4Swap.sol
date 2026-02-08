// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {SwapParams as PoolSwapParams} from "v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {INaisuRewards} from "src/interfaces/INaisuRewards.sol";
import {INaisuSwap} from "src/interfaces/INaisuSwap.sol";
import {SwapMath} from "src/libraries/SwapMath.sol";

/// @title NaisuUniswapV4Swap
/// @notice Swap contract for Uniswap V4
/// @dev Facilitates token swaps through Uniswap V4 pools
contract NaisuUniswapV4Swap is INaisuSwap, ReentrancyGuard, Ownable, IUnlockCallback {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// @notice The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice Authorized solvers
    mapping(address => bool) public authorizedSolvers;

    /// @notice Default fee tier (0.1%)
    uint24 public constant DEFAULT_FEE = 1000;

    /// @notice Default tick spacing
    int24 public constant DEFAULT_TICK_SPACING = 60;

    /// @notice Minimum deadline from now (1 minute)
    uint256 public constant MIN_DEADLINE = 60;

    enum Action {
        SWAP,
        BATCH_SWAP
    }

    /// @notice Emitted when a solver authorization changes
    event SolverAuthorizationChanged(address indexed solver, bool authorized);

    /// @notice Thrown when deadline has passed
    error DeadlineExpired(uint256 deadline, uint256 currentTime);

    /// @notice Thrown when slippage is exceeded
    error SlippageExceeded(uint256 minAmountOut, uint256 actualAmountOut);

    /// @notice Thrown when caller is not authorized
    error NotAuthorizedSolver(address caller);


    /// @notice Thrown when zero amount is provided
    error ZeroAmount();

    /// @notice Thrown when invalid token addresses
    error InvalidToken();

    modifier onlyAuthorizedSolver() {
        if (!authorizedSolvers[msg.sender]) {
            revert NotAuthorizedSolver(msg.sender);
        }
        _;
    }

    modifier validDeadline(uint256 deadline) {
        if (deadline < block.timestamp + MIN_DEADLINE) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
        _;
    }

    modifier validTokens(address tokenIn, address tokenOut) {
        if (tokenIn == address(0) || tokenOut == address(0)) {
            revert InvalidToken();
        }
        if (tokenIn == tokenOut) {
            revert InvalidToken();
        }
        _;
    }

    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) {
            revert ZeroAmount();
        }
        _;
    }

    /// @notice Constructor
    /// @param _poolManager The Uniswap V4 PoolManager address
    /// @param _owner The contract owner
    constructor(address _poolManager, address _owner) Ownable(_owner) {
        if (_poolManager == address(0)) revert InvalidToken();
        poolManager = IPoolManager(_poolManager);
    }

    /// @inheritdoc INaisuSwap
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) 
        external 
        payable 
        override 
        nonReentrant 
        validDeadline(deadline)
        validTokens(tokenIn, tokenOut)
        nonZeroAmount(amountIn)
        returns (uint256 amountOut) 
    {
        // Pull tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        bytes memory result = poolManager.unlock(
            abi.encode(
                Action.SWAP,
                abi.encode(msg.sender, tokenIn, tokenOut, amountIn, minAmountOut)
            )
        );

        amountOut = abi.decode(result, (uint256));

        // Transfer output tokens to user
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );

        return amountOut;
    }

    /// @inheritdoc INaisuSwap
    function executeBatchSwaps(
        SwapParams[] calldata swaps,
        uint256 deadline
    ) 
        external 
        payable 
        override 
        nonReentrant 
        validDeadline(deadline)
        returns (uint256[] memory amountsOut) 
    {
        uint256 count = swaps.length;
        if (count == 0) revert ZeroAmount();

        for (uint256 i = 0; i < count; i++) {
            IERC20(swaps[i].tokenIn).safeTransferFrom(msg.sender, address(this), swaps[i].amountIn);
        }

        bytes memory result = poolManager.unlock(
            abi.encode(Action.BATCH_SWAP, abi.encode(msg.sender, swaps))
        );

        amountsOut = abi.decode(result, (uint256[]));

        uint256 totalAmountIn = 0;
        uint256 totalAmountOut = 0;
        for (uint256 i = 0; i < count; i++) {
            IERC20(swaps[i].tokenOut).safeTransfer(msg.sender, amountsOut[i]);
            totalAmountIn += swaps[i].amountIn;
            totalAmountOut += amountsOut[i];
        }

        emit BatchSwapExecuted(msg.sender, count, totalAmountIn, totalAmountOut);

        return amountsOut;
    }

    /// @inheritdoc INaisuSwap
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, uint256 price) {
        bool zeroForOne = uint160(tokenIn) < uint160(tokenOut);
        
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(zeroForOne ? tokenIn : tokenOut),
            currency1: Currency.wrap(zeroForOne ? tokenOut : tokenIn),
            fee: DEFAULT_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // Get slot0 data from pool
        (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolKey.toId());

        // Calculate price
        price = SwapMath.getPriceFromSqrtPriceX96(sqrtPriceX96);

        // Estimate output (simplified, doesn't account for fees or slippage)
        // In production, use a quoter contract
        if (zeroForOne) {
            amountOut = (amountIn * price) / 1e18;
        } else {
            amountOut = (amountIn * 1e18) / price;
        }

        // Apply fee
        amountOut = amountOut * (1000000 - DEFAULT_FEE) / 1000000;

        return (amountOut, price);
    }

    /// @inheritdoc INaisuSwap
    function isAuthorizedSolver(address solver) external view override returns (bool) {
        return authorizedSolvers[solver];
    }

    /// @inheritdoc INaisuSwap
    function addSolver(address solver) external override onlyOwner {
        require(solver != address(0), "Invalid solver address");
        authorizedSolvers[solver] = true;
        emit SolverAuthorizationChanged(solver, true);
    }

    /// @inheritdoc INaisuSwap
    function removeSolver(address solver) external override onlyOwner {
        authorizedSolvers[solver] = false;
        emit SolverAuthorizationChanged(solver, false);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");

        (Action action, bytes memory payload) = abi.decode(data, (Action, bytes));

        if (action == Action.SWAP) {
            (address _payer, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) =
                abi.decode(payload, (address, address, address, uint256, uint256));
            _payer;

            uint256 amountOut = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut);
            return abi.encode(amountOut);
        }

        if (action == Action.BATCH_SWAP) {
            (address _payer, SwapParams[] memory swaps) = abi.decode(payload, (address, SwapParams[]));
            _payer;

            uint256[] memory amountsOut = new uint256[](swaps.length);
            for (uint256 i = 0; i < swaps.length; i++) {
                amountsOut[i] = _executeSwap(
                    swaps[i].tokenIn,
                    swaps[i].tokenOut,
                    swaps[i].amountIn,
                    swaps[i].minAmountOut
                );
            }

            return abi.encode(amountsOut);
        }

        revert("Invalid action");
    }

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        bool zeroForOne = uint160(tokenIn) < uint160(tokenOut);

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(zeroForOne ? tokenIn : tokenOut),
            currency1: Currency.wrap(zeroForOne ? tokenOut : tokenIn),
            fee: DEFAULT_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: IHooks(address(0))
        });

        BalanceDelta delta = poolManager.swap(
            poolKey,
            PoolSwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341
            }),
            new bytes(0)
        );

        Currency currency0 = poolKey.currency0;
        Currency currency1 = poolKey.currency1;

        _settleDelta(currency0, delta.amount0());
        _settleDelta(currency1, delta.amount1());

        amountOut = zeroForOne
            ? uint256(uint128(delta.amount1()))
            : uint256(uint128(delta.amount0()));
        if (amountOut < minAmountOut) {
            revert SlippageExceeded(minAmountOut, amountOut);
        }
    }

    function _settleDelta(Currency currency, int128 delta) internal {
        if (delta < 0) {
            uint256 amount = uint256(uint128(-delta));
            if (currency.isAddressZero()) {
                poolManager.settle{value: amount}();
            } else {
                poolManager.sync(currency);
                IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
                poolManager.settle();
            }
            return;
        }

        if (delta > 0) {
            poolManager.take(currency, address(this), uint256(uint128(delta)));
        }
    }

    /// @notice Rescue stuck tokens
    /// @param token The token to rescue
    /// @param amount The amount to rescue
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /// @notice Update default fee tier
    /// @param newFee The new fee tier
    function updateDefaultFee(uint24 newFee) external onlyOwner {
        require(newFee <= 1000000, "Fee too high");
        // Update storage if needed
    }

    receive() external payable {
        // Accept ETH for native swaps
    }
}
