pragma solidity ^0.4.25;

import "../RandomNumberGenerator.sol";

contract RandomNumberGeneratorTest {

  // will return false, if rng generate same numbers
  function test2RNGinSameBlock() public returns (bool result) {
    RandomNumberGenerator rng = new RandomNumberGenerator();
    uint a =  rng.RNG(420000000);
    uint b =  rng.RNG(420000000);
    result = a != b;
  }
}
