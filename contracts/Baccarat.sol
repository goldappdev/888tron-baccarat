pragma solidity ^0.4.25;

import "./Deck.sol";
import "./Ownable.sol";
import "./Hand.sol";
import "./SafeMath.sol";


contract Baccarat is Ownable {
  using SafeMath for uint;
  using CardLib for Card;

  struct Bet{
    uint player;
    uint banker;
    uint tie;
    uint small;
    uint big;
    uint playerPair;
    uint bankerPair;
    uint eitherPair;
    uint perfectPair;
  }

  struct Game{
    address player;
    uint blockNumber;

    uint[9] initialBetsArray;
    // can be optional parameter
    uint[9] receivedBetsArray;
    // cards
    Hand playerHand;
    Hand bankerHand;

  }

  // winnings rates
  uint maxPercent = 100;
  uint playerBetMul = 100;
  uint bankerBetMul = 100;
  uint bankerOn6BetMul = 50;
  uint banker6BetMul = 50;
  uint tieBetMul = 800;
  uint smallBetMul = 150;
  uint bigBetMul = 54;
  uint playerPairBetMul = 1100;
  uint bankerPairBetMul = 1100;
  uint eitherPairBetMul = 500;
  uint perfectPairBetMul = 2500;

  // default bet limits (inclusive)
  uint public minBetLimit = 1 trx;
  uint public maxBetLimit = 1000 trx;

  // use the game id to reference the games
  uint public gameCount = 0;
  // TODO: remove public
  mapping(uint => Game) public games;

  Deck public deck;
  // fast way to get player games ids
  mapping(address => uint[]) public playersHistory;


  // all params in games map
  event GameResult(address indexed player, uint gameId);

  constructor (Deck _deck) public {
    deck = _deck;
  }

  /*
  * initialBetsArray - array of all posible bets in order:
    playerBet
    bankerBet
    tieBet
    smallBet
    bigBet
    playerPairBet
    bankerPairBet
    eitherPairBet
    perfectPairBet
  */
  function playGame(uint[9] initialBetsArray) public payable {

    // sent trx must be equal to the bets sum
    assert(_isBetCorrect(initialBetsArray, msg.value));

    // all bets must be at required limits
    assert(_isBetsLimited(initialBetsArray));

    // the contract should have enough money to pay the winnings
    assert(_isBetsCanBePaid(initialBetsArray));

    // draw 6 random cards
    CardStack cardStack = new CardStack();
    deck.drawSixCardsToStack(cardStack);
    Hand userHand = new Hand();
    Hand bankerHand = new Hand();

    // lay out a deck
    _dealCards(userHand, bankerHand, cardStack);

    // calculate the bets
    uint[9] memory receivedBetsArray = _calculateBets(userHand, bankerHand, initialBetsArray);

    // send winnings
    msg.sender.transfer(_getTotalBet(receivedBetsArray));

    // logging data and events
    games[gameCount] = Game(msg.sender,
      block.number,
      initialBetsArray,
      receivedBetsArray,
      userHand,
      bankerHand);

    playersHistory[msg.sender].push(gameCount);
    emit GameResult(msg.sender, gameCount);
    gameCount+= 1;

  }

  function _betIncrease(uint bet, uint multiplier) public view returns(uint){
    return bet.add(bet.mul(multiplier).div(maxPercent));
  }

  // distributes cards from the stack to the players in the hands of the rules of the game
  function _dealCards(Hand userHand, Hand bankerHand, CardStack cardStack) public {

    userHand.takeCard(cardStack.pop());
    bankerHand.takeCard(cardStack.pop());
    userHand.takeCard(cardStack.pop());
    bankerHand.takeCard(cardStack.pop());

    // "If the value of Player or Banker is 8 or 9, both hands stand"
    if (userHand.getTotalPoints()!=9 && userHand.getTotalPoints()!=8 && bankerHand.getTotalPoints()!=9 && bankerHand.getTotalPoints()!=8){
      // "If the value of Player’s starting hand is between 0 and 5 (inclusive), Player draws a third card"
      // "If the value of Player is 6 or 7, Player stands"
      if (userHand.getTotalPoints() <= 5){
        userHand.takeCard(cardStack.pop());
        // "If Player draws a third card, the Banker will only draw a third card if either:"
        // "The value of Banker’s starting hand is between 0 and 2 from initial deal"
        bool cardRequired = bankerHand.getTotalPoints() <= 2;
        // "The value of Banker’s starting hand is 3 and the Player’s third card is not an 8"
        cardRequired = cardRequired || ((bankerHand.getTotalPoints() == 3) && (userHand.getCard(2).getPoints() != 8));
        // "The value of the Banker’s starting hand is 4 and the Player’s third card is between 2 and 7 (inclusive)"
        cardRequired = cardRequired || ((bankerHand.getTotalPoints() == 4) && (userHand.getCard(2).getPoints()>=2 && userHand.getCard(2).getPoints()<=7));
        // "The value of the Banker’s starting hans 5 and the Player’s third card is between 4 and 7 (inclusive)"
        cardRequired = cardRequired || ((bankerHand.getTotalPoints() == 5) && (userHand.getCard(2).getPoints()>=4 && userHand.getCard(2).getPoints()<=7));
        // "The value of the Banker’s starting hand is 6 and the Player’s third card is either 6 or 7"
        cardRequired = cardRequired || ((bankerHand.getTotalPoints() == 6) && (userHand.getCard(2).getPoints()>=6 && userHand.getCard(2).getPoints()<=7));
        if (cardRequired){
          bankerHand.takeCard(cardStack.pop());
        }
      }else{
        // "If Player stands, Banker draws third card if the value of its starting hand is between 0 and 5 (inclusive)"
        if (bankerHand.getTotalPoints() <= 5){
          bankerHand.takeCard(cardStack.pop());
        }
      }
    }
  }

  // returns the total winnings of the player, depending on the cards on the hands and the original bets
  function _calculateBets(Hand userHand,
    Hand bankerHand,
    uint[9] initialBetsArray) public view returns(uint[9]) {

    // use structures to not get confused in the code
    Bet memory initialBets = Bet(initialBetsArray[0],
       initialBetsArray[1],
       initialBetsArray[2],
       initialBetsArray[3],
       initialBetsArray[4],
       initialBetsArray[5],
       initialBetsArray[6],
       initialBetsArray[7],
       initialBetsArray[8]);
    Bet memory receivedBets = Bet(0, 0, 0, 0, 0, 0, 0, 0, 0);

    // calculating winning bets

    // player/banker/tie
    if (bankerHand.getTotalPoints() == userHand.getTotalPoints()){
       receivedBets.tie = _betIncrease(initialBets.tie, tieBetMul);
       // "When there is a tie, the Player and Banker bets are pushed"
       receivedBets.player = initialBets.player;
       receivedBets.banker = initialBets.banker;
    } else {
      receivedBets.tie = 0;

      if (bankerHand.getTotalPoints() > userHand.getTotalPoints()){
        receivedBets.player = 0;
        // This rule is not indicated in the example, but comes from Paytable
        if (bankerHand.getTotalPoints() == 6){
          receivedBets.banker = _betIncrease(initialBets.banker, bankerOn6BetMul);
        }else{
          receivedBets.banker = _betIncrease(initialBets.banker, bankerBetMul);
        }
      }else{
        receivedBets.player = _betIncrease(initialBets.player, playerBetMul);
        receivedBets.banker = 0;
      }
    }

    // "Player Pair bet pays if the Player is dealt a pair in their first two cards"
    if (userHand.isPair()){
      receivedBets.playerPair = _betIncrease(initialBets.playerPair, playerPairBetMul);
    }else{
      receivedBets.playerPair = 0;
    }

    // "Banker Pair bet pays if the Player is dealt a pair in their first two cards"
    if (bankerHand.isPair()){
      receivedBets.bankerPair = _betIncrease(initialBets.bankerPair, bankerPairBetMul);
    }else{
      receivedBets.bankerPair = 0;
    }

    // "Either Pair bet pays if either the Player or Banker is dealt a pair in their first two cards"
    if (userHand.isPair() || bankerHand.isPair()){
      receivedBets.eitherPair = _betIncrease(initialBets.eitherPair, eitherPairBetMul);
    }else{
      receivedBets.eitherPair = 0;
    }

    // "Perfect Pair bet pays if either the Player or Banker is dealt a suited pair in their first two cards"
    if (userHand.isPerfectPair() || bankerHand.isPerfectPair()){
      receivedBets.perfectPair = _betIncrease(initialBets.perfectPair, perfectPairBetMul);
    }else{
      receivedBets.perfectPair = 0;
    }

    // "Small bet pays if only four cards have been dealt to Player and Banker by the end of the hand"
    // "Big bet pays if five or six cards have been dealt to Player and Banker by the end of the hand"
    if ((bankerHand.cardsCount() + userHand.cardsCount()) > 4){
      receivedBets.big = _betIncrease(initialBets.big, bigBetMul);
      receivedBets.small = 0;
    } else {
      receivedBets.big = 0;
      receivedBets.small = _betIncrease(initialBets.small, smallBetMul);
    }

    uint[9] memory receivedBetsArray = [receivedBets.player,
      receivedBets.banker,
      receivedBets.tie,
      receivedBets.small,
      receivedBets.big,
      receivedBets.playerPair,
      receivedBets.bankerPair,
      receivedBets.eitherPair,
      receivedBets.perfectPair];

    return receivedBetsArray;
  }

  function _getTotalBet(uint[9] bets) public pure returns(uint){
    uint totalBet = 0;
    for (uint i=0; i<9; i+=1){
      totalBet = totalBet.add(bets[i]);
    }
    return totalBet;
  }

  // withdraw some value of ETH to some address
  function withdraw(uint value, address payee) onlyOwner external {
    payee.transfer(value);
  }

  // receive funds
  function () external payable {
  }

  // true if the bets do not go beyond the permissible limits
  function _isBetsLimited(uint[9] bets) public view returns(bool){
    for (uint i=0; i<9; i+=1){
      if (bets[i] > 0){
        if ((minBetLimit > bets[i]) || (bets[i] > maxBetLimit)){
          return false;
        }
      }
    }
    return true;
  }

  // true if there is enough money to pay for the maximum win
  function _isBetsCanBePaid(uint[9] bets) public view returns(bool){
    return address(this).balance >= _getTotalBet([_betIncrease(bets[0], playerBetMul),
      _betIncrease(bets[1], bankerBetMul),
      _betIncrease(bets[2], tieBetMul),
      _betIncrease(bets[3], smallBetMul),
      _betIncrease(bets[4], bigBetMul),
      _betIncrease(bets[5], playerPairBetMul),
      _betIncrease(bets[6], bankerPairBetMul),
      _betIncrease(bets[7], eitherPairBetMul),
      _betIncrease(bets[8], perfectPairBetMul)]);
  }

  function _isBetCorrect(uint[9] bets, uint value) public pure returns(bool){
    if (value==0){
      return false;
    }else{
      return _getTotalBet(bets) == value;
    }
  }

  function setMinBetLimit(uint newBetLimit) onlyOwner external {
    assert(newBetLimit <= maxBetLimit);
    minBetLimit = newBetLimit;
  }

  function setMaxBetLimit(uint newBetLimit) onlyOwner external {
    assert(newBetLimit >= minBetLimit);
    maxBetLimit = newBetLimit;
  }

  // allowing to serialize the game struct
  function getGameInfo(uint gameId) public view returns (address, uint, uint[9], uint[9], Hand, Hand){
    Game memory o = games[gameId];
    return (o.player, o.blockNumber, o.initialBetsArray, o.receivedBetsArray, o.playerHand, o.bankerHand);
  }
}
