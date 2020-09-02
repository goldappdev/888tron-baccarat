const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

var Card = artifacts.require("./Card.sol");
var CardLibTest = artifacts.require("contract/test_contracts/CardLibTest.sol");

contract("CardLibStack", function(accounts) {

  let instance;
  let contract;


  // create cards
  let parameters = [{params:[0, 0], points:2, str:"2♠" },
    {params:[7, 3], points:9, str:"9♦" },
    {params:[9, 1], points:0, str:"J♣" },
    {params:[12, 2], points:1, str:"A♥️" }];
  let cards = new Array(4);

  beforeEach(async () =>
  {
    instance = await CardLibTest.deployed();
    contract = await tronWeb.contract().at(instance.address);
  });

  it("contract using CardLib should be deployed", async () => {
  });

  it("call all CardLib functions", async () => {
    await contract.testCallAllCardLibFunctions().send({shouldPollResponse:true});
  });

  it("check getPoints", async () => {

    // Create cards
    for (var i = 0; i < cards.length; i++) {
      let instance = await Card.new(parameters[i]['params'][1],
        parameters[i]['params'][0]);
      cards[i] = await tronWeb.contract().at(instance.address);
    }

    // Check points
    for (var i = 0; i < cards.length; i++) {
      let p = await contract.callGetPoints(cards[i].address).call({shouldPollResponse:true});
    	assert.equal(p, parameters[i]['points']);
    }
  });

  it("check callStr", async () => {
    // cards are created in previous step
    // Check
    for (var i = 0; i < cards.length; i++) {
      //console.log(cards[i]);
      //console.log(parameters[i]['str']);
      let s = await contract.callStr(cards[i].address).call({shouldPollResponse:true});
    	assert.equal(s, parameters[i]['str']);
    }
  });





});
