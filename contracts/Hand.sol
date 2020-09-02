pragma solidity ^0.4.25;

import "./Card.sol";

/*
*/
contract Hand{
    using CardLib for Card;

    Card[] cards;
    uint8 points;

    function takeCard(Card card) public {
      cards.push(card);
      points = (points + card.getPoints()) % 10;
    }

    function getCard(uint index) public view returns(Card){
      assert(index < cards.length);
      return cards[index];
    }

    function getTotalPoints() public view returns(uint8){
      return points;
    }

    function isPair() public view returns(bool){
      assert(cards.length>=2);
      return cards[0].valueNumber() == cards[1].valueNumber();
    }

    function isPerfectPair() public view returns(bool){
      assert(cards.length>=2);
      return cards[0].valueNumber() == cards[1].valueNumber() && cards[0].suitNumber() == cards[1].suitNumber();
    }

    function cardsCount() public view returns(uint){
      return cards.length;
    }

}
