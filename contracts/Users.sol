pragma solidity ^0.4.25;

import "./IUsers.sol";

contract Users is IUsers {

    address[] users;

    function getUserIdToAddress(uint _userId) external view returns (address){
      return users[_userId];
    }

    function addUser(address user) external returns (uint){
      uint id = users.length;
      users.push(user);
      return id;
    }
}
