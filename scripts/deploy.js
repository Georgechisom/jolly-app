// Deployment script for jolly-app contract

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  SignedContractDeployOptions,
  getNonce,
} from "@stacks/transactions";
import { StacksTestnet, StacksMainnet } from "@stacks/network";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const CONFIG = {
  // Network: 'testnet' or 'mainnet'
  network: process.env.NETWORK || "testnet",

  // Your wallet's private key (use environment variable for security)
  privateKey: process.env.STACKS_PRIVATE_KEY,

  // Contract details
  contractName: "jolly-app",
  contractFile: "./contracts/jolly-app.clar",

  // Fee in microstacks (adjust as needed)
  // 1 STX = 1,000,000 microstacks
  fee: parseInt(process.env.DEPLOYMENT_FEE || "100000"), // 0.1 STX default
};

function getNetwork() {
  if (CONFIG.network === "mainnet") {
    console.log(" Using Mainnet");
    return new StacksMainnet();
  } else {
    console.log(" Using Testnet");
    return new StacksTestnet();
  }
}

function readContractSource() {
  const contractPath = path.join(__dirname, CONFIG.contractFile);

  if (!fs.existsSync(contractPath)) {
    throw new Error(` Contract file not found: ${contractPath}`);
  }

  const contractSource = fs.readFileSync(contractPath, "utf8");

  console.log(` Contract loaded: ${CONFIG.contractName}`);
  console.log(` Contract size: ${contractSource.length} bytes`);

  // Check contract size (max is ~1MB)
  if (contractSource.length > 1000000) {
    console.warn("  Warning: Contract is very large (>1MB)");
  }

  return contractSource;
}

function validateEnvironment() {
  console.log("🔍 Validating environment...");

  // Check private key
  if (!CONFIG.privateKey) {
    throw new Error(
      " STACKS_PRIVATE_KEY environment variable is not set." +
        "" +
        "Please set it with:" +
        "  export STACKS_PRIVATE_KEY=your_private_key_here" +
        "" +
        "To get your private key from Hiro Wallet:" +
        "  1. Open Hiro Wallet" +
        "  2. Go to Settings" +
        '  3. Click "View Secret Key"' +
        "  4. Copy your private key"
    );
  }

  // Check private key format (should be 64 hex characters)
  if (CONFIG.privateKey.length !== 64) {
    throw new Error(
      " Invalid private key format." +
        "Private key should be 64 hexadecimal characters (32 bytes)."
    );
  }

  // Validate network
  if (!["testnet", "mainnet"].includes(CONFIG.network)) {
    throw new Error(
      ` Invalid network: ${CONFIG.network}` +
        'Network must be either "testnet" or "mainnet"'
    );
  }

  // Warn about mainnet deployment
  if (CONFIG.network === "mainnet") {
    console.log("  WARNING: You are deploying to MAINNET!");
    console.log("  This will use real STX tokens.");
    console.log(" Make sure you have tested thoroughly on testnet first.");
  }

  console.log(" Environment validation passed");
}

function displayDeploymentSummary(transaction) {
  console.log(` Contract Name:    ${CONFIG.contractName}`);
  console.log(` Network:          ${CONFIG.network}`);
  console.log(` Deployment Fee:   ${CONFIG.fee / 1000000} STX`);
  console.log(` Transaction ID:   ${transaction.txid}`);

  console.log("🔗 Explorer Links:");
  if (CONFIG.network === "mainnet") {
    console.log(
      `   Transaction: https://explorer.hiro.so/txid/${transaction.txid}?chain=mainnet`
    );
    console.log(
      `   Contract:    https://explorer.hiro.so/txid/${transaction.txid}/contract?chain=mainnet`
    );
  } else {
    console.log(
      `   Transaction: https://explorer.hiro.so/txid/${transaction.txid}?chain=testnet`
    );
    console.log(
      `   Contract:    https://explorer.hiro.so/txid/${transaction.txid}/contract?chain=testnet`
    );
  }
}

