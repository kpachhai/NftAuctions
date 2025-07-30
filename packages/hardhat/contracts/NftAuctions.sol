// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// EIP-2981 Royalty Interface
interface IERC2981 {
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount);
}

contract NftAuctions is Ownable, ReentrancyGuard {
    struct Auction {
        uint256 auctionId;
        address seller;
        address highestBidder;
        uint256 highestBid;
        uint256 startTime;
        uint256 endTime;
        uint256 startingPrice;
        IERC721 nftContract;
        uint256 tokenId;
        bool ended;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    // Efficient storage for ongoing and expired auctions
    uint256[] public ongoingAuctionIds;
    uint256[] public expiredAuctionIds;
    mapping(uint256 => uint256) public ongoingAuctionIndex;
    mapping(uint256 => uint256) public expiredAuctionIndex;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 startTime,
        uint256 endTime
    );

    event BidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);

    event AuctionEnded(uint256 auctionId, address indexed winner, uint256 winningBid);

    event RoyaltyPaid(uint256 auctionId, address indexed receiver, uint256 royaltyAmount);

    event AuctionWithdrawn(uint256 auctionId, address indexed seller);

    event AuctionCancelled(uint256 auctionId, address indexed seller, address indexed highestBidder);

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    function createAuction(
        IERC721 _nftContract,
        uint256 _tokenId,
        uint256 _startingPriceWei,
        uint256 _durationSeconds
    ) external nonReentrant {
        require(_startingPriceWei > 0, "Starting price must be > 0");
        require(_durationSeconds > 0, "Duration must be > 0");

        _nftContract.transferFrom(msg.sender, address(this), _tokenId);

        uint256 auctionId = auctionCount;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            seller: msg.sender,
            highestBidder: address(0),
            highestBid: 0, // Initialize to 0, not starting price
            startTime: block.timestamp,
            endTime: endTime,
            startingPrice: _startingPriceWei,
            nftContract: _nftContract,
            tokenId: _tokenId,
            ended: false
        });

        ongoingAuctionIndex[auctionId] = ongoingAuctionIds.length;
        ongoingAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId,
            msg.sender,
            address(_nftContract),
            _tokenId,
            _startingPriceWei,
            block.timestamp,
            endTime
        );

        auctionCount += 1;
    }

    function placeBid(uint256 _auctionId) external payable nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction ended");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");
        require(!auction.ended, "Auction already ended");

        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(block.timestamp >= auction.endTime, "Auction not ended yet");
        require(!auction.ended, "Auction already ended");

        // Anyone can end an expired auction, but we'll track who can claim
        auction.ended = true;

        _moveToExpired(_auctionId);

        if (auction.highestBidder != address(0)) {
            auction.nftContract.transferFrom(address(this), auction.highestBidder, auction.tokenId);
            
            // Handle royalties if the NFT contract supports EIP-2981
            try IERC2981(address(auction.nftContract)).royaltyInfo(auction.tokenId, auction.highestBid) returns (address receiver, uint256 royaltyAmount) {
                if (royaltyAmount > 0 && receiver != address(0)) {
                    // Pay royalty to the receiver
                    payable(receiver).transfer(royaltyAmount);
                    emit RoyaltyPaid(_auctionId, receiver, royaltyAmount);
                    
                    // Pay remaining amount to seller
                    uint256 sellerAmount = auction.highestBid - royaltyAmount;
                    payable(auction.seller).transfer(sellerAmount);
                } else {
                    // No royalty, pay full amount to seller
                    payable(auction.seller).transfer(auction.highestBid);
                }
            } catch {
                // NFT contract doesn't support EIP-2981, pay full amount to seller
                payable(auction.seller).transfer(auction.highestBid);
            }
             emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid);
        } else {
            auction.nftContract.transferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionEnded(_auctionId, address(0), 0);
        }
    }

    // New function to check if auction is expired (can be ended)
    function isAuctionExpired(uint256 _auctionId) external view returns (bool) {
        Auction memory auction = auctions[_auctionId];
        return auction.seller != address(0) && block.timestamp >= auction.endTime && !auction.ended;
    }

    // New function to get current blockchain timestamp
    function getCurrentTime() external view returns (uint256) {
        return block.timestamp;
    }

    function _moveToExpired(uint256 _auctionId) internal {
        uint256 indexToRemove = ongoingAuctionIndex[_auctionId];
        uint256 lastIndex = ongoingAuctionIds.length - 1;

        if (indexToRemove != lastIndex) {
            uint256 lastAuctionId = ongoingAuctionIds[lastIndex];
            ongoingAuctionIds[indexToRemove] = lastAuctionId;
            ongoingAuctionIndex[lastAuctionId] = indexToRemove;
        }

        ongoingAuctionIds.pop();
        delete ongoingAuctionIndex[_auctionId];

        expiredAuctionIndex[_auctionId] = expiredAuctionIds.length;
        expiredAuctionIds.push(_auctionId);
    }

    // Helper function to get royalty info
    function getRoyaltyInfo(address nftContract, uint256 tokenId, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount) {
        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (address _receiver, uint256 _royaltyAmount) {
            return (_receiver, _royaltyAmount);
        } catch {
            return (address(0), 0);
        }
    }

    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }

    function getOngoingAuctions() external view returns (Auction[] memory) {
        uint256 count = 0;

        for (uint256 i = 0; i < ongoingAuctionIds.length; i++) {
            uint256 auctionId = ongoingAuctionIds[i];
            if (!auctions[auctionId].ended && block.timestamp < auctions[auctionId].endTime) {
                count++;
            }
        }

        Auction[] memory ongoing = new Auction[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < ongoingAuctionIds.length; i++) {
            uint256 auctionId = ongoingAuctionIds[i];
            if (!auctions[auctionId].ended && block.timestamp < auctions[auctionId].endTime) {
                ongoing[index] = auctions[auctionId];
                index++;
            }
        }

        return ongoing;
    }

    function getExpiredAuctions() external view returns (Auction[] memory) {
        uint256 count = 0;

        for (uint256 i = 0; i < ongoingAuctionIds.length; i++) {
            uint256 auctionId = ongoingAuctionIds[i];
            if (auctions[auctionId].ended || block.timestamp >= auctions[auctionId].endTime) {
                count++;
            }
        }

        for (uint256 i = 0; i < expiredAuctionIds.length; i++) {
            count++;
        }

        Auction[] memory expired = new Auction[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < ongoingAuctionIds.length; i++) {
            uint256 auctionId = ongoingAuctionIds[i];
            if (auctions[auctionId].ended || block.timestamp >= auctions[auctionId].endTime) {
                expired[index] = auctions[auctionId];
                index++;
            }
        }

        for (uint256 i = 0; i < expiredAuctionIds.length; i++) {
            expired[index] = auctions[expiredAuctionIds[i]];
            index++;
        }

        return expired;
    }

    function cleanupExpiredAuctions() external {
        for (uint256 i = ongoingAuctionIds.length; i > 0; i--) {
            uint256 auctionId = ongoingAuctionIds[i - 1];
            if (block.timestamp >= auctions[auctionId].endTime && !auctions[auctionId].ended) {
                _moveToExpired(auctionId);
            }
        }
    }

    function withdrawAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(msg.sender == auction.seller, "Only seller can withdraw");
        require(!auction.ended, "Auction already ended");
        require(auction.highestBidder == address(0), "Cannot withdraw after bids");

        auction.ended = true;

        // Return NFT to seller
        auction.nftContract.transferFrom(address(this), auction.seller, auction.tokenId);

        emit AuctionWithdrawn(_auctionId, auction.seller);
    }

    function emergencyWithdraw(uint256 _auctionId) external onlyOwner nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction already ended");

        auction.ended = true;

        // Return NFT to seller
        auction.nftContract.transferFrom(address(this), auction.seller, auction.tokenId);

        // Refund highest bidder if any
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        emit AuctionCancelled(_auctionId, auction.seller, auction.highestBidder);
    }
}
