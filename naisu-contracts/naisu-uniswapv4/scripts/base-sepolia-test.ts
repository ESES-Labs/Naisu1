import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeAbiParameters,
  keccak256,
  maxUint256,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

type Address = `0x${string}`;

const env = {
  PRIVATE_KEY: process.env.PRIVATE_KEY as Address | undefined,
  BASE_SEPOLIA_RPC: process.env.BASE_SEPOLIA_RPC as string | undefined,
  NAISU_SWAP_CONTRACT: process.env.NAISU_SWAP_CONTRACT as Address | undefined,
  NAISU_REWARDS_CONTRACT: process.env.NAISU_REWARDS_CONTRACT as Address | undefined,
  TOKEN_0: process.env.TOKEN_0 as Address | undefined,
  TOKEN_1: process.env.TOKEN_1 as Address | undefined,
  USDC_ADDRESS: process.env.USDC_ADDRESS as Address | undefined,
  POOL_FEE: process.env.POOL_FEE ? Number(process.env.POOL_FEE) : 3000,
  TICK_SPACING: process.env.TICK_SPACING ? Number(process.env.TICK_SPACING) : 60,
  SWAP_AMOUNT_IN: process.env.SWAP_AMOUNT_IN ?? "0.1",
  LIQ_AMOUNT_0: process.env.LIQ_AMOUNT_0 ?? "0.1",
  LIQ_AMOUNT_1: process.env.LIQ_AMOUNT_1 ?? "0.00001",
  DEADLINE_SECONDS: process.env.DEADLINE_SECONDS
    ? Number(process.env.DEADLINE_SECONDS)
    : 3600,
};

const required = [
  "PRIVATE_KEY",
  "BASE_SEPOLIA_RPC",
  "NAISU_SWAP_CONTRACT",
  "NAISU_REWARDS_CONTRACT",
  "TOKEN_0",
  "TOKEN_1",
] as const;

for (const key of required) {
  if (!env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

const account = privateKeyToAccount(env.PRIVATE_KEY!);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(env.BASE_SEPOLIA_RPC),
});

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: http(env.BASE_SEPOLIA_RPC),
  account,
});

const erc20Abi = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const swapAbi = [
  {
    name: "executeSwap",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "getSwapQuote",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
  },
  {
    name: "poolManager",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "DEFAULT_TICK_SPACING",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int24" }],
  },
  {
    name: "DEFAULT_FEE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint24" }],
  },
] as const;

const poolManagerAbi = [
  {
    name: "getSlot0",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "swapFee", type: "uint24" },
    ],
  },
] as const;

