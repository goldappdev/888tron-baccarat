const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

let Baccarat = artifacts.require("BaccaratGame");
let Users = artifacts.require("Users");
let DividendsController = artifacts.require("EmptyDividendsController");
let GameManager = artifacts.require("GameManager");


contract("BaccaratGame", function(accounts) {

  //console.log(accounts);
  let instance;
  let contract;
  let gameManagerInstance;
  let gameManagerContract;
  let dividendsInstance;
  let dividendsContract;
  let usersInstance;
  let usersContract;

  let ownerAddess = accounts[0];
  let someGuyAddress = accounts[1];
  let someGuyPk;
  let someOtherGuyAddress = accounts[2];
  let someOtherGuyPk;

  let ownerId;
  let someGuyId;
  let someOtherGuyId;

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

  function numberToBytes32(...values) {
      const res = values.map(v => {
          const str = tronWeb.toHex(v).substr(2);
          const h = '0x0000000000000000000000000000000000000000000000000000000000000000';
          return h.substr(0, h.length - str.length) + str;
      });
      return res;
  }

  it("prepare test stuff (creating new accounts and add them to Users)", async () => {
    let resp = await newTestAccounts(3);
    let accounts = await getTestAccounts();
    //console.log(accounts);
    someGuyAddress = accounts['b58'][1];
    someOtherGuyAddress = accounts['b58'][2];
    someGuyPk = accounts['pks'][1];
    someOtherGuyPk = accounts['pks'][2];

    usersInstance = await Users.deployed();
    usersContract = await tronWeb.contract().at(usersInstance.address);

    dividendsInstance = await DividendsController.deployed();
    dividendsContract = await tronWeb.contract().at(dividendsInstance.address);

    ownerId = await usersContract.addUser(ownerAddess).send({shouldPollResponse:true});
    someGuyId = await usersContract.addUser(someGuyAddress).send({shouldPollResponse:true});
    someOtherGuyId = await usersContract.addUser(someOtherGuyAddress).send({shouldPollResponse:true});

    gameManagerInstance = await GameManager.deployed();
    gameManagerContract = await tronWeb.contract().at(gameManagerInstance.address);
  });


  it("should be deployed with owner", async () => {
    instance = await Baccarat.deployed();
    contract = await tronWeb.contract().at(instance.address);

    let owner = tronWeb.address.fromHex(await contract.owner().call({shouldPollResponse:true}));
    //console.log([owner, ownerAddess]);
    assert.isTrue(owner==ownerAddess);
  });

  it("check Min/Max setter/getter for wrong and good values", async () => {
    // check initial bets
    let initLimits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    //console.log(initLimits);

    assert.isTrue(initLimits['min'].toNumber() <= initLimits['max'].toNumber());

    // errors should be generated when trying to set an incorrect limit (higher than max uint64)
    try {
      //0x10000000000000000 = 2^64 = (max uint64)+1
      await contract.setMinMaxBet(0, '0x10000000000000000').send({shouldPollResponse:true});
      assert.fail();
    }catch(error){
      //console.log(error);
    }

    // should work
    await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
    initLimits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    console.log(initLimits);
    assert.isTrue(
      initLimits['min'].toNumber()==100 &&
      initLimits['max'].toNumber()==10000000
    );
  });

  /*

  it("isBetsLimited must determine inappropriate rates", async () => {
    // initial bets
    let initLimits = await contract.getMinMaxBet().call({shouldPollResponse:true});


    let limitedBets = new Array(9);
    // bets are in required diapason
    limitedBets[0] = initLimits['min'].toNumber();
    limitedBets[1] = initLimits['max'].toNumber();
    for (var i = 2; i < limitedBets.length; i++) {
      limitedBets[i]=randomInt(initLimits['min'].toNumber(), initLimits['max'].toNumber());
    }
    let isLimited = await contract.isBetsLimited(limitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, true);

    let unlimitedBets = new Array(9);
    // there is too little bet
    unlimitedBets[0] = initLimits['min'].toNumber()-1;
    for (var i = 1; i < unlimitedBets.length; i++) {
      unlimitedBets[i]=randomInt(initLimits['min'].toNumber(), initLimits['max'].toNumber());
    }
    isLimited = await contract.isBetsLimited(unlimitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, false);

    // too much bet
    for (var i = 0; i < unlimitedBets.length-1; i++) {
      unlimitedBets[i]=randomInt(initLimits['min'].toNumber(), initLimits['max'].toNumber());
    }
    unlimitedBets[8] = initLimits['max'].toNumber()+1;
    isLimited = await contract.isBetsLimited(unlimitedBets).call({shouldPollResponse:true});
    assert.equal(isLimited, false);
  });


  it("getTotalBet must return right sum of bets", async () => {
    // initial bets
    let initLimits = await contract.getMinMaxBet().call({shouldPollResponse:true});


    // check sum of random array
    let bets = new Array(9);
    let sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(initLimits['min'].toNumber(), initLimits['max'].toNumber());
      sum+= bets[i];
    }
    let res = await contract.getTotalBet(bets).call({shouldPollResponse:true});
    assert.equal(res, sum);

    // check zero array
    res = await contract.getTotalBet([0, 0, 0, 0, 0, 0, 0, 0, 0]).call({shouldPollResponse:true});
    assert.equal(res, 0);
  });


  it("betIncrease should returns increased bets", async () => {
    // winnings rates
    let testedValue = 100;
    let ansvers = [200, 200, 150, 900, 250, 154, 1200, 1200, 600, 2600];
    for (var i = 0; i < ansvers.length; i++) {
      let res = await contract.betIncrease(testedValue, i).call({shouldPollResponse:true});
      assert.equal(res, ansvers[i]);
    }

    let res = await contract.betIncrease(0, 3).call({shouldPollResponse:true});
    assert.equal(res, 0);
  });


  it("isBetCorrect must verify the amount sent and the sum of the bets", async () => {
    // amount of bets and amount sent match
    let bets = new Array(9);
    let sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(0, 1000);
      sum+= bets[i];
    }
    let res = await contract.isBetCorrect(bets, sum).call({shouldPollResponse:true});
    assert.equal(res, true);

    // bid amount less than sent
    sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(0, 1000);
      sum+= bets[i];
    }
    res = await contract.isBetCorrect(bets, sum+1).call({shouldPollResponse:true});
    assert.equal(res, false);

    // bid amount more than sent
    sum = 0;
    for (var i = 0; i < bets.length; i++) {
      bets[i]=randomInt(1, 1000);
      sum+= bets[i];
    }
    res = await contract.isBetCorrect(bets, sum-1).call({shouldPollResponse:true});
    assert.equal(res, false);


    // check zero array
    // the bets sum and the sent amount are the same, but the zero value is not allowed
    res = await contract.isBetCorrect([0, 0, 0, 0, 0, 0, 0, 0, 0], 0).call({shouldPollResponse:true});
    assert.equal(res, false);
  });


  it("getCardByIndex should convert card index to value/suit/deckNumber of card", async () => {
    // automated tests
    for (var deckNumber = 0; deckNumber < 8; deckNumber++) {
      for (var value = 0; value < 13; value++) {
        for (var suit = 0; suit < 4; suit++) {
          let cardInfo = await contract
          .getCardByIndex(deckNumber*52 + value*4 + suit)
          .call({shouldPollResponse:true});

          //console.log(cardInfo);
          assert.equal(cardInfo['value'], value);
          assert.equal(cardInfo['suit'], suit);
          assert.equal(cardInfo['deckNumber'], deckNumber);
        }
      }
    }
    // just to be sure check some card manually
    let cardInfo = await contract.getCardByIndex(415).call({shouldPollResponse:true});
    assert.equal(cardInfo['value'], 12);
    assert.equal(cardInfo['suit'], 3);
    assert.equal(cardInfo['deckNumber'], 7);
  });


  it("getCardPointsByIndex return card points by index", async () => {
    // automated tests
    let cardsPoints = [2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 1];
    for (var deckNumber = 0; deckNumber < 8; deckNumber++) {
      for (var value = 0; value < 13; value++) {
        for (var suit = 0; suit < 4; suit++) {
          let cardPoints = await contract
          .getCardPointsByIndex(deckNumber*52 + value*4 + suit)
          .call({shouldPollResponse:true});

          //console.log([cardPoints, cardsPoints[value]]);
          assert.equal(cardPoints, cardsPoints[value]);
        }
      }
    }
    // just to be sure check some card manually
    let cardPoints = await contract.getCardPointsByIndex(415).call({shouldPollResponse:true});
    assert.equal(cardPoints, 1);
    cardPoints = await contract.getCardPointsByIndex(52).call({shouldPollResponse:true});
    assert.equal(cardPoints, 2);

  });


  it("call createBet using the manager shuld work", async () => {
    let limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    //console.log(limits);

    let min = limits['min'].toNumber();

    let bets = [
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0],
      numberToBytes32(min)[0]
    ];

    //console.log(bets);

    // owner!=sender, shuld raise revert
    try{
      await contract.createBet(
        ownerAddess,
        ownerAddess,
        parseInt((min*9)*1000000),
        0,
        bets
      ).send({shouldPollResponse:true});
      assert.fail();
    } catch (error) {
      // its ok
      console.log(error);
    }

    // shuld be ok
    await gameManagerContract.createBet(
      instance.address,
      ownerAddess,
      0,
      bets
    ).send({shouldPollResponse:true, callValue:(min*9)*1000000});

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

  it("tests of all variants of card distributions and their sequence (dealCards test)", async () => {
    // test all custom data
    for (var i = 0; i < cardsData.length; i++) {
      // create cards indexes
      let cardsIndexes = new Array(cardsData[i][0].length);
      for (var j = 0; j < cardsData[i][0].length; j++) {
        // card suit and deck number always same. value taken from data
        cardsIndexes[cardsData[i][0].length-j-1] = cardsData[i][0][j]*4;
      }

      // deal cards
      let hands = await contract.dealCards(cardsIndexes).call({shouldPollResponse:true});


      //console.log([hands, cardsIndexes, cardsData[i][1]]);
      assert.equal(hands['userHand'][4], cardsData[i][1][0]);
      assert.equal(hands['bankerHand'][4], cardsData[i][1][1]);

      // check cards positions
      if (hands['userHand'][4]==3){
        assert.equal(hands['userHand'][2], cardsIndexes[1]);
      }
      if (hands['bankerHand'][4]==3){
        if (hands['userHand'][4]==2){
          assert.equal(hands['bankerHand'][2], cardsIndexes[1]);
        } else {
          assert.equal(hands['bankerHand'][2], cardsIndexes[0]);
        }
      }
    }
  });

  // test data(card vales) for check every rule
  let calcRateTestData = [];
  i=0;
  // results calculated for bet= [100, 100, 100, . . .]
  // player, big, player pair, either pair, perfect pair
  calcRateTestData[i++] = {playerCards:[[4, 3, 0], [4, 3, 1], [4, 1, 0]],
    bankerCards:[[2, 2, 0], [7, 2, 0], [10, 2, 0]],
    result:[200, 0, 0, 0, 154, 1200, 0, 600, 2600]};

  // tie, big
  calcRateTestData[i++] = {playerCards:[[3, 2, 0], [5, 3, 0], [4, 0, 0]],
    bankerCards:[[11, 0, 0], [10, 1, 0], [6, 1, 0]],
    result:[100, 100, 900, 0, 154, 0, 0, 0, 0]};

  // banker, small, banker pair, either pair
  calcRateTestData[i++] = {playerCards:[[10, 0, 0], [11, 3, 0]],
    bankerCards:[[7, 3, 0], [7, 2, 0]],
    result:[0, 200, 0, 250, 0, 0, 1200, 600, 0]};

  // banker (on 6), big
  calcRateTestData[i++] = {playerCards:[[10, 0, 0], [11, 3, 0], [12, 1, 0]],
    bankerCards:[[10, 0, 0], [11, 3, 1], [4, 1, 0]],
    result:[0, 150, 0, 0, 154, 0, 0, 0, 0]};

  it("calculateBets test on custom data", async () => {
    let limits = await contract.getMinMaxBet().call({shouldPollResponse:true});

    if (limits['min'].toNumber()>100){
      await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
    }

    // create bet
    let bytesMinBet = numberToBytes32(100)[0];
    let bets = [
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet
    ];

    // test all custom data
    for (var i = 0; i < calcRateTestData.length; i++) {
      // create player cards and send them to hand
      let userHand = new Array(5).fill(0);
      userHand[4] = calcRateTestData[i]['playerCards'].length;
      for (var j = 0; j < calcRateTestData[i]['playerCards'].length; j++) {
        userHand[j] = calcRateTestData[i]['playerCards'][j][0]*4+calcRateTestData[i]['playerCards'][j][1]+calcRateTestData[i]['playerCards'][j][2]*52;
        userHand[3]+= await contract
        .getCardPointsByIndex(userHand[j])
        .call({shouldPollResponse:true});
      }
      userHand[3] %= 10;

      let bankerHand = new Array(5).fill(0);
      bankerHand[4] = calcRateTestData[i]['bankerCards'].length;
      for (var j = 0; j < calcRateTestData[i]['bankerCards'].length; j++) {
        bankerHand[j] = calcRateTestData[i]['bankerCards'][j][0]*4 +
        calcRateTestData[i]['bankerCards'][j][1] +
        calcRateTestData[i]['bankerCards'][j][2]*52;

        bankerHand[3]+= await contract
        .getCardPointsByIndex(bankerHand[j])
        .call({shouldPollResponse:true});
      }
      bankerHand[3] %= 10;

      //console.log([userHand, bankerHand]);
      // calc winnings
      let res = await contract.calculateBets(userHand, bankerHand, bets).call({shouldPollResponse:true});;
      //res = res['receivedBets'];
      //console.log(res);
      for (let k = 0; k < res.length; k++) {
        if (res[k].toNumber()!=calcRateTestData[i]['result'][k]){
          console.log([i, res[k].toNumber(), calcRateTestData[i]['result'][k]]);
          assert.fail();
        }
      }
    }
  });

  it("getBetValuesByIndex test", async () => {
    await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
    limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    // create bet
    let minBet = limits['min'].toNumber();
    let initBets = [
      minBet,
      minBet+1,
      minBet+2,
      minBet+3,
      minBet+4,
      minBet+5,
      minBet+6,
      minBet+7,
      minBet+8,
    ];

    let betsForSend = new Array(9);
    let betValuesSum = 0;
    for (var i = 0; i < betsForSend.length; i++) {
      betsForSend[i] = numberToBytes32(initBets[i])[0];
      betValuesSum += initBets[i];
    }
    let bb = await tronWeb.trx.getBalance(ownerAddess);
    console.log(["createBet: ", betValuesSum*1000000, bb, initBets]);
    await gameManagerContract.createBet(
      instance.address,
      ownerAddess,
      0,
      betsForSend
    ).send({shouldPollResponse:true, callValue: betValuesSum*1000000});

    let betCount = await contract.getBetCount().call({shouldPollResponse:true});
    //console.log("betCount: "+betCount);

    let requiredBetIndex = (betCount-1)*2+1;
    //console.log("requiredBetIndex: "+requiredBetIndex);

    console.log("betsFromContract: "+betCount);
    let betsFromContract = await contract.getBetValuesByIndex(requiredBetIndex).call({shouldPollResponse:true});
    console.log("betsFromContract: "+betsFromContract);

    //console.log([initBets, betsForSend, betsFromContract, requiredBetIndex]);
    for (let k = 0; k < betsFromContract.length; k++) {
      if (betsFromContract[k]!=initBets[k]){
        assert.fail();
      }
    }
  });

  it("closeBet automated test", async () => {

    // deploy and setup new contract
    // deploy and setup new contract
    instance = await Baccarat.new();
    contract = await tronWeb.contract().at(instance.address);

    await gameManagerContract.addGame(instance.address).send({shouldPollResponse:true});
    await contract.setManager(gameManagerInstance.address).send({shouldPollResponse:true});
    await contract.setUsers(usersInstance.address).send({shouldPollResponse:true});
    await contract.setDividends(dividendsInstance.address).send({shouldPollResponse:true});


    // default bet
    let limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    if (limits['min'].toNumber()>100){
      await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
      limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    }
    let bytesMinBet = numberToBytes32(100)[0]; // 1trx
    let bets = [
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet
    ];

    //console.log('start');

    for (var i = 0; i < 15; i++) {
      // create bet from some guy
      let sgbb = await tronWeb.trx.getBalance(someGuyAddress);
      let gmb = await tronWeb.trx.getBalance(gameManagerInstance.address);
      let betsCount = (await contract.getBetCount().call({shouldPollResponse:true}));

      await gameManagerContract.createBet(
        instance.address,
        ownerAddess,
        0,
        bets
      ).send(options={shouldPollResponse:true, callValue:(100*9)*1000000}, privateKey=someGuyPk);
      //console.log(['gmb:', gmb]);

      betsCount = await contract.getBetCount().call({shouldPollResponse:true});
      sgbb =  await waitForBalanceChange(tronWeb, someGuyAddress, sgbb);

      // closeBet from owner
      await contract.closeBets(1).send({shouldPollResponse:true, callValue:100*9});
      let sgba =  await waitForBalanceChange(tronWeb, someGuyAddress, sgbb);
      //console.log(['closeBet', sgba]);

      //check cards
      let cards = await contract.getCardsByIndex((betsCount.toNumber()-1)*2+1).call({shouldPollResponse:true});
      //console.log(['closeBet', cards]);
      // deal cards
      let hands = await contract.dealCards(cards).call({shouldPollResponse:true});
      //console.log(['hands', hands]);
      //console.log(['userHand', hands['userHand'][0]%52, hands['userHand'][1]%52]);
      //console.log(['bankerHand', hands['bankerHand'][0]%52, hands['bankerHand'][1]%52]);
      // calc winning
      let receivedBets = await contract.calculateBets(
        hands['userHand'],
        hands['bankerHand'],
        bets
      ).call({shouldPollResponse:true});
      receivedBets = receivedBets['receivedBets'];
      //console.log(['receivedBets', receivedBets]);

      let receivedAmount = 0;
      for (let k = 0; k < receivedBets.length; k++) {
        receivedAmount+= receivedBets[k];
      }
      // check sender balance change
      if (receivedAmount*1000000!=sgba-sgbb){
        console.log([receivedAmount, sgba, sgbb]);
        assert.fail();
      }
    }
  }).timeout(600000);;


  it("getNeedCloseBets test", async () => {
    let res;

    // deploy and setup new contract
    instance = await Baccarat.new();
    contract = await tronWeb.contract().at(instance.address);

    await gameManagerContract.addGame(instance.address).send({shouldPollResponse:true});

    await contract.setManager(gameManagerInstance.address).send({shouldPollResponse:true});
    let usersInstance = await Users.deployed();
    await contract.setUsers(usersInstance.address).send({shouldPollResponse:true});
    let dcInstance = await DividendsController.deployed();
    await contract.setDividends(dcInstance.address).send({shouldPollResponse:true});

    // tets isNotNeed
    res = await contract.getNeedCloseBets().call({shouldPollResponse:true});
    //console.log(res);

    // create bet
    let limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    if (limits['min'].toNumber()>100){
      await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
    }
    let bytesMinBet = numberToBytes32(100)[0];
    let bets = [
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet,
      bytesMinBet
    ];
    await gameManagerContract.createBet(
      instance.address,
      ownerAddess,
      0,
      bets
    ).send({shouldPollResponse:true, callValue:(100*9)*1000000});

    // test isNeed
    res = await contract.getNeedCloseBets().call({shouldPollResponse:true});
    //console.log(res);

    await contract.closeBets(1).send({shouldPollResponse:true});

    // tets isNotNeed
    res = await contract.getNeedCloseBets().call({shouldPollResponse:true});
    //console.log(res);

  });



  it("getCardsByIndex test", async () => {
    let limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    if (limits['max'].toNumber()-limits['min'].toNumber()<10){
      await contract.setMinMaxBet(100, 10000000).send({shouldPollResponse:true});
      limits = await contract.getMinMaxBet().call({shouldPollResponse:true});
    }
    // create bet
    let initBets = [
      limits['min'].toNumber(),
      limits['min'].toNumber()+1,
      limits['min'].toNumber()+2,
      limits['min'].toNumber()+3,
      limits['min'].toNumber()+4,
      limits['min'].toNumber()+5,
      limits['min'].toNumber()+6,
      limits['min'].toNumber()+7,
      limits['min'].toNumber()+8,
    ];

    let betsForSend = new Array(9);
    let sendAmount = 0;
    for (var i = 0; i < betsForSend.length; i++) {
      betsForSend[i] = numberToBytes32(initBets[i])[0];
      sendAmount += initBets[i];
    }
    console.log([initBets, betsForSend]);

    await gameManagerContract.createBet(
      instance.address,
      ownerAddess,
      0,
      betsForSend
    ).send({shouldPollResponse:true, callValue: sendAmount});
    let requiredBetIndex = (await contract.getBetCount().call({shouldPollResponse:true}))-1;
    let betsFromContract = await contract.getBetValuesByIndex(requiredBetIndex).call({shouldPollResponse:true});
    console.log([initBets, betsForSend, betsFromContract, requiredBetIndex]);
    //console.log(res);
    for (let k = 0; k < betsFromContract.length; k++) {
      if (betsFromContract[k].toNumber()!=initBets[k]){
        assert.fail();
      }
    }

  });


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
