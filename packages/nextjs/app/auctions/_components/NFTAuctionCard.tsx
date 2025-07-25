import { useEffect, useState } from "react";
import { Auction } from "./Auctions";
import { parseGwei } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const NFTAuctionCard = ({ auction }: { auction: Auction }) => {
  const [bidAmount, setBidAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    ended: false,
  });

  const { writeContractAsync: placeBidAsync } = useScaffoldWriteContract({
    contractName: "NftAuctions",
  });

  // Optional: Fetch current highest bid to validate against
  const { data: currentHighestBid } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: "getAuction",
    args: [BigInt(auction.auctionId)],
  });

  const handlePlaceBid = async () => {
    if (!bidAmount) {
      return;
    }

    const bidAmountInWei = parseGwei(bidAmount);
    const minBid = currentHighestBid?.highestBid || auction.startingPrice;

    if (bidAmountInWei <= minBid) {
      return;
    }

    setIsLoading(true);

    try {
      await placeBidAsync({
        functionName: "placeBid",
        args: [BigInt(auction.auctionId)],
        value: bidAmountInWei,
      });
      // Success - you might want to add toast notification here
      setBidAmount("");
    } catch (err: any) {
      console.error("Bid placement failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = Number(auction.endTime);
      const totalSeconds = Math.max(0, endTime - now);

      if (totalSeconds <= 0) {
        setTimeRemaining({
          hours: 0,
          minutes: 0,
          seconds: 0,
          ended: true,
        });
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

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [auction.endTime]);

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[325px] shadow-secondary">
      <figure className="relative">
        <img src={auction.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 rounded-xl">
          <span className="text-white"># {auction.tokenId}</span>
        </figcaption>
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{auction.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {auction.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary px-1.5">
                {attr.value}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center mt-1 space-y-4">
          <div className="flex gap-2 items-center">
            <span className="font-semibold min-w-[120px]">Auction ID:</span>
            <span>{auction.auctionId}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-semibold min-w-[120px]">Seller:</span>
            <Address address={auction.seller} />
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-semibold min-w-[120px]">Highest Bidder:</span>
            <Address address={auction.highestBidder} />
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-semibold min-w-[120px]">Current Bid:</span>
            <span>{(auction.highestBid / BigInt(1e9)).toString()} Gwei</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-semibold min-w-[120px]">Starting Price:</span>
            <span>{(auction.startingPrice / BigInt(1e9)).toString()} Gwei</span>
          </div>
        </div>

        <div className="text-center">
          <span className="font-semibold">Time Remaining: </span>
          {timeRemaining.ended ? (
            <span className="text-error">Auction Ended</span>
          ) : (
            <span>
              {timeRemaining.hours.toString().padStart(2, "0")}:{timeRemaining.minutes.toString().padStart(2, "0")}:
              {timeRemaining.seconds.toString().padStart(2, "0")}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Your Bid (Gwei)</span>
            </label>
            <input
              type="number"
              step="1"
              min={(Number(auction.highestBid) / 10 ** 9 + 1).toString()}
              placeholder={`Min: ${(Number(auction.highestBid) / 10 ** 9 + 1).toString()} Gwei`}
              className="input input-bordered w-full"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
            />
          </div>

          <button
            className={`btn btn-primary w-full ${isLoading ? "loading" : ""}`}
            onClick={handlePlaceBid}
            disabled={isLoading || Date.now() / 1000 > auction.endTime}
          >
            {isLoading ? "Placing Bid..." : "Place Bid"}
            {Date.now() / 1000 > auction.endTime && " (Auction Ended)"}
          </button>
        </div>
      </div>
    </div>
  );
};
