import { useCallback, useEffect, useState } from "react";
import {
  Block,
  Hash,
  Transaction,
  TransactionReceipt,
  createTestClient,
  publicActions,
  walletActions,
  webSocket,
} from "viem";
import { hardhat } from "viem/chains";
import { decodeTransactionData } from "~~/utils/scaffold-eth";

const BLOCKS_PER_PAGE = 20;

export const testClient = createTestClient({
  chain: hardhat,
  mode: "hardhat",
  transport: webSocket("ws://127.0.0.1:8545"),
})
  .extend(publicActions)
  .extend(walletActions);

export const useFetchBlocks = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transactionReceipts, setTransactionReceipts] = useState<{
    [key: string]: TransactionReceipt;
  }>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBlocksWithTransactions, setTotalBlocksWithTransactions] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [allBlocksWithTransactions, setAllBlocksWithTransactions] = useState<Block[]>([]);

  const fetchAllBlocksWithTransactions = useCallback(async () => {
    setError(null);

    try {
      const blockNumber = await testClient.getBlockNumber();

      // Start from the latest block and work backwards to find ALL blocks with transactions
      let startingBlock = blockNumber;
      const blocksWithTransactions: Block[] = [];
      let blocksChecked = 0;
      const maxBlocksToCheck = 100000; // Search through ~1.5 weeks worth of blocks (10-second intervals)

      while (blocksChecked < maxBlocksToCheck && startingBlock > 0) {
        try {
          const block = await testClient.getBlock({ blockNumber: startingBlock, includeTransactions: true });

          // Only include blocks that have transactions
          if (block.transactions && block.transactions.length > 0) {
            blocksWithTransactions.push(block);
          }

          startingBlock--;
          blocksChecked++;
        } catch (err) {
          setError(err instanceof Error ? err : new Error("An error occurred."));
          break;
        }
      }

      // Decode transaction data for all blocks
      blocksWithTransactions.forEach(block => {
        block.transactions.forEach(tx => decodeTransactionData(tx as Transaction));
      });

      // Get transaction receipts for all transactions
      const txReceipts = await Promise.all(
        blocksWithTransactions.flatMap(block =>
          block.transactions.map(async tx => {
            try {
              const receipt = await testClient.getTransactionReceipt({ hash: (tx as Transaction).hash });
              return { [(tx as Transaction).hash]: receipt };
            } catch (err) {
              setError(err instanceof Error ? err : new Error("An error occurred."));
              throw err;
            }
          }),
        ),
      );

      setAllBlocksWithTransactions(blocksWithTransactions);
      setTotalBlocksWithTransactions(blocksWithTransactions.length);
      setTransactionReceipts(prevReceipts => ({ ...prevReceipts, ...Object.assign({}, ...txReceipts) }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("An error occurred."));
    }
  }, []);

  // Update the displayed blocks based on current page
  useEffect(() => {
    const startIndex = currentPage * BLOCKS_PER_PAGE;
    const endIndex = startIndex + BLOCKS_PER_PAGE;
    const pageBlocks = allBlocksWithTransactions.slice(startIndex, endIndex);
    setBlocks(pageBlocks);
  }, [currentPage, allBlocksWithTransactions]);

  useEffect(() => {
    fetchAllBlocksWithTransactions();
  }, [fetchAllBlocksWithTransactions]);

  useEffect(() => {
    const handleNewBlock = async (newBlock: any) => {
      try {
        // Only add new blocks if they have transactions
        if (newBlock.transactions && newBlock.transactions.length > 0) {
          // Get full transaction details
          const transactionsDetails = await Promise.all(
            newBlock.transactions.map((txHash: string) => testClient.getTransaction({ hash: txHash as Hash })),
          );
          newBlock.transactions = transactionsDetails;

          newBlock.transactions.forEach((tx: Transaction) => decodeTransactionData(tx as Transaction));

          const receipts = await Promise.all(
            newBlock.transactions.map(async (tx: Transaction) => {
              try {
                const receipt = await testClient.getTransactionReceipt({ hash: (tx as Transaction).hash });
                return { [(tx as Transaction).hash]: receipt };
              } catch (err) {
                setError(err instanceof Error ? err : new Error("An error occurred fetching receipt."));
                throw err;
              }
            }),
          );

          // Add the new block to the beginning of our list
          setAllBlocksWithTransactions(prevBlocks => [newBlock, ...prevBlocks]);
          setTotalBlocksWithTransactions(prev => prev + 1);
          setTransactionReceipts(prevReceipts => ({ ...prevReceipts, ...Object.assign({}, ...receipts) }));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("An error occurred."));
      }
    };

    return testClient.watchBlocks({ onBlock: handleNewBlock, includeTransactions: true });
  }, []);

  return {
    blocks,
    transactionReceipts,
    currentPage,
    totalBlocks: BigInt(totalBlocksWithTransactions),
    setCurrentPage,
    error,
  };
};
