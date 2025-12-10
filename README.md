# Jolly App

## Overview

**Jolly App** is a decentralized social media platform built on the Stacks blockchain. It empowers users to own their data and content through blockchain technology, featuring tokenized posts as NFTs (using SIP-009 standard), direct crypto tips for creators with platform fees, and secure ownership transfers. This combats centralized censorship, fosters a creator economy, and enables users to earn from fan interactions without intermediaries.

Inspired by evolving Web3 creator tools, Jolly App promotes transparency and user sovereignty. Potential monetization includes platform fees on tips (2-5%), NFT royalties (extendable), and premium features. The core is implemented in Clarity smart contracts, ensuring security and immutability.

Key goals:

- Enable users to mint posts as NFTs for true ownership.
- Facilitate direct STX tips to creators with automated fee collection.
- Provide a foundation for decentralized social interactions, extensible to full DApps.

This repository contains the smart contract, tests, deployment scripts, and documentation for the Jolly App project.

## Features

- **Tokenized Posts as NFTs (SIP-009 Compliant)**: Users mint posts as unique NFTs with content (up to 280 characters), metadata, and ownership. Supports transfers, balance queries, and URI retrieval.
- **Direct Crypto Tips**: Send STX tips to post creators, with a configurable platform fee (default 2%) collected automatically.
- **Ownership and Transfers**: Users can transfer post NFTs to others, maintaining control over their content.
- **Platform Fee Management**: Accumulated fees viewable and withdrawable by the contract owner.
- **Access Controls**: Owner-only functions for fee withdrawal; error handling for unauthorized actions.
- **Testing Suite**: Comprehensive unit tests in TypeScript (using Vitest) covering minting, tipping, transfers, and edge cases.
- **Deployment Ready**: Scripts and plans for Devnet, Testnet, and Mainnet using Clarinet.
- **Extensibility**: Designed for future additions like off-chain storage (e.g., IPFS for longer content), NFT royalties, or frontend integrations.

## Project Structure

```
jolly-app/
├── Clarinet.toml               # Project configuration
├── contracts/
│   └── jolly-app.clar          # Main smart contract for posts, NFTs, and tips
├── tests/
│   └── jolly-app.test.ts       # Unit tests for contract functions
├── deployments/
│   ├── default.devnet-plan.yaml   # Devnet deployment plan (note: YAML format)
│   ├── default.testnet-plan.yaml  # Testnet deployment plan
│   └── default.mainnet-plan.yaml  # Mainnet deployment plan
├── deploy.sh                   # Script for generating and applying deployments
├── vitest.config.js            # Vitest configuration for tests
├── package.json                # Node.js dependencies (e.g., @hirosystems/clarinet-sdk)
├── settings/                   # Clarinet settings (Devnet.toml, Testnet.toml, Mainnet.toml)
└── README.md                   # This file
```

### Contract Architecture

```
+-------------------+
|                   |
|   Jolly App       |
|   (Main Contract) |
|                   |
+-------------------+
          ^
          |
   SIP-009 NFT Trait
          |
   Core Functions:
   - Mint Post (NFT)
   - Tip Post (with Fee)
   - Transfer Post
   - Read-Only Queries
   - Fee Withdrawal (Private)
```

- **jolly-app.clar**: Implements SIP-009 for NFTs, tipping logic, and fee management. Key functions: `mint-post`, `tip-post`, `transfer-post`, `withdraw-fees`.

## Prerequisites

- [Clarinet](https://docs.stacks.co/reference/clarinet/cli-reference) (Stacks CLI tool) installed via Cargo: `cargo install --git https://github.com/hirosystems/clarinet.git --locked clarinet`.
- Node.js and npm (for running tests with Vitest and Clarinet JS SDK).
- A Stacks wallet (e.g., Hiro Wallet) for Testnet/Mainnet interactions.
- Basic knowledge of Clarity, Stacks blockchain, and SIP-009 NFT standard.

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/your-username/jolly-app.git
   cd jolly-app
   ```

2. Install Node.js dependencies:

   ```
   npm install
   ```

3. Verify project integrity (syntax and type checking):
   ```
   clarinet check
   ```

## Usage

### Local Development

1. Start the Clarinet console for interactive testing:

   ```
   clarinet console
   ```

   Example interactions (in console):

   - Mint a post: `(contract-call? .jolly-app mint-post u"Hello World!" none)`
   - Tip a post: `(contract-call? .jolly-app tip-post u1 u1000000)` (tips 1 STX to post ID 1)
   - Get post details: `(contract-call? .jolly-app get-post u1)`
   - Transfer post: `(contract-call? .jolly-app transfer-post u1 'ST1PQHQKV0RJXZHJ1DG7EY8M17W11ZZ1EDWXG5)`
   - View tips: `(contract-call? .jolly-app get-post-tips u1)`

2. Simulate scenarios, like tipping and fee accumulation.

### Testing

Run all unit tests using Vitest:

```
npm run test
```

Or directly:

```
npx vitest
```

Tests cover:

- Minting posts with validation (e.g., content length, unauthorized mints).
- Tipping with fee deduction and updates.
- NFT transfers and ownership queries.
- Fee withdrawal (owner-only) and edge cases (e.g., insufficient fees).
- Expect 100% coverage; all tests should pass.

If tests fail, check Clarity syntax or update dependencies.

## Deployment

### Local Devnet

1. Start Devnet for local testing:

   ```
   clarinet devnet start
   ```

2. Deploy contracts via the console or deployment plans.

### Testnet/Mainnet

1. Update `settings/Testnet.toml` or `settings/Mainnet.toml` with your wallet details (e.g., private keys for deployment).

2. Generate a deployment plan:

   ```
   clarinet deployments generate --testnet
   ```

   This creates `deployments/default.testnet-plan.yaml`.

3. Apply the deployment:

   ```
   clarinet deployments apply --testnet
   ```

   For Mainnet: Use `--mainnet` flag.

4. Use the `deploy.sh` script for automation (modify as needed for network).

**Note**: Validate deployment files first with `clarinet deployments check`. For production, conduct a professional audit (e.g., via Certik). Deploy to Testnet first.

## Security Considerations

- **Access Controls**: Only the contract owner can withdraw fees; asserts prevent unauthorized actions.
- **Error Handling**: Custom errors for invalid operations (e.g., post not found, insufficient balance).
- **Best Practices**: Uses `try!` for safe STX transfers, `unwrap!` with errors, and defaults for maps. No unsafe code; follows SIP-009 standards.
- **Recommendations**:
  - Audit contracts before Mainnet deployment.
  - Use hardware wallets for deployment keys.
  - Monitor for reentrancy risks in tipping/transfer flows.
  - For real-world use, integrate secure oracles if expanding to external data.

## Future Extensions

- Add NFT royalties on transfers (e.g., via marketplace add-on).
- Integrate off-chain storage (IPFS/Arweave) for longer post content or media.
- Build a frontend DApp (e.g., React + @stacks/connect) for user-friendly interactions.
- Support community features like likes/reposts (on-chain events).
- Cross-chain compatibility or Bitcoin L2 integrations.
- Premium features like verified profiles or ad-free experiences.

## Contributing

Contributions are welcome! Follow these steps:

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Commit changes (`git commit -m 'Add YourFeature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a Pull Request.

Report issues via GitHub Issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Clarinet](https://docs.stacks.co/reference/clarinet/cli-reference) and inspired by Stacks ecosystem examples (e.g., Hiro Systems NFT templates).

- Thanks to the Stacks community for SIP-009 standards and Clarity best practices.

For questions, contact us or open an issue. Let's decentralize social media!
