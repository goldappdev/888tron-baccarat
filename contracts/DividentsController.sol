pragma solidity ^0.4.25;

import "./IDividentsController.sol";

contract EmptyDividendsController is IDividendsController {

    function addMintableAmount(address player, uint value) external{

    }

    function addDividends(int value) external {

    }
}
