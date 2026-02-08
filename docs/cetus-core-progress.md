# Cetus CLMM Core — Progress Summary

## Overview

Built a complete **Cetus CLMM Core Debug/Test Page** that uses ONLY the CORE package (`0x6bbdf09f...`) for all operations. This bypasses the Integration package and works directly with ALL pools including legacy ones.

---

## Files Created / Modified

### 1. `naisu-frontend/src/lib/cetus/cetusServiceCore.ts` (NEW)

Core-only TX builder service with **10 functions**:

| Function | Description |
|---|---|
| `buildSwapCoreTx` | Flash swap (SUI input) — flash_swap → repay_flash_swap receipt pattern |
| `buildSwapCoreWithCoinTx` | Flash swap with explicit coin object (non-SUI input, e.g. USDC) |
| `buildOpenPositionWithLiquidityCoreTx` | Open position + add liquidity via receipt pattern |
| `buildAddLiquidityCoreTx` | Add liquidity to existing position via receipt pattern |
| `buildRemoveLiquidityCoreTx` | Remove liquidity → Balance → Coin → transfer |
| `buildCollectFeeCoreTx` | Collect trading fees from position |
| `buildClosePositionCoreTx` | Remove all liq + collect fees + destroy Position NFT |
| `buildCreatePoolCoreTx` | Create pool via `pool_creator::create_pool_v3` (NOT v2) |
| `buildZapCoreTx` | Single-sided zap: flash_swap 50% → open position → add liquidity |
| `_addLiquidityReceipt` | Internal helper: `add_liquidity_fix_coin` → `add_liquidity_pay_amount` → `repay_add_liquidity` |

**Key patterns:**
- **Flash swap receipt**: `flash_swap` → `repay_flash_swap` (receipt is non-droppable)
- **Add liquidity receipt**: `add_liquidity_fix_coin` → `add_liquidity_pay_amount` → split exact amounts → `repay_add_liquidity`
- **Balance ↔ Coin conversion**: CORE returns `Balance<T>`, must use `coin::from_balance` / `coin::into_balance`
- **Coin source priority**: explicit source FIRST → fallback to `tx.gas` for SUI → zero balance

### 2. `naisu-frontend/src/routes/test-cetus-core.tsx` (NEW)

Full debug page with **4 tabs**:

- **Swap** — Direction toggle, amount input, MAX button, supports SUI and non-SUI input
- **Position** — Open empty / Open+Add Liq, Fix Side toggle (A/B), custom tick range, close position
- **Liquidity** — Add/Remove liquidity, collect fees, Zap with coin selector (SUI or any pool coin)
- **Pool** — Create pool with 16 tick_spacing options, price presets, existing pool detection

**UI features:**
- Pool selector (hardcoded + factory discovery)
- Wallet balance display for both pool coins
- Position list with auto-fetch from chain
- Status/log panel with Suiscan explorer links

### 3. `naisu-frontend/src/lib/cetus/cetusService.ts` (MODIFIED)

- **Fixed `CETUS_FACTORY`** from wrong deployment (`0x50eb61dd...`) to correct one (`0x20a086e6...`)
- **Fixed `currentTick` parsing** — converts u32 bits to signed i32 (was causing tick misalignment for negative ticks)
- **Added pools** — 5 new USDC(Circle)/SUI pools added to hardcoded `CETUS_POOLS`

### 4. `naisu-frontend/src/routes/__root.tsx` (MODIFIED)

Added "CLMM Core Test" entry to Debug dropdown menu.

---

## Pools Created (USDC Circle / SUI)

| Pool Name | Pool ID | tick_spacing | Price | Status |
|---|---|---|---|---|
| USDC(Circle)/SUI [ts200] | `0xc0b2d0d3...` | 200 | Skewed | Someone else created, liq=0 |
| USDC(Circle)/SUI [1:1] | `0x0b723951...` | 2 | Broken | Price shifted after removing all liq |
| USDC(Circle)/SUI [1:20] | `0x396d6233...` | 10 | 1 SUI = 20 USDC | **Working** |
| USDC(Circle)/SUI [ts60] | `0x64a908fd...` | 60 | 1 SUI = 1000 USDC | Empty, tick=0 |
| USDC(Circle)/SUI [1:200] | `0x1e8ade87...` | 20 | 1 SUI = 200 USDC | **Working** |

---

## Bugs Found & Fixed

### 1. Wrong `CETUS_FACTORY` object
- **Symptom**: `CommandArgumentError { arg_idx: 1, kind: TypeMismatch }` on create pool
- **Root cause**: Factory object `0x50eb61dd...` was from deployment `0x0c7ae833...`, but CORE package expects `0x5372d555...` deployment
- **Fix**: Changed to correct factory `0x20a086e6...` (found via `InitFactoryEvent`)

