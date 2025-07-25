import { Auction } from "./Autions";
import { Address } from "~~/components/scaffold-eth";

export const NFTAuctionCard = ({ auction }: { auction: Auction }) => {
  // const [transferToAddress, setTransferToAddress] = useState("");

  // const { writeContractAsync } = useScaffoldWriteContract({ contractName: "NftAuctions" });

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        {/* eslint-disable-next-line  */}
        <img src={auction.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 rounded-xl">
          <span className="text-white "># {auction.tokenId}</span>
        </figcaption>
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{auction.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {auction.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary px-1.5">
                {attr.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{auction.description}</p>
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Seller : </span>
          <Address address={auction.seller} />
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Highest Bidder : </span>
          <Address address={auction.highestBidder} />
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Highest Bid : </span>
          <span className="text-lg">{auction.highestBid} WEI</span>
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Starting Price : </span>
          <span className="text-lg">{auction.startingPrice / 10n ** 18n} ETH</span>
        </div>
      </div>
    </div>
  );
};
