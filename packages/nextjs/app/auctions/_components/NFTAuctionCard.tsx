"use client";

import { useEffect, useState } from "react";
<<<<<<< HEAD
import { formatEther, parseGwei } from "viem";
=======
import { Auction } from "./Auctions";
import { parseGwei } from "viem";
>>>>>>> 2c086f0 (Add auction royalties and  withdrawal functions, make blockchain auto-mine and adjust UI to display relevant info)
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { Auction } from "~~/types/nft";
import { notification } from "~~/utils/scaffold-eth";

export const NFTAuctionCard = ({ auction }: { auction: Auction }) => {
  const { address: connectedAddress } = useAccount();
  const [bidAmount, setBidAmount] = useState("");
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    ended: false,
  });
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [isBidLoading, setIsBidLoading] = useState(false);

  const { address: connectedAddress } = useAccount();

  const { writeContractAsync: placeBidAsync } = useScaffoldWriteContract({
    contractName: "NftAuctions",
  });

  const { writeContractAsync: endAuctionAsync } = useScaffoldWriteContract({
    contractName: "NftAuctions",
  });

  const { data: currentAuctionState, refetch: refetchAuctionState } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: "getAuction",
    args: [auction.auctionId],
    watch: true,
  });

  // Check if current user is the seller
  const isSeller = connectedAddress?.toLowerCase() === auction.seller.toLowerCase();

  // Check if current user is the owner (for emergency withdraw)
  const { data: contractOwner } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: "owner",
  });
  const isOwner = connectedAddress?.toLowerCase() === contractOwner?.toLowerCase();

  // Check if auction can be withdrawn (no bids placed)
  const canWithdraw = auction.highestBidder === "0x0000000000000000000000000000000000000000";

  const handlePlaceBid = async () => {
    if (!bidAmount) {
      notification.error("Please enter a bid amount");
      return;
    }

    const bidAmountInWei = parseGwei(bidAmount);
    const minBid = currentAuctionState?.highestBid || auction.startingPrice;

    if (bidAmountInWei <= minBid) {
      notification.error(`Bid must be higher than ${formatEther(minBid)} ETH`);
      return;
    }

    setIsBidLoading(true);
    try {
      await placeBidAsync({
        functionName: "placeBid",
        args: [auction.auctionId],
        value: bidAmountInWei,
      });
      notification.success("Bid placed successfully!");
      setBidAmount("");
    } catch (err: any) {
      console.error("Bid placement failed:", err);
      notification.error("Failed to place bid");
    } finally {
      setIsBidLoading(false);
    }
  };

  const handleClaimNFT = async () => {
    setIsClaimLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const endTime = Number(currentAuctionState?.endTime || auction.endTime);

      if (now < endTime) {
        throw new Error("Auction has not yet ended");
      }

      await endAuctionAsync({
        functionName: "endAuction",
        args: [auction.auctionId],
      });
      notification.success("NFT claimed successfully!");
    } catch (err: any) {
      console.error("Claim NFT failed:", err);
      notification.error("Failed to claim NFT: " + (err.message || "Unknown error"));
    } finally {
      setIsClaimLoading(false);
      refetchAuctionState();
    }
  };

  const handleWithdrawAuction = async () => {
    try {
      await placeBidAsync({
        functionName: "withdrawAuction",
        args: [BigInt(auction.auctionId)],
      });
    } catch (err: any) {
      console.error("Withdraw auction failed:", err);
    }
  };

  const handleEmergencyWithdraw = async () => {
    try {
      await placeBidAsync({
        functionName: "emergencyWithdraw",
        args: [BigInt(auction.auctionId)],
      });
    } catch (err: any) {
      console.error("Emergency withdraw failed:", err);
    }
  };

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = Number(currentAuctionState?.endTime || auction.endTime);
      const totalSeconds = Math.max(0, endTime - now);

      if (totalSeconds <= 0) {
        setTimeRemaining({
          hours: 0,
          minutes: 0,
          seconds: 0,
          ended: true,
        });
        refetchAuctionState(); // Fetch the latest auction state once the countdown ends
        return;
      }

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeRemaining({
        hours,
        minutes,
        seconds,
        ended: false,
      });
    };

    updateCountdown(); // Initial update
    const interval = setInterval(updateCountdown, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on unmount
  }, [currentAuctionState?.endTime, auction.endTime, refetchAuctionState]);

  const canClaim = () => {
    if (!connectedAddress || !currentAuctionState) return false;

    const highestBidder = currentAuctionState.highestBidder || auction.highestBidder;
    const seller = auction.seller;

    return (
      connectedAddress.toLowerCase() === highestBidder?.toLowerCase() ||
      (connectedAddress.toLowerCase() === seller.toLowerCase() &&
        (!highestBidder || highestBidder === "0x0000000000000000000000000000000000000000"))
    );
  };

  const isAuctionEnded = timeRemaining.ended || currentAuctionState?.ended || auction.ended;
  const currentHighestBid = currentAuctionState?.highestBid || auction.highestBid;
  const currentHighestBidder = currentAuctionState?.highestBidder || auction.highestBidder;

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[325px] shadow-secondary">
      <figure className="relative">
        <img src={auction.image} alt="NFT Image" className="h-60 min-w-full object-cover" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 rounded-xl">
          <span className="text-white">#{auction.tokenId.toString()}</span>
        </figcaption>
        {isAuctionEnded && <div className="absolute top-4 right-4 badge badge-error">ENDED</div>}
      </figure>

      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <div className="flex flex-col text-center">
            <span className="text-lg font-bold">{auction.name}</span>
            <span className="text-base-content text-xs">
              Seller: <Address address={auction.seller} size="xs" />
            </span>
          </div>
        </div>

        <div className="flex justify-between">
          <div className="text-sm">
            <span className="text-base-content/70">Starting Price:</span>
            <br />
            <span className="font-bold">{formatEther(auction.startingPrice)} ETH</span>
          </div>
          <div className="text-sm text-right">
            <span className="text-base-content/70">Current Bid:</span>
            <br />
            <span className="font-bold">{formatEther(currentHighestBid)} ETH</span>
          </div>
        </div>

        {currentHighestBidder && currentHighestBidder !== "0x0000000000000000000000000000000000000000" && (
          <div className="text-sm text-center">
            <span className="text-base-content/70">Highest Bidder:</span>
            <br />
            <Address address={currentHighestBidder} size="xs" />
          </div>
        )}

        <div className="text-center">
          {isAuctionEnded ? (
            <div className="text-error font-bold">Auction Ended</div>
          ) : (
            <div className="text-success font-bold">
              {" "}
              {/* Updated color to make it more visible */}
              Time Remaining: {timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s
            </div>
          )}
        </div>

        {!isAuctionEnded && connectedAddress && auction.seller.toLowerCase() !== connectedAddress.toLowerCase() && (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="Bid amount (Gwei)"
              className="input input-bordered input-sm"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={handlePlaceBid} disabled={isBidLoading || !bidAmount}>
              {isBidLoading ? "Placing Bid..." : "Place Bid"}
            </button>
          </div>
        )}

<<<<<<< HEAD
        {isAuctionEnded && canClaim() && !currentAuctionState?.ended && (
          <button className="btn btn-success btn-sm" onClick={handleClaimNFT} disabled={isClaimLoading}>
            {isClaimLoading ? "Claiming..." : "Claim NFT"}
=======
          <button
            className={`btn btn-primary w-full`}
            onClick={handlePlaceBid}
            disabled={Date.now() / 1000 > auction.endTime || auction.ended}
          >
            {"Place Bid"}
            {(Date.now() / 1000 > auction.endTime || auction.ended) && " (Auction Ended)"}
>>>>>>> 2c086f0 (Add auction royalties and  withdrawal functions, make blockchain auto-mine and adjust UI to display relevant info)
          </button>
        )}

<<<<<<< HEAD
        {isAuctionEnded && currentAuctionState?.ended && (
          <div className="text-center text-success font-bold">NFT Claimed</div>
        )}

        {auction.seller.toLowerCase() === connectedAddress?.toLowerCase() && (
          <div className="text-center text-info text-xs">You are the seller</div>
        )}
=======
          <button
            className={`btn btn-primary w-full`}
            onClick={handleClaimNFT}
            disabled={Date.now() / 1000 < auction.endTime}
          >
            {"Claim NFT"}
          </button>

          {/* Seller Withdraw Button - Only show if user is seller and no bids */}
          {isSeller && canWithdraw && (
            <button className="btn btn-warning w-full" onClick={handleWithdrawAuction} disabled={auction.ended}>
              Withdraw Auction
            </button>
          )}

          {/* Owner Emergency Withdraw Button - Only show if user is owner */}
          {isOwner && (
            <button className="btn btn-error w-full" onClick={handleEmergencyWithdraw} disabled={auction.ended}>
              Emergency Withdraw
            </button>
          )}
        </div>
>>>>>>> 2c086f0 (Add auction royalties and  withdrawal functions, make blockchain auto-mine and adjust UI to display relevant info)
      </div>
    </div>
  );
};
