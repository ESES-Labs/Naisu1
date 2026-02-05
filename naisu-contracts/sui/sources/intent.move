/// Naisu Intent - Yield Intent Marketplace on Sui
///
/// Users create yield intents, solvers compete to fulfill them.
/// Winner is the solver offering highest APY above user's minimum.
module naisu::intent {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::String;

    // ============ Constants ============

    /// Intent status: Open for bidding
    const STATUS_OPEN: u8 = 0;
    /// Intent status: Fulfilled by solver
    const STATUS_FULFILLED: u8 = 1;
    /// Intent status: Expired/cancelled
    const STATUS_EXPIRED: u8 = 2;

    // ============ Errors ============

    /// Intent is not in OPEN status
    const EIntentNotOpen: u64 = 0;
    /// Intent has expired
    const EIntentExpired: u64 = 1;
    /// APY offered is below user's minimum
    const EInsufficientApy: u64 = 2;
    /// Not the intent owner
    const ENotOwner: u64 = 3;
    /// Intent not yet expired
    const ENotExpired: u64 = 4;
    /// Invalid input amount
    const EInvalidAmount: u64 = 5;
    /// Solver fee calculation error
    const EFeeCalculation: u64 = 6;

    // ============ Structs ============

    /// YieldIntent - Shared Object discoverable by solvers
    public struct YieldIntent<phantom T> has key {
        id: UID,
        /// User who created the intent
        user: address,
        /// Locked input asset (e.g., USDC)
        input: Coin<T>,
        /// Minimum acceptable APY (basis points, e.g., 750 = 7.5%)
        min_apy: u64,
        /// Deadline timestamp (ms)
        deadline: u64,
        /// Current status
        status: u8,
        /// Timestamp when created
        created_at: u64,
        /// Target protocol (optional, "any" for any protocol)
        target_protocol: String,
    }

    /// Receipt given to user after fulfillment
    public struct YieldReceipt<phantom Y> has key {
        id: UID,
        /// Original user
        user: address,
        /// Protocol that was used (e.g., "scallop", "navi")
        protocol: String,
        /// APY achieved (basis points)
        apy: u64,
        /// Amount deposited
        amount: u64,
        /// Timestamp
        fulfilled_at: u64,
    }

    /// Solver capability (optional, for authorized solvers)
    public struct SolverCap has key, store {
        id: UID,
        solver: address,
        name: String,
    }

    // ============ Events ============

    /// Emitted when intent is created
    public struct IntentCreated has copy, drop {
        intent_id: address,
        user: address,
        amount: u64,
        min_apy: u64,
        deadline: u64,
        target_protocol: String,
    }

    /// Emitted when intent is fulfilled
    public struct IntentFulfilled has copy, drop {
        intent_id: address,
        user: address,
        solver: address,
        protocol: String,
        apy: u64,
        user_surplus: u64, // How much better than minimum
        solver_fee: u64,
    }

    /// Emitted when intent is cancelled
    public struct IntentCancelled has copy, drop {
        intent_id: address,
        user: address,
        reason: u8, // 0 = expired, 1 = user cancelled
    }

    // ============ Public Functions ============

    /// Create a new yield intent
    /// 
    /// User locks their assets and sets minimum APY requirement.
    /// Solvers will compete to offer better rates.
    ///
    /// # Arguments
    /// * `input` - The coin to deposit (e.g., USDC)
    /// * `min_apy` - Minimum acceptable APY in basis points (e.g., 750 = 7.5%)
    /// * `deadline` - Duration in seconds from now
    /// * `target_protocol` - "any" or specific protocol name
    /// * `ctx` - Transaction context
    public entry fun create_intent<T>(
        input: Coin<T>,
        min_apy: u64,
        deadline: u64,
        target_protocol: String,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&input);
        assert!(amount > 0, EInvalidAmount);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let deadline_ms = now + (deadline * 1000); // Convert to ms

        let intent = YieldIntent<T> {
            id: object::new(ctx),
            user: tx_context::sender(ctx),
            input,
            min_apy,
            deadline: deadline_ms,
            status: STATUS_OPEN,
            created_at: now,
            target_protocol,
        };

        let intent_id = object::uid_to_address(&intent.id);

        // Emit event for solver discovery
        event::emit(IntentCreated {
            intent_id,
            user: tx_context::sender(ctx),
            amount,
            min_apy,
            deadline: deadline_ms,
            target_protocol,
        });

