pragma solidity ^0.4.25;

import "./IGame.sol";
import "./IUsers.sol";
import "./Ownable.sol";
import "./IGameManager.sol";
import "./IDividentsController.sol";


contract BaccaratGame is Ownable, IGame {

    uint64 private minBet; // in trx
    // max posible bet 18446744073709,551615 trx (actually less)
    uint64 private maxBet; // in trx

    /* sum(3)(5)(8)(2)
      bets array structure
      game take 4 bytes32 slots
      1s block
      player(address, 160b) - status(8b) - amount(32b) - block(32) - refId(24)
      2 block
      bets(player, banker, tie, small, big, player pair, banker pair, either pair, perfect pair 9*16b=144b) - empty(58b) - cardsIndexes(6*9b=56b)
    */
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

    // winning values relative to 100
    uint32[] private betsValues = [
      100, // player
      100, // banker
      50, // banker on 6
      800, // tie
      150, // small
      54, // big
      1100, // player pair
      1100, // banker pair
      500, // either pair
      2500 // perfect pair
    ];

    constructor() public {
      minBet = 10;
      maxBet = 20000000000;

      drawer = msg.sender;
      drawerFee = 300000;
      fee2 = 300000;
      fee3 = 20;
      refPercent = 20;
    }

    function getBetCount() public view returns (uint){
        return bets.length/2;
    }

    function isNotContract(address _address) public view returns (bool){
        uint32 size;
        assembly {
            size := extcodesize(_address)
        }
        return size == 0;
    }

    // bets order: player, banker, tie, small, big, player pair, banker pair, either pair, perfect pair
    function createBet (
      address from,
      address player,
      uint amount,
      uint refUserId,
      bytes32[] data
    )
      external
    {
      require(msg.sender == address(manager));
      require(isNotContract(from));
      require(data.length == 9);

      // collect bets
      uint32[9] memory betValues;
      for (uint8 i=0; i<9; i++){
        betValues[i] = uint32(data[i]);
      }

      // check bets limits
      require(isBetsLimited(betValues));

      // check sum(bets) == amount

      require(isBetCorrect(betValues, amount/1000000));

      uint currentSlot = bets.length;

      bets.length+= 2;

      bets[currentSlot] = bytes32(
        ((refUserId & 0xFFFFFF) << 232) |
        (((block.number) & 0xFFFFFFFF) << 200) |
        ((amount/1000000 & 0xFFFFFFFF) << 168) |
        (250 << 160) |
        uint(from) // max is 2^20
      );

      bets[currentSlot+1] = bytes32(
        (uint(betValues[8] & 0xFFFF) << 16*8) |
        (uint(betValues[7] & 0xFFFF) << 16*7) |
        (uint(betValues[6] & 0xFFFF) << 16*6) |
        (uint(betValues[5] & 0xFFFF) << 16*5) |
        (uint(betValues[4] & 0xFFFF) << 16*4) |
        (uint(betValues[3] & 0xFFFF) << 16*3) |
        (uint(betValues[2] & 0xFFFF) << 16*2) |
        (uint(betValues[1] & 0xFFFF) << 16) |
        (betValues[0] & 0xFFFF)
      );

      if (refUserId > 0) {
          handleRef(refUserId, amount);
      }
      manager.transferTo(drawer, drawerFee);
      dividends.addMintableAmount(from, amount);
    }

    function getBetValuesByIndex(uint slot) public view returns(uint32[9] memory) {
      return [
        uint32(bets[slot] & 0xFFFF),
        uint32((bets[slot]>>16*1) & 0xFFFF),
        uint32((bets[slot]>>16*2) & 0xFFFF),
        uint32((bets[slot]>>16*3) & 0xFFFF),
        uint32((bets[slot]>>16*4) & 0xFFFF),
        uint32((bets[slot]>>16*5) & 0xFFFF),
        uint32((bets[slot]>>16*6) & 0xFFFF),
        uint32((bets[slot]>>16*7) & 0xFFFF),
        uint32((bets[slot]>>16*8) & 0xFFFF)
      ];
    }

    function getCardsByIndex(uint slot) public view returns(uint[6] memory) {
      return [
        uint((bets[slot]>>(202+0*9)) & 0x1FF),
        uint((bets[slot]>>(202+1*9)) & 0x1FF),
        uint((bets[slot]>>(202+2*9)) & 0x1FF),
        uint((bets[slot]>>(202+3*9)) & 0x1FF),
        uint((bets[slot]>>(202+4*9)) & 0x1FF),
        uint((bets[slot]>>(202+5*9)) & 0x1FF)
      ];
    }

    function closeBets(uint count) external {

        uint n = openBetIndex + count*2;
        if (n > bets.length) n = bets.length;

        for (uint betIndex = openBetIndex; betIndex < n; betIndex+=2) {
          uint winAmount = 0;

          // take curr bet params
          uint betBlockNumber = (uint(bets[betIndex]) >> 200) & 0xffffffff;
          address player = address(bets[betIndex]);

          if (((uint(bets[betIndex]) >> 160) & 0xff) != 250 || betBlockNumber >= block.number || betBlockNumber == 0) break;

          // collect betValues
          uint betAmount = ((uint(bets[betIndex]) >> 168) & 0xFFFFFFFF);

          uint hash = uint(blockhash(betBlockNumber));
          uint16[6] memory gameCardsIndexes = getRandomIndexesFromHash(player, hash);

          if ((block.number < (betBlockNumber + 250)) && (hash > 0)) {
              //  dealCards
              (uint16[5] memory userHandIndexes,
              uint16[5] memory bankerHandIndexes) = dealCards(gameCardsIndexes);

              // calculate winnings
              winAmount = getTotalBet(
                calculateBets(
                  userHandIndexes,
                  bankerHandIndexes,
                  getBetValuesByIndex(betIndex+1)
                )
              );

              bets[betIndex] = bytes32(
                (bets[betIndex] & 0xFFFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) |
                (252 << 160)
              );
          } else {
              bets[betIndex] = bytes32(
                (bets[betIndex] & 0xFFFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) |
                (251 << 160)
              );
              winAmount = betAmount;
          }
          winAmount = winAmount*1000000;

          // send trx
          if (winAmount > 0) {
            require(
              address(manager).call.gas(9700)(bytes4(keccak256("transferTo(address,uint256)")), player, winAmount) ||
              address(manager).balance > winAmount
            );
          }

          // logging drawned cards
          for (uint8 i=0; i < 6; i+= 1){
            // each card require 9b
            bets[betIndex+1] = bytes32((bets[betIndex+1]) | (bytes32(gameCardsIndexes[i]) << (202 + i*9)));
          }

          dividends.addDividends(int(betAmount) - int(winAmount) - fee2 - int(betAmount * fee3 / 10000));
        }

        openBetIndex = betIndex;
    }

    function handleRef(uint refUserId, uint amount) internal {
      address referral = users.getUserIdToAddress(refUserId);

      if (referral != address(0)) {
        manager.transferTo(referral, (amount * refPercent) / 10000);
      }
    }

    // set 1 0 to disable buy
    function setMinMaxBet(uint _minBet, uint _maxBet) external onlyOwner {
      require(_minBet<=uint64(0 - 1) && _maxBet<=uint64(0 - 1));

      minBet = uint64(_minBet);
      maxBet = uint64(_maxBet);
    }

    function getMinMaxBet() external view returns (uint min, uint max) {
        min = minBet;
        max = maxBet;
    }

    // status 250 - game wait for processing, 251 - game out off date, 252 - game completed
    function getNeedCloseBets()
      external
      view
      returns (
        uint openIndex,
        bool isNeedClose,
        uint betsCount,
        uint betBlockNumber,
        uint status,
        bytes32 bet
      )
    {
        betsCount = getBetCount();
        openIndex = openBetIndex;

        if (openIndex < bets.length) {

            bet = (bets[openIndex]);

            betBlockNumber = (uint(bet) >> 200) & 0xffffffff;
            status = uint(bet >> 160) & 0xff;

            isNeedClose = betBlockNumber > 0 && betBlockNumber < block.number && status == 250;
        } else {
            isNeedClose = false;
        }
    }

    function getBets(uint offset, uint count) external view returns (bytes32[]){
        require(offset > bets.length);

        uint k;
        uint n = offset + count*2;
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

    function addBets(bytes32[] _bets) external onlyOwner {
        for (uint i = 0; i < _bets.length; i++) {
            bets.push(_bets[i]);
        }
    }

    // My functions

    // get 6 random indexes in order to take a unique selection from all cards
    function getRandomIndexesFromHash(address player, uint hash)
      public
      pure
      returns (uint16[6])
    {
      bytes32 winHash = keccak256(abi.encodePacked(hash + uint(player)));

      // we assume that we have an infinite number of decks,
      // in order to significantly simplify the generation algorithm
      return [
        uint16(uint(winHash & 0xffff) % 52),
        uint16(uint((winHash >> 16) & 0xffff) % 52)+52*1,
        uint16(uint((winHash >> 32) & 0xffff) % 52)+52*2,
        uint16(uint((winHash >> 48) & 0xffff) % 52)+52*3,
        uint16(uint((winHash >> 64) & 0xffff) % 52)+52*4,
        uint16(uint((winHash >> 80) & 0xffff) % 52)+52*5
      ];
    }

    function getTotalBet(uint32[9] betValues) public pure returns(uint){
      uint totalBet = 0;
      for (uint i=0; i<9; i+=1){
        totalBet+= uint(betValues[i]);
      }
      return totalBet;
    }

    // return the increased bet amount
    function betIncrease(uint32 bet, uint betIndex) public view returns(uint32){
      return bet+(bet*betsValues[betIndex])/100;
    }

    function isBetCorrect(uint32[9] betValues, uint value) public pure returns(bool){
      if (value==0){
        return false;
      }else{
        return getTotalBet(betValues) == value;
      }
    }

    // true if the bets do not go beyond the permissible limits
    function isBetsLimited(uint32[9] _bets) public view returns(bool){
      for (uint i=0; i<9; i+=1){
        if (_bets[i] > 0){
          if ((uint(minBet) > _bets[i]) || (_bets[i] > uint(maxBet))){
            return false;
          }
        }
      }
      return true;
    }

    // return value and suit numbers of card by index
    // values = "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"
    // suits = "♠", "♣", "♥️", "♦"
    function getCardByIndex(uint index)
      public
      pure
      returns(uint8 value, uint8 suit, uint8 deckNumber)
    {
      require(index<416);
      deckNumber = uint8(index / 52);
      uint8 indexInDeck = uint8(index % 52);
      value = indexInDeck / 4;
      suit = indexInDeck % 4;
    }

    function getCardPointsByIndex(uint index) public pure returns(uint8){
      (uint8 value, , ) = getCardByIndex(index);

      if (value < 8){
        // 2,3,..8,9
        return value+2;
      }else{
        if (value == 12){
          // Ace
          return 1;
        }else{
          // 10,Jack,Queen,King
          return 0;
        }
      }
    }

    // distributes cards from the stack to the players in the hands of the rules of the game
    // userHand[0..2] - cards
    // userHand[3] - points
    // userHand[4] - cards count
    function dealCards(uint16[6] cardsIndexes) public pure returns (
      uint16[5] memory userHand,
      uint16[5] memory bankerHand
    )
    {
      uint8 topCardIndex = 6;

      // player and banker take 2 cards one by one starting from the player
      userHand[userHand[4]++] = cardsIndexes[--topCardIndex];
      userHand[3] = (userHand[3] + getCardPointsByIndex(userHand[userHand[4]-1])) % 10;

      bankerHand[bankerHand[4]++] = cardsIndexes[--topCardIndex];
      bankerHand[3] = (bankerHand[3] + getCardPointsByIndex(bankerHand[bankerHand[4]-1])) % 10;

      userHand[userHand[4]++] = cardsIndexes[--topCardIndex];
      userHand[3] = (userHand[3] + getCardPointsByIndex(userHand[userHand[4]-1])) % 10;

      bankerHand[bankerHand[4]++] = cardsIndexes[--topCardIndex];
      bankerHand[3] = (bankerHand[3] + getCardPointsByIndex(bankerHand[bankerHand[4]-1])) % 10;

      // "If the value of Player or Banker is 8 or 9, both hands stand"
      if (userHand[3]!=9 && userHand[3]!=8 && bankerHand[3]!=9 && bankerHand[3]!=8){
        // "If the value of Player’s starting hand is between 0 and 5 (inclusive), Player draws a third card"
        // "If the value of Player is 6 or 7, Player stands"
        if (userHand[3] <= 5){
          userHand[userHand[4]++] = cardsIndexes[--topCardIndex];
          uint8 userThirdCardPoints = getCardPointsByIndex(userHand[userHand[4]-1]);
          userHand[3] = (userHand[3] + userThirdCardPoints) % 10;
          // "If Player draws a third card, the Banker will only draw a third card if either:"
          // "The value of Banker’s starting hand is between 0 and 2 from initial deal"
          bool cardRequired = bankerHand[3] <= 2;
          // "The value of Banker’s starting hand is 3 and the Player’s third card is not an 8"
          cardRequired = cardRequired || ((bankerHand[3] == 3) && (userThirdCardPoints != 8));
          // "The value of the Banker’s starting hand is 4 and the Player’s third card is between 2 and 7 (inclusive)"
          cardRequired = cardRequired || ((bankerHand[3] == 4) && (userThirdCardPoints>=2 && userThirdCardPoints<=7));
          // "The value of the Banker’s starting hans 5 and the Player’s third card is between 4 and 7 (inclusive)"
          cardRequired = cardRequired || ((bankerHand[3] == 5) && (userThirdCardPoints>=4 && userThirdCardPoints<=7));
          // "The value of the Banker’s starting hand is 6 and the Player’s third card is either 6 or 7"
          cardRequired = cardRequired || ((bankerHand[3] == 6) && (userThirdCardPoints>=6 && userThirdCardPoints<=7));
          if (cardRequired){
            bankerHand[bankerHand[4]++] = cardsIndexes[--topCardIndex];
            bankerHand[3] = (bankerHand[3] + getCardPointsByIndex(bankerHand[bankerHand[4]-1])) % 10;
          }
        }else{
          // "If Player stands, Banker draws third card if the value of its starting hand is between 0 and 5 (inclusive)"
          if (bankerHand[3] <= 5){
            bankerHand[bankerHand[4]++] = cardsIndexes[--topCardIndex];
            bankerHand[3] = (bankerHand[3] + getCardPointsByIndex(bankerHand[bankerHand[4]-1])) % 10;
          }
        }
      }

      return (userHand, bankerHand);
    }

    function calculateBets(
      uint16[5] userHand,
      uint16[5] bankerHand,
      uint32[9] memory initialBets
    )
      public
      view
      returns(uint32[9] memory receivedBets)
    {
      // first user card value and suit
      (uint8 fuv, uint8 fus,) = getCardByIndex(userHand[0]);
      // second user card value and suit
      (uint8 suv, uint8 sus,) = getCardByIndex(userHand[1]);
      (uint8 fbv, uint8 fbs,) = getCardByIndex(bankerHand[0]);
      (uint8 sbv, uint8 sbs,) = getCardByIndex(bankerHand[1]);

      // calculating winning bets

      // player/banker/tie
      if (bankerHand[3] == userHand[3]){
        receivedBets[2] = betIncrease(initialBets[2], 3);
        // "When there is a tie, the Player and Banker bets are pushed"
        receivedBets[0] = initialBets[0];
        receivedBets[1] = initialBets[1];
      } else {
        receivedBets[2] = 0;

        if (bankerHand[3] > userHand[3]){
         receivedBets[0] = 0;
         // This rule is not indicated in the example, but comes from Paytable
         if (bankerHand[3] == 6){
           receivedBets[1] = betIncrease(initialBets[1], 2);
         }else{
           receivedBets[1] = betIncrease(initialBets[1], 1);
         }
        }else{
           receivedBets[0] = betIncrease(initialBets[0], 0);
           receivedBets[1] = 0;
        }
      }

      // "Player Pair bet pays if the Player is dealt a pair in their first two cards"
      if (fuv == suv){
        receivedBets[5] = betIncrease(initialBets[5], 6);
      }else{
        receivedBets[5] = 0;
      }

      // "Banker Pair bet pays if the Player is dealt a pair in their first two cards"
      if (fbv == sbv){
        receivedBets[6] = betIncrease(initialBets[6], 7);
      }else{
        receivedBets[6] = 0;
      }

      // "Either Pair bet pays if either the Player or Banker is dealt a pair in their first two cards"
      if (fuv == suv || fbv == sbv){
        receivedBets[7] = betIncrease(initialBets[7], 8);
      }else{
        receivedBets[7] = 0;
      }

      // "Perfect Pair bet pays if either the Player or Banker is dealt a suited pair in their first two cards"
      if ((fuv == suv && fus == sus) || (fbv == sbv && fbs == sbs)){
        receivedBets[8] = betIncrease(initialBets[8], 9);
      }else{
        receivedBets[8] = 0;
      }

      // "Small bet pays if only four cards have been dealt to Player and Banker by the end of the hand"
      // "Big bet pays if five or six cards have been dealt to Player and Banker by the end of the hand"
      if ((bankerHand[4] + userHand[4]) > 4){
        receivedBets[4] = betIncrease(initialBets[4], 5);
        receivedBets[3] = 0;
      } else {
        receivedBets[4] = 0;
        receivedBets[3] = betIncrease(initialBets[3], 4);
      }

      return receivedBets;
    }
}
