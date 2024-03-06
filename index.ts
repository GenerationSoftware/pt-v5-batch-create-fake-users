import axios, { isCancel, AxiosError } from "axios";
import chalk from "chalk";
import nodeFetch from "node-fetch";
import { ethers, providers } from "ethers";
import {
  ContractsBlob,
  downloadContractsBlob,
  getSubgraphPrizeVaults,
  populateSubgraphPrizeVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";
import { ERC20Abi } from "./abis/ERC20Abi";

const CHAIN_IDS = {
  sepolia: 11155111,
  optimismSepolia: 11155420,
  optimismGoerli: 420
};

const CHAIN_NAME = "optimismGoerli";
const SELECTED_CHAIN_ID = CHAIN_IDS[CHAIN_NAME];

const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.sepolia]: "0xb02bb09c774a1ecca01259f68373894f6efe7164",
  [CHAIN_IDS.optimismGoerli]: "0x7506De196cd50f95c53412844743c90B63fE79ef",
  [CHAIN_IDS.optimismSepolia]: "0xbcf3095812b97b2e2cd1a1d03230b01dc326c047"
};

const getProviderUrl = (): string | undefined => {
  let url: string | undefined = "";

  switch (SELECTED_CHAIN_ID) {
    case CHAIN_IDS.sepolia: {
      url = process.env.SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.optimismGoerli: {
      url = process.env.OPTIMISM_GOERLI_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.optimismSepolia: {
      url = process.env.OPTIMISM_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
  }

  if (!url) {
    console.error(
      chalk.red("[FATAL] Could not find provider URL for chain with name: ", CHAIN_NAME)
    );
    console.log("");
  }

  return url;
};

const getSelectedPrizeVaults = async () => {
  const url = `https://raw.githubusercontent.com/GenerationSoftware/pt-v5-testnet/v51/deployments/${CHAIN_NAME}/vaults.json`;
  try {
    console.log(url);
    // const response = await nodeFetch(
    //   url
    // );
    const response = await axios.get(url);
    console.log(response);

    // if (!response.ok) {
    //   throw new Error(response.statusText);
    // }
    // return await response.json();
  } catch (err) {
    console.error(chalk.red(err));
  }
};

// !!!
// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
// !!!
const SELECTED_VAULTS = {
  [CHAIN_IDS.sepolia]: [
    "0x7de52acb8cebc9713a804f5fdbd443e95234a31a", // DAI
    "0x8d8d5e80daec5c917d1b1e7a331dae2fa0a789f5" // USDC
  ],
  [CHAIN_IDS.optimismSepolia]: [
    "0x0ffe33d8b2d93ff1eff4be866c87ae45c22fb681", // DAI
    "0x170de99261a497d5b29aa2279cc2f3da0eb09b4b" // USDC
  ]
};

const getPrizeVaults = async (chainId: number) => {
  let prizeVaults = await getSubgraphPrizeVaults(chainId);
  if (prizeVaults.length === 0) {
    throw new Error("Claimer: No prizeVaults found in subgraph");
  }

  // Page through and concat all accounts for all prizeVaults
  prizeVaults = await populateSubgraphPrizeVaultAccounts(chainId, prizeVaults);

  return prizeVaults;
};

const getContracts = async () => {
  try {
    const contracts: ContractsBlob = await downloadContractsBlob(SELECTED_CHAIN_ID);
    return contracts;
  } catch (error) {
    throw new Error(error);
  }
};

function toCapitalizedWords(name) {
  const words = name.match(/[A-Za-z][a-z]*/g) || [];
  return words.map(capitalize).join(" ");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.substring(1);
}

export async function main() {
  console.log("");
  console.log(chalk.green("*********** BATCH CREATE FAKE USERS ***********"));
  console.log("");

  console.log("");
  console.log(
    chalk.cyan(
      `Operating on chain with ID #${SELECTED_CHAIN_ID} - ${toCapitalizedWords(CHAIN_NAME)}`
    )
  );
  console.log("");

  console.log("test");

  console.log(await getSelectedPrizeVaults());
  console.log("here");

  const provider = new providers.JsonRpcProvider(getProviderUrl());

  const contracts: ContractsBlob = await getContracts();
  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const erc20MintableContracts = contracts.contracts.filter(
    contract => contract.type === "ERC20Mintable"
  );

  const addresses = {
    userFakerAddress: USER_FAKER_ADDRESS[SELECTED_CHAIN_ID],
    tokenFaucetAddress: faucetContractData?.address,
    poolTokenAddress: erc20MintableContracts[5].address,
    wethTokenAddress: erc20MintableContracts[4].address
  };

  console.table(addresses);
  console.log("");

  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  await drip(contracts, signer, addresses.tokenFaucetAddress, addresses.wethTokenAddress);
  await drip(contracts, signer, addresses.tokenFaucetAddress, addresses.poolTokenAddress);

  const userFaker = new ethers.Contract(addresses.userFakerAddress, userFakerAbi, signer);

  let prizeVaults: any = await getPrizeVaults(SELECTED_CHAIN_ID);
  // let prizeVaults: any = [];

  if (prizeVaults.length === 0) {
    prizeVaults = [
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][0], accounts: [] },
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][1], accounts: [] }
    ];
  }

  for (let i = 0; i < prizeVaults.length; i++) {
    try {
      const vault = prizeVaults[i];

      if (!SELECTED_VAULTS[SELECTED_CHAIN_ID].includes(vault.id)) {
        console.log("skipping");
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(7, 20);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        Math.max(numUsers, 1),
        addresses.tokenFaucetAddress,
        { gasLimit: 10000000 }
      );
      console.log("TransactionHash:", transactionSentToNetwork.hash);
      await transactionSentToNetwork.wait();

      console.log("");
    } catch (error) {
      throw new Error(error);
    }
  }
}

main();

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  const int = Math.floor(Math.random() * (max - min + 1)) + min;
  return int === 0 ? 1 : int;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Faucet
async function drip(contracts, signer, tokenFaucetAddress, tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20Abi, signer);
  console.log(`Drip: (${await tokenContract.symbol()}) [${tokenAddress}] to ${signer.address}`);

  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const faucetContract = new ethers.Contract(tokenFaucetAddress, faucetContractData?.abi, signer);

  const tx = await faucetContract.drip(tokenAddress);
  console.log("Tx Hash:");
  console.log(tx.hash);
  console.log("");
  console.log("Send this token to relayer.");
  console.log("");
  console.log("");
  await delay(3000); // sleep due to nonce re-use issues (too many tx's sent at once)
}
