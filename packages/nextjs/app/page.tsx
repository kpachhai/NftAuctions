"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 text-center">
        <h1 className="text-6xl font-bold mb-8">NFT Auctions</h1>
        <p className="text-xl mb-8 max-w-2xl">
          A decentralized platform for creating and participating in NFT auctions. Mint your NFTs and put them up for
          auction, or discover and bid on unique digital collectibles.
        </p>

        <div className="flex justify-center items-center space-x-2 flex-col mb-8">
          <p className="my-2 font-medium">Connected Address:</p>
          <Address address={connectedAddress} />
        </div>

        <div className="flex gap-4 justify-center mb-12">
          <Link href="/myNFTs" className="btn btn-primary">
            My NFTs
          </Link>
          <Link href="/auctions" className="btn btn-secondary">
            Browse Auctions
          </Link>
        </div>
      </div>

      <div className="grow bg-base-300 w-full px-8 py-12">
        <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Create Auctions</h3>
            <p>Mint your NFTs and create time-limited auctions with custom starting prices.</p>
          </div>

          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Place Bids</h3>
            <p>Discover unique NFTs and participate in auctions with real-time bidding.</p>
          </div>

          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Secure & Fair</h3>
            <p>Smart contract-powered auctions ensure transparent and secure transactions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
