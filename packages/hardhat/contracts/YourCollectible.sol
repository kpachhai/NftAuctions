// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; //Do not change the solidity version as it negatively impacts submission grading

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// EIP-2981 Royalty Interface
interface IERC2981 {
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount);
}

contract YourCollectible is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 public tokenIdCounter;
    
    // EIP-2981 Royalty variables
    uint256 public royaltyPercentage = 1000; // 10% in basis points (1000 = 10%)
    address public royaltyReceiver;

    constructor() ERC721("YourCollectible", "YCB") Ownable(msg.sender) {
        royaltyReceiver = msg.sender; // Set deployer as initial royalty receiver
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://ipfs.io/ipfs/";
    }

    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    function mintItem(address to, string memory uri) public returns (uint256) {
        tokenIdCounter += 1;
        uint256 tokenId = tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    // EIP-2981 Royalty functions
    function royaltyInfo(uint256 tokenId, uint256 salePrice) public view returns (address receiver, uint256 royaltyAmount) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        royaltyAmount = (salePrice * royaltyPercentage) / 10000;
        return (royaltyReceiver, royaltyAmount);
    }

    function setRoyaltyReceiver(address newReceiver) public onlyOwner {
        require(newReceiver != address(0), "Invalid receiver address");
        royaltyReceiver = newReceiver;
    }

    function setRoyaltyPercentage(uint256 newPercentage) public onlyOwner {
        require(newPercentage <= 10000, "Percentage cannot exceed 100%");
        royaltyPercentage = newPercentage;
    }

    function _increaseBalance(address account, uint128 tokenId) internal override(ERC721, ERC721Enumerable) {
        return super._increaseBalance(account, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
