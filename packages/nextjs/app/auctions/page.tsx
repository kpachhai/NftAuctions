"use client";

import { Auctions, ExpiredAuctions } from "./_components";
import type { NextPage } from "next";

const AuctionsPage: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">Ongoing NFT auctions</span>
          </h1>
        </div>
      </div>
      <Auctions />
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">Expired NFT auctions</span>
          </h1>
        </div>
      </div>
      <ExpiredAuctions />
    </>
  );
};

export default AuctionsPage;