const rewardsAbi = [
  {
    name: "addLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "minLiquidity", type: "uint128" },
    ],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
  {
    name: "removeLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "liquidity", type: "uint128" },
      { name: "amount0Min", type: "uint256" },
      { name: "amount1Min", type: "uint256" },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
  {
    name: "collectFees",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
  {
    name: "getUserPosition",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "poolId", type: "bytes32" },
    ],
    outputs: [
      {
        name: "position",
        type: "tuple",
        components: [
          { name: "poolId", type: "bytes32" },
          { name: "liquidity", type: "uint128" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
        ],
      },
    ],
  },
] as const;

async function ensureApprove(
  token: Address,
  spender: Address,
  amount: bigint
) {
  const allowance = (await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  })) as bigint;

  if (allowance >= amount) return;

  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  const token0 = env.TOKEN_0!;
  const token1 = env.TOKEN_1!;
  const swap = env.NAISU_SWAP_CONTRACT!;
  const rewards = env.NAISU_REWARDS_CONTRACT!;
  const usdc = env.USDC_ADDRESS ?? token0;

  const [dec0, dec1] = await Promise.all([
    publicClient.readContract({
      address: token0,
      abi: erc20Abi,
      functionName: "decimals",
    }) as Promise<number>,
    publicClient.readContract({
      address: token1,
      abi: erc20Abi,
      functionName: "decimals",
    }) as Promise<number>,
  ]);

  const usdcDecimals = await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "decimals",
  }) as number;

  const swapAmountIn = parseUnits(env.SWAP_AMOUNT_IN!, dec0);
  const liqAmount0 = parseUnits(env.LIQ_AMOUNT_0!, dec0);
  const liqAmount1 = parseUnits(env.LIQ_AMOUNT_1!, dec1);

  const nativeBalance = await publicClient.getBalance({
    address: account.address,
  });

  const usdcBalance = await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  }) as bigint;

  const [bal0, bal1] = await Promise.all([
    publicClient.readContract({
      address: token0,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: token1,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }) as Promise<bigint>,
  ]);

  console.log(`Wallet: ${account.address}`);
  console.log(`Native balance: ${formatUnits(nativeBalance, 18)} ETH`);
  console.log(`USDC balance: ${formatUnits(usdcBalance, usdcDecimals)} USDC`);
  console.log(`Token0 balance: ${formatUnits(bal0, dec0)}`);
  console.log(`Token1 balance: ${formatUnits(bal1, dec1)}`);

  if (bal0 < swapAmountIn + liqAmount0) {
    console.warn("Insufficient token0 balance for swap + liquidity.");
    console.warn(`Have: ${bal0.toString()} Need: ${(swapAmountIn + liqAmount0).toString()}`);
  }

  if (bal1 < liqAmount1) {
    console.warn("Insufficient token1 balance for liquidity.");
    console.warn(`Have: ${bal1.toString()} Need: ${liqAmount1.toString()}`);
  }

  await ensureApprove(token0, swap, swapAmountIn);
  await ensureApprove(token0, rewards, liqAmount0);
  await ensureApprove(token1, rewards, liqAmount1);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + env.DEADLINE_SECONDS);

  let quote;
  try {
    quote = await publicClient.readContract({
      address: swap,
      abi: swapAbi,
      functionName: "getSwapQuote",
      args: [token0, token1, swapAmountIn],
    });
    console.log("Swap quote (contract):", quote);
  } catch (error) {
    // Fallback for current deployment where getSwapQuote can overflow (panic 0x11).
    const [poolManager, fee, tickSpacing] = await Promise.all([
      publicClient.readContract({
        address: swap,
        abi: swapAbi,
        functionName: "poolManager",
      }) as Promise<Address>,
      publicClient.readContract({
        address: swap,
        abi: swapAbi,
        functionName: "DEFAULT_FEE",
      }) as Promise<number>,
      publicClient.readContract({
        address: swap,
        abi: swapAbi,
        functionName: "DEFAULT_TICK_SPACING",
      }) as Promise<number>,
    ]);

    const [currency0, currency1] =
      token0.toLowerCase() < token1.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    const poolKeyEncoded = encodeAbiParameters(
      [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "tickSpacing", type: "int24" },
        { name: "hooks", type: "address" },
      ],
      [currency0, currency1, fee, tickSpacing, "0x0000000000000000000000000000000000000000"]
    );
    const poolId = keccak256(poolKeyEncoded);

    const [sqrtPriceX96] = await publicClient.readContract({
      address: poolManager,
      abi: poolManagerAbi,
      functionName: "getSlot0",
      args: [poolId],
    });

    const q192 = 2n ** 192n;
    const priceX18 = (BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96) * 10n ** 18n) / q192;
    const feeAmount = (swapAmountIn * BigInt(fee)) / 1_000_000n;
    const amountAfterFee = swapAmountIn - feeAmount;
    const zeroForOne = BigInt(token0) < BigInt(token1);
    const amountOut = zeroForOne
      ? (amountAfterFee * priceX18) / 10n ** 18n
      : (amountAfterFee * 10n ** 18n) / priceX18;

    quote = [amountOut, priceX18];
    console.warn("getSwapQuote reverted, using fallback quote math.");
    console.log("Swap quote (fallback):", quote);
    void error;
  }

  const swapHash = await walletClient.writeContract({
    address: swap,
    abi: swapAbi,
    functionName: "executeSwap",
    args: [token0, token1, swapAmountIn, 0n, deadline],
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log("Swap tx:", swapHash);

  // Ensure token0 < token1 for pool key
  const [currency0, currency1] =
    token0.toLowerCase() < token1.toLowerCase()
      ? [token0, token1]
      : [token1, token0];

  const poolKeyEncoded = encodeAbiParameters(
    [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
    [currency0, currency1, env.POOL_FEE, env.TICK_SPACING, "0x0000000000000000000000000000000000000000"]
  );
  const poolId = keccak256(poolKeyEncoded);

  const canProvideLiquidity = bal0 >= liqAmount0 && bal1 >= liqAmount1;
  if (!canProvideLiquidity) {
    console.warn("Skipping add/collect/remove liquidity due to insufficient balances.");
    return;
  }

  const addHash = await walletClient.writeContract({
    address: rewards,
    abi: rewardsAbi,
    functionName: "addLiquidity",
    args: [
      currency0,
      currency1,
      currency0 === token0 ? liqAmount0 : liqAmount1,
      currency1 === token1 ? liqAmount1 : liqAmount0,
      -120,
      120,
      0n,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: addHash });
  console.log("Add liquidity tx:", addHash);

  const position = await publicClient.readContract({
    address: rewards,
    abi: rewardsAbi,
    functionName: "getUserPosition",
    args: [account.address, poolId],
  });
  const liquidity = (position as any).liquidity as bigint;
  console.log("Position liquidity:", liquidity.toString());

  // const collectHash = await walletClient.writeContract({
  //   address: rewards,
  //   abi: rewardsAbi,
  //   functionName: "collectFees",
  //   args: [poolId],
  // });
  // await publicClient.waitForTransactionReceipt({ hash: collectHash });
  // console.log("Collect fees tx:", collectHash);

  // if (liquidity > 0n) {
  //   const removeHash = await walletClient.writeContract({
  //     address: rewards,
  //     abi: rewardsAbi,
  //     functionName: "removeLiquidity",
  //     args: [poolId, liquidity, 0n, 0n],
  //   });
  //   await publicClient.waitForTransactionReceipt({ hash: removeHash });
  //   console.log("Remove liquidity tx:", removeHash);
  // }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
