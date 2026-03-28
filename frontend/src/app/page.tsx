"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits, formatUnits } from "viem";
import { io, Socket } from "socket.io-client";
import {
  Dice6,
  Wallet,
  Plus,
  LogIn,
  Coins,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { MOCK_USDC_ADDRESS, MOCK_USDC_ABI } from "@/config/abi";
import { monadTestnet } from "@/config/wagmi";
import { useRouter } from "next/navigation";

const BACKEND_URL = "http://localhost:3001";

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  const isWrongNetwork = isConnected && chainId !== monadTestnet.id;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);

  // Read USDC balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Mint MockUSDC
  const {
    writeContract: mintUSDC,
    data: mintHash,
    isPending: isMintPending,
  } = useWriteContract();

  const { isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  useEffect(() => {
    if (isMintConfirmed) {
      setIsMinting(false);
      setMintSuccess(true);
      refetchBalance();
      setTimeout(() => setMintSuccess(false), 3000);
    }
  }, [isMintConfirmed, refetchBalance]);

  // Socket connection
  useEffect(() => {
    const s = io(BACKEND_URL);
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const handleMint = () => {
    if (!address) return;
    setIsMinting(true);
    mintUSDC({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "mint",
      args: [parseUnits("1000", 6)],
    });
  };

  const handleCreateRoom = useCallback(() => {
    if (!socket || !address || !totalAmount) return;

    socket.emit(
      "createRoom",
      { hostAddress: address, totalAmount: Number(totalAmount) },
      (response: { success: boolean; roomId: string }) => {
        if (response.success) {
          setCreatedRoomId(response.roomId);
        }
      }
    );
  }, [socket, address, totalAmount]);

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(createdRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToLobby = () => {
    router.push(`/lobby/${createdRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!joinRoomId) return;
    router.push(`/lobby/${joinRoomId}`);
  };

  const formattedBalance = balance
    ? parseFloat(formatUnits(balance as bigint, 6)).toLocaleString()
    : "0";

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl monad-gradient flex items-center justify-center pulse-glow">
              <Dice6 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Monad SplitIt</h1>
              <p className="text-xs text-gray-500">Monad Testnet</p>
            </div>
          </div>

          {isConnected ? (
            isWrongNetwork ? (
              <button
                onClick={() => switchChain({ chainId: monadTestnet.id })}
                className="bg-red-500/10 text-red-400 border border-red-500/30 px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                Yanlış Ağ! Monad'a Geç
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="glass-card px-4 py-2 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">{formattedBalance} mUSDC</span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="glass-card px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </button>
              </div>
            )
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="monad-gradient px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              Cüzdan Bağla
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-6">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-300">
              Powered by Monad &bull; EIP-2612 Gasless Permits
            </span>
          </div>

          <h2 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6">
            <span className="gradient-text">Monad SplitIt</span>{" "}
            <span className="text-6xl sm:text-8xl">🎲</span>
          </h2>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4">
            Hesabı kim ödeyecek? Rulet çevir, kader karar versin!
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            Sıfır gas maliyetiyle cüzdanını bağla, imzanı at, ruleti çevir.
            Kaybeden öder. Basit. Adil. On-chain.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: <Shield className="w-6 h-6" />,
              title: "Gasless İmza",
              desc: "EIP-2612 Permit ile sıfır gas maliyetli harcama izni. Sadece imzala, ödeme yokken gas yok.",
              color: "text-purple-400",
            },
            {
              icon: <Dice6 className="w-6 h-6" />,
              title: "Adil Rulet",
              desc: "Rastgele seçim ile herkes eşit şansta. Kim ödeyecek? Kadere bırak!",
              color: "text-indigo-400",
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: "Anlık Çok Oyunculu",
              desc: "Socket.io ile gerçek zamanlı oda sistemi. Arkadaşlarınla anında masaya otur.",
              color: "text-violet-400",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="glass-card p-6 hover:border-purple-500/30 transition-all duration-300 group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 ${f.color} group-hover:scale-110 transition-transform`}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Action Cards */}
        {isConnected && (
          isWrongNetwork ? (
            <div className="glass-card p-10 max-w-lg mx-auto text-center border-red-500/20">
              <Zap className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ağ Hatası</h3>
              <p className="text-sm text-gray-400 mb-6">
                Lütfen oyuna devam etmek için Monad Testnet ana ağına geçiş yapın.
              </p>
              <button
                onClick={() => switchChain({ chainId: monadTestnet.id })}
                className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-medium transition-colors cursor-pointer"
              >
                Ağı Otomatik Değiştir
              </button>
            </div>
          ) : (
            <div className="space-y-8">
            {/* Faucet */}
            <div className="glass-card p-6 max-w-lg mx-auto text-center">
              <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                MockUSDC Faucet
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Test için 1000 mUSDC al. Monad Testnet üzerinde ücretsiz.
              </p>
              <button
                onClick={handleMint}
                disabled={isMintPending || isMinting}
                className="monad-gradient px-8 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                {isMintPending || isMinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    İşleniyor...
                  </>
                ) : mintSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-green-300" />
                    1000 mUSDC Alındı!
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    1000 MockUSDC İste
                  </>
                )}
              </button>
            </div>

            {/* Room Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Create Room */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="glass-card p-6 text-left hover:border-purple-500/30 transition-all duration-300 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl monad-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Masa Kur</h3>
                <p className="text-sm text-gray-400">
                  Yeni bir rulet masası oluştur ve arkadaşlarını davet et.
                </p>
                <ArrowRight className="w-4 h-4 text-purple-400 mt-3 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Join Room */}
              <button
                onClick={() => setShowJoinModal(true)}
                className="glass-card p-6 text-left hover:border-indigo-500/30 transition-all duration-300 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LogIn className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Masaya Katıl</h3>
                <p className="text-sm text-gray-400">
                  5 haneli oda kodu ile mevcut bir masaya otur.
                </p>
                <ArrowRight className="w-4 h-4 text-indigo-400 mt-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
          )
        )}

        {/* Not Connected State */}
        {!isConnected && (
          <div className="text-center glass-card p-10 max-w-lg mx-auto">
            <Wallet className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Cüzdanını Bağla</h3>
            <p className="text-sm text-gray-400 mb-6">
              Monad SplitIt&apos;i kullanmak için MetaMask veya uyumlu bir cüzdan bağla.
            </p>
            <button
              onClick={() => connect({ connector: injected() })}
              className="monad-gradient px-8 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Cüzdan Bağla
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between text-sm text-gray-500">
          <span>Monad Blitz Hackathon 2026 🏆</span>
          <span>Built on Monad Testnet</span>
        </div>
      </footer>

      {/* ========== CREATE ROOM MODAL ========== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-8 w-full max-w-md mx-4 relative">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setCreatedRoomId("");
                setTotalAmount("");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Dice6 className="w-5 h-5 text-purple-400" />
              Yeni Masa Kur
            </h3>

            {!createdRoomId ? (
              <>
                <label className="block text-sm text-gray-400 mb-2">
                  Toplam Hesap (mUSDC)
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="Örn: 50"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none transition-colors mb-6"
                />
                <button
                  onClick={handleCreateRoom}
                  disabled={!totalAmount}
                  className="w-full monad-gradient py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Masa Oluştur
                </button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full monad-gradient flex items-center justify-center mx-auto pulse-glow">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-400">Oda kodu:</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-mono font-bold tracking-widest gradient-text">
                    {createdRoomId}
                  </span>
                  <button
                    onClick={handleCopyRoomId}
                    className="glass-card p-2 hover:border-purple-500/30 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Bu kodu arkadaşlarınla paylaş!
                </p>
                <button
                  onClick={handleGoToLobby}
                  className="w-full monad-gradient py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                >
                  Lobiye Git
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== JOIN ROOM MODAL ========== */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-8 w-full max-w-md mx-4 relative">
            <button
              onClick={() => {
                setShowJoinModal(false);
                setJoinRoomId("");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-indigo-400" />
              Masaya Katıl
            </h3>

            <label className="block text-sm text-gray-400 mb-2">
              Oda Kodu (5 haneli)
            </label>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Örn: 12345"
              maxLength={5}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest placeholder:text-gray-600 focus:border-indigo-500/50 focus:outline-none transition-colors mb-6"
            />
            <button
              onClick={handleJoinRoom}
              disabled={joinRoomId.length !== 5}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Katıl
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
