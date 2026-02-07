/**
 * Simpler Cetus Test - Just Open Position
 *
 * Test opening position WITHOUT adding liquidity
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
// import { useNetworkConfig } from "@/hooks/useNetworkConfig";
// import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export const Route = createFileRoute("/test-cetus-simple")({
  component: SimpleTestPage,
});

const CETUS_PACKAGE = "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8";
const CETUS_GLOBAL_CONFIG = "0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a";
const COIN_SUI = "0x2::sui::SUI";
const COIN_USDC = "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC";
const DEFAULT_POOL = "0x2603c08065a848b719f5f465e40dbef485ec4fd9c967ebe83a7565269a74a2b2";

function SimpleTestPage() {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const client = useSuiClient();
  // const queryClient = useQueryClient();
  // const { config } = useNetworkConfig();

  const [poolId, setPoolId] = useState(DEFAULT_POOL);
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const addLog = (msg: string) => setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const testOpenPosition = async () => {
    if (!account) return;

    setStatus('executing');
    setLog([]);
    setTxDigest(null);

    try {
      addLog("🚀 Testing: Open Position Only (No Liquidity)");

      // Fetch pool info
      addLog("🔍 Fetching pool info...");
      const poolObj = await client.getObject({
        id: poolId,
        options: { showContent: true }
      });

      if (!poolObj.data) {
        throw new Error("Pool not found!");
      }

      const poolContent = poolObj.data.content as any;
      const currentTick = poolContent.fields?.current_tick_index?.fields?.bits || 0;
      const tickSpacing = poolContent.fields?.tick_spacing || 60;

      addLog(`ℹ️ Current Tick: ${currentTick}, Spacing: ${tickSpacing}`);

      // Calculate tick range
      const tickRange = tickSpacing * 100;
      const tickLowerIndex = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
      const tickUpperIndex = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

      addLog(`📊 Tick Range: [${tickLowerIndex}, ${tickUpperIndex}]`);

      // Build transaction
      const tx = new Transaction();

      addLog("🌊 Opening Position (empty, no liquidity)...");
      const position = tx.moveCall({
        target: `${CETUS_PACKAGE}::pool::open_position`,
        arguments: [
          tx.object(CETUS_GLOBAL_CONFIG),
          tx.object(poolId),
          tx.pure.u32(tickLowerIndex),
          tx.pure.u32(tickUpperIndex),
        ],
        typeArguments: [COIN_USDC, COIN_SUI]
      });

      // Transfer position NFT to user
      tx.transferObjects([position], tx.pure.address(account.address));

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Transaction Successful! Digest: ${result.digest}`);
            setStatus('success');
            setTxDigest(result.digest);
            toast.success(`Position opened! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Transaction Failed: ${error.message}`);
            setStatus('error');
            toast.error(`Failed: ${error.message}`);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
      setStatus('error');
      toast.error(`Error: ${e.message}`);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl min-h-screen text-white">
      <Card>
        <CardHeader>
          <CardTitle>Simple Cetus Test - Open Position Only</CardTitle>
          <p className="text-sm text-white/50">Test opening position WITHOUT adding liquidity</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-white/70">Pool ID</label>
            <Input
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="font-mono text-xs"
              placeholder="Pool Object ID"
            />
          </div>

          <Button
            fullWidth
            onClick={testOpenPosition}
            disabled={status === 'executing' || !account}
          >
            {status === 'executing' ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Testing...
              </>
            ) : (
              'Open Empty Position'
            )}
          </Button>

          {!account && (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-sm text-amber-400">Connect wallet first</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {log.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs space-y-1 text-white/60">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.includes("✅")
                      ? "text-green-400"
                      : entry.includes("❌")
                        ? "text-red-400"
                        : ""
                  }
                >
                  {entry}
                </div>
              ))}
              {txDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline block mt-2"
                >
                  View on Suiscan →
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
