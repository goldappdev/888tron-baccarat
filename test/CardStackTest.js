const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

var Card = artifacts.require("./Card.sol");
var Deck = artifacts.require("./Deck.sol");
var CardStack = artifacts.require("./CardStack.sol");

contract("CardStack", function(accounts) {

  let instance;
  let contract;

  // cards
  let parameters = [{params:[0, 0], points:2, str:"2♠" },
    {params:[7, 3], points:9, str:"9♦" },
    {params:[9, 1], points:0, str:"J♣" },
    {params:[12, 2], points:1, str:"A♥️" },
    {params:[12, 3], points:1, str:"A♦" },
    {params:[12, 1], points:1, str:"A♣" }];
  let cards = new Array(6);


  it("should be deployed with 0 cards", async () => {
    // deploy
    instance = await CardStack.new();
    contract = await tronWeb.contract().at(instance.address);

    // check
    let r = await contract.length().call({shouldPollResponse:true});
    assert.equal(r.toNumber(), 0, "CardStack is not empty!");
  });


  it("push "+cards.length+" cards", async () => {
    // Create cards
    for (var i = 0; i < cards.length; i++) {
      let instance = await Card.new(parameters[i]['params'][1],
        parameters[i]['params'][0]);
      //console.log(instance);
      cards[i] = await tronWeb.contract().at(instance.address);
    }

    // push cards to stack
    for (let i=0; i<cards.length; i++){
      //console.log(cards[i].address);
      await contract.push(cards[i].address).send({shouldPollResponse:true});
    }
  });


  it("pop "+cards.length+" cards (check order and result length)", async () => {
    for (let i = cards.length-1; i >= 0; i--) {
      let card_address = await contract.pop().send({shouldPollResponse:true});
      //console.log(card_address);
      assert.equal(card_address, cards[i].address, "Not expected card!");
    }

    let r = await contract.length().call({shouldPollResponse:true});
    assert.equal(r.toNumber(), 0, "CardStack is not empty!");
  });


  it("pop from empty stack must throw exception", async () => {
    // deploy
    instance = await CardStack.new();
    contract = await tronWeb.contract().at(instance.address);

    try {
      let card_address = await contract.pop().send({shouldPollResponse:true});
    } catch(error) {
      return;
    }

    assert.fail();
  });


});
