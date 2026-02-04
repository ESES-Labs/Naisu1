// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title NaisuIntentHook
/// @notice Uniswap V4 Hook that captures swap intents for cross-chain yield migration to Sui
/// @dev This hook triggers on afterSwap to capture USDC for bridging to Sui DeFi
contract NaisuIntentHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct Intent {
        address user;
        bytes32 suiDestination;
        address inputToken;
        uint256 inputAmount;
        uint256 usdcAmount;
        uint8 strategyId;
        IntentStatus status;
        uint256 createdAt;
    }

    enum IntentStatus {
        Pending,
        SwapCompleted,
        Bridging,
        Completed,
        Failed,
        Cancelled
    }

    // ============ Events ============

    event IntentCreated(
        bytes32 indexed intentId,
        address indexed user,
        bytes32 suiDestination,
        address inputToken,
        uint256 inputAmount,
        uint256 usdcAmount,
        uint8 strategyId,
        uint256 timestamp
    );

    event IntentBridgeInitiated(
        bytes32 indexed intentId,
        bytes32 lifiTransactionId
    );

    event IntentCompleted(
        bytes32 indexed intentId,
        bytes32 suiTxDigest
    );

    event IntentFailed(
        bytes32 indexed intentId,
        string reason
    );

    // ============ State ============

    /// @notice USDC token address on this chain
    address public immutable usdc;

    /// @notice Li.Fi bridge contract address
    address public liFiBridge;

    /// @notice Mapping from intent ID to intent data
    mapping(bytes32 => Intent) public intents;

    /// @notice Counter for generating unique intent IDs
    uint256 public nextIntentNonce;

    /// @notice Mapping to track pending intents per user
    mapping(address => bytes32[]) public userIntents;

    /// @notice Temporary storage for swap context
    mapping(address => SwapContext) private _swapContexts;

    struct SwapContext {
        bytes32 suiDestination;
        uint8 strategyId;
        address user;
        bool hasIntent;
    }

    // ============ Constructor ============

    constructor(
        IPoolManager _poolManager,
        address _usdc,
        address _liFiBridge
    ) BaseHook(_poolManager) {
        usdc = _usdc;
        liFiBridge = _liFiBridge;
    }

    // ============ Hook Configuration ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,  // We need beforeSwap to capture intent data
            afterSwap: true,   // We need afterSwap to process the intent
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ User Functions ============

    /// @notice Set intent data before performing a swap (Legacy/Direct interaction)
    /// @param suiDestination The user's Sui wallet address (as bytes32)
    /// @param strategyId The yield strategy ID on Sui
    function setIntentData(bytes32 suiDestination, uint8 strategyId) external {
        require(suiDestination != bytes32(0), "Invalid Sui destination");
        require(strategyId > 0 && strategyId <= 4, "Invalid strategy ID");

        _swapContexts[msg.sender] = SwapContext({
            suiDestination: suiDestination,
            strategyId: strategyId,
            user: msg.sender,
            hasIntent: true
        });
    }

    /// @notice Clear pending intent data
    function clearIntentData() external {
        delete _swapContexts[msg.sender];
    }

    /// @notice Get user's intents
    function getUserIntents(address user) external view returns (bytes32[] memory) {
        return userIntents[user];
    }

    /// @notice Get intent details
    function getIntent(bytes32 intentId) external view returns (Intent memory) {
        return intents[intentId];
    }

    // ============ Hook Callbacks ============

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Check if there's intent data from hookData or stored context
        if (hookData.length > 0) {
            // Updated decoding to include user address
            if (hookData.length == 32 + 32 + 32) { // minimal check for length (bytes32 + uint8 padded + address padded) or similar
                 (bytes32 suiDest, uint8 strategyId, address user) = abi.decode(hookData, (bytes32, uint8, address));
                 _swapContexts[sender] = SwapContext({
                    suiDestination: suiDest,
                    strategyId: strategyId,
                    user: user,
                    hasIntent: true
                });
            } else {
                 // Fallback for old format or direct calls (optional, but good for backward compat if needed)
                 // For now, let's enforce passing the user address if we rely on it.
                 // But strictly, abi.decode matches types.
                 // If decoding fails, it reverts.
                 try this.decodeHookData(hookData) returns (bytes32 s, uint8 id, address u) {
                     _swapContexts[sender] = SwapContext({
                        suiDestination: s,
                        strategyId: id,
                        user: u,
                        hasIntent: true
                    });
                 } catch {
                     // Try decoding without user (legacy)
                     (bytes32 suiDest, uint8 strategyId) = abi.decode(hookData, (bytes32, uint8));
                     _swapContexts[sender] = SwapContext({
                        suiDestination: suiDest,
                        strategyId: strategyId,
                        user: sender, // Fallback to sender (Router)
                        hasIntent: true
                    });
                 }
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // Helper to decode avoiding try/catch complexity inside hook if possible, 
    // but try/catch block above is fine or we just standardise on one format.
    // Let's standardise on one format for simplicity: (bytes32, uint8, address)
    // But since I can't use `try` with internal functions easily or `abi.decode` doesn't throw clean errors for `try`,
    // I'll just check data length.
    // 32 bytes (bytes32) + 32 bytes (uint8 padded) + 32 bytes (address padded) = 96 bytes.
    // Previous: 32 + 32 = 64 bytes.

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        SwapContext memory ctx = _swapContexts[sender];

        // Only process if user has set intent data
        if (!ctx.hasIntent) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // Check if the output is USDC
        address outputToken = params.zeroForOne
            ? Currency.unwrap(key.currency1)
            : Currency.unwrap(key.currency0);

        if (outputToken != usdc) {
            // Not swapping to USDC, skip
            delete _swapContexts[sender];
            return (BaseHook.afterSwap.selector, 0);
        }

        // Calculate amounts
        address inputToken = params.zeroForOne
            ? Currency.unwrap(key.currency0)
            : Currency.unwrap(key.currency1);

        int256 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        int256 outputDelta = params.zeroForOne ? delta.amount1() : delta.amount0();

        uint256 inputAmount = inputDelta > 0 ? uint256(inputDelta) : uint256(-inputDelta);
        uint256 usdcAmount = outputDelta > 0 ? uint256(outputDelta) : uint256(-outputDelta);

        // Generate intent ID
        // Use ctx.user instead of sender for ID generation to ensure uniqueness per user
        bytes32 intentId = keccak256(abi.encodePacked(
            ctx.user,
            ctx.suiDestination,
            block.timestamp,
            nextIntentNonce++
        ));

        // Create intent
        intents[intentId] = Intent({
            user: ctx.user,
            suiDestination: ctx.suiDestination,
            inputToken: inputToken,
            inputAmount: inputAmount,
            usdcAmount: usdcAmount,
            strategyId: ctx.strategyId,
            status: IntentStatus.SwapCompleted,
            createdAt: block.timestamp
        });

        userIntents[ctx.user].push(intentId);

        // Emit event for the agent to pick up
        emit IntentCreated(
            intentId,
            ctx.user,
            ctx.suiDestination,
            inputToken,
            inputAmount,
            usdcAmount,
            ctx.strategyId,
            block.timestamp
        );

        // Clear context
        delete _swapContexts[sender];

        return (BaseHook.afterSwap.selector, 0);
    }
    
    // Public helper for decoding (to support the try/catch usage above if strict, but simpler logic is better)
    function decodeHookData(bytes calldata data) external pure returns (bytes32, uint8, address) {
        return abi.decode(data, (bytes32, uint8, address));
    }

    // ============ Agent Functions ============

    /// @notice Called by agent to initiate bridge after swap
    /// @dev Agent must approve USDC to Li.Fi bridge before calling
    function initiateBridge(bytes32 intentId, bytes32 lifiTxId) external {
        Intent storage intent = intents[intentId];
        require(intent.status == IntentStatus.SwapCompleted, "Invalid status");

        intent.status = IntentStatus.Bridging;

        emit IntentBridgeInitiated(intentId, lifiTxId);
    }

    /// @notice Called by agent when bridge and Sui deposit are complete
    function markCompleted(bytes32 intentId, bytes32 suiTxDigest) external {
        Intent storage intent = intents[intentId];
        require(intent.status == IntentStatus.Bridging, "Invalid status");

        intent.status = IntentStatus.Completed;

        emit IntentCompleted(intentId, suiTxDigest);
    }

    /// @notice Called by agent if intent fails
    function markFailed(bytes32 intentId, string calldata reason) external {
        Intent storage intent = intents[intentId];
        require(
            intent.status == IntentStatus.SwapCompleted ||
            intent.status == IntentStatus.Bridging,
            "Invalid status"
        );

        intent.status = IntentStatus.Failed;

        emit IntentFailed(intentId, reason);
    }

    // ============ Admin Functions ============

    /// @notice Update Li.Fi bridge address
    function setLiFiBridge(address _liFiBridge) external {
        // TODO: Add access control
        liFiBridge = _liFiBridge;
    }
}
