/**
 * Improved Swap Page with Pool Selector
 *
 * Clean swap interface with integrated pool selection
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PoolSelector } from '@/components/cetus/PoolSelector';
import { CetusPoolInfo } from '@/hooks/sui/useQueryCetusPools';
import { useQuerySuiTokenBalance } from '@/hooks/sui/useQuerySuiTokenBalance';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, ArrowDownUp, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export const Route = createFileRoute('/swap')({
  component: SwapPage,
});

// Cetus Contract Addresses
const CETUS_GLOBAL_CONFIG = '0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a';
const CETUS_INTEGRATE = '0xab2d58dd28ff0dc19b18ab2c634397b785a38c342a8f5065ade5f53f9dbffa1c';
const COIN_SUI = '0x2::sui::SUI';

function SwapPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Pool selection
  const [selectedPool, setSelectedPool] = useState<CetusPoolInfo | null>(null);

  // Swap state
  const [fromAmount, setFromAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState<'a2b' | 'b2a'>('b2a'); // SUI -> USDC by default
  const [slippage, _setSlippage] = useState(1); // 1%
  const [isSwapping, setIsSwapping] = useState(false);

  // Get token types based on direction
  const fromToken = swapDirection === 'b2a'
    ? { type: COIN_SUI, symbol: 'SUI', decimals: 9 }
    : { type: selectedPool?.coinTypeA || '', symbol: selectedPool?.coinASymbol || 'Token A', decimals: 6 };

  const toToken = swapDirection === 'b2a'
    ? { type: selectedPool?.coinTypeA || '', symbol: selectedPool?.coinASymbol || 'Token A', decimals: 6 }
    : { type: COIN_SUI, symbol: 'SUI', decimals: 9 };

  // Fetch balances
  const { data: fromBalance } = useQuerySuiTokenBalance({
    coinType: fromToken.type,
    accountAddress: account?.address,
  });

  const formattedFromBalance = fromBalance
    ? (parseInt(fromBalance.totalBalance) / Math.pow(10, fromToken.decimals)).toFixed(4)
    : '0.0000';

  // Estimate output (simple 1:1 for demo, should use pool price)
  const estimatedOutput = fromAmount ? (parseFloat(fromAmount) * 0.997).toFixed(4) : '0';

  const handleSwap = async () => {
    if (!account || !selectedPool || !fromAmount) {
      toast.error('Please connect wallet, select pool, and enter amount');
      return;
    }

    const amountFloat = parseFloat(fromAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      toast.error('Invalid amount');
      return;
    }

    setIsSwapping(true);

    try {
      const tx = new Transaction();
      const amountIn = BigInt(Math.floor(amountFloat * Math.pow(10, fromToken.decimals)));

      // Sqrt price limits for Cetus
      const MAX_SQRT_PRICE = '79226673515401279992447579055'; // ~2^96 - 1
      const MIN_SQRT_PRICE = '4295048016'; // ~2^32

      // Build swap transaction
      if (swapDirection === 'b2a') {
        // SUI -> Token A (e.g., USDC)
        const [coinIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);
        const coinOut = tx.moveCall({
          target: '0x2::coin::zero',
          typeArguments: [selectedPool.coinTypeA],
        });

        const [resultCoinA, resultCoinB] = tx.moveCall({
          target: `${CETUS_INTEGRATE}::router::swap`,
          arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(selectedPool.poolAddress),
            coinOut,
            coinIn,
            tx.pure.bool(false), // a_to_b: false (B->A)
            tx.pure.bool(true),  // by_amount_in
            tx.pure.u64(amountIn),
            tx.pure(bcs.u128().serialize(MAX_SQRT_PRICE).toBytes()), // Use proper limit
            tx.pure.bool(false),
            tx.object('0x6'),
          ],
          typeArguments: [selectedPool.coinTypeA, COIN_SUI],
        });

        tx.transferObjects([resultCoinA, resultCoinB], tx.pure.address(account.address));
      } else {
        // Token A -> SUI
        // Get user's Token A coins
        const coins = await client.getCoins({
          owner: account.address,
          coinType: selectedPool.coinTypeA,
        });

        if (coins.data.length === 0) {
          throw new Error(`No ${selectedPool.coinASymbol} tokens found`);
        }

        const coinObj = coins.data.find(c => BigInt(c.balance) > 0);
        if (!coinObj) {
          throw new Error('Insufficient balance');
        }

        const coinIn = tx.object(coinObj.coinObjectId);
        const coinOut = tx.moveCall({
          target: '0x2::coin::zero',
          typeArguments: [COIN_SUI],
        });

        const [resultCoinA, resultCoinB] = tx.moveCall({
          target: `${CETUS_INTEGRATE}::router::swap`,
          arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(selectedPool.poolAddress),
            coinIn,
            coinOut,
            tx.pure.bool(true), // a_to_b: true (A->B)
            tx.pure.bool(true),
            tx.pure.u64(amountIn),
            tx.pure(bcs.u128().serialize(MIN_SQRT_PRICE).toBytes()), // Use proper limit
            tx.pure.bool(false),
            tx.object('0x6'),
          ],
          typeArguments: [selectedPool.coinTypeA, COIN_SUI],
        });

        tx.transferObjects([resultCoinA, resultCoinB], tx.pure.address(account.address));
      }

      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            toast.success(`Swap successful! ${result.digest.slice(0, 8)}...`);
            setFromAmount('');
            setIsSwapping(false);

            // Refresh balances
            queryClient.invalidateQueries({ queryKey: ['sui-token-balance'] });
          },
          onError: (error) => {
            console.error(error);
            toast.error(`Swap failed: ${error.message}`);
            setIsSwapping(false);
          },
        }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`);
      setIsSwapping(false);
    }
  };

  const handleFlipDirection = () => {
    setSwapDirection(swapDirection === 'a2b' ? 'b2a' : 'a2b');
    setFromAmount('');
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-xl min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Swap</h1>
          <p className="text-white/50">Trade tokens on Cetus Protocol</p>
        </div>

        {/* Main Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Pool Selector */}
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">
                Select Pool
              </label>
              <PoolSelector
                selectedPool={selectedPool}
                onSelectPool={setSelectedPool}
                filterByTokens={['SUI']}
              />
            </div>

            {selectedPool && (
              <>
                {/* From Token */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-white/50 uppercase tracking-wider">
                      From
                    </label>
                    <span className="text-xs text-white/40">
                      Balance: {formattedFromBalance}
                    </span>
                  </div>

                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="pr-28 text-2xl h-16 font-medium"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white/[0.05] px-3 py-2 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${fromToken.symbol === 'SUI' ? 'bg-blue-500' : 'bg-green-500'
                        }`}>
                        {fromToken.symbol[0]}
                      </div>
                      <span className="font-semibold text-white">{fromToken.symbol}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setFromAmount(formattedFromBalance)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    MAX
                  </button>
                </div>

                {/* Flip Button */}
                <div className="relative flex justify-center -my-2">
                  <button
                    onClick={handleFlipDirection}
                    className="relative z-10 p-2 rounded-xl bg-[#0b0e14] border border-white/[0.1] hover:bg-white/[0.05] transition-all"
                  >
                    <ArrowDownUp className="h-5 w-5 text-indigo-400" />
                  </button>
                </div>

                {/* To Token */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">
                    To (Estimated)
                  </label>

                  <div className="relative">
                    <div className="p-4 h-16 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                      <span className="text-2xl font-medium text-white/70">
                        {estimatedOutput}
                      </span>
                      <div className="flex items-center gap-2 bg-white/[0.05] px-3 py-2 rounded-lg">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${toToken.symbol === 'SUI' ? 'bg-blue-500' : 'bg-green-500'
                          }`}>
                          {toToken.symbol[0]}
                        </div>
                        <span className="font-semibold text-white">{toToken.symbol}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Info className="h-3 w-3" />
                    <span>Slippage: {slippage}%</span>
                  </div>
                  <div className="text-xs text-white/50">
                    Fee: {(selectedPool.feeRate / 10000).toFixed(2)}%
                  </div>
                </div>

                {/* Swap Button */}
                {!account ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <p className="text-sm text-amber-400">
                      Connect your wallet to swap
                    </p>
                  </div>
                ) : (
                  <Button
                    fullWidth
                    size="lg"
                    onClick={handleSwap}
                    disabled={isSwapping || !fromAmount || parseFloat(fromAmount) <= 0}
                    className="h-14 text-lg font-bold"
                  >
                    {isSwapping ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Swapping...
                      </span>
                    ) : (
                      `Swap ${fromToken.symbol} → ${toToken.symbol}`
                    )}
                  </Button>
                )}
              </>
            )}

            {!selectedPool && (
              <div className="text-center py-8 text-white/40 text-sm">
                Select a pool to start swapping
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-indigo-500/[0.03] border-indigo-500/20">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-indigo-300">How it works</h3>
            <ul className="text-xs text-white/50 space-y-1">
              <li>• Select a liquidity pool from Cetus Protocol</li>
              <li>• Enter the amount you want to swap</li>
              <li>• Review the estimated output and fees</li>
              <li>• Confirm the transaction in your wallet</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
