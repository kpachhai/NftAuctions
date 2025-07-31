import { TransactionHash } from "./TransactionHash";
import { formatEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { TransactionWithFunction } from "~~/utils/scaffold-eth";
import { TransactionsTableProps } from "~~/utils/scaffold-eth/";

export const TransactionsTable = ({ blocks, transactionReceipts }: TransactionsTableProps) => {
  const { targetNetwork } = useTargetNetwork();

  // Check if there are any transactions across all blocks
  const hasTransactions = blocks.some(
    block => block.transactions && Array.isArray(block.transactions) && block.transactions.length > 0,
  );

  if (!hasTransactions) {
    return (
      <div className="flex justify-center px-4 md:px-0">
        <div className="w-full shadow-2xl rounded-xl bg-base-100 p-8">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4">No Transactions Found</h3>
            <p className="text-base-content/70 mb-4">No transactions have been sent to the local network yet.</p>
            <div className="space-y-2 text-sm text-base-content/60">
              <p>To see transactions here:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Make sure your local blockchain is running with <code className="bg-base-300 px-1">yarn chain</code>
                </li>
                <li>Send transactions using the Debug Contracts page</li>
                <li>Or interact with your deployed contracts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getTransactionEffects = (tx: TransactionWithFunction, receipt: any) => {
    if (!receipt?.logs) return null;

    const effects = [];

    // Check for Transfer events (NFT transfers)
    const transferEvents = receipt.logs.filter(
      (log: any) => log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    );

    // Check for RoyaltyPaid events
    const royaltyEvents = receipt.logs.filter(
      (log: any) => log.topics[0] === "0xf670029fc6f5302baba881b4ae845d1453acdf752b4c19ed81fe0fa6a686409b",
    );

    // Check for AuctionEnded events
    const auctionEndedEvents = receipt.logs.filter(
      (log: any) => log.topics[0] === "0xd2aa34a4fdbbc6dff6a3e56f46e0f3ae2a31d7785ff3487aa5c95c642acea501",
    );

    if (transferEvents.length > 0) effects.push("NFT Transfer");
    if (royaltyEvents.length > 0) effects.push("Royalty Paid");
    if (auctionEndedEvents.length > 0) effects.push("Auction Ended");

    return effects.length > 0 ? effects : null;
  };

  return (
    <div className="flex justify-center px-4 md:px-0">
      <div className="overflow-x-auto w-full shadow-2xl rounded-xl">
        <table className="table text-xl bg-base-100 table-zebra w-full md:table-md table-sm">
          <thead>
            <tr className="rounded-xl text-sm text-base-content">
              <th className="bg-primary">Transaction Hash</th>
              <th className="bg-primary">Function Called</th>
              <th className="bg-primary">Effects</th>
              <th className="bg-primary">Block Number</th>
              <th className="bg-primary">Time Mined</th>
              <th className="bg-primary">From</th>
              <th className="bg-primary">To</th>
              <th className="bg-primary text-end">Value ({targetNetwork.nativeCurrency.symbol})</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map(block =>
              (block.transactions as TransactionWithFunction[]).map(tx => {
                const receipt = transactionReceipts[tx.hash];
                const timeMined = new Date(Number(block.timestamp) * 1000).toLocaleString();
                const functionCalled = tx.input.substring(0, 10);
                const effects = getTransactionEffects(tx, receipt);

                return (
                  <tr key={tx.hash} className="hover text-sm">
                    <td className="w-1/12 md:py-4">
                      <TransactionHash hash={tx.hash} />
                    </td>
                    <td className="w-2/12 md:py-4">
                      {tx.functionName === "0x" ? "" : <span className="mr-1">{tx.functionName}</span>}
                      {functionCalled !== "0x" && (
                        <span className="badge badge-primary font-bold text-xs">{functionCalled}</span>
                      )}
                    </td>
                    <td className="w-2/12 md:py-4">
                      {effects && (
                        <div className="flex flex-col gap-2">
                          {effects.map((effect, index) => (
                            <span key={index} className="badge badge-success text-xs px-3 py-2 whitespace-nowrap">
                              {effect}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="w-1/12 md:py-4">{block.number?.toString()}</td>
                    <td className="w-2/12 md:py-4">{timeMined}</td>
                    <td className="w-2/12 md:py-4">
                      <Address address={tx.from} size="sm" onlyEnsOrAddress />
                    </td>
                    <td className="w-2/12 md:py-4">
                      {!receipt?.contractAddress ? (
                        tx.to && <Address address={tx.to} size="sm" onlyEnsOrAddress />
                      ) : (
                        <div className="relative">
                          <Address address={receipt.contractAddress} size="sm" onlyEnsOrAddress />
                          <small className="absolute top-4 left-4">(Contract Creation)</small>
                        </div>
                      )}
                    </td>
                    <td className="text-right md:py-4">
                      {formatEther(tx.value)} {targetNetwork.nativeCurrency.symbol}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
