"use client";

import { useCallback, useEffect, useState } from "react";
import { NFTAuctionCard } from "./NFTAuctionCard";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { Auction } from "~~/types/nft";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";

interface AuctionListProps {
  title: string;
  emptyMessage: string;
  fetchFunction: "getOngoingAuctions" | "getExpiredAuctions";
}

const AuctionList = ({ title, emptyMessage, fetchFunction }: AuctionListProps) => {
  const { address: connectedAddress } = useAccount();
  const [auctionsData, setAuctionsData] = useState<Auction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { data: nftAuctionsContract } = useScaffoldContract({
    contractName: "NftAuctions",
  });

  const { data: auctionsFromContract } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: fetchFunction,
    watch: true,
  });

  const fetchAuctionData = useCallback(
    async (auctionFromContract: any): Promise<Auction> => {
      const tokenId = auctionFromContract.tokenId;
      const tokenURI = await yourCollectibleContract!.read.tokenURI([tokenId]);
      const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "");
      const nftMetadata = await getMetadataFromIPFS(ipfsHash);

      return {
        auctionId: auctionFromContract.auctionId,
        tokenId: tokenId,
        startingPrice: auctionFromContract.startingPrice,
        duration: BigInt(Number(auctionFromContract.endTime) - Number(auctionFromContract.startTime)),
        seller: auctionFromContract.seller,
        uri: tokenURI,
        highestBidder: auctionFromContract.highestBidder,
        highestBid: auctionFromContract.highestBid,
        startTime: auctionFromContract.startTime,
        endTime: auctionFromContract.endTime,
        nftContract: nftAuctionsContract!.address,
        ended: auctionFromContract.ended,
        ...nftMetadata,
      };
    },
    [yourCollectibleContract, nftAuctionsContract],
  );

  useEffect(() => {
    const updateAuctions = async (): Promise<void> => {
      if (
        auctionsFromContract === undefined ||
        nftAuctionsContract === undefined ||
        yourCollectibleContract === undefined ||
        connectedAddress === undefined
      )
        return;

      setAuctionsLoading(true);

      try {
        const updatedAuctionsData: Auction[] = [];

        for (let auctionIndex = 0; auctionIndex < auctionsFromContract.length; auctionIndex++) {
          try {
            const auction = await fetchAuctionData(auctionsFromContract[auctionIndex]);
            updatedAuctionsData.push(auction);
          } catch (e) {
            console.error("Error fetching individual auction:", e);
          }
        }

        setAuctionsData(updatedAuctionsData);
      } catch (e) {
        notification.error("Error fetching auctions");
        console.error("Error fetching auctions:", e);
      } finally {
        setAuctionsLoading(false);
      }
    };

    updateAuctions();
  }, [connectedAddress, auctionsFromContract, fetchAuctionData, nftAuctionsContract, yourCollectibleContract]);

  if (auctionsLoading) {
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">{title}</span>
          </h1>
        </div>
      </div>

      {auctionsData.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">{emptyMessage}</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {auctionsData.map(item => (
            <NFTAuctionCard auction={item} key={item.auctionId} />
          ))}
        </div>
      )}
    </div>
  );
};

export const Auctions = () => (
  <AuctionList
    title="Ongoing NFT Auctions"
    emptyMessage="No ongoing NFT auctions found"
    fetchFunction="getOngoingAuctions"
  />
);

export const ExpiredAuctions = () => (
  <AuctionList
    title="Expired NFT Auctions"
    emptyMessage="No expired NFT auctions found"
    fetchFunction="getExpiredAuctions"
  />
);