        // Make discoverable by solvers (CRITICAL: Shared object)
        transfer::share_object(intent);
    }

    /// Fulfill intent - called by winning solver
    ///
    /// Winner deposits to protocol, gives yield tokens to user,
    /// claims solver fee from spread.
    ///
    /// # Arguments
    /// * `intent` - The intent to fulfill (must be OPEN)
    /// * `output_coin` - Yield-bearing tokens for user (e.g., sUSDC)
    /// * `protocol` - Name of protocol used
    /// * `apy` - APY achieved (basis points, must be >= min_apy)
    /// * `ctx` - Transaction context
    ///
    /// # Note
    /// This function assumes the solver has already deposited to the
    /// target protocol and is passing the resulting yield tokens.
    public entry fun fulfill_intent<T, Y>(
        intent: YieldIntent<T>,
        output_coin: Coin<Y>,
        protocol: String,
        apy: u64,
        ctx: &mut TxContext
    ) {
        // Verify intent is open
        assert!(intent.status == STATUS_OPEN, EIntentNotOpen);

        // Verify not expired
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now <= intent.deadline, EIntentExpired);

        // Verify APY meets minimum
        assert!(apy >= intent.min_apy, EInsufficientApy);

        let solver = tx_context::sender(ctx);
        let input_amount = coin::value(&intent.input);

        // Calculate user surplus (how much better than minimum)
        let user_surplus = apy - intent.min_apy;

        // Solver fee: half of the spread (configurable)
        let solver_fee_bps = user_surplus / 2;

        // Create receipt for user
        let receipt = YieldReceipt<Y> {
            id: object::new(ctx),
            user: intent.user,
            protocol,
            apy,
            amount: input_amount,
            fulfilled_at: now,
        };

        let intent_id = object::uid_to_address(&intent.id);

        // Emit fulfillment event
        event::emit(IntentFulfilled {
            intent_id,
            user: intent.user,
            solver,
            protocol,
            apy,
            user_surplus,
            solver_fee: solver_fee_bps,
        });

        // Transfer yield tokens to user
        transfer::public_transfer(output_coin, intent.user);

        // Transfer receipt to user
        transfer::transfer(receipt, intent.user);

        // Transfer input to solver (they deposit to protocol)
        // In production, solver would deposit this to protocol
        let YieldIntent { 
            id, 
            user: _, 
            input,
            min_apy: _, 
            deadline: _, 
            status: _, 
            created_at: _, 
            target_protocol: _ 
        } = intent;
        
        transfer::public_transfer(input, solver);
        object::delete(id);
    }

    /// Cancel expired intent and reclaim assets
    ///
    /// Can only be called by intent owner after deadline.
    public entry fun cancel_expired_intent<T>(
        intent: YieldIntent<T>,
        ctx: &mut TxContext
    ) {
        let caller = tx_context::sender(ctx);
        assert!(intent.user == caller, ENotOwner);

        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now > intent.deadline, ENotExpired);

        let intent_id = object::uid_to_address(&intent.id);

        // Emit cancellation event
        event::emit(IntentCancelled {
            intent_id,
            user: intent.user,
            reason: 0, // Expired
        });

        // Return locked assets to user
        let YieldIntent { 
            id, 
            user: _, 
            input,
            min_apy: _, 
            deadline: _, 
            status: _, 
            created_at: _, 
            target_protocol: _ 
        } = intent;
        
        transfer::public_transfer(input, caller);
        object::delete(id);
    }

    /// User cancels intent before expiry (emergency)
    ///
    /// This is a "soft" cancel - requires intent to not be in process.
    /// In production, might require timelock or penalty.
    public entry fun user_cancel_intent<T>(
        intent: YieldIntent<T>,
        ctx: &mut TxContext
    ) {
        let caller = tx_context::sender(ctx);
        assert!(intent.user == caller, ENotOwner);
        assert!(intent.status == STATUS_OPEN, EIntentNotOpen);

        let intent_id = object::uid_to_address(&intent.id);

        event::emit(IntentCancelled {
            intent_id,
            user: intent.user,
            reason: 1, // User cancelled
        });

        // Return assets
        let YieldIntent { 
            id, 
            user: _, 
            input,
            min_apy: _, 
            deadline: _, 
            status: _, 
            created_at: _, 
            target_protocol: _ 
        } = intent;
        
        transfer::public_transfer(input, caller);
        object::delete(id);
    }

    // ============ View Functions ============

    /// Get intent details
    public fun get_intent_info<T>(intent: &YieldIntent<T>): (
        address, u64, u64, u64, u8, String
    ) {
        (
            intent.user,
            coin::value(&intent.input),
            intent.min_apy,
            intent.deadline,
            intent.status,
            intent.target_protocol,
        )
    }

    /// Get receipt details
    public fun get_receipt_info<Y>(receipt: &YieldReceipt<Y>): (
        address, String, u64, u64
    ) {
        (
            receipt.user,
            receipt.protocol,
            receipt.apy,
            receipt.amount,
        )
    }

    /// Check if intent is open
    public fun is_open<T>(intent: &YieldIntent<T>): bool {
        intent.status == STATUS_OPEN
    }

    /// Check if intent is expired
    public fun is_expired<T>(intent: &YieldIntent<T>, ctx: &TxContext): bool {
        tx_context::epoch_timestamp_ms(ctx) > intent.deadline
    }
}

// ============ Tests ============

#[test_only]
module naisu::intent_tests {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_scenario;
    use naisu::intent;
    use std::string;

    #[test]
    fun test_create_intent() {
        let addr = @0xA;
        let scenario = test_scenario::begin(addr);
        
        // Create test coin
        let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
        
        // Create intent
        intent::create_intent<SUI>(
            coin,
            750, // 7.5% min APY
            3600, // 1 hour deadline
            string::utf8(b"any"),
            test_scenario::ctx(&mut scenario)
        );
        
        // Verify intent was created (would need to query in real test)
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = naisu::intent::EInvalidAmount)]
    fun test_create_intent_zero_amount() {
        let addr = @0xA;
        let scenario = test_scenario::begin(addr);
        let coin = coin::mint_for_testing<SUI>(0, test_scenario::ctx(&mut scenario));
        
        intent::create_intent<SUI>(
            coin,
            750,
            3600,
            string::utf8(b"any"),
            test_scenario::ctx(&mut scenario)
        );
        
        test_scenario::end(scenario);
    }
}
