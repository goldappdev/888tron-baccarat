pragma solidity ^0.4.25;

interface IUsers {
    function getUserIdToAddress(uint _userId) external view returns (address);
}
