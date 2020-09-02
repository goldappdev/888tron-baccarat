const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);

let Card = artifacts.require("./Card.sol");
let Deck = artifacts.require("./Deck.sol");
let CardStack = artifacts.require("./CardStack.sol");

contract("Deck", function(accounts) {

  let instance;
  let contract;

	beforeEach(async () =>
  {
    instance = await Deck.deployed(false);
    contract = await tronWeb.contract().at(instance.address);
		//console.log(instance.address);
  });

  it("should be deployed", async () => {
  });


	it("should contain 416 cards (8 decks)", async () => {
		// create the right deck
		let suits  = ["♠", "♣", "♥️", "♦"];
		let values  = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
		// key - cark face, value - card count in Deck
		let cardCountMap = {};
		for (let i = 0; i < suits.length; i++) {
			for (let j = 0; j < values.length; j++) {
				let key = values[j]+suits[i];
				cardCountMap[key] = 0;
			}
		}

		// count all cards
		for (let i = 0; i < 416; i++) {
			let cardFace = await contract.getCardFace(i).call({shouldPollResponse:true});
			if (cardFace in cardCountMap){
				cardCountMap[cardFace]+= 1;
			}else {
				assert.fail("unknown card: " + cardFace);
			}
		}

		// check
		for (let i = 0; i < suits.length; i++) {
			for (let j = 0; j < values.length; j++) {
				let key = values[j]+suits[i];
				if (cardCountMap[key]!=8){
					assert.fail("wrong cards count " + cardCountMap[key] + " for key " + key);
				}
			}
		}
  });


	it("each card should have unique address", async () => {
		let cards_addresses = new Set();
		for (let i = 0; i < 416; i++) {
			let card_address = await contract.cards(i).call({shouldPollResponse:true});
			cards_addresses.add(card_address);
		}
		assert.equal(cards_addresses.size, 416);
	});


	it("drawCards should put 6 cards to stack and they have unique addresses", async () => {
		// deploy stack for test
		let stackInstance = await CardStack.new();
		let stackContract = await tronWeb.contract().at(stackInstance.address);

		// put cards to stack
		await contract.drawSixCardsToStack(stackInstance.address).send({shouldPollResponse:true});
		let cardStackCount = await stackContract.length().call({shouldPollResponse:true});
		let cardsAddresses = new Set();
		for (let i = 0; i < cardStackCount.toNumber(); i++) {
			let cardAddress = await stackContract.pop().send({shouldPollResponse:true});
			cardsAddresses.add(cardAddress);
		}
		// all
		assert.equal(cardsAddresses.size, cardStackCount.toNumber(), "some addresses is not unique");
		assert.isTrue(cardsAddresses.size>=6, "number of drawn cards < 6");
	});

	/*
		// https://github.com/tronprotocol/tron-web/issues/120
		// test for bug
	  let cardStackAddress;
	  it("create cardStack from Deck", async () => {
	    let deckInstance = await Deck.new(false);
	    //TODO: fill Deck with cards
	    contractDeck = await tronWeb.contract().at(deckInstance.address);
	    for (let k=0; k<8; k+=1){
	      await contractDeck.addFullDeck(1).send({shouldPollResponse:true});
	    }
	    cardStackAddress = await contractDeck.drawCards().send({shouldPollResponse:true});
	  });
	  it("test1", async () => {
	    // deploy
	    let instance = await CardStack.new();
	    console.log(instance.address);
	    let contract = await tronWeb.contract().at(instance.address);
	    // check
	    let r = await contract.length().call({shouldPollResponse:true});
	    assert.equal(r.toNumber(), 0, "CardStack is not empty!");
	  });
	  it("test2", async () => {
	    // deploy
	    let instance = await CardStack.new();
	    console.log(instance.address);
	    let contract = await tronWeb.contract(CardStack.abi, instance.address);
	    // check
	    let r = await contract.length().call({shouldPollResponse:true});
	    assert.equal(r.toNumber(), 0, "CardStack is not empty!");

	    // contract that deploy another contract
	    let deckInstance = await Deck.deployed(false);
	    let deckContract = await tronWeb.contract().at(deckInstance.address);
	    let waitSomeTime = await deckContract.drawCards().send({shouldPollResponse:true});
	  });
	  it("test3", async () => {
	    let contract = await tronWeb.contract().at(cardStackAddress);
	    // check
	    let r = await contract.length().call({shouldPollResponse:true});
	    assert.equal(r.toNumber(), 0, "CardStack is not empty!");
	  });
	  it("test4", async () => {
	    let contract = await tronWeb.contract(CardStack.abi, cardStackAddress);
	    // check
	    let r = await contract.length().call({shouldPollResponse:true});
	    assert.equal(r.toNumber(), 0, "CardStack is not empty!");
	  });
	*/

});
