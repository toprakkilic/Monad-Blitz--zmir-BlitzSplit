"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits } from "viem";
import { io, Socket } from "socket.io-client";
import Confetti from "react-confetti";
import {
  Dice6,
  Users,
  Crown,
  Skull,
  Loader2,
  Check,
  ArrowLeft,
  Wallet,
  Copy,
  Zap,
  CircleDollarSign,
} from "lucide-react";
import { usePermit } from "@/hooks/usePermit";
import { MONAD_SPLITTER_ADDRESS, MONAD_SPLITTER_ABI } from "@/config/abi";

const BACKEND_URL = "http://localhost:3001";

interface Player {
  address: string;
  hasSigned: boolean;
}

interface RoomState {
  roomId: string;
  hostAddress: string;
  totalAmount: number;
  players: Player[];
  status: string;
}

interface RouletteResultData {
  loserAddress: string;
  hostAddress: string;
  totalAmount: number;
  signatureData: {
    v: number;
    r: string;
    s: string;
    deadline: string;
    value: string;
    nonce: string;
  } | null;
  players: string[];
}

interface SettlementData {
  txHash: string;
  loser: string;
  amount: number;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  // Roulette state
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<RouletteResultData | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const spinnerRef = useRef<HTMLDivElement>(null);

  // Settlement state
  const [isSettling, setIsSettling] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [settlementTx, setSettlementTx] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const { signPermit, isLoading: isPermitLoading } = usePermit();

  // Write contract for settlement
  const {
    writeContract: executePayment,
    data: paymentHash,
    isPending: isPaymentPending,
  } = useWriteContract();

  const { isSuccess: isPaymentConfirmed } = useWaitForTransactionReceipt({
    hash: paymentHash,
  });

  // Handle payment confirmed
  useEffect(() => {
    if (isPaymentConfirmed && paymentHash && socket) {
      setIsSettling(false);
      setIsSettled(true);
      setShowConfetti(true);
      setSettlementTx(paymentHash);

      socket.emit("settlePayment", {
        roomId,
        txHash: paymentHash,
      });

      setTimeout(() => setShowConfetti(false), 8000);
    }
  }, [isPaymentConfirmed, paymentHash, socket, roomId]);

