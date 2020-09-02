pragma solidity ^0.4.23;

import "./IGame.sol";
import "./IUsers.sol";
import "./Ownable.sol";
import "./IGameManager.sol";
import "./IDividentsController.sol";


contract Wheel is Ownable, IGame {

    uint private minBet;

    uint private maxBet;

    bytes32[] private bets;

    uint public openBetIndex = 0;

    uint public drawerFee;
    int private fee2;
    uint private fee3;

    address private drawer;

    uint public refPercent;

    IGameManager private manager;

    IDividendsController private dividends;

    IUsers private users;

    constructor() public {
        minBet = 50000000;
        maxBet = 20000000000;

        drawer = msg.sender;
        drawerFee = 300000;
        fee2 = 300000;
        fee3 = 20;
        refPercent = 20;
    }


    uint[] private betValues = [0, 6, 2, 5, 2, 10, 2, 5, 2, 6, 2, 5, 2, 6, 2, 10, 2, 5, 2, 20, 2];

    function getBetCount() external view returns (uint){
        return bets.length;
    }

    function getWinValue(address player, uint blockNumber) external view returns (uint){
        if (block.number > blockNumber + 250 || blockNumber >= block.number) return 250;

        return betValues[uint(keccak256(abi.encodePacked(uint(blockhash(blockNumber)) + uint(player)))) % 21];
    }

    function getWinIndex(address player, uint blockNumber) external view returns (uint){
        if (block.number > blockNumber + 250 || blockNumber >= block.number) return 250;

        return uint(keccak256(abi.encodePacked(uint(blockhash(blockNumber)) + uint(player)))) % 21;
    }

    function getWinIndexFromHash(address player, bytes32 hash) external pure returns (uint){
        return uint(keccak256(abi.encodePacked(uint(hash) + uint(player)))) % 21;
    }

    function isNotContract(address _address) public view returns (bool){
        uint32 size;
        assembly {
            size := extcodesize(_address)
        }
        return size == 0;
    }

    function createBet(address from, address player, uint amount, uint refUserId, bytes32[] data) external {
        require(msg.sender == address(manager) && minBet <= amount && amount <= maxBet && isNotContract(from));

        uint value = uint(data[0]);

        //bets.push(uint(msg.sender) | (value<<(8*20)) | (resultValue<<(8*21)) | (167772161<<(8*22)) | (1544162665 <<(8*25)));

        bets.push(bytes32(uint(from) | ((value & 0xFF) << 160) | (250 << 168) | ((uint(amount / 1000000)) << 176) | (((block.number) & 0xFFFFFFFF) << 200) | ((refUserId & 0xFFFFFF) << 232)));

        if (refUserId > 0) {
            address referral = users.getUserIdToAddress(refUserId);

            if (referral != address(0)) {
                manager.transferTo(referral, amount * refPercent / 10000);
            }
        }

        manager.transferTo(drawer, drawerFee);
        dividends.addMintableAmount(from, amount);
    }

    function closeBets(uint count) external {

        uint betCount = bets.length;
        uint n = openBetIndex + count;
        if (n > betCount) n = betCount;

        uint blockNumber = block.number;

        for (uint betIndex = openBetIndex; betIndex < n; betIndex++) {

            uint bet = uint(bets[betIndex]);

            uint betBlockNumber = (bet >> 200) & 0xffffffff;

            if (((bet >> 168) & 0xff) != 250 || betBlockNumber >= blockNumber || betBlockNumber == 0) break;

            address player = address(bet);

            uint betAmount = ((bet >> 176) & 0xffffff) * 1000000;

            uint winAmount = 0;

            uint hash = uint(blockhash(betBlockNumber));

            uint winIndex = uint(keccak256(abi.encodePacked(hash + uint(player)))) % 21;

            if ((blockNumber < (betBlockNumber + 250)) && (hash > 0)) {

                uint winValue = betValues[winIndex];

                uint betValue = (bet >> 160) & 0xff;

                if (betValue == winValue) {
                    winAmount = betAmount * betValue;
                }
            } else {
                winIndex = 251;
                winAmount = betAmount;
            }

            bets[betIndex] = bytes32((bet & 0xFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) | (winIndex << 168));

            if (winAmount > 0) {
                require(
                    address(manager).call.gas(9700)(bytes4(keccak256("transferTo(address,uint256)")), player, winAmount) ||
                    address(manager).balance > winAmount);
            }

            dividends.addDividends(int(betAmount) - int(winAmount) - fee2 - int(betAmount * fee3 / 10000));
        }
        if (openBetIndex != betIndex) openBetIndex = betIndex;
    }

    // set 1 0 to disable buy
    function setMinMaxBet(uint _minBet, uint _maxBet) external onlyOwner {
        minBet = _minBet;
        maxBet = _maxBet;
    }

    function getMinMaxBet() external view returns (uint min, uint max) {
        min = minBet;
        max = maxBet;
    }

    function getNeedCloseBets() external view returns (uint openIndex, bool isNeedClose, uint betsCount, uint betBlockNumber, uint betWinIndex, bytes32 bet){
        betsCount = bets.length;
        openIndex = openBetIndex;

        if (openIndex < betsCount) {

            bet = (bets[openIndex]);

            betBlockNumber = uint((bet >> 200) & 0xffffffff);
            betWinIndex = uint(bet >> 168) & 0xff;

            isNeedClose = betBlockNumber > 0 && betBlockNumber < block.number && betWinIndex == 250;
        } else {
            isNeedClose = false;
        }
    }

    function getBets(uint offset, uint count) external view returns (bytes32[]){
        if (offset > bets.length) return res;

        uint k;
        uint n = offset + count;
        if (n > bets.length) n = bets.length;
        bytes32[] memory res = new bytes32 [](n - offset);

        for (uint i = offset; i < n; i++) {
            res[k++] = bets[i];
        }
        return res;
    }

    function setRefPercent(uint _refPercent) external onlyOwner {
        refPercent = _refPercent;
    }

    function setDrawer(address _drawer) external onlyOwner {
        drawer = _drawer;
    }

    function setDrawerFee(uint _drawerFee) external onlyOwner {
        drawerFee = _drawerFee;
    }

    function setFee2(uint _fee2) external onlyOwner {
        fee2 = int(_fee2);
    }

    function setFee3(uint _fee3) external onlyOwner {
        fee3 = _fee3;
    }

    function setUsers(address _users) external onlyOwner {
        users = IUsers(_users);
    }

    function setManager(address _manager) external onlyOwner {
        require(_manager != address(0));
        manager = IGameManager(_manager);
    }

    function setDividends(address _dividends) external onlyOwner {
        require(_dividends != address(0));
        dividends = IDividendsController(_dividends);
    }

    function setOpenBetIndex(uint _openBetIndex) external onlyOwner {
        openBetIndex = _openBetIndex;
    }

    function setBets(uint _offset, bytes32[] _bets) external onlyOwner {
        uint n = _offset + _bets.length;
        if (bets.length < n) bets.length = n;

        for (uint i = 0; i < _bets.length; i++) {
            bets[_offset + i] = _bets[i];
        }

    }

    function addBets(bytes32 _bets) external onlyOwner {
        for (uint i = 0; i < _bets.length; i++) {
            bets.push(_bets[i]);
        }
    }
}
