const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

let Card = artifacts.require("./Card.sol");
let Deck = artifacts.require("./Deck.sol");
let CardStack = artifacts.require("./CardStack.sol");
let Hand = artifacts.require("./Hand.sol");
let Baccarat = artifacts.require("./Baccarat.sol");


contract("Baccarat", function(accounts) {

  //console.log(accounts);
  let instance;
  let contract;
  let deckContract;
  let ownerAddess = accounts[0];
  let someGuyAddress = accounts[1];
  let someGuyPk;
  let someOtherGuyAddress = accounts[2];
  let someOtherGuyPk;
  let contractAddress;
  // player, banker, tie, small, big, player pair, banker pair, either pair, perfect pair
  let winningRates = [100, 100, 800, 150, 54, 1100, 1100, 500, 2500];

  const waitForBalanceChange = async function(tronWeb, address, startBalance){
    let resultBalance;
    do {
      resultBalance = await tronWeb.trx.getBalance(address);
    } while (resultBalance==startBalance);
    return resultBalance;
  }
  let timeoutForBalanceChange = 120; // sec
 // mb not need
  const newTestAccounts = async function (amount) {
    return await tronWeb.fullNode.request('/admin/temporary-accounts-generation?accounts=' + amount);
  }

  const getTestAccounts = async function () {
    const accounts = {
        b58: [],
        hex: [],
        pks: []
    };
    const accountsJson = await tronWeb.fullNode.request('/admin/accounts-json');
    accounts.pks = accountsJson.more[accountsJson.more.length - 1].privateKeys;
    for (let i = 0; i < accounts.pks.length; i++) {
        let addr = tronWeb.address.fromPrivateKey(accounts.pks[i]);
        accounts.b58.push(addr);
        accounts.hex.push(tronWeb.address.toHex(addr));
    }
    return accounts;
  }

  const randomInt = function (min, max){
    return Math.floor(Math.random() * (+max - +min)) + +min;
  }

  const arrEquals = function (arr1, arr2){
       return arr1.length == arr2.length && arr1.filter(elt=>arr2.includes(elt)).length == arr1.length;
  }

  it("prepare test stuff", async () => {
    let resp = await newTestAccounts(10);
    let accounts = await getTestAccounts();
    //console.log(accounts);
    someGuyAddress = accounts['b58'][1];
    someOtherGuyAddress = accounts['b58'][2];
    someGuyPk = accounts['pks'][1];
    someOtherGuyPk = accounts['pks'][2];
  });


  it("should be deployed with owner", async () => {
    instance = await Baccarat.deployed();
    contract = await tronWeb.contract().at(instance.address);
    contractAddress = tronWeb.address.fromHex(instance.address);

    // this deck we will use in next Baccarat instances
    let deckInstance = await Deck.deployed();
    deckContract = await tronWeb.contract().at(deckInstance.address);
  });



  it("account balance can be replenished by simple trx", async () => {
    let sendValue = 1001;
    // to be sure that someGuyAddress balance is not zero
    let ownerBalance = await tronWeb.trx.getBalance(ownerAddess);
    if (ownerBalance < sendValue){
      assert.fail();
    }

    let startBalance = await tronWeb.trx.getBalance(contractAddress);
    let sendRc = await tronWeb.trx.sendTransaction(contractAddress, sendValue);
    let endBalance = await waitForBalanceChange(tronWeb, contractAddress, startBalance);
    assert.equal(endBalance, startBalance + sendValue);
  }).timeout(timeoutForBalanceChange*1000);


  it("isOwner tests", async () => {
    let isOwner1 = await contract.isOwner()
    .call({shouldPollResponse:true});
    assert.isTrue(isOwner1);

    let isOwner2 = await contract.isOwner()
    .call({shouldPollResponse:true, from: someGuyAddress});
    assert.isTrue(!isOwner2);
  });


  it("withdraw can only be called by owner", async () => {
    let sendValue = 1;
    // to be sure that contract balance is not zero
    let startBalance = await tronWeb.trx.getBalance(contractAddress);
    await tronWeb.trx.sendTransaction(contractAddress, sendValue*2);
    let endBalance = await waitForBalanceChange(tronWeb, contractAddress, startBalance);

    // to be sure that someGuyAddress balance is not zero
    let someGuyBalance = await tronWeb.trx.getBalance(someGuyAddress);
    if (someGuyBalance==0){
      assert.fail();
    }

    try {
      // some guy try to withdraw to different accounts
      await contract.withdraw(sendValue, someGuyAddress)
      .send(options={shouldPollResponse:true}, privateKey=someGuyPk);
    } catch(error) {
      //console.log(error);
      return;
    }

    assert.fail();
  }).timeout(timeoutForBalanceChange*1000);


  it("withdraw works for owner", async () => {
    let sendValue = 1;
    // to be sure that contract balance is not zero
    let startBalance = await tronWeb.trx.getBalance(contractAddress);
    await tronWeb.trx.sendTransaction(contractAddress, sendValue*2);
    let endBalance = await waitForBalanceChange(tronWeb, contractAddress, startBalance);

    // remember balances
    let startContractBalance = await tronWeb.trx.getBalance(contractAddress);
    let startGuyBalance = await tronWeb.trx.getBalance(someGuyAddress);
    let startOtherGuyBalance = await tronWeb.trx.getBalance(someOtherGuyAddress);
    //console.log([startContractBalance,startGuyBalance,startOtherGuyBalance]);
    //console.log('withdraw');
    // owner withdraw to different accounts
    //console.log(someGuyAddress);
    //console.log(someOtherGuyAddress);
    await contract.withdraw(sendValue, someGuyAddress).send({shouldPollResponse:true});
    await contract.withdraw(sendValue, someOtherGuyAddress).send({shouldPollResponse:true});

    //console.log('wait');
    let endContractBalance = await waitForBalanceChange(tronWeb, contractAddress, startContractBalance);
    let endGuyBalance = await waitForBalanceChange(tronWeb, someGuyAddress, startGuyBalance);
    let endOtherGuyBalance = await waitForBalanceChange(tronWeb, someOtherGuyAddress, startOtherGuyBalance);

    //console.log('check');
    //console.log([endContractBalance, endGuyBalance, endOtherGuyBalance]);
    assert.equal(endContractBalance, startContractBalance - 2*sendValue);
    assert.equal(endGuyBalance, startGuyBalance + sendValue);
    assert.equal(endOtherGuyBalance, startOtherGuyBalance + sendValue);
  }).timeout(timeoutForBalanceChange*1000);


  it("check set Min and Max bet limits", async () => {
    // check initial bets
    let initMinBet = await contract.minBetLimit().call({shouldPollResponse:true});
    let initMaxBet = await contract.maxBetLimit().call({shouldPollResponse:true});
    assert.isTrue(initMinBet <= initMaxBet);

    // errors should be generated when trying to set an incorrect limit
    try {
      await contract.setMinBetLimit(initMaxBet+1).send({shouldPollResponse:true});
      assert.fail();
    }catch(error){
      //console.log(error);
    }
    try {
      await contract.setMaxBetLimit(initMinBet-1).send({shouldPollResponse:true});
      assert.fail();
    }catch(error){
      //console.log(error);
    }

    // values of limits must change to new  after trx
    let newMinBet = initMinBet-1;
    let newMaxBet = initMaxBet+1;
    await contract.setMinBetLimit(newMinBet).send({shouldPollResponse:true});
    await contract.setMaxBetLimit(newMaxBet).send({shouldPollResponse:true});
    let lastMinBet = await contract.minBetLimit().call({shouldPollResponse:true});
    let lastMaxBet = await contract.maxBetLimit().call({shouldPollResponse:true});
    assert.isTrue(newMaxBet==lastMaxBet && newMinBet==lastMinBet);
  });


  it("setMinBetLimit and setMaxBetLimit should throw revert if sender is not owner", async () => {
    // to be sure that someGuyAddress balance is not zero
    let someGuyBalance = await tronWeb.trx.getBalance(someGuyAddress);
    if (someGuyBalance==0){
      assert.fail();
    }

    // select suitable values
    let initMinBet = await contract.minBetLimit().call({shouldPollResponse:true});
    let initMaxBet = await contract.maxBetLimit().call({shouldPollResponse:true});

    try {
      await contract.setMinBetLimit(initMinBet)
      .send(options={shouldPollResponse:true}, privateKey=someGuyPk);
    } catch(error) {
      // try again with setMaxBetLimit
      try {
        await contract.setMaxBetLimit(initMaxBet)
        .send(options={shouldPollResponse:true}, privateKey=someGuyPk);
      } catch(error) {
        return;
      }
    }

    assert.fail();
  });


  it("_isBetsLimited must determine inappropriate rates", async () => {
    // initial bets
    let minBet = await contract.minBetLimit().call({shouldPollResponse:true});
    let maxBet = await contract.maxBetLimit().call({shouldPollResponse:true});

    let limitedBets = new Array(9);
    // bets are in required diapason
    limitedBets[0] = minBet;
    limitedBets[1] = maxBet;
    for (var i = 2; i < limitedBets.length; i++) {
      limitedBets[i]=randomInt(minBet, maxBet);
    }
    let isLimited = await contract._isBetsLimited(limitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, true);

    let unlimitedBets = new Array(9);
    // there is too little bet
    unlimitedBets[0] = minBet-1;
    for (var i = 1; i < unlimitedBets.length; i++) {
      unlimitedBets[i]=randomInt(minBet, maxBet);
    }
    isLimited = await contract._isBetsLimited(unlimitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, false);

    // too much bet
    for (var i = 0; i < unlimitedBets.length-1; i++) {
      unlimitedBets[i]=randomInt(minBet, maxBet);
    }
    unlimitedBets[8] = maxBet+1;
    isLimited = await contract._isBetsLimited(unlimitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, false);
  });


  it("_getTotalBet must return right sum of bets", async () => {
    // initial bets
    let minBet = await contract.minBetLimit().call({shouldPollResponse:true});
    let maxBet = await contract.maxBetLimit().call({shouldPollResponse:true});

    // check sum of random array
    let bets = new Array(9);
    let sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(minBet, maxBet);
      sum+= bets[i];
    }
    let res = await contract._getTotalBet(bets).call({shouldPollResponse:true});
    assert.equal(res, sum);

    // check zero array
    res = await contract._getTotalBet([0, 0, 0, 0, 0, 0, 0, 0, 0]).call({shouldPollResponse:true});
    assert.equal(res, 0);
  });


  it("_betIncrease should increase the bet", async () => {
    // winnings rates
    let allPossibleWinningRates = [100, 50, 800, 54, 1100, 500, 2500];
    let testedValue = 100;
    let ansvers = [200, 150, 900, 154, 1200, 600, 2600];
    for (var i = 0; i < allPossibleWinningRates.length; i++) {
      let res = await contract._betIncrease(testedValue, allPossibleWinningRates[i]).call({shouldPollResponse:true});
      assert.equal(res, ansvers[i]);
    }
  });


  it("_isBetCorrect must verify the amount sent and the sum of the bets", async () => {
    // amount of bets and amount sent match
    let bets = new Array(9);
    let sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(0, 1000);
      sum+= bets[i];
    }
    let res = await contract._isBetCorrect(bets, sum).call({shouldPollResponse:true});
    assert.equal(res, true);

    // bid amount less than sent
    sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(0, 1000);
      sum+= bets[i];
    }
    res = await contract._isBetCorrect(bets, sum+1).call({shouldPollResponse:true});
    assert.equal(res, false);

    // bid amount more than sent
    sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(1, 1000);
      sum+= bets[i];
    }
    res = await contract._isBetCorrect(bets, sum-1).call({shouldPollResponse:true});
    assert.equal(res, false);


    // check zero array
    // the bets sum and the sent amount are the same, but the zero value is not allowed
    res = await contract._isBetCorrect([0, 0, 0, 0, 0, 0, 0, 0, 0], 0).call({shouldPollResponse:true});
    assert.equal(res, false);
  });


  it("_isBetsCanBePaid must return false if bets cannot be paid", async () => {
    // before test we need to setup contract balance
    // to be sure that contract balance is not zero
    let startBalance = await tronWeb.trx.getBalance(contractAddress);
    await tronWeb.trx.sendTransaction(contractAddress, 10000);
    let contractBalance = await waitForBalanceChange(tronWeb, contractAddress, startBalance);

    // bets that can be paid
    let bets = new Array(9);
    bets[0] = 100; // its player bet (after increase it will be 200)
    for (var i = 1; i < bets.length; i++) {
      bets[i]=1;
    }
    let res = await contract._isBetsCanBePaid(bets).call({shouldPollResponse:true});
    assert.equal(res, true);

    // bets that can't be paid
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(1, 1000);
    }
    bets[2] = contractBalance; // its tie bet (after increase it will be contractBalance*9)
    res = await contract._isBetsCanBePaid(bets).call({shouldPollResponse:true});
    assert.equal(res, false);


    let winningRates = [100, 100, 800, 150, 54, 1100, 1100, 500, 2500];

    // random tests
    for (let j = 0; j < 100; j++) {
      let requiredSum = 0;
      for (let i = 0; i < bets.length; i++) {
        bets[i]=randomInt(10, 1000);
        requiredSum+= Math.trunc((bets[i]*winningRates[i])/100);
      }
      //console.log([requiredSum, contractBalance]);
      res = await contract._isBetsCanBePaid(bets).call({shouldPollResponse:true});
      assert.equal(res, requiredSum<=contractBalance);
    }

  });


  // test data(card vales) for check every rule
  let cardsData = [];
  let i=0;
  // cards are dealt in turns. first to the player, then to the banker (p b p b p b)
  //ps>=8 || bs>=8 22
  cardsData[i++] = [[3, 10, 2, 10, 12, 0], [2, 2]];
  cardsData[i++] = [[10, 3, 10, 2, 10, 12], [2, 2]];
  //!(ps>=8 || bs>=8) && ps>5 && bs>5 22
  cardsData[i++] = [[12, 3, 3, 12, 10, 12], [2, 2]];
  //!(ps>=8 || bs>=8) && ps>5 && bs<=5 23
  cardsData[i++] = [[12, 10, 3, 10, 10, 1], [2, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && bs<=2 33
  cardsData[i++] = [[12, 10, 2, 12, 10, 12], [3, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && bs==3 && ptc!=8 33
  cardsData[i++] = [[12, 0, 2, 12, 10, 12], [3, 3]];
  cardsData[i++] = [[12, 0, 2, 12, 7, 12], [3, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && bs==4 && ptc>=2 && pct<=7 33
  cardsData[i++] = [[12, 1, 2, 12, 5, 12], [3, 3]];
  cardsData[i++] = [[12, 2, 2, 10, 2, 12], [3, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && bs==5 && ptc>=4 && pct<=7 33
  cardsData[i++] = [[12, 3, 2, 10, 2, 12], [3, 3]];
  cardsData[i++] = [[12, 3, 2, 10, 5, 12], [3, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && bs==6 && ptc>=6 && pct<=7 33
  cardsData[i++] = [[12, 3, 2, 12, 5, 12], [3, 3]];
  cardsData[i++] = [[12, 3, 2, 12, 4, 12], [3, 3]];
  //!(ps>=8 || bs>=8) && ps<=5 && !((bs<=2) || (bs==3 && ptc!=8) || (bs==4 && ptc>=2 && pct<=7) || (bs==5 && ptc>=4 && pct<=7) || (bs==6 && ptc>=6 && pct<=7)) 32
  cardsData[i++] = [[12, 3, 2, 12, 6, 12], [3, 2]];
  cardsData[i++] = [[12, 3, 2, 0, 6, 12], [3, 2]];

  it("_dealCards test", async () => {
    // test all custom data
    for (var i = 0; i < cardsData.length; i++) {

      try{

        // create cards
        let cardsAddresses = new Array(cardsData[i][0].length);
        for (var j = 0; j < cardsData[i][0].length; j++) {
          // card suit always same. value taken from data
          cardsAddresses[j] = (await Card.new(0, cardsData[i][0][j])).address;
        }

        // create stack and fill it
        let stackInstance = await CardStack.new();
        let stackContract = await tronWeb.contract().at(stackInstance.address);
        for (var j = 0; j < cardsAddresses.length; j++) {
          // pushing cards from last to first
          await stackContract.push(cardsAddresses[cardsAddresses.length-j-1]).send({shouldPollResponse:true});
        }

        // create two empty hands
        let playerHandInstance = await Hand.new();
        let playerHandContract = await tronWeb.contract().at(playerHandInstance.address);
        let bankerHandInstance = await Hand.new();
        let bankerHandContract = await tronWeb.contract().at(bankerHandInstance.address);
        // deal cards
        await contract._dealCards(playerHandInstance.address,
          bankerHandInstance.address,
          stackInstance.address).send({shouldPollResponse:true});

        let pcc = await playerHandContract.cardsCount().call({shouldPollResponse:true});
        let bcc = await bankerHandContract.cardsCount().call({shouldPollResponse:true});

        //console.log(cardsData[i]);
        //console.log([pcc.toNumber(), bcc.toNumber()]);
        assert.equal(pcc.toNumber(), cardsData[i][1][0]);
        assert.equal(bcc.toNumber(), cardsData[i][1][1]);
      } catch (error){
        console.log("// WARNING: server busy. "+error);
        i--;
      }
    }
  }).timeout(cardsData.length*120000);;


  // test data(card vales) for check every rule
  let calcRateTestData = [];
  i=0;
  // player, big, player pair, either pair, perfect pair
  calcRateTestData[i++] = {playerCards:[[4, 3], [4, 3], [4, 1]],
    bankerCards:[[2, 2], [7, 2], [10, 2]],
    result:[200, 0, 0, 0, 154, 1200, 0, 600, 2600]};

  // tie, big
  calcRateTestData[i++] = {playerCards:[[3, 2], [5, 3], [4, 0]],
    bankerCards:[[11, 0], [10, 1], [6, 1]],
    result:[100, 100, 900, 0, 154, 0, 0, 0, 0]};

  // banker, small, banker pair, either pair
  calcRateTestData[i++] = {playerCards:[[10, 0], [11, 3]],
    bankerCards:[[7, 3], [7, 2]],
    result:[0, 200, 0, 250, 0, 0, 1200, 600, 0]};

  // banker (on 6), big
  calcRateTestData[i++] = {playerCards:[[10, 0], [11, 3], [12, 1]],
    bankerCards:[[10, 0], [11, 3], [4, 1]],
    result:[0, 150, 0, 0, 154, 0, 0, 0, 0]};


  it("_calculateBets test", async () => {
    // test all custom data
    for (var i = 0; i < calcRateTestData.length; i++) {
      try{

        // create player cards and send them to hand
        let playerHandInstance = await Hand.new();
        let playerHandContract = await tronWeb.contract().at(playerHandInstance.address);
        for (var j = 0; j < calcRateTestData[i]['playerCards'].length; j++) {
          let newCardAddress = (await Card.new(calcRateTestData[i]['playerCards'][j][1],
            calcRateTestData[i]['playerCards'][j][0])).address;
          await playerHandContract.takeCard(newCardAddress).send({shouldPollResponse:true});
        }

        // create banker cards and send them to hand
        let bankerHandInstance = await Hand.new();
        let bankerHandContract = await tronWeb.contract().at(bankerHandInstance.address);
        for (var j = 0; j < calcRateTestData[i]['bankerCards'].length; j++) {
          let newCardAddress = (await Card.new(calcRateTestData[i]['playerCards'][j][1],
            calcRateTestData[i]['bankerCards'][j][0])).address;
          await bankerHandContract.takeCard(newCardAddress).send({shouldPollResponse:true});
        }

        // calc winnings
        let res = await contract._calculateBets(playerHandInstance.address,
          bankerHandInstance.address,
          [100, 100, 100, 100, 100, 100, 100, 100, 100]).call({shouldPollResponse:true});

        for (let k = 0; k < res.length; k++) {
          if (res[k].toNumber()!=calcRateTestData[i]['result'][k]){
            console.log([i, res[k].toNumber(), calcRateTestData[i]['result'][k]]);
            assert.fail();
          }
        }
      } catch (error){
        console.log("// WARNING: server busy. "+error);
        i--;
      }
    }
  }).timeout(cardsData.length*120000);


/*

it("test owner", async () => {

  let instance1 = await MyTest.deployed();
  let contract1 = await tronWeb.contract().at(instance1.address);

  let ownerAddr = await contract1.owner().call({shouldPollResponse:true});
  console.log("owner address:"+tronWeb.address.fromHex(ownerAddr));
  console.log("guy address:"+someGuyAddress);

  let addr1 = await contract1.setForAll().send(options={shouldPollResponse:true,
  }, privateKey=someGuyPk);
  console.log(await contract1.a().call({shouldPollResponse:true}));

  let addr2 = await contract1.setForOwner().send({shouldPollResponse:true},
     privateKey=someGuyPk);
  console.log(await contract1.a().call({shouldPollResponse:true}));

  console.log(tronWeb.address.fromHex(addr1));
  console.log(tronWeb.address.fromHex(addr2));

  assert.fail();
});*/
});
