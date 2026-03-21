# Network Overview (Mainnet / Testnet)

Somnia provides two distinct environments for developers and users: **Mainnet** and **Testnet (Shannon)**. Both serve different purposes in the ecosystem, and knowing when to use which is essential for building and deploying applications effectively.

***

### Somnia Mainnet

The **Mainnet** is the official production blockchain of Somnia. All transactions on this chain are **final and irreversible** and require **SOMI tokens** as gas.

#### Key Characteristics

* Real-value environment secured by Somnia’s validator set.
* Integrated with wallets, explorers, bridges, and infrastructure providers.
* Permanent and immutable transaction history.
* Designed for live dApps, end-users, and production-ready deployments.

#### When to Use Mainnet

* Deploying **audited and tested smart contracts**.
* Running dApps with **real users and assets**.
* Managing liquidity, staking, governance, or NFT projects.
* Partner integrations requiring **security and finality**.

#### Example

{% code title="Deploy to Somnia Mainnet" %}

```bash
# Deploying a contract to Somnia Mainnet
npx hardhat run scripts/deploy.js --network somnia_mainnet
```

{% endcode %}

***

### Somnia Testnet (Shannon)

The **Testnet** is a sandbox environment that mirrors mainnet behavior but uses **STT test tokens** with no real-world value. It allows safe experimentation and rapid iteration without financial risk.

#### Key Characteristics

* Transactions use **STT tokens**, available via the faucet.
* Close-to-mainnet parameters for realistic testing.
* Safe for prototyping, debugging, and QA.
* Commonly used in workshops, hackathons, and developer onboarding.

#### When to Use Testnet

* Learning how to connect and deploy on Somnia.
* Prototyping features or building MVPs.
* Debugging smart contracts or dApp flows.
* Preparing for audits and production deployment.

#### Example

{% code title="Deploy to Somnia Testnet (Shannon)" %}

```bash
# Deploying a contract to Somnia Testnet
npx hardhat run scripts/deploy.js --network somnia_testnet
```

{% endcode %}

***

### Quick Comparison

| Feature      | Mainnet (Production)           | Testnet (Shannon)           |
| ------------ | ------------------------------ | --------------------------- |
| Currency     | SOMI (real value)              | STT (valueless, faucet)     |
| Purpose      | Production deployments         | Development & testing       |
| Transactions | Permanent and irreversible     | Experimental and disposable |
| Typical Use  | Live dApps, DeFi, staking, NFT | Prototyping, QA, education  |
| Risk         | Financial impact possible      | No financial risk           |

***

### Best Practices

{% hint style="info" %}

* Start on Testnet: Validate contracts and flows on Shannon before mainnet.
* Audit before launch: Ensure contracts are reviewed and secure.
* Use separate configs: Keep `.env` files distinct for testnet and mainnet.
* Stay updated: Follow official announcements for upgrades and changes.
  {% endhint %}

{% hint style="success" %}
Tip: Treat **Testnet** as your safe playground and **Mainnet** as your production stage. Every project should pass through Testnet before moving to Mainnet.
{% endhint %}
