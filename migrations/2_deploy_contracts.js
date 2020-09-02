const settings = require('../tronbox.js');
const currentNetwork = process.env.NETWORK;;
const BigNumber = require('big-number');
const TronWeb = require('tronweb');
const tronWeb = new TronWeb(settings['networks'][currentNetwork]);


//var GameManager = artifacts.require("GameManager");
var Users = artifacts.require("Users");
var GameManager = artifacts.require("GameManager");
var DividendsController = artifacts.require("EmptyDividendsController");
var BaccaratGame = artifacts.require("BaccaratGame");

console.log(tronWeb.address.fromHex("41099e0672fa1b071f993b4bea9bdbb393eb193a69"));
//https://ethereum.stackexchange.com/questions/39372/you-must-deploy-and-link-the-following-libraries-before-you-can-deploy-a-new-ver
async function doDeploy(deployer, network) {
  await deployer.deploy(Users);
  await deployer.deploy(GameManager);
  await deployer.deploy(DividendsController);
  await deployer.deploy(BaccaratGame);
  var manager = await tronWeb.contract().at(GameManager.address);
  console.log(BaccaratGame.address);
  await manager.addGame(BaccaratGame.address).send({shouldPollResponse:true});

  var baccarat = await tronWeb.contract().at(BaccaratGame.address);
  console.log(await baccarat.owner().call({shouldPollResponse:true}));

  await baccarat.setUsers(Users.address).send({shouldPollResponse:true});
  await baccarat.setManager(GameManager.address).send({shouldPollResponse:true});
  await baccarat.setDividends(DividendsController.address).send({shouldPollResponse:true});
}

module.exports = (deployer, network) => {
    deployer.then(async () => {
        await doDeploy(deployer, network);
    });
};
