pragma solidity ^0.4.25;

interface IDividendsController {

    function addMintableAmount(address player, uint value) external;

    function addDividends(int value) external;
}
