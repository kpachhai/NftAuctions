import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { NftAuctions, YourCollectible } from "../typechain-types";

describe("NftAuctions", function () {
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let nftAuctions: NftAuctions;
  let yourCollectible: YourCollectible;
  const tokenId = 1;
  const startingPrice = ethers.parseEther("1.0");
  const duration = 86400; // 1 day in seconds

  let nftAuctionsAddress: string;
  let mockERC721Address: string;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    // Deploy mock ERC721
    const YourCollectible = await ethers.getContractFactory("contracts/YourCollectible.sol:YourCollectible");
    yourCollectible = await YourCollectible.deploy();
    await yourCollectible.waitForDeployment();

    // Mint NFT to seller
    await yourCollectible.connect(seller).mint(seller.address, tokenId);

    // Deploy NftAuctions
    const NftAuctions = await ethers.getContractFactory("NftAuctions");
    nftAuctions = await NftAuctions.deploy(owner.address);
    await nftAuctions.waitForDeployment();

    nftAuctionsAddress = await nftAuctions.getAddress();
    mockERC721Address = await yourCollectible.getAddress();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nftAuctions.owner()).to.equal(owner.address);
    });

    it("Should have correct token name and symbol", async function () {
      expect(await nftAuctions.name()).to.equal("NftAutions");
      expect(await nftAuctions.symbol()).to.equal("MTK");
    });
  });

  describe("createAuction", async function () {
    it("Should create an auction and emit event", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      const tx = await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);

      // Verify event emission
      await expect(tx).to.emit(nftAuctions, "AuctionCreated").withArgs(
        0, // auctionId
        seller.address,
        mockERC721Address,
        tokenId,
        startingPrice,
        anyValue,
        anyValue,
      );

      // Verify auction details
      const auction = await nftAuctions.auctions(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.highestBid).to.equal(startingPrice);
      expect(auction.ended).to.equal(false);
      expect(await yourCollectible.ownerOf(tokenId)).to.equal(nftAuctionsAddress);
    });

    it("Should revert with zero starting price", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await expect(
        nftAuctions.connect(seller).createAuction(
          mockERC721Address,
          tokenId,
          0, // invalid price
          duration,
        ),
      ).to.be.revertedWith("Starting price must be > 0");
    });

    it("Should increment auctionCount", async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
      expect(await nftAuctions.auctionCount()).to.equal(1);
    });
  });

  describe("placeBid", async function () {
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

      // Place first bid
      await nftAuctions.connect(bidder1).placeBid(0, { value: firstBid });

      // Check balance before second bid
      const balanceBefore = await ethers.provider.getBalance(bidder1.address);

      // Place second bid
      await nftAuctions.connect(bidder2).placeBid(0, { value: secondBid });

      // Check balance after second bid
      const balanceAfter = await ethers.provider.getBalance(bidder1.address);
      expect(balanceAfter).to.equal(balanceBefore + firstBid);
    });

    it("Should revert if auction doesn't exist", async function () {
      await expect(
        nftAuctions.connect(bidder1).placeBid(999, {
          value: startingPrice * BigInt(2),
        }),
      ).to.be.revertedWith("Auction does not exist");
    });

    it("Should revert if auction ended", async function () {
      // Fast-forward time
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

      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const tx = await nftAuctions.connect(owner).endAuction(0);

      await expect(tx).to.emit(nftAuctions, "AuctionEnded").withArgs(0, bidder1.address, bidAmount);

      expect(await yourCollectible.ownerOf(tokenId)).to.equal(bidder1.address);

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + bidAmount);
    });

    it("Should return NFT to seller if no bids", async function () {
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      await nftAuctions.connect(owner).endAuction(0);
      expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);
    });

    it("Should revert if auction not ended", async function () {
      await expect(nftAuctions.connect(owner).endAuction(0)).to.be.revertedWith("Auction not ended yet");
    });

    it("Should revert if already ended", async function () {
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      // End once
      await nftAuctions.connect(owner).endAuction(0);

      // Try to end again
      await expect(nftAuctions.connect(owner).endAuction(0)).to.be.revertedWith("Auction already ended");
    });
  });

  // Helper for anyValue matcher
  const anyValue = () => true;
});
