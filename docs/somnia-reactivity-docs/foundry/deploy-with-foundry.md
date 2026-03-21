# Deploy with Foundry

Somnia empowers developers to build applications for mass adoption. Foundry is a tool for building Smart Contracts for mass adoption, making it easy for developers to create and deploy Smart Contracts to the Somnia Network.&#x20;

[Foundry](https://book.getfoundry.sh/) is a blazing fast, portable and modular toolkit for EVM application development written in Rust.

This guide will teach you how to deploy a “Voting” Smart Contract to the Somia Network using Foundry.

{% hint style="success" %}
Somnia Mainnet is LIVE. To deploy on Somnia Mainnet, you will need SOMI Tokens. Please refer to the [guide](https://docs.somnia.network/get-started/getting-started-for-mainnet) on Moving from Testnet to Mainnet.
{% endhint %}

## Pre-requisites:

1. This guide is not an introduction to Solidity Programming; you are expected to understand Basic Solidity Programming.
2. To complete this guide, you will need MetaMask installed and the Somnia Network added to the list of Networks. If you have yet to install MetaMask, please follow this guide to [Connect Your Wallet](https://docs.somnia.network/get-started/connect-your-wallet-to-mainnet).
3. Foundry is installed and set up on your local machine. See [Guide](https://getfoundry.sh/)

## Initialise Foundry Project

To start a new project with Foundry, run the command:

```
forge init BallotVoting
```

This creates a new directory `hello_foundry` from the default template. Open `BallotVoting` directory, and the open the `src` directory where you will find a default `Counter.sol` solidity file. Delete the `Counter.sol` file.

## Create the Smart Contract

Create a new file inside the `src` directory and name it `BallotVoting.sol` and paste the following code:

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BallotVoting {
    struct Ballot {
        string name; 
        string[] options; 
        mapping(uint256 => uint256) votes; 
        mapping(address => bool) hasVoted; 
        bool active; 
        uint256 totalVotes; 
    }

    uint256 public ballotCount; 
    mapping(uint256 => Ballot) public ballots; 

    event BallotCreated(uint256 indexed ballotId, string name, string[] options);
    event VoteCast(uint256 indexed ballotId, address indexed voter, uint256 optionIndex);
    event BallotClosed(uint256 indexed ballotId);

    function createBallot(string memory name, string[] memory options) public {
        require(options.length > 1, "Ballot must have at least two options");

        ballotCount++;
        Ballot storage ballot = ballots[ballotCount];
        ballot.name = name;
        ballot.options = options;
        ballot.active = true;

        emit BallotCreated(ballotCount, name, options);
    }

    function vote(uint256 ballotId, uint256 optionIndex) public {
        Ballot storage ballot = ballots[ballotId];
        require(ballot.active, "This ballot is closed");
        require(!ballot.hasVoted[msg.sender], "You have already voted");
        require(optionIndex < ballot.options.length, "Invalid option index");
        ballot.votes[optionIndex]++;
        ballot.hasVoted[msg.sender] = true;
         ballot.totalVotes++;
        emit VoteCast(ballotId, msg.sender, optionIndex);
    }

    function closeBallot(uint256 ballotId) public {
        Ballot storage ballot = ballots[ballotId];
        require(ballot.active, "Ballot is already closed");
        ballot.active = false;

        emit BallotClosed(ballotId);
    }

    function getBallotDetails(uint256 ballotId)
        public
        view
        returns (
            string memory name,
            string[] memory options,
            bool active,
             uint256 totalVotes
        )
    {
        Ballot storage ballot = ballots[ballotId];
        return (ballot.name, ballot.options, ballot.active, ballot.totalVotes);
    }

    function getBallotResults(uint256 ballotId) public view returns (uint256[] memory results) {
        Ballot storage ballot = ballots[ballotId];
        uint256[] memory voteCounts = new uint256[](ballot.options.length);
        for (uint256 i = 0; i < ballot.options.length; i++) {
            voteCounts[i] = ballot.votes[i];
        }

        return voteCounts;
    }
}
```

## Compile the Smart Contract

Compiling the Smart Contract will convert the Solidity code into machine-readable bytecode.&#x20;

To compile the Smart Contract, run the command:

```
forge build
```

It will return the response:

```
[⠊] Compiling...
[⠢] Compiling 27 files with Solc 0.8.28
[⠆] Solc 0.8.28 finished in 2.22s
Compiler run successful!
```

You can learn more about parsing arguments using flags by reading the [Foundry book](https://book.getfoundry.sh/reference/forge/forge-build).

## Deploy Contract.

Deploying Smart Contracts to the Somnia Network is very straightforward. All you need the RPC URL and the Private Key from[ ](#user-content-fn-1)[^1]an Ethereum address which contains some STT tokens to pay for Gas during deployment. You can get some STT Tokens from the Somnia [Faucet](https://devnet.somnia.network/). Follow this [guide](https://support.metamask.io/managing-my-wallet/secret-recovery-phrase-and-private-keys/how-to-export-an-accounts-private-key/) to get your Private Key on MetaMask. \
\
To deploy the Smart Contract, run this command in the terminal:

```
forge create --rpc-url 
https://dream-rpc.somnia.network
 --private-key PRIVATE_KEY src/BallotVoting.sol:BallotVoting
```

You will see a status response:

```
[⠊] Compiling...
No files changed, compilation skipped
Deployer: 0xb6e4fa6ff2873480590c68D9Aa991e5BB14Dbf03
Deployed to: 0x46639fB6Ce28FceC29993Fc0201Cd5B6fb1b7b16
Transaction hash: 0xb3f8fe0443acae4efdb6d642bbadbb66797ae1dcde2c864d5c00a56302fb9a34
```

Copy the Transaction hash and paste it into the Somnia Network [Explorer](https://somnia-devnet.socialscan.io/). You will find the deployed Smart Contract address.\
\
Congratulations. 🎉 You have deployed your “BallotVoting” Smart Contract to the Somnia Network using Foundry. 🎉<br>

> NOTE: Contract Verification on SomniaScan is COMING SOON!

[^1]: I would change this for "an"&#x20;