### 2. `create_pool_v2` requires `CoinMetadata` objects that don't exist on testnet
- **Symptom**: `CommandArgumentError { arg_idx: 9, kind: TypeMismatch }`
- **Root cause**: `getCoinMetadata()` API returns `coin_registry::Currency<T>`, NOT `coin::CoinMetadata<T>`
- **Fix**: Switched to `create_pool_v3` which has NO CoinMetadata parameters

### 3. Tick range misalignment for negative ticks
- **Symptom**: `check_position_tick_range` abort on pools with negative current_tick (e.g. USDC/SUI)
- **Root cause**: `fetchPoolInfo` returned `currentTick` as raw u32 bits; tick range math treated it as positive number, producing ticks not aligned to tick_spacing
- **Fix**: Added u32→i32 conversion in `fetchPoolInfo`: `bits >= 2^31 ? bits - 2^32 : bits`

### 4. `_addLiquidityReceipt` ignoring explicit coin sources for SUI
- **Symptom**: Zap with non-SUI input impossible; SUI from flash_swap output was ignored in favor of `tx.gas`
- **Root cause**: Code checked `isSuiCoin()` BEFORE checking explicit `coinSource`, always using gas for SUI side
- **Fix**: Reversed priority — check explicit source FIRST, then fallback to gas for SUI, then zero

### 5. Non-SUI swap input not supported
- **Symptom**: Swap tab failed for USDC→SUI direction
- **Root cause**: `buildSwapCoreTx` only handled SUI input (split from gas)
- **Fix**: Added `buildSwapCoreWithCoinTx` for non-SUI input with coin merge + split

---

## CLMM Price Formula

For a pool with CoinA (decA decimals) / CoinB (decB decimals):

```
raw_price = coinA_raw_amount / coinB_raw_amount
human_price = raw_price × 10^(decB - decA)
```

**Examples for USDC(6 dec) / SUI(9 dec):**

| Human Price | raw init_price | Formula |
|---|---|---|
| 1 SUI = 1 USDC | 0.001 | 1×10^6 / 1×10^9 = 0.001 |
| 1 SUI = 20 USDC | 0.02 | 20×10^6 / 1×10^9 = 0.02 |
| 1 SUI = 200 USDC | 0.2 | 200×10^6 / 1×10^9 = 0.2 |

**sqrt_price_x64** = `sqrt(raw_price) × 2^64`

---

## Available Tick Spacings (from Cetus factory)

| tick_spacing | fee_rate | fee % |
|---|---|---|
| 2 | 100 | 0.01% |
| 4 | 200 | 0.02% |
| 6 | 300 | 0.03% |
| 8 | 400 | 0.04% |
| 10 | 500 | 0.05% |
| 20 | 1000 | 0.1% |
| 30 | 1500 | 0.15% |
| 40 | 2000 | 0.2% |
| 60 | 2500 | 0.25% |
| 80 | 3000 | 0.3% |
| 100 | 4000 | 0.4% |
| 120 | 6000 | 0.6% |
| 160 | 8000 | 0.8% |
| 200 | 10000 | 1% |
| 220 | 20000 | 2% |
| 260 | 40000 | 4% |

Pool uniqueness: same (coinA, coinB, tick_spacing) → only one pool allowed.

---

## Key Constants

```typescript
CETUS_CORE_PACKAGE = "0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7"
CETUS_GLOBAL_CONFIG = "0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a"
CETUS_FACTORY      = "0x20a086e6fa0741b3ca77d033a65faf0871349b986ddbdde6fa1d85d78a5f4222"
COIN_USDC_CIRCLE   = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"
COIN_SUI           = "0x2::sui::SUI"
```

---

## Important Lessons

1. **CLMM pools are permanent** — once created, the pair+tick_spacing combo is taken forever
2. **Removing all liquidity breaks pool price** — without liquidity, any operation can shift the price to extremes; the pool can't be "reset"
3. **CORE vs Integration**: CORE functions are `public` (not `entry`), return `Balance<T>` not `Coin<T>`, and require receipt patterns
4. **`create_pool_v3` NOT v2** — v2 requires `CoinMetadata` objects which may not exist on testnet; v3 skips them
5. **u32 tick encoding** — negative ticks stored as `2^32 + tick`; must convert back to signed for math
6. **Two Cetus deployments on testnet** — `0x5372d555...` (our CORE) vs `0x0c7ae833...` (different) — don't mix objects
