"use client";

import { MyHoldings } from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  // Contract owner detection
  const { data: contractOwner } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "owner",
  });

  const isOwner = connectedAddress && contractOwner && connectedAddress.toLowerCase() === contractOwner.toLowerCase();

  // Royalty data
  const { data: royaltyPercentage } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "royaltyPercentage",
  });

  const { data: royaltyReceiver } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "royaltyReceiver",
  });

  const handleMintItem = async () => {
    // circle back to the zero item if we've reached the end of the array
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const currentTokenMetaData = nftsMetadata[tokenIdCounterNumber % nftsMetadata.length];
    const notificationId = notification.loading("Uploading to IPFS");
    try {
      const uploadedItem = await addToIPFS(currentTokenMetaData);

      // First remove previous loading notification and then show success notification
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      await writeContractAsync({
        functionName: "mintItem",
        args: [connectedAddress, uploadedItem.path],
      });
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
    }
  };

  const formatRoyaltyPercentage = (percentage: bigint | undefined) => {
    if (!percentage) return "Loading...";
    return `${Number(percentage) / 100}%`;
  };

  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">My NFTs</span>
          </h1>
        </div>
      </div>

      {/* Contract Owner Info */}
      {isConnected && isOwner && (
        <div className="flex justify-center mb-4">
          <div className="alert alert-success">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>You are the contract owner! You can configure royalty settings.</span>
          </div>
        </div>
      )}

      {/* Royalty Settings Section */}
      {isConnected && isOwner && (
        <div className="flex justify-center mb-6">
          <div className="card w-96 bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Royalty Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-semibold">Current Royalty Percentage</span>
                  </label>
                  <div className="text-lg font-semibold text-primary">{formatRoyaltyPercentage(royaltyPercentage)}</div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-semibold">Current Royalty Receiver</span>
                  </label>
                  <div className="text-sm">
                    <Address address={royaltyReceiver} />
                  </div>
                </div>

                <div className="divider">Update Settings</div>

                <div>
                  <label className="label">
                    <span className="label-text">New Royalty Percentage (0-100%)</span>
                  </label>
                  <input type="number" placeholder="10" className="input input-bordered w-full" min="0" max="100" />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">New Royalty Receiver</span>
                  </label>
                  <input type="text" placeholder="0x..." className="input input-bordered w-full" />
                </div>

                <div className="card-actions justify-end">
                  <button className="btn btn-primary">Update Royalty Settings</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        {!isConnected || isConnecting ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <button className="btn btn-secondary" onClick={handleMintItem}>
            Mint NFT
          </button>
        )}
      </div>
      <MyHoldings />
    </>
  );
};

export default MyNFTs;
