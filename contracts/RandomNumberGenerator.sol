pragma solidity ^0.4.25;

contract RandomNumberGenerator {
  uint private rngCounter;

  constructor() public {
    rngCounter = 1;
  }
  //Generates a random number from 0 to X based on the last block hash
  //counter is added to "now" so that RNG doesnt produce same number if called twice in the same second
  function RNG(uint X) public returns (uint) {
    assert ((X+1)!=0); // overflow check

    if  (X==0) return 0;

    rngCounter *= 2;
    uint seed = now - rngCounter;
    uint _randNum = (uint(keccak256(abi.encodePacked(blockhash(block.number - 1), seed)))%(X + 1));

    //reset RNG counter to prevent unecessary large number and overflow
    if(rngCounter > 420000000)
    rngCounter = _randNum;

    return _randNum;
  }
}
