pragma solidity ^0.4.25;


import "./CardStack.sol";
import "./RandomNumberGenerator.sol";

contract Deck is RandomNumberGenerator{
    using CardLib for Card;
    Card[416] public cards;
    uint _topIndex = 0;

    modifier isFilled() {
        require(_topIndex>=416);
        _;
    }

    constructor (bool fill) public {
      if (fill){
        for (uint k=0; k<8; k+=1){
          for (uint j=0; j<13; j+=1){
            for (uint i=0; i<4; i+=1){
              cards[k*52 + j*4 + i] = new Card(uint8(i), uint8(j));
            }
          }
        }
        _topIndex = 416;
      }
    }

    function addCard(Card card) external returns(uint){
      require(_topIndex<416);
      cards[_topIndex] = card;
      _topIndex+= 1;
      return _topIndex;
    }

    function addFullDeck(uint decksCount) external returns(uint){
      require(_topIndex<=(416-52*decksCount));
      for (uint k=0; k<decksCount; k+=1){
        for (uint j=0; j<13; j+=1){
          for (uint i=0; i<4; i+=1){
            cards[_topIndex + k*52 + j*4 + i] = new Card(uint8(i), uint8(j));
          }
        }
      }
      _topIndex+= 13*4*decksCount;
      return _topIndex;
    }

    function getCardFace(uint _index) isFilled external  view returns(string){
      return cards[_index].str();
    }

    function drawSixCardsToStack(CardStack stack) isFilled public returns(CardStack ){
      uint[416] memory flags;
      for (uint i=0; i < 416; i++) {
        flags[i] = i;
      }

      uint flagIndex;
      for (i=0; i < 6; i++) {
        flagIndex = RNG(416 - i -1);
        stack.push(cards[flags[flagIndex]]);
        // remove the selected item to not select it again
        cards[flagIndex] = cards[416 - i - 1];
      }
      return stack;
    }

}
