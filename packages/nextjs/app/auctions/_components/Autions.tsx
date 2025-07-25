"use client";

import { useEffect, useState } from "react";
import { NFTAuctionCard } from "./NFTAuctionCard";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

export interface Auction extends Partial<NFTMetaData> {
  tokenId: bigint;
  startingPrice: bigint;
  duration: bigint;
  seller: string;
  uri: string;
  highestBidder: string;
  highestBid: bigint;
  startTime: bigint;
  endTime: bigint;
  nftContract: string;
  ended: boolean;
}

export const Auctions = () => {
  const { address: connectedAddress } = useAccount();
  const [auctionsData, setAuctionsData] = useState<Auction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { data: nftAuctionsContract } = useScaffoldContract({
    contractName: "NftAuctions",
  });

  const { data: ongoingAuctions } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: "getOngoingAuctions",
    watch: true,
  });

  useEffect(() => {
    const updateOngoingAuctions = async (): Promise<void> => {
      if (
        ongoingAuctions === undefined ||
        nftAuctionsContract === undefined ||
        yourCollectibleContract === undefined ||
        connectedAddress === undefined
      )
        return;

      setAuctionsLoading(true);
      setAuctionsData([]);
      const auctionsCount = ongoingAuctions.length;
      for (let auctionIndex = 0; auctionIndex < auctionsCount; auctionIndex++) {
        try {
          const tokenId = ongoingAuctions[auctionIndex].tokenId;

          const tokenURI = await yourCollectibleContract.read.tokenURI([tokenId]);

          const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "");

          const nftMetadata: NFTMetaData = await getMetadataFromIPFS(ipfsHash);

          const auction: Auction = {
            tokenId: tokenId,
            startingPrice: ongoingAuctions[auctionIndex].startingPrice,
            duration: ongoingAuctions[auctionIndex].endTime - ongoingAuctions[auctionIndex].startTime,
            seller: ongoingAuctions[auctionIndex].seller,
            uri: tokenURI,
            highestBidder: ongoingAuctions[auctionIndex].highestBidder,
            highestBid: ongoingAuctions[auctionIndex].highestBid,
            startTime: ongoingAuctions[auctionIndex].startTime,
            endTime: ongoingAuctions[auctionIndex].endTime,
            nftContract: nftAuctionsContract.address,
            ended: ongoingAuctions[auctionIndex].ended,
            ...nftMetadata,
          };
          auctionsData.push(auction);
        } catch (e) {
          notification.error("Error fetching all collectibles");
          setAuctionsLoading(false);
          console.log(e);
        }
      }

      setAuctionsData(auctionsData);
      setAuctionsLoading(false);
    };

    updateOngoingAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, ongoingAuctions]);

  if (auctionsLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {auctionsData.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No NFT auctions found</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {auctionsData.map(item => (
            <NFTAuctionCard auction={item} key={item.tokenId} />
          ))}
        </div>
      )}
    </>
  );
};

// TODO: refactor this component to avoid code duplication with Auctions component
export const ExpiredAuctions = () => {
  const { address: connectedAddress } = useAccount();
  const [auctionsData, setAuctionsData] = useState<Auction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { data: nftAuctionsContract } = useScaffoldContract({
    contractName: "NftAuctions",
  });

  const { data: expiredAuctions } = useScaffoldReadContract({
    contractName: "NftAuctions",
    functionName: "getExpiredAuctions",
    watch: true,
  });

  useEffect(() => {
    const updateOngoingAuctions = async (): Promise<void> => {
      if (
        expiredAuctions === undefined ||
        nftAuctionsContract === undefined ||
        yourCollectibleContract === undefined ||
        connectedAddress === undefined
      )
        return;

      setAuctionsLoading(true);
      setAuctionsData([]);
      const auctionsCount = expiredAuctions.length;
      for (let auctionIndex = 0; auctionIndex < auctionsCount; auctionIndex++) {
        try {
          const tokenId = expiredAuctions[auctionIndex].tokenId;

          const tokenURI = await yourCollectibleContract.read.tokenURI([tokenId]);

          const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "");

          const nftMetadata: NFTMetaData = await getMetadataFromIPFS(ipfsHash);

          const auction: Auction = {
            tokenId: tokenId,
            startingPrice: expiredAuctions[auctionIndex].startingPrice,
            duration: expiredAuctions[auctionIndex].endTime - expiredAuctions[auctionIndex].startTime,
            seller: expiredAuctions[auctionIndex].seller,
            uri: tokenURI,
            highestBidder: expiredAuctions[auctionIndex].highestBidder,
            highestBid: expiredAuctions[auctionIndex].highestBid,
            startTime: expiredAuctions[auctionIndex].startTime,
            endTime: expiredAuctions[auctionIndex].endTime,
            nftContract: nftAuctionsContract.address,
            ended: expiredAuctions[auctionIndex].ended,
            ...nftMetadata,
          };
          auctionsData.push(auction);
        } catch (e) {
          notification.error("Error fetching all collectibles");
          setAuctionsLoading(false);
          console.log(e);
        }
      }

      setAuctionsData(auctionsData);
      setAuctionsLoading(false);
    };

    updateOngoingAuctions();
  }, [connectedAddress, expiredAuctions]);

  if (auctionsLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {auctionsData.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No expired NFT auctions found</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {auctionsData.map(item => (
            <NFTAuctionCard auction={item} key={item.tokenId} />
          ))}
        </div>
      )}
    </>
  );
};
