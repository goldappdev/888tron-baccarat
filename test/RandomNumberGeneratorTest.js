const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;

var RandomNumberGenerator = artifacts.require("./RandomNumberGenerator.sol");
var RandomNumberGeneratorTest = artifacts.require("test_contracts/RandomNumberGeneratorTest.sol");

const BigNumber = require('big-number');
const TronWeb = require('tronweb');

const tronWeb = new TronWeb(settings['networks'][currentNetwork]);


contract("RandomNumberGenerator", function(accounts) {

  let instance;
  let contract;

  beforeEach(async () =>
  {
    instance = await RandomNumberGenerator.deployed();
    contract = await tronWeb.contract().at(instance.address);
  });

  it("should deploy", async () => {
  });


  it("RNG(0) should return 0", async () => {
    let r = await contract.RNG(0).send({from:accounts[0],
      shouldPollResponse:true});
    assert.equal(r.toNumber(),0, r.toString()+" != 0");
  });

  it("call RNG two times in same block should return non equal numbers", async () => {
    let testInstance = await RandomNumberGeneratorTest.deployed();
    let testContract = await tronWeb.contract().at(testInstance.address);
    let r = await testContract.test2RNGinSameBlock().send({from:accounts[0],
      shouldPollResponse:true});
    assert.isTrue(r['result']);
  });

  var testsCount = 100;
  var testsCountTimeout = testsCount*15000;// 15 sec to one trx
  it("distribution should be uniform", async () => {
    console.log("Max wait time " + testsCountTimeout + " ms");

    var cardsIndexes = new Array(5).fill(0);
    for (var i = 0; i < testsCount; i++) {
      try {
        let index = await contract.RNG(4).send({from:accounts[0],
          shouldPollResponse:true});
        console.log(testsCount-i);
        cardsIndexes[index.toNumber()]+= 1;
      } catch (err) {
        i--;
        //console.log("wait "+err);
      }
    }
    // show result array
    let s = "";
    for (var i = 0; i < cardsIndexes.length; i++) {
        s = s + cardsIndexes[i] + "_";
    }
    console.log(s);
    // check in a fixed range of probability values
    var minP = (testsCount/cardsIndexes.length)*0.2;
    var maxP = (testsCount/cardsIndexes.length)*5;
    for (var i = 0; i < cardsIndexes.length; i++) {
        assert.isTrue(cardsIndexes[i]>=minP && cardsIndexes[i]<=maxP);
    }
  }).timeout(testsCountTimeout);


});
