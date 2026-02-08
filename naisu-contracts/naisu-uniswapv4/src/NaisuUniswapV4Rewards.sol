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
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

import {INaisuRewards} from "src/interfaces/INaisuRewards.sol";
import {SwapMath} from "src/libraries/SwapMath.sol";

/// @title NaisuUniswapV4Rewards
/// @notice Liquidity provision and fee collection contract for Uniswap V4
/// @dev Enables users to add/remove liquidity and collect accrued fees
contract NaisuUniswapV4Rewards is INaisuRewards, ReentrancyGuard, Ownable, IUnlockCallback {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// @notice The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice User positions: user => poolId => Position
    mapping(address => mapping(bytes32 => PositionInfo)) public userPositions;

    /// @notice Pool information: poolId => PoolInfo
    mapping(bytes32 => PoolInfo) public poolInfo;

    /// @notice Authorized solvers
    mapping(address => bool) public authorizedSolvers;

    /// @notice Position info structure
    struct PositionInfo {
        bytes32 poolId;
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @notice Default fee tier (0.1%)
    uint24 public constant DEFAULT_FEE = 1000;

    /// @notice Default tick spacing
    int24 public constant DEFAULT_TICK_SPACING = 60;

    /// @notice Full range tick boundaries
    int24 public constant MIN_TICK = -887220;
    int24 public constant MAX_TICK = 887220;

    enum Action {
        ADD,
        REMOVE,
        COLLECT
    }

    /// @notice Emitted when a solver authorization changes
    event SolverAuthorizationChanged(address indexed solver, bool authorized);


    /// @notice Thrown when position is not found
    error PositionNotFound(address user, bytes32 poolId);

    /// @notice Thrown when insufficient liquidity
    error InsufficientLiquidity(uint128 requested, uint128 available);

    /// @notice Thrown when slippage is exceeded
    error SlippageExceeded(uint256 minimum, uint256 actual);

    /// @notice Thrown when caller is not authorized
    error NotAuthorizedSolver(address caller);


    /// @notice Thrown when pool does not exist
    error PoolNotFound(bytes32 poolId);

    modifier onlyAuthorizedSolver() {
        if (!authorizedSolvers[msg.sender]) {
            revert NotAuthorizedSolver(msg.sender);
        }
        _;
    }


    /// @notice Constructor
    /// @param _poolManager The Uniswap V4 PoolManager address
    /// @param _owner The contract owner
    constructor(address _poolManager, address _owner) Ownable(_owner) {
        require(_poolManager != address(0), "Invalid PoolManager");
        poolManager = IPoolManager(_poolManager);
    }

    /// @inheritdoc INaisuRewards
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 tickLower,
        int24 tickUpper,
        uint128 minLiquidity
    ) 
        external 
        override 
        nonReentrant 
        returns (uint128 liquidity) 
    {
        require(token0 < token1, "Invalid token order");
        require(amount0 > 0 || amount1 > 0, "Zero amounts");
        require(tickLower < tickUpper, "Invalid tick range");
        require(tickLower >= MIN_TICK && tickUpper <= MAX_TICK, "Ticks out of bounds");

        // Create pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: DEFAULT_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: IHooks(address(0))
        });

        PoolId poolId = poolKey.toId();
        bytes32 poolIdBytes = PoolId.unwrap(poolId);

        // Transfer tokens from user
        if (amount0 > 0) {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
            IERC20(token0).approve(address(poolManager), amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
            IERC20(token1).approve(address(poolManager), amount1);
        }

        // Get current sqrt price
        (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolId);

        // Calculate liquidity
        liquidity = SwapMath.getLiquidityForAmounts(
            sqrtPriceX96,
            uint160(getSqrtRatioAtTick(tickLower)),
            uint160(getSqrtRatioAtTick(tickUpper)),
            amount0,
            amount1
        );

        require(liquidity >= minLiquidity, "Insufficient liquidity");

        poolManager.unlock(
            abi.encode(
                Action.ADD,
                abi.encode(msg.sender, poolKey, tickLower, tickUpper, liquidity)
            )
        );

        // Update user position
        PositionInfo storage position = userPositions[msg.sender][poolIdBytes];

        if (position.liquidity == 0) {
            // New position
            position.poolId = poolIdBytes;
            position.tickLower = tickLower;
            position.tickUpper = tickUpper;
        }
        
        position.liquidity += liquidity;
        // Initialize pool info if new
        if (poolInfo[poolIdBytes].token0 == address(0)) {
            poolInfo[poolIdBytes] = PoolInfo({
                token0: token0,
                token1: token1,
                fee: DEFAULT_FEE,
                tickSpacing: DEFAULT_TICK_SPACING
            });
        }

        emit LiquidityAdded(
            msg.sender,
            poolIdBytes,
            liquidity,
            amount0,
            amount1
        );

        return liquidity;
    }

    /// @inheritdoc INaisuRewards
    function removeLiquidity(
        bytes32 poolId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) 
        external 
        override 
        nonReentrant 
        returns (uint256 amount0, uint256 amount1) 
    {
        PositionInfo storage position = userPositions[msg.sender][poolId];
        
        if (position.liquidity == 0) {
            revert PositionNotFound(msg.sender, poolId);
        }
        
        if (liquidity > position.liquidity) {
            revert InsufficientLiquidity(liquidity, position.liquidity);
        }

        PoolInfo memory info = poolInfo[poolId];
        if (info.token0 == address(0)) {
            revert PoolNotFound(poolId);
        }

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(info.token0),
            currency1: Currency.wrap(info.token1),
            fee: info.fee,
            tickSpacing: info.tickSpacing,
            hooks: IHooks(address(0))
        });

        bytes memory result = poolManager.unlock(
            abi.encode(
                Action.REMOVE,
                abi.encode(msg.sender, poolKey, position.tickLower, position.tickUpper, liquidity)
            )
        );

        (amount0, amount1) = abi.decode(result, (uint256, uint256));

        // Check slippage
        if (amount0 < amount0Min || amount1 < amount1Min) {
            revert SlippageExceeded(
                amount0 < amount0Min ? amount0Min : amount1Min,
                amount0 < amount0Min ? amount0 : amount1
            );
        }

        // Update position
        position.liquidity -= liquidity;
        // Transfer tokens back to user
        if (amount0 > 0) {
            IERC20(info.token0).safeTransfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            IERC20(info.token1).safeTransfer(msg.sender, amount1);
        }

        emit LiquidityRemoved(
            msg.sender,
            poolId,
            liquidity,
            amount0,
            amount1
        );

        return (amount0, amount1);
    }

    /// @inheritdoc INaisuRewards
    function collectFees(
        bytes32 poolId
    ) external override nonReentrant returns (uint256 amount0, uint256 amount1) {
        PositionInfo storage position = userPositions[msg.sender][poolId];
        if (position.liquidity == 0) {
            revert PositionNotFound(msg.sender, poolId);
        }

        PoolInfo memory info = poolInfo[poolId];
        if (info.token0 == address(0)) {
            revert PoolNotFound(poolId);
        }

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(info.token0),
            currency1: Currency.wrap(info.token1),
            fee: info.fee,
            tickSpacing: info.tickSpacing,
            hooks: IHooks(address(0))
        });

        bytes memory result = poolManager.unlock(
            abi.encode(
                Action.COLLECT,
                abi.encode(msg.sender, poolKey, position.tickLower, position.tickUpper)
            )
        );

        (amount0, amount1) = abi.decode(result, (uint256, uint256));

        if (amount0 > 0) {
            IERC20(info.token0).safeTransfer(msg.sender, amount0);
        }
        if (amount1 > 0) {
            IERC20(info.token1).safeTransfer(msg.sender, amount1);
        }

        emit FeesCollected(msg.sender, poolId, amount0, amount1);
    }

    /// @inheritdoc INaisuRewards
    function getUserPosition(
        address user,
        bytes32 poolId
    ) external view override returns (Position memory) {
        PositionInfo storage pos = userPositions[user][poolId];

        return Position({
            poolId: pos.poolId,
            liquidity: pos.liquidity,
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper
        });
    }

    /// @inheritdoc INaisuRewards
    function getPoolInfo(
        bytes32 poolId
    ) external view override returns (PoolInfo memory info) {
        return poolInfo[poolId];
    }

    /// @notice Add an authorized solver
    /// @param solver The solver address to add
    function addSolver(address solver) external onlyOwner {
        require(solver != address(0), "Invalid solver address");
        authorizedSolvers[solver] = true;
        emit SolverAuthorizationChanged(solver, true);
    }

    /// @notice Remove an authorized solver
    /// @param solver The solver address to remove
    function removeSolver(address solver) external onlyOwner {
        authorizedSolvers[solver] = false;
        emit SolverAuthorizationChanged(solver, false);
    }


    /// @notice Get sqrt ratio at tick
    /// @param tick The tick value
    /// @return sqrtPriceX96 The sqrt price in X96 format
    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        return TickMath.getSqrtPriceAtTick(tick);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");

        (Action action, bytes memory payload) = abi.decode(data, (Action, bytes));

        if (action == Action.ADD) {
            (address _payer, PoolKey memory poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity) =
                abi.decode(payload, (address, PoolKey, int24, int24, uint128));
            _payer;

            (BalanceDelta callerDelta, BalanceDelta feesAccrued) = poolManager.modifyLiquidity(
                poolKey,
                ModifyLiquidityParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: int256(uint256(liquidity)),
                    salt: bytes32(0)
                }),
                new bytes(0)
            );

            _settleDelta(poolKey.currency0, callerDelta.amount0());
            _settleDelta(poolKey.currency1, callerDelta.amount1());
            _settleDelta(poolKey.currency0, feesAccrued.amount0());
            _settleDelta(poolKey.currency1, feesAccrued.amount1());

            return abi.encode(uint256(0));
        }

        if (action == Action.REMOVE) {
            (address _payer, PoolKey memory poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity) =
                abi.decode(payload, (address, PoolKey, int24, int24, uint128));
            _payer;

            (BalanceDelta callerDelta, BalanceDelta feesAccrued) = poolManager.modifyLiquidity(
                poolKey,
                ModifyLiquidityParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: -int256(uint256(liquidity)),
                    salt: bytes32(0)
                }),
                new bytes(0)
            );

            _settleDelta(poolKey.currency0, callerDelta.amount0());
            _settleDelta(poolKey.currency1, callerDelta.amount1());
            _settleDelta(poolKey.currency0, feesAccrued.amount0());
            _settleDelta(poolKey.currency1, feesAccrued.amount1());

            uint256 amount0 = callerDelta.amount0() > 0 ? uint256(uint128(callerDelta.amount0())) : 0;
            uint256 amount1 = callerDelta.amount1() > 0 ? uint256(uint128(callerDelta.amount1())) : 0;
            return abi.encode(amount0, amount1);
        }

        if (action == Action.COLLECT) {
            (address _payer, PoolKey memory poolKey, int24 tickLower, int24 tickUpper) =
                abi.decode(payload, (address, PoolKey, int24, int24));
            _payer;

            (, BalanceDelta feesAccrued) = poolManager.modifyLiquidity(
                poolKey,
                ModifyLiquidityParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: 0,
                    salt: bytes32(0)
                }),
                new bytes(0)
            );

            _settleDelta(poolKey.currency0, feesAccrued.amount0());
            _settleDelta(poolKey.currency1, feesAccrued.amount1());

            uint256 amount0 = feesAccrued.amount0() > 0 ? uint256(uint128(feesAccrued.amount0())) : 0;
            uint256 amount1 = feesAccrued.amount1() > 0 ? uint256(uint128(feesAccrued.amount1())) : 0;
            return abi.encode(amount0, amount1);
        }

        revert("Invalid action");
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

    receive() external payable {
        // Accept ETH
    }
}
