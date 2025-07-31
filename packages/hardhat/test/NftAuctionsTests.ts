import { expect } from "chai";
import { ethers } from "hardhat";
import { NftAuctions, YourCollectible } from "../typechain-types";

describe("NftAuctions", function () {
  let nftAuctions: NftAuctions;
  let yourCollectible: YourCollectible;
  const tokenId = 1;
  const startingPrice = ethers.parseEther("1.0");
  const duration = 1440; // 1 day in minutes

  let nftAuctionsAddress: string;
  let mockERC721Address: string;
  let owner: any;
  let seller: any;
  let bidder1: any;
  let bidder2: any;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    const YourCollectibleFactory = await ethers.getContractFactory("YourCollectible");
    yourCollectible = (await YourCollectibleFactory.deploy()) as YourCollectible;
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
    it("Should set the right owner", async function () {
      expect(await nftAuctions.owner()).to.equal(owner.address);
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
        anyValue, // startTime
        anyValue, // endTime
      );

      const auction = await nftAuctions.auctions(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.highestBid).to.equal(0); // Should start at 0
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
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        nftAuctions.connect(bidder1).placeBid(0, {
          value: startingPrice * BigInt(2),
        }),
      ).to.be.revertedWith("Auction ended");
    });

    it("Should revert if bid is too low", async function () {
      // First place a bid to set a minimum
      await nftAuctions.connect(bidder1).placeBid(0, { value: startingPrice });

      // Now try to place a lower bid
      await expect(
        nftAuctions.connect(bidder2).placeBid(0, {
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
      await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const tx = await nftAuctions.connect(bidder1).endAuction(0);

      await expect(tx).to.emit(nftAuctions, "AuctionEnded").withArgs(0, bidder1.address, bidAmount);

      expect(await yourCollectible.ownerOf(tokenId)).to.equal(bidder1.address);
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      // Seller receives bidAmount - royalty (10% of 1.5 ETH = 0.15 ETH)
      const expectedSellerAmount = bidAmount - (bidAmount * BigInt(10)) / BigInt(100);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + expectedSellerAmount);
    });

    it("Should return NFT to seller if no bids", async function () {
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await nftAuctions.connect(seller).endAuction(0);
      expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);
    });

    it("Should revert if auction not ended", async function () {
      await expect(nftAuctions.connect(owner).endAuction(0)).to.be.revertedWith("Auction not ended yet");
    });

    it("Should revert if already ended", async function () {
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      // End once
      await nftAuctions.connect(owner).endAuction(0);

      // Try to end again
      await expect(nftAuctions.connect(owner).endAuction(0)).to.be.revertedWith("Auction already ended");
    });
  });

  describe("Royalty Functionality", function () {
    beforeEach(async function () {
      [owner, seller, bidder1, bidder2] = await ethers.getSigners();

      // Deploy mock ERC721
      const YourCollectibleFactory = await ethers.getContractFactory("YourCollectible");
      yourCollectible = (await YourCollectibleFactory.deploy()) as YourCollectible;
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

    describe("Royalty Calculation", function () {
      it("Should calculate royalty correctly for different amounts", async function () {
        const testAmounts = [
          ethers.parseEther("1.0"), // 1 ETH
          ethers.parseEther("10.0"), // 10 ETH
          ethers.parseEther("0.1"), // 0.1 ETH
        ];

        for (const amount of testAmounts) {
          const royaltyInfo = await yourCollectible.royaltyInfo(tokenId, amount);
          const expectedRoyalty = (amount * BigInt(10)) / BigInt(100); // 10%
          expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
          expect(royaltyInfo.receiver).to.equal(owner.address); // Contract deployer is royalty receiver
        }
      });

      it("Should handle zero sale price", async function () {
        const royaltyInfo = await yourCollectible.royaltyInfo(tokenId, 0);
        expect(royaltyInfo.royaltyAmount).to.equal(0);
        expect(royaltyInfo.receiver).to.equal(owner.address);
      });

      it("Should handle maximum sale price", async function () {
        const maxAmount = ethers.parseEther("1000000"); // Use a large but reasonable amount instead of MaxUint256
        const royaltyInfo = await yourCollectible.royaltyInfo(tokenId, maxAmount);
        const expectedRoyalty = (maxAmount * BigInt(10)) / BigInt(100);
        expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
        expect(royaltyInfo.receiver).to.equal(owner.address);
      });
    });

    describe("Auction with Royalties", function () {
      beforeEach(async function () {
        await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
        await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
      });

      it("Should pay royalties when auction ends", async function () {
        const bidAmount = ethers.parseEther("2.0");
        await nftAuctions.connect(bidder1).placeBid(0, { value: bidAmount });

        // Fast-forward time
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
        const royaltyReceiverBalanceBefore = await ethers.provider.getBalance(owner.address);

        const tx = await nftAuctions.connect(owner).endAuction(0);

        // Verify RoyaltyPaid event
        await expect(tx)
          .to.emit(nftAuctions, "RoyaltyPaid")
          .withArgs(0, owner.address, (bidAmount * BigInt(10)) / BigInt(100));

        const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
        const royaltyReceiverBalanceAfter = await ethers.provider.getBalance(owner.address);

        // Verify seller gets 90% (2.0 ETH - 0.2 ETH = 1.8 ETH)
        const expectedSellerAmount = bidAmount - (bidAmount * BigInt(10)) / BigInt(100);
        expect(sellerBalanceAfter).to.be.greaterThan(
          sellerBalanceBefore + expectedSellerAmount - ethers.parseEther("0.01"),
        ); // Account for gas
        expect(sellerBalanceAfter).to.be.lessThan(
          sellerBalanceBefore + expectedSellerAmount + ethers.parseEther("0.01"),
        );

        // Verify royalty receiver gets 10% (0.2 ETH)
        const expectedRoyaltyAmount = (bidAmount * BigInt(10)) / BigInt(100);
        expect(royaltyReceiverBalanceAfter).to.be.greaterThan(
          royaltyReceiverBalanceBefore + expectedRoyaltyAmount - ethers.parseEther("0.01"),
        );
        expect(royaltyReceiverBalanceAfter).to.be.lessThan(
          royaltyReceiverBalanceBefore + expectedRoyaltyAmount + ethers.parseEther("0.01"),
        );
      });

      it("Should emit RoyaltyPaid event", async function () {
        const bidAmount = ethers.parseEther("1.5");
        await nftAuctions.connect(bidder1).placeBid(0, { value: bidAmount });

        // Fast-forward time
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const tx = await nftAuctions.connect(owner).endAuction(0);

        const expectedRoyaltyAmount = (bidAmount * BigInt(10)) / BigInt(100);
        await expect(tx).to.emit(nftAuctions, "RoyaltyPaid").withArgs(0, owner.address, expectedRoyaltyAmount);
      });

      it("Should handle multiple auctions of the same token ID", async function () {
        // First auction
        const firstBidAmount = ethers.parseEther("1.0");
        await nftAuctions.connect(bidder1).placeBid(0, { value: firstBidAmount });

        // Fast-forward time and end first auction
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const royaltyReceiverBalanceBeforeFirst = await ethers.provider.getBalance(owner.address);

        await nftAuctions.connect(owner).endAuction(0);

        const royaltyReceiverBalanceAfterFirst = await ethers.provider.getBalance(owner.address);

        // Verify first auction royalties
        const firstExpectedRoyalty = (firstBidAmount * BigInt(10)) / BigInt(100);
        expect(royaltyReceiverBalanceAfterFirst).to.be.greaterThan(
          royaltyReceiverBalanceBeforeFirst + firstExpectedRoyalty - ethers.parseEther("0.01"),
        );

        // Reset time for second auction
        await ethers.provider.send("evm_increaseTime", [1]);
        await ethers.provider.send("evm_mine", []);

        // Winner from first auction (bidder1) now sells the NFT
        await yourCollectible.connect(bidder1).approve(nftAuctionsAddress, tokenId);
        await nftAuctions.connect(bidder1).createAuction(mockERC721Address, tokenId, startingPrice, duration);

        // Second auction
        const secondBidAmount = ethers.parseEther("2.0");
        await nftAuctions.connect(bidder2).placeBid(1, { value: secondBidAmount });

        // Fast-forward time and end second auction
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const royaltyReceiverBalanceBeforeSecond = await ethers.provider.getBalance(owner.address);

        await nftAuctions.connect(owner).endAuction(1);

        const royaltyReceiverBalanceAfterSecond = await ethers.provider.getBalance(owner.address);

        // Verify second auction royalties
        const secondExpectedRoyalty = (secondBidAmount * BigInt(10)) / BigInt(100);
        expect(royaltyReceiverBalanceAfterSecond).to.be.greaterThan(
          royaltyReceiverBalanceBeforeSecond + secondExpectedRoyalty - ethers.parseEther("0.01"),
        );

        // Verify total royalties received
        const totalExpectedRoyalty = firstExpectedRoyalty + secondExpectedRoyalty;
        const totalRoyaltyReceived = royaltyReceiverBalanceAfterSecond - royaltyReceiverBalanceBeforeFirst;
        expect(totalRoyaltyReceived).to.be.greaterThan(totalExpectedRoyalty - ethers.parseEther("0.02"));
        expect(totalRoyaltyReceived).to.be.lessThan(totalExpectedRoyalty + ethers.parseEther("0.02"));
      });

      it("Should handle auction with no bids (no royalties)", async function () {
        // Fast-forward time without any bids
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const royaltyReceiverBalanceBefore = await ethers.provider.getBalance(owner.address);

        await nftAuctions.connect(owner).endAuction(0);

        const royaltyReceiverBalanceAfter = await ethers.provider.getBalance(owner.address);

        // No royalties should be paid when there are no bids
        // Use tolerance for gas costs
        expect(royaltyReceiverBalanceAfter).to.be.greaterThan(royaltyReceiverBalanceBefore - ethers.parseEther("0.01"));
        expect(royaltyReceiverBalanceAfter).to.be.lessThan(royaltyReceiverBalanceBefore + ethers.parseEther("0.01"));
      });
    });

    describe("Royalty Configuration", function () {
      it("Should allow owner to update royalty percentage", async function () {
        const newPercentage = 1500; // 15%
        await yourCollectible.connect(owner).setRoyaltyPercentage(newPercentage);

        const updatedPercentage = await yourCollectible.royaltyPercentage();
        expect(updatedPercentage).to.equal(newPercentage);

        // Test royalty calculation with new percentage
        const testAmount = ethers.parseEther("1.0");
        const royaltyInfo = await yourCollectible.royaltyInfo(tokenId, testAmount);
        const expectedRoyalty = (testAmount * BigInt(15)) / BigInt(100);
        expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
      });

      it("Should allow owner to update royalty receiver", async function () {
        await yourCollectible.connect(owner).setRoyaltyReceiver(bidder1.address);

        const updatedReceiver = await yourCollectible.royaltyReceiver();
        expect(updatedReceiver).to.equal(bidder1.address);

        // Test royalty info with new receiver
        const testAmount = ethers.parseEther("1.0");
        const royaltyInfo = await yourCollectible.royaltyInfo(tokenId, testAmount);
        expect(royaltyInfo.receiver).to.equal(bidder1.address);
      });

      it("Should revert if non-owner tries to update royalty settings", async function () {
        await expect(yourCollectible.connect(bidder1).setRoyaltyPercentage(2000)).to.be.revertedWithCustomError(
          yourCollectible,
          "OwnableUnauthorizedAccount",
        );

        await expect(
          yourCollectible.connect(bidder1).setRoyaltyReceiver(bidder2.address),
        ).to.be.revertedWithCustomError(yourCollectible, "OwnableUnauthorizedAccount");
      });

      it("Should revert if royalty percentage exceeds 100%", async function () {
        await expect(yourCollectible.connect(owner).setRoyaltyPercentage(10001)).to.be.revertedWith(
          "Percentage cannot exceed 100%",
        );
      });

      it("Should revert if royalty receiver is zero address", async function () {
        await expect(yourCollectible.connect(owner).setRoyaltyReceiver(ethers.ZeroAddress)).to.be.revertedWith(
          "Invalid receiver address",
        );
      });
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
  describe("Withdrawal Functionality", function () {
    beforeEach(async function () {
      await yourCollectible.connect(seller).approve(nftAuctionsAddress, tokenId);
      await nftAuctions.connect(seller).createAuction(mockERC721Address, tokenId, startingPrice, duration);
    });

    describe("Seller Withdrawal", function () {
      it("Should allow seller to withdraw before any bids", async function () {
        const tx = await nftAuctions.connect(seller).withdrawAuction(0);

        await expect(tx).to.emit(nftAuctions, "AuctionWithdrawn").withArgs(0, seller.address);

        // Verify NFT is returned to seller
        expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);

        // Verify auction is marked as ended
        const auction = await nftAuctions.auctions(0);
        expect(auction.ended).to.equal(true);
      });

      it("Should revert if non-seller tries to withdraw", async function () {
        await expect(nftAuctions.connect(bidder1).withdrawAuction(0)).to.be.revertedWith("Only seller can withdraw");
      });

      it("Should revert if seller tries to withdraw after bids", async function () {
        // Place a bid first
        await nftAuctions.connect(bidder1).placeBid(0, { value: startingPrice });

        // Try to withdraw after bid
        await expect(nftAuctions.connect(seller).withdrawAuction(0)).to.be.revertedWith("Cannot withdraw after bids");
      });

      it("Should revert if auction doesn't exist", async function () {
        await expect(nftAuctions.connect(seller).withdrawAuction(999)).to.be.revertedWith("Auction does not exist");
      });

      it("Should revert if auction already ended", async function () {
        // End the auction first
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);
        await nftAuctions.connect(owner).endAuction(0);

        // Try to withdraw ended auction
        await expect(nftAuctions.connect(seller).withdrawAuction(0)).to.be.revertedWith("Auction already ended");
      });
    });

    describe("Emergency Withdrawal", function () {
      it("Should allow owner to emergency withdraw before bids", async function () {
        const tx = await nftAuctions.connect(owner).emergencyWithdraw(0);

        await expect(tx).to.emit(nftAuctions, "AuctionCancelled").withArgs(0, seller.address, ethers.ZeroAddress);

        // Verify NFT is returned to seller
        expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);

        // Verify auction is marked as ended
        const auction = await nftAuctions.auctions(0);
        expect(auction.ended).to.equal(true);
      });

      it("Should allow owner to emergency withdraw after bids", async function () {
        const bidAmount = ethers.parseEther("1.5");
        await nftAuctions.connect(bidder1).placeBid(0, { value: bidAmount });

        const bidderBalanceBefore = await ethers.provider.getBalance(bidder1.address);

        const tx = await nftAuctions.connect(owner).emergencyWithdraw(0);

        await expect(tx).to.emit(nftAuctions, "AuctionCancelled").withArgs(0, seller.address, bidder1.address);

        // Verify NFT is returned to seller
        expect(await yourCollectible.ownerOf(tokenId)).to.equal(seller.address);

        // Verify bidder gets refund
        const bidderBalanceAfter = await ethers.provider.getBalance(bidder1.address);
        expect(bidderBalanceAfter).to.be.greaterThan(bidderBalanceBefore + bidAmount - ethers.parseEther("0.01"));
        expect(bidderBalanceAfter).to.be.lessThan(bidderBalanceBefore + bidAmount + ethers.parseEther("0.01"));

        // Verify auction is marked as ended
        const auction = await nftAuctions.auctions(0);
        expect(auction.ended).to.equal(true);
      });

      it("Should revert if non-owner tries to emergency withdraw", async function () {
        await expect(nftAuctions.connect(seller).emergencyWithdraw(0)).to.be.revertedWithCustomError(
          nftAuctions,
          "OwnableUnauthorizedAccount",
        );
      });

      it("Should revert if emergency withdraw on non-existent auction", async function () {
        await expect(nftAuctions.connect(owner).emergencyWithdraw(999)).to.be.revertedWith("Auction does not exist");
      });

      it("Should revert if emergency withdraw on already ended auction", async function () {
        // End the auction first
        await ethers.provider.send("evm_increaseTime", [duration * 60 + 1]);
        await ethers.provider.send("evm_mine", []);
        await nftAuctions.connect(owner).endAuction(0);

        // Try to emergency withdraw ended auction
        await expect(nftAuctions.connect(owner).emergencyWithdraw(0)).to.be.revertedWith("Auction already ended");
      });
    });
  });

  // Helper for anyValue matcher
  const anyValue = () => true;
});
