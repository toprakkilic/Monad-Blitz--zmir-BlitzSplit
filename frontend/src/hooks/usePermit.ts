"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignTypedData, useReadContract, useChainId, useSwitchChain } from "wagmi";
import { MOCK_USDC_ADDRESS, MOCK_USDC_ABI, MONAD_SPLITTER_ADDRESS } from "@/config/abi";
import { monadTestnet } from "@/config/wagmi";

// EIP-2612 Permit type definitions
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

interface PermitSignatureData {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
  value: bigint;
  nonce: bigint;
  owner: `0x${string}`;
  spender: `0x${string}`;
}

interface UsePermitReturn {
  signPermit: (amount: bigint) => Promise<PermitSignatureData | null>;
  isLoading: boolean;
  error: string | null;
}

export function usePermit(): UsePermitReturn {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read current nonce for the user
  const { data: nonce } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "nonces",
    args: address ? [address] : undefined,
  });

  const signPermit = useCallback(
    async (amount: bigint): Promise<PermitSignatureData | null> => {
      if (!address) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      // Check if user is on the right network before signing
      if (chainId !== monadTestnet.id) {
        try {
          await switchChainAsync({ chainId: monadTestnet.id });
        } catch (switchErr) {
          setError("Lütfen Monad Testnet ağına geçiş yapın.");
          setIsLoading(false);
          return null;
        }
      }

      try {
        const currentNonce = nonce ?? BigInt(0);
        // Set deadline to 1 hour from now
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const spender = MONAD_SPLITTER_ADDRESS;

        const domain = {
          name: "Mock USDC",
          version: "1",
          chainId: BigInt(monadTestnet.id),
          verifyingContract: MOCK_USDC_ADDRESS,
        };

        const message = {
          owner: address,
          spender,
          value: amount,
          nonce: currentNonce,
          deadline,
        };

        // Sign the typed data (EIP-712)
        const signature = await signTypedDataAsync({
          domain,
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message,
        });

        // Parse signature into v, r, s components
        const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
        const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
        const v = parseInt(signature.slice(130, 132), 16);

        const result: PermitSignatureData = {
          v,
          r,
          s,
          deadline,
          value: amount,
          nonce: currentNonce,
          owner: address,
          spender,
        };

        setIsLoading(false);
        return result;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to sign permit";
        console.error("Permit signing failed:", err);
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    },
    [address, nonce, signTypedDataAsync]
  );

  return { signPermit, isLoading, error };
}
