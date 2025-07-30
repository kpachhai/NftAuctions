"use client";

import { useState } from "react";
import Image from "next/image";
import { parseGwei } from "viem";
import { useScaffoldContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

// Use the same interface as MyHoldings to avoid type conflicts
interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [startingPrice, setStartingPrice] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: nftAuctionsContract } = useScaffoldContract({
    contractName: "NftAuctions",
  });

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { writeContractAsync: approveAsync } = useScaffoldWriteContract({
    contractName: "YourCollectible",
  });

  const { writeContractAsync: createAuctionAsync } = useScaffoldWriteContract({
    contractName: "NftAuctions",
  });

  const handleCreateAuction = async () => {
    if (!nftAuctionsContract?.address || !yourCollectibleContract?.address) {
      setError("Contracts not loaded");
      return;
    }

    if (!startingPrice || !durationSeconds) {
      setError("Please fill all fields");
      return;
    }

    const parsedPrice = parseFloat(startingPrice);
    const parsedDuration = parseInt(durationSeconds);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter a valid starting price");
      return;
    }

    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setError("Please enter a valid duration in seconds");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const approveTx = await approveAsync({
        functionName: "approve",
        args: [nftAuctionsContract.address, BigInt(nft.id.toString())],
      });
      console.log("Approval TX:", approveTx);

      const auctionTx = await createAuctionAsync({
        functionName: "createAuction",
        args: [
          yourCollectibleContract.address,
          BigInt(nft.id.toString()),
          parseGwei(startingPrice),
          BigInt(durationSeconds),
        ],
      });

      console.log("Auction Creation TX:", auctionTx);
      setStartingPrice("");
      setDurationSeconds("");
      setError("Auction created successfully!");
    } catch (error: any) {
      console.error("Error creating auction:", error);
      setError(error.message || "Failed to create auction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-80">
      <figure className="relative">
        <Image
          src={
            nft.image ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-family='Arial' font-size='16'%3ENFT Image%3C/text%3E%3C/svg%3E"
          }
          alt={nft.name || `NFT #${nft.id}`}
          width={320}
          height={240}
          className="h-60 w-full object-cover"
        />
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <div className="flex flex-col text-center">
            <span className="text-lg font-bold">{nft.name || `NFT #${nft.id}`}</span>
            <span className="text-base-content text-xs">#{nft.id}</span>
          </div>
        </div>

        {nft.description && <p className="text-sm text-center text-base-content/70 line-clamp-2">{nft.description}</p>}

        {nft.attributes && nft.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {nft.attributes.slice(0, 3).map((attr, index) => (
              <span key={index} className="badge badge-outline badge-sm">
                {attr.trait_type}: {attr.value}
              </span>
            ))}
            {nft.attributes.length > 3 && (
              <span className="badge badge-outline badge-sm">+{nft.attributes.length - 3} more</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="Starting price (Gwei)"
            className="input input-bordered input-sm"
            value={startingPrice}
            onChange={e => setStartingPrice(e.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Duration (seconds)"
            className="input input-bordered input-sm"
            value={durationSeconds}
            onChange={e => setDurationSeconds(e.target.value)}
          />
        </div>

        {error && (
          <div className={`text-xs text-center ${error.includes("successfully") ? "text-success" : "text-error"}`}>
            {error}
          </div>
        )}

        <div className="card-actions justify-center">
          <button className="btn btn-primary btn-sm" onClick={handleCreateAuction} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Auction"}
          </button>
        </div>
      </div>
    </div>
  );
};