function displayNextSteps() {
  console.log(
    `   (contract-call? .${CONFIG.contractName} init-owner 'YOUR_ADDRESS 'YOUR_CONTRACT_ADDRESS)`
  );

  console.log("3️ Test Contract Functions");
  console.log(" Create a test post");
  console.log(" Try tipping a post");
  console.log(" Verify all features work");

  console.log("4️  Build Your Frontend");
  console.log(" Use @stacks/connect for wallet integration");
  console.log(" Create a beautiful UI");
  console.log(" Make it mobile-friendly");

  console.log("5️  Go Live!");
  console.log(" Share your dApp with the community");
  console.log(" Announce on Stacks Discord/Twitter");
  console.log(" Celebrate your deployment!");
}

async function deployContract() {
  try {

    // Step 1: Validate environment
    validateEnvironment();

    // Step 2: Setup network and load contract
    const network = getNetwork();
    const codeBody = readContractSource();

    console.log(" Preparing deployment transaction...");

    // Step 3: Create the contract deploy transaction
    const txOptions = {
      contractName: CONFIG.contractName,
      codeBody: codeBody,
      senderKey: CONFIG.privateKey,
      network: network,
      anchorMode: AnchorMode.Any,
      fee: BigInt(CONFIG.fee),
      // Nonce will be fetched automatically
    };

    console.log(" Building transaction...");
    const transaction = await makeContractDeploy(txOptions);

    console.log(" Transaction built successfully");
    console.log(`   Size: ${transaction.serialize().byteLength} bytes`);

    // Step 4: Broadcast the transaction
    console.log(" Broadcasting transaction to blockchain...");
    console.log("   This may take a few seconds...");

    const broadcastResponse = await broadcastTransaction({
      transaction,
      network,
    });

    // Step 5: Check for errors
    if (broadcastResponse.error) {
      console.error(" Transaction broadcast failed!");
      console.error(`   Error: ${broadcastResponse.error}`);
      if (broadcastResponse.reason) {
        console.error(`   Reason: ${broadcastResponse.reason}`);
      }
      if (broadcastResponse.reason_data) {
        console.error(
          `   Details: ${JSON.stringify(
            broadcastResponse.reason_data,
            null,
            2
          )}`
        );
      }
      throw new Error("Transaction broadcast failed");
    }

    // Step 6: Success! Display results
    console.log(" Transaction broadcast successful!");

    displayDeploymentSummary(broadcastResponse);
    displayNextSteps();

    return broadcastResponse;
  } catch (error) {
    console.error(" Deployment failed!");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (error.message.includes("STACKS_PRIVATE_KEY")) {
      console.error(error.message);
    } else if (error.message.includes("Contract file not found")) {
      console.error(error.message);
      console.error(
        " Tip: Make sure you are running this script from the project root directory."
      );
    } else if (error.message.includes("ConflictingNonceInMempool")) {
      console.error(" A transaction with this nonce is already pending.");
      console.error(
        " Wait for the previous transaction to complete or use a different account."
      );
    } else if (error.message.includes("NotEnoughFunds")) {
      console.error(" Insufficient STX balance for deployment.");
      console.error(
        ` You need at least ${CONFIG.fee / 1000000} STX plus network fees.`
      );
      if (CONFIG.network === "testnet") {
        console.error(
          " Get testnet STX from: https://explorer.hiro.so/sandbox/faucet?chain=testnet"
        );
      }
    } else if (error.message.includes("ContractAlreadyExists")) {
      console.error(
        " A contract with this name already exists on your account."
      );
      console.error(
        " Choose a different contract name or use a different deployer account."
      );
    } else {
      console.error("Error details:", error.message);
      if (error.stack) {
        console.error("Stack trace:");
        console.error(error.stack);
      }
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(" Troubleshooting Tips:");
    console.error("   1. Verify your private key is correct");
    console.error("   2. Check you have enough STX for deployment");
    console.error("   3. Ensure the contract file path is correct");
    console.error("   4. Try running: clarinet check");
    console.error("   5. Check network status: https://status.hiro.so/");
    console.error(" Documentation: https://docs.hiro.so/");
    console.error(" Get help: https://discord.gg/stacks");

    process.exit(1);
  }
}

async function main() {
  const startTime = Date.now();

  try {
    await deployContract();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱  Total deployment time: ${duration} seconds`);
    console.log("✨ Deployment process completed successfully! ✨");

    process.exit(0);
  } catch (error) {
    // Error already logged in deployContract
    process.exit(1);
  }
}

// Run the deployment when script is executed
main();

// ST2CVPDX63RF1BPBRMY98K2F18ZJSVDGZ0K043AE6.jolly - app;
