pragma solidity ^0.4.25;

import "./CardLib.sol";

contract Card {
  uint8 public suitNumber;
  uint8 public valueNumber;

  constructor (uint8 _suitNumber, uint8 _valueNumber) public {
    suitNumber = _suitNumber;
    valueNumber = _valueNumber;
  }
}
