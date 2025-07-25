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

    constructor(address initialOwner) ERC20("NftAutions", "MTK") ERC20Permit("NftAutions") Ownable(initialOwner) {}

    receive() external payable {}

    function createAuction(
        IERC721 _nftContract,
        uint256 _tokenId,
        uint256 _startingPriceWei,
        uint256 _durationMinutes
    ) external nonReentrant {
        require(_startingPriceWei > 0, "Starting price must be > 0");
        _nftContract.transferFrom(msg.sender, address(this), _tokenId);

        uint256 auctionId = auctionCount;
        auctions[auctionId] = Auction({
            auctionId: auctionId,
            seller: msg.sender,
            highestBidder: address(0),
            highestBid: _startingPriceWei,
            startTime: block.timestamp,
            endTime: block.timestamp + _durationMinutes * 1 minutes,
            startingPrice: _startingPriceWei,
            nftContract: _nftContract,
            tokenId: _tokenId,
            ended: false
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            address(_nftContract),
            _tokenId,
            _startingPriceWei,
            block.timestamp,
            block.timestamp + _durationMinutes * 1 minutes
        );

        auctionCount += 1;
    }

    function placeBid(uint256 _auctionId) external payable nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        // Refund previous bidder
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(block.timestamp >= auction.endTime, "Auction not ended yet");
        require(!auction.ended, "Auction already ended");

        auction.ended = true;

        if (auction.highestBidder != address(0)) {
            // Transfer NFT to the highest bidder
            auction.nftContract.transferFrom(address(this), auction.highestBidder, auction.tokenId);
            payable(auction.seller).transfer(auction.highestBid);
            emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid);
        } else {
            // No bids were placed, return NFT to the seller
            auction.nftContract.transferFrom(address(this), auction.seller, auction.tokenId);
        }
    }

    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }

    function getOngoingAuctions() external view returns (Auction[] memory) {
        Auction[] memory ongoing = new Auction[](auctionCount);
        uint256 count = 0;

        for (uint256 i = 0; i < auctionCount; i++) {
            if (!auctions[i].ended && block.timestamp < auctions[i].endTime) {
                ongoing[count] = auctions[i];
                count++;
            }
        }

        assembly {
            mstore(ongoing, count)
        }

        return ongoing;
    }

    function getExpiredAuctions() external view returns (Auction[] memory) {
        Auction[] memory expired = new Auction[](auctionCount);
        uint256 count = 0;

        for (uint256 i = 0; i < auctionCount; i++) {
            if (auctions[i].ended || block.timestamp >= auctions[i].endTime) {
                expired[count] = auctions[i];
                count++;
            }
        }

        assembly {
            mstore(expired, count)
        }

        return expired;
    }
}
