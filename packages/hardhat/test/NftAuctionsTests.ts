import { expect } from "chai";
import sinon from "sinon";
import { ethers } from "hardhat";
import { NftAuctions, YourCollectible } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("NftAuctions", function () {
  let nftAuctions: NftAuctions;
  let yourCollectible: YourCollectible;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let bidder1: HardhatEthersSigner;
  let bidder2: HardhatEthersSigner;

  let nftAuctionsAddress: string;
  let mockERC721Address: string;
  const tokenId = 1n;
  const startingPrice = ethers.parseEther("1.0");
  const duration = 30; // 30 seconds for testing

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    const YourCollectibleFactory = await ethers.getContractFactory("YourCollectible");
    yourCollectible = await YourCollectibleFactory.connect(owner).deploy();
    await yourCollectible.waitForDeployment();

    const NftAuctionsFactory = await ethers.getContractFactory("NftAuctions");
    nftAuctions = await NftAuctionsFactory.connect(owner).deploy(owner.address);
    await nftAuctions.waitForDeployment();

    nftAuctionsAddress = await nftAuctions.getAddress();
    mockERC721Address = await yourCollectible.getAddress();

    // Mint an NFT to the seller
    await yourCollectible.connect(owner).mintItem(seller.address, "https://ipfs.io/ipfs/test");
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await nftAuctions.name()).to.equal("NftAuctions");
      expect(await nftAuctions.symbol()).to.equal("NFTA");
    });
  });

  describe("createAuction", async function () {
    it("Should create an auction and emit event", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      const tx = await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
      await expect(tx).to.emit(nftAuctions, "AuctionCreated").withArgs(
        0, // auctionId
        seller.address,
        mockERC721Address,
        tokenId,
        startingPrice,
        sinon.match.number, // startTime
        sinon.match.number, // endTime
      );

      const auction = await nftAuctions.auctions(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.highestBid).to.equal(startingPrice);
      expect(auction.ended).to.equal(false);
    });

    it("Should revert with zero starting price", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await expect(
        nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, 0, duration),
      ).to.be.revertedWith("Starting price must be > 0");
    });

    it("Should revert with zero duration", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await expect(
        nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, 0),
      ).to.be.revertedWith("Duration must be > 0");
    });
  });

  describe("placeBid", function () {
    beforeEach(async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
    });

    it("Should accept higher bid and emit event", async function () {
      const higherBid = ethers.parseEther("1.5");
      await expect(nftAuctions.connect(bidder1).placeBid(0, { value: higherBid }))
        .to.emit(nftAuctions, "BidPlaced")
        .withArgs(0, bidder1.address, higherBid);

      const auction = await nftAuctions.auctions(0);
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(higherBid);
    });

    it("Should refund previous bidder", async function () {
      const firstBid = ethers.parseEther("1.5");
      const secondBid = ethers.parseEther("2.0");

      await nftAuctions.connect(bidder1).placeBid(0, { value: firstBid });
      const balanceBefore = await ethers.provider.getBalance(bidder1.address);

      await nftAuctions.connect(bidder2).placeBid(0, { value: secondBid });
      const balanceAfter = await ethers.provider.getBalance(bidder1.address);
      expect(balanceAfter).to.equal(balanceBefore + firstBid);
    });

    it("Should revert if auction ended", async function () {
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        nftAuctions.connect(bidder1).placeBid(0, {
          value: startingPrice * BigInt(2),
        }),
      ).to.be.revertedWith("Auction ended");
    });

    it("Should revert if bid is too low", async function () {
      await expect(
        nftAuctions.connect(bidder1).placeBid(0, {
          value: startingPrice - BigInt(1),
        }),
      ).to.be.revertedWith("Bid too low");
    });
  });

  describe("endAuction", function () {
    beforeEach(async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
    });

    it("Should transfer NFT to winner and ETH to seller (with bids)", async function () {
      const bidAmount = ethers.parseEther("1.5");
      await nftAuctions.connect(bidder1).placeBid(0, { value: bidAmount });

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const tx = await nftAuctions.connect(bidder1).endAuction(0);

      await expect(tx).to.emit(nftAuctions, "AuctionEnded").withArgs(0, bidder1.address, bidAmount);

      expect(await yourCollectible.ownerOf(tokenId)).to.equal(bidder1.address);
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + bidAmount);
    });

    it("Should return NFT to seller if no bids", async function () {
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      await nftAuctions.connect(seller).endAuction(0);
      expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);
    });

    it("Should revert if auction not ended", async function () {
      await expect(nftAuctions.connect(owner).endAuction(0)).to.be.revertedWith("Auction not ended yet");
    });

    it("Should revert if not authorized", async function () {
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(nftAuctions.connect(bidder2).endAuction(0)).to.be.revertedWith("Not authorized to end auction");
    });
  });

  describe("getOngoingAuctions", function () {
    it("Should return only ongoing auctions", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);

      const ongoingAuctions = await nftAuctions.getOngoingAuctions();
      expect(ongoingAuctions.length).to.equal(1);
      expect(ongoingAuctions[0].auctionId).to.equal(0);
    });
  });

  describe("getExpiredAuctions", function () {
    it("Should return expired auctions", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      const expiredAuctions = await nftAuctions.getExpiredAuctions();
      expect(expiredAuctions.length).to.equal(1);
      expect(expiredAuctions[0].auctionId).to.equal(0);
    });
  });
});
