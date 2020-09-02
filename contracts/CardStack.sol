pragma solidity ^0.4.25;

import "./Card.sol";

/*
This implementation is needed to simplify the code in the Bakkarat contract.
It can be removed when using solidity 0.5.4+,
because there they added pop for the array.
*/
contract CardStack{
    Card[] public stack;

    function pop() public returns(Card){
      assert(stack.length > 0);
      Card topCard = stack[stack.length - 1];
      stack.length-= 1;
      return topCard;
    }

    function push(Card card) public {
      stack.push(card);
    }

    function length() public view returns(uint){
      return stack.length;
    }

}
