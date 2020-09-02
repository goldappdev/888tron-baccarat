const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

let Card = artifacts.require("./Card.sol");
let Deck = artifacts.require("./Deck.sol");
let CardStack = artifacts.require("./CardStack.sol");
let Hand = artifacts.require("./Hand.sol");

contract("Hand", function(accounts) {

  let instance;
  let contract;

  // test data
  let handsParams = [{cardsParams:[[0, 0], [0, 1]], points:4, isPair:true, isPerfectPair:false },
    {cardsParams:[[0, 0], [0, 1], [0, 0]], points:6, isPair:true, isPerfectPair:false },
    {cardsParams:[[7, 0], [7, 0]], points:8, isPair:true, isPerfectPair:true },
    {cardsParams:[[7, 0], [7, 0], [8, 3]], points:8, isPair:true, isPerfectPair:true },
    {cardsParams:[[12, 0], [11, 1]], points:1, isPair:false, isPerfectPair:false },
    {cardsParams:[[12, 0], [11, 1], [12, 0]], points:2, isPair:false, isPerfectPair:false },
  ];
  let cards = new Array(6);

	beforeEach(async () =>
  {
    instance = await Hand.new();
    contract = await tronWeb.contract().at(instance.address);
  });

  it("should deploy and be empty", async () => {
    let cardsCount = await contract.cardsCount().call({shouldPollResponse:true});
    assert.equal(cardsCount, 0);

    let totalPoints = await contract.getTotalPoints().call({shouldPollResponse:true});
    assert.equal(totalPoints, 0);
  });


  it("should be able to take 3 cards + cardsCount test", async () => {
    // create card(2♠) and send it to hand
    for (let i = 0; i < 3; i++) {
      let cardInstance = await Card.new(0, i);
      await contract.takeCard(cardInstance.address).send({shouldPollResponse:true});

      let cardsCount = await contract.cardsCount().call({shouldPollResponse:true});
      assert.equal(cardsCount, i+1);
    }
  });

  for (let i = 0; i < handsParams.length; i++) {
    it("check "+i+" cards from handsParams", async () => {
      // create cards and send it to hand
      for (let j = 0; j < handsParams[i]['cardsParams'].length; j++) {
        let cardInstance = await Card.new(handsParams[i]['cardsParams'][j][1],
      handsParams[i]['cardsParams'][j][0]);
        console.log();
        await contract.takeCard(cardInstance.address).send({shouldPollResponse:true});
      }

      // check
      let isPerfectPair = await contract.isPerfectPair().call({shouldPollResponse:true});
      assert.equal(isPerfectPair, handsParams[i]['isPerfectPair']);

      let isPair = await contract.isPair().call({shouldPollResponse:true});
      assert.equal(isPair, handsParams[i]['isPair']);

      let totalPoints = await contract.getTotalPoints().call({shouldPollResponse:true});
      assert.equal(totalPoints, handsParams[i]['points']);
    });
  }

});
