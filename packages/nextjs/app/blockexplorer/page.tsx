"use client";

import { useEffect, useState } from "react";
import { PaginationButton, SearchBar, TransactionsTable } from "./_components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useFetchBlocks } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";

const BlockExplorer: NextPage = () => {
  const { blocks, transactionReceipts, currentPage, totalBlocks, setCurrentPage, error } = useFetchBlocks();
  const { targetNetwork } = useTargetNetwork();
  const [isLocalNetwork, setIsLocalNetwork] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Check if there are any transactions across all blocks
  const hasTransactions = blocks.some(
    block => block.transactions && Array.isArray(block.transactions) && block.transactions.length > 0,
  );

  useEffect(() => {
    if (targetNetwork.id !== hardhat.id) {
      setIsLocalNetwork(false);
    }
  }, [targetNetwork.id]);

  useEffect(() => {
    if (targetNetwork.id === hardhat.id && error) {
      setHasError(true);
    }
  }, [targetNetwork.id, error]);

  // Only show notification for hardhat network - remove restrictions for other networks
  useEffect(() => {
    if (!isLocalNetwork && targetNetwork.id !== hardhat.id) {
      // Show informational message instead of error for non-local networks
      notification.info(
        <>
          <p className="font-bold mt-0 mb-1">Using external block explorer</p>
          <p className="m-0">
            You are on <code className="italic bg-base-300 text-base font-bold">{targetNetwork.name}</code>. For
            complete transaction history, you can also use{" "}
            <a
              className="text-accent"
              href={targetNetwork.blockExplorers?.default.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {targetNetwork.blockExplorers?.default.name}
            </a>
          </p>
        </>,
      );
    }
  }, [
    isLocalNetwork,
    targetNetwork.blockExplorers?.default.name,
    targetNetwork.blockExplorers?.default.url,
    targetNetwork.name,
    targetNetwork.id,
  ]);

  useEffect(() => {
    if (hasError) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">Cannot connect to local provider</p>
          <p className="m-0">
            - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
          </p>
          <p className="mt-1 break-normal">
            - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
            <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
          </p>
        </>,
      );
    }
  }, [hasError]);

  return (
    <div className="container mx-auto my-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Block Explorer</h1>
        <p className="text-sm text-gray-600">
          Network: <span className="font-semibold">{targetNetwork.name}</span>
          {!isLocalNetwork && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">External Network</span>
          )}
        </p>
      </div>
      <SearchBar />
      {!hasTransactions && !isLocalNetwork ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            No local transactions found. This block explorer shows limited data for external networks.
          </p>
          <a
            href={targetNetwork.blockExplorers?.default.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            View on {targetNetwork.blockExplorers?.default.name}
          </a>
        </div>
      ) : (
        <>
          <TransactionsTable blocks={blocks} transactionReceipts={transactionReceipts} />
          <PaginationButton
            currentPage={currentPage}
            totalItems={Number(totalBlocks)}
            setCurrentPage={setCurrentPage}
            hasTransactions={hasTransactions}
          />
        </>
      )}
    </div>
  );
};

export default BlockExplorer;
