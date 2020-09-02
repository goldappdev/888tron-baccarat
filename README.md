# Baccarat

This is a Tron realization of a card game in which players seek to score as many points as possible using two or three cards.


### Installation to develop

Baccarat project requires [tronbox](https://developers.tron.network/docs/tron-box-user-guide) to run.


#### To deploy contract on shasta or main node
Create a .env file containing something like
```cfg
export PRIVATE_KEY_MAINNET=your_mainnet_private_key
export PRIVATE_KEY_SHASTA=your_shasta_private_key
```
Then, run the migration with
```sh
 source .env && tronbox migrate --network mainnet
```


 #### To deploy contract on develop


Dependencies:

    * Docker - please refer to the Docker official website to download and install the latest Docker version.
    * Node.JS Console - this will be used to interact with the Full and Solidity Nodes via Tron-Web.

Clone TRON Quickstart
```sh
$ git clone https://github.com/tronprotocol/docker-tron-quickstart.git
```
Build TRON Quickstart
```sh
$ cd docker-tron-quickstart
$ docker build -t tron .
```
Run TRON Quickstart
```sh
$ docker run -it --rm -p 9090:9090 --name tron -e "defaultBalance=100000" -e "showQueryString=true" -e "showBody=true" -e "formatJson=true" tron
```
And now you can lunch tests or deploy contracts to develop node.
