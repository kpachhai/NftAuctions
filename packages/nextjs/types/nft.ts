import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

export interface Auction extends Partial<NFTMetaData> {
  auctionId: bigint;
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
