/// Naisu Automator - Sui module for automated yield deposits
///
/// This module receives bridged funds and automatically deposits them
/// into lending protocols like Scallop or Navi.
module naisu_automator::automator {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // ============ Structs ============

    /// Receipt token given to users after deposit
    public struct NaisuReceipt has key, store {
        id: UID,
        /// Original EVM intent ID
        intent_id: vector<u8>,
        /// User's Sui address
        user: address,
        /// Protocol where funds are deposited (1=Scallop, 2=Navi)
        protocol_id: u8,
        /// Strategy ID
        strategy_id: u8,
        /// Amount deposited
        amount: u64,
        /// Timestamp
        deposited_at: u64,
    }

    /// Admin capability
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Protocol configuration
    public struct ProtocolConfig has key {
        id: UID,
        /// Scallop market object ID
        scallop_market: address,
        /// Navi pool object ID
        navi_pool: address,
        /// Whether the automator is paused
        paused: bool,
    }

    // ============ Events ============

    public struct DepositExecuted has copy, drop {
        intent_id: vector<u8>,
        user: address,
        protocol_id: u8,
        strategy_id: u8,
        amount: u64,
    }

    public struct WithdrawalExecuted has copy, drop {
        receipt_id: address,
        user: address,
        amount: u64,
    }

    // ============ Errors ============

    const EInvalidStrategy: u64 = 1;
    const EPaused: u64 = 2;
    const ENotOwner: u64 = 3;
    const EInsufficientAmount: u64 = 4;

    // ============ Init ============

    fun init(ctx: &mut TxContext) {
        // Create admin cap
        let admin = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin, tx_context::sender(ctx));

        // Create protocol config
        let config = ProtocolConfig {
            id: object::new(ctx),
            scallop_market: @0x0,
            navi_pool: @0x0,
            paused: false,
        };
        transfer::share_object(config);
    }

    // ============ Public Functions ============

    /// Execute deposit for a cross-chain intent
    /// Called by the agent after bridge completes
    public entry fun execute_deposit<CoinType>(
        config: &ProtocolConfig,
        intent_id: vector<u8>,
        strategy_id: u8,
        coin: Coin<CoinType>,
        ctx: &mut TxContext,
    ) {
        assert!(!config.paused, EPaused);
        assert!(strategy_id >= 1 && strategy_id <= 4, EInvalidStrategy);

        let amount = coin::value(&coin);
        assert!(amount > 0, EInsufficientAmount);

        let user = tx_context::sender(ctx);
        let protocol_id = get_protocol_for_strategy(strategy_id);

        // In production, this would call the actual protocol
        // For MVP, we just hold the coins and issue a receipt

        // TODO: Integrate with actual Scallop/Navi
        // Example for Scallop:
        // scallop::lending::deposit(scallop_market, coin, ctx);

        // For now, transfer to this module's address (would be protocol in production)
        transfer::public_transfer(coin, @naisu_automator);

        // Create receipt
        let receipt = NaisuReceipt {
            id: object::new(ctx),
            intent_id,
            user,
            protocol_id,
            strategy_id,
            amount,
            deposited_at: tx_context::epoch(ctx),
        };

        // Emit event
        event::emit(DepositExecuted {
            intent_id,
            user,
            protocol_id,
            strategy_id,
            amount,
        });

        // Transfer receipt to user
        transfer::transfer(receipt, user);
    }

    /// Withdraw funds using receipt
    public entry fun withdraw<CoinType>(
        _config: &ProtocolConfig,
        receipt: NaisuReceipt,
        ctx: &mut TxContext,
    ) {
        let NaisuReceipt {
            id,
            intent_id: _,
            user,
            protocol_id: _,
            strategy_id: _,
            amount,
            deposited_at: _,
        } = receipt;

        assert!(user == tx_context::sender(ctx), ENotOwner);

        // In production, withdraw from protocol
        // For MVP, we would transfer back from held funds

        event::emit(WithdrawalExecuted {
            receipt_id: object::uid_to_address(&id),
            user,
            amount,
        });

        object::delete(id);
    }

    // ============ Admin Functions ============

    /// Update protocol addresses
    public entry fun update_config(
        _admin: &AdminCap,
        config: &mut ProtocolConfig,
        scallop_market: address,
        navi_pool: address,
    ) {
        config.scallop_market = scallop_market;
        config.navi_pool = navi_pool;
    }

    /// Pause/unpause the automator
    public entry fun set_paused(
        _admin: &AdminCap,
        config: &mut ProtocolConfig,
        paused: bool,
    ) {
        config.paused = paused;
    }

    // ============ View Functions ============

    public fun get_receipt_info(receipt: &NaisuReceipt): (vector<u8>, address, u8, u8, u64) {
        (
            receipt.intent_id,
            receipt.user,
            receipt.protocol_id,
            receipt.strategy_id,
            receipt.amount,
        )
    }

    // ============ Internal Functions ============

    fun get_protocol_for_strategy(strategy_id: u8): u8 {
        if (strategy_id == 1 || strategy_id == 2) {
            1 // Scallop
        } else {
            2 // Navi
        }
    }
}
