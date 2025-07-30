// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC1363 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NftAuctions is ERC20, ERC1363, ERC20Permit, Ownable, ReentrancyGuard {
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

    constructor(address initialOwner) ERC20("NftAuctions", "NFTA") ERC20Permit("NftAuctions") Ownable(initialOwner) {}

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
            highestBid: _startingPriceWei,
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
            payable(auction.seller).transfer(auction.highestBid);
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
}
