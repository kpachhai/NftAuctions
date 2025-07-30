"use client";

import { Auctions, ExpiredAuctions } from "./_components";
import type { NextPage } from "next";

const AuctionsPage: NextPage = () => {
  return (
    <div className="min-h-screen">
      <Auctions />
      <ExpiredAuctions />
    </div>
  );
};

export default AuctionsPage;
