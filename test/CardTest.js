const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

var Card = artifacts.require("./Card.sol");

contract("Card", function(accounts) {

  let instance;
  let contract;

  beforeEach(async () =>
  {
    instance = await Card.new(0, 1);
    contract = await tronWeb.contract().at(instance.address);
  });

  it("should deploy and return initial params", async () => {
    let a = await contract.suitNumber().call({shouldPollResponse:true});
    assert.equal(a, 0);
    let b = await contract.valueNumber().call({shouldPollResponse:true});
    assert.equal(b, 1);
  });

});
