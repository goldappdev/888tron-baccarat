pragma solidity ^0.4.25;

import "./Card.sol";

library CardLib {

  function getPoints(Card a) public view returns(uint8){
    if (a.valueNumber() < 8){
      // 2,3,..8,9
      return a.valueNumber()+2;
    }else{
      if (a.valueNumber() == 12){
        // Ace
        return 1;
      }else{
        // 10,Jack,Queen,King
        return 0;
      }
    }
  }

  function suitStr(Card a) public view returns(string){
    //TODO: memory of VM?
    string[4] memory cardSuits = ["♠", "♣", "♥️", "♦"];

    //TODO: check suit numbers
    return string(cardSuits[a.suitNumber()]);
  }

  function valueStr(Card a) public view returns(string){
    //TODO: memory of VM?
    // 11 12 13 14 - Jack Queen King Ace
    string[13] memory valuesRepr = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    //TODO: check value numbers
    return string(valuesRepr[a.valueNumber()]);
  }

  function str(Card a) public view returns(string){
    // concatenation
    return string(abi.encodePacked(valueStr(a), suitStr(a), "", "", ""));
  }
}