  // Socket connection
  useEffect(() => {
    const s = io(BACKEND_URL);
    setSocket(s);

    s.on("roomUpdated", (data: RoomState) => {
      setRoom(data);
      // Check if current user is already in the room
      if (address) {
        const playerInRoom = data.players.find(
          (p) => p.address === address.toLowerCase()
        );
        if (playerInRoom) {
          setHasJoined(true);
        } else {
          setHasJoined(false);
        }
      } else {
        setHasJoined(false);
      }
    });

    s.on("rouletteResult", (data: RouletteResultData) => {
      setIsSpinning(true);
      setSpinAngle(1440 + Math.random() * 720);

      // Show spinner for 3 seconds, then reveal result
      setTimeout(() => {
        setIsSpinning(false);
        setRouletteResult(data);
        setShowResult(true);
      }, 3000);
    });

    s.on("paymentSettled", (data: SettlementData) => {
      setIsSettled(true);
      setSettlementTx(data.txHash);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 8000);
    });

    return () => {
      s.disconnect();
    };
  }, [address]);

  // Fetch room info on mount
  useEffect(() => {
    if (roomId) {
      fetch(`${BACKEND_URL}/api/rooms/${roomId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setRoom(data);
            if (address) {
              const playerInRoom = data.players.find(
                (p: Player) => p.address === address.toLowerCase()
              );
              if (playerInRoom) {
                setHasJoined(true);
              } else {
                setHasJoined(false);
              }
            } else {
              setHasJoined(false);
            }
          }
        })
        .catch(console.error);
    }
  }, [roomId, address]);

  // Join room with permit signature
  const handleJoinRoom = useCallback(async () => {
    if (!socket || !address || !room) return;

    setIsJoining(true);

    try {
      const amount = parseUnits(room.totalAmount.toString(), 6);
      const signature = await signPermit(amount);

      if (!signature) {
        setIsJoining(false);
        return;
      }

      const signatureData = {
        v: signature.v,
        r: signature.r,
        s: signature.s,
        deadline: signature.deadline.toString(),
        value: signature.value.toString(),
        nonce: signature.nonce.toString(),
      };

      socket.emit(
        "joinRoomWithSignature",
        { roomId, userAddress: address, signatureData },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            setHasJoined(true);
          } else {
            console.error("Join failed:", response.error);
          }
          setIsJoining(false);
        }
      );
    } catch (err) {
      console.error("Join error:", err);
      setIsJoining(false);
    }
  }, [socket, address, room, roomId, signPermit]);

  // Host sign (when host is already in room but needs to sign permit)
  const handleHostSign = useCallback(async () => {
    if (!socket || !address || !room) return;

    setIsJoining(true);

    try {
      const amount = parseUnits(room.totalAmount.toString(), 6);
      const signature = await signPermit(amount);

      if (!signature) {
        setIsJoining(false);
        return;
      }

      const signatureData = {
        v: signature.v,
        r: signature.r,
        s: signature.s,
        deadline: signature.deadline.toString(),
        value: signature.value.toString(),
        nonce: signature.nonce.toString(),
      };

      socket.emit(
        "hostSign",
        { roomId, hostAddress: address, signatureData },
        () => {
          setIsJoining(false);
        }
      );
    } catch (err) {
      console.error("Host sign error:", err);
      setIsJoining(false);
    }
  }, [socket, address, room, roomId, signPermit]);

  // Spin roulette
  const handleSpin = useCallback(() => {
    if (!socket || !address) return;

    socket.emit(
      "spinRoulette",
      { roomId, hostAddress: address },
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          alert(response.error || "Spin failed");
        }
      }
    );
  }, [socket, address, roomId]);

  // Settle payment
  const handleSettle = useCallback(() => {
    if (!rouletteResult || !rouletteResult.signatureData) return;

    setIsSettling(true);

    const sig = rouletteResult.signatureData;

    executePayment({
      address: MONAD_SPLITTER_ADDRESS,
      abi: MONAD_SPLITTER_ABI,
      functionName: "executePayment",
      args: [
        rouletteResult.loserAddress as `0x${string}`,
        rouletteResult.hostAddress as `0x${string}`,
        BigInt(sig.value),
        BigInt(sig.deadline),
        sig.v,
        sig.r as `0x${string}`,
        sig.s as `0x${string}`,
      ],
    });
  }, [rouletteResult, executePayment]);

  const isHost = address && room && address.toLowerCase() === room.hostAddress;
  const isLoser =
    address && rouletteResult && address.toLowerCase() === rouletteResult.loserAddress;
  const currentPlayerSigned = room?.players.find(
    (p) => p.address === address?.toLowerCase()
  )?.hasSigned;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <Wallet className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Cüzdanını Bağla</h2>
          <p className="text-gray-400 text-sm mb-6">
            Lobiye girmek için cüzdanını bağlamalısın.
          </p>
          <button
            onClick={() => connect({ connector: injected() })}
            className="monad-gradient px-8 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            Cüzdan Bağla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={typeof window !== "undefined" ? window.innerWidth : 800}
          height={typeof window !== "undefined" ? window.innerHeight : 600}
          recycle={false}
          numberOfPieces={300}
          colors={["#7c3aed", "#4f46e5", "#6366f1", "#a78bfa", "#fbbf24", "#22c55e"]}
        />
      )}

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Ana Sayfa</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="glass-card px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-400">Oda:</span>
              <span className="font-mono font-bold text-purple-400">{roomId}</span>
              <button onClick={handleCopy} className="cursor-pointer">
                {copied ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-500 hover:text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Room Info */}
        {room && (
          <div className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl monad-gradient flex items-center justify-center pulse-glow">
                  <Dice6 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">
                    Rulet Masası
                  </h1>
                  <p className="text-xs text-gray-500">
                    #{roomId} &bull;{" "}
                    {room.status === "waiting"
                      ? "Oyuncular Bekleniyor"
                      : room.status === "spinning"
                      ? "Rulet Dönüyor!"
                      : "Ödeme Yapıldı ✅"}
                  </p>
                </div>
              </div>

              <div className="glass-card px-4 py-2 flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-green-400" />
                <span className="font-bold text-lg">
                  {room.totalAmount} mUSDC
                </span>
              </div>
            </div>

            {/* Players */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Oyuncular ({room.players.length})
              </h3>

              <div className="grid gap-2">
                {room.players.map((player, index) => (
                  <div
                    key={player.address}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      rouletteResult &&
                      showResult &&
                      player.address === rouletteResult.loserAddress
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          player.address === room.hostAddress
                            ? "monad-gradient"
                            : "bg-white/10"
                        }`}
                      >
                        {player.address === room.hostAddress ? (
                          <Crown className="w-4 h-4 text-yellow-300" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-sm">
                          {player.address.slice(0, 6)}...
                          {player.address.slice(-4)}
                          {player.address === address?.toLowerCase() && (
                            <span className="ml-2 text-xs text-purple-400">
                              (Sen)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {player.address === room.hostAddress
                            ? "Host"
                            : "Oyuncu"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {player.hasSigned ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 glass-card px-2 py-1">
                          <Check className="w-3 h-3" />
                          İmzaladı
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 glass-card px-2 py-1">
                          Bekliyor...
                        </span>
                      )}

                      {rouletteResult &&
                        showResult &&
                        player.address === rouletteResult.loserAddress && (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-bold">
                            <Skull className="w-4 h-4" />
                            KAYIP
                          </span>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Area */}
        <div className="space-y-4">
          {/* Join / Sign buttons */}
          {room && !hasJoined && !isHost && (
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || isPermitLoading}
              className="w-full monad-gradient py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
              {isJoining || isPermitLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  İmza Atılıyor...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  İmzala ve Katıl ({room.totalAmount} mUSDC)
                </>
              )}
            </button>
          )}

          {/* Host sign button */}
          {room && isHost && !currentPlayerSigned && !showResult && (
            <button
              onClick={handleHostSign}
              disabled={isJoining || isPermitLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
              {isJoining || isPermitLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  İmza Atılıyor...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Sen de İmzala (Host)
                </>
              )}
            </button>
          )}

          {/* Roulette Spinner Visual */}
          {isSpinning && (
            <div className="glass-card p-8 text-center">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div
                  ref={spinnerRef}
                  className="w-full h-full rounded-full border-4 border-purple-500/30 flex items-center justify-center"
                  style={{
                    transform: `rotate(${spinAngle}deg)`,
                    transition: "transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)",
                  }}
                >
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  <Dice6 className="w-16 h-16 text-purple-400 animate-pulse" />
                </div>
                {/* Pointer */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[16px] border-t-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold gradient-text animate-pulse">
                Rulet Dönüyor...
              </h2>
              <p className="text-gray-400 mt-2">Kim ödeyecek? 🎰</p>
            </div>
          )}

          {/* Roulette Result */}
          {showResult && rouletteResult && !isSettled && (
            <div className="glass-card p-8 text-center">
              {isLoser ? (
                // Loser view
                <div className="space-y-4">
                  <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto border-2 border-red-500/50">
                    <Skull className="w-12 h-12 text-red-400" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-red-400">
                    HESAP SANA KALDI 💀
                  </h2>
                  <p className="text-gray-400">
                    {rouletteResult.totalAmount} mUSDC hesabını sen ödüyorsun!
                  </p>
                  <p className="text-sm text-gray-500">
                    Permit imzanla ödeme host tarafından çekilecek...
                  </p>
                </div>
              ) : isHost ? (
                // Host view - can settle
                <div className="space-y-4">
                  <div className="w-24 h-24 rounded-full monad-gradient flex items-center justify-center mx-auto pulse-glow">
                    <Crown className="w-12 h-12 text-yellow-300" />
                  </div>
                  <h2 className="text-2xl font-bold gradient-text">
                    Kaybeden Belli Oldu!
                  </h2>
                  <p className="text-gray-400">
                    <span className="font-mono text-red-400">
                      {rouletteResult.loserAddress.slice(0, 6)}...
                      {rouletteResult.loserAddress.slice(-4)}
                    </span>{" "}
                    {rouletteResult.totalAmount} mUSDC ödeyecek!
                  </p>

                  <button
                    onClick={handleSettle}
                    disabled={isSettling || isPaymentPending}
                    className="monad-gradient px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto cursor-pointer"
                  >
                    {isSettling || isPaymentPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        İşleniyor...
                      </>
                    ) : (
                      <>
                        <CircleDollarSign className="w-5 h-5" />
                        Hesabı Çek (Settle)
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // Spectator view
                <div className="space-y-4">
                  <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto border-2 border-green-500/50">
                    <Check className="w-12 h-12 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-400">
                    Sen Kurtardın! 🎉
                  </h2>
                  <p className="text-gray-400">
                    <span className="font-mono text-red-400">
                      {rouletteResult.loserAddress.slice(0, 6)}...
                      {rouletteResult.loserAddress.slice(-4)}
                    </span>{" "}
                    kaybetti!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Settlement Success */}
          {isSettled && (
            <div className="glass-card p-8 text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto border-2 border-green-500/50 pulse-glow">
                <Check className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-3xl font-extrabold text-green-400">
                Ödeme Tamamlandı! 🎉
              </h2>
              {settlementTx && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${settlementTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-purple-400 hover:text-purple-300 underline"
                >
                  İşlemi Görüntüle ↗
                </a>
              )}
              <button
                onClick={() => router.push("/")}
                className="glass-card px-6 py-3 hover:border-purple-500/30 transition-colors mt-4 cursor-pointer"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          )}

          {/* Spin Button (Host only, when room is ready) */}
          {room &&
            isHost &&
            !isSpinning &&
            !showResult &&
            !isSettled &&
            room.players.length >= 2 && (
              <button
                onClick={handleSpin}
                className="w-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 py-5 rounded-xl font-extrabold text-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-3 pulse-glow cursor-pointer"
              >
                <Dice6 className="w-7 h-7" />
                🎰 Ruleti Çevir!
              </button>
            )}

          {/* Waiting message for non-host */}
          {room && !isHost && hasJoined && !isSpinning && !showResult && !isSettled && (
            <div className="glass-card p-6 text-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400">
                Host&apos;un ruleti çevirmesini bekliyorsun...
              </p>
            </div>
          )}

          {/* Need more players */}
          {room && isHost && room.players.length < 2 && !showResult && (
            <div className="glass-card p-6 text-center">
              <Users className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">
                En az 2 oyuncu gerekli. Oda kodunu paylaş:{" "}
                <span className="font-mono font-bold text-purple-400">
                  {roomId}
                </span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
