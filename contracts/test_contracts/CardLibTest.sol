pragma solidity ^0.4.25;

import "../CardLib.sol";

contract CardLibTest {
  using CardLib for Card;

  // TODO:someshit
  function testCallAllCardLibFunctions() public {
    Card card = new Card(0, 0);

    uint8 p = card.getPoints();
    string memory s = card.suitStr();
    string memory v = card.valueStr();
    string memory sv = card.str();
  }

  function callGetPoints(Card card) public view returns(uint8) {
      return card.getPoints();
  }

  function callStr(Card card) public view returns(string) {
      return card.str();
  }
}
