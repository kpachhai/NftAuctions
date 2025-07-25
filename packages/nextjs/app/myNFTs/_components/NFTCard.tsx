import { useState } from "react";
import { Collectible } from "./MyHoldings";
import { parseEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [startingPrice, setStartingPrice] = useState("0.1"); // Default 0.1 ETH
  const [durationMinutes, setDurationMinutes] = useState("1440"); // Default 24 hours
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

    if (!startingPrice || !durationMinutes) {
      setError("Please fill all fields");
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
          parseEther(startingPrice),
          BigInt(durationMinutes),
        ],
      });
      console.log("Auction TX:", auctionTx);
    } catch (err: any) {
      console.error("Auction creation failed:", err);
      setError(err.message || "Failed to create auction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        {/* eslint-disable-next-line  */}
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 rounded-xl">
          <span className="text-white "># {nft.id}</span>
        </figcaption>
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{nft.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {nft.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary px-1.5">
                {attr.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{nft.description}</p>
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Owner : </span>
          <Address address={nft.owner} />
        </div>
        <div className="card-actions justify-end">
          <div className="flex flex-col gap-2 w-full">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Starting Price (ETH)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.1"
                className="input input-bordered"
                value={startingPrice}
                onChange={e => setStartingPrice(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Duration (minutes)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="1440"
                className="input input-bordered"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              className={`btn btn-secondary btn-md px-8 tracking-wide ${isLoading ? "loading" : ""}`}
              onClick={handleCreateAuction}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Auction NFT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
