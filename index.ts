import yn from "yn";
import chalk from "chalk";
import { ethers, providers } from "ethers";
import {
  PrizePoolInfo,
  PrizeVault,
  ContractsBlob,
  downloadContractsBlob,
  getPrizePoolInfo,
  getSubgraphPrizeVaults,
  populateSubgraphPrizeVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";
import { ERC20Abi } from "./abis/ERC20Abi";

const CHAIN_IDS = {
  sepolia: 11155111,
  optimismSepolia: 11155420
};
const CHAIN_NAMES = {
  11155111: "sepolia",
  11155420: "optimismSepolia"
};

const selectedChainId = Number(process.argv[2]);
const chainName = CHAIN_NAMES[selectedChainId];
const onlyDrip = yn(process.argv[3]);
const useSubgraph = yn(process.argv[4]);

const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.sepolia]: "0xb02bb09c774a1ecca01259f68373894f6efe7164",
  [CHAIN_IDS.optimismSepolia]: "0xbcf3095812b97b2e2cd1a1d03230b01dc326c047"
};

const getProviderUrl = (): string | undefined => {
  let url: string | undefined = "";

  switch (selectedChainId) {
    case CHAIN_IDS.sepolia: {
      url = process.env.SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.optimismSepolia: {
      url = process.env.OPTIMISM_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
  }

  if (!url) {
    console.error(
      chalk.red(
        "[FATAL] Could not find provider URL for chain with name: ",
        toCapitalizedWords(chainName)
      )
    );
    console.log("");
  }

  return url;
};

const getPrizeVaults = async (chainId: number, prizePoolInfo: PrizePoolInfo) => {
  let prizeVaults = await getSubgraphPrizeVaults(chainId);
  if (prizeVaults.length === 0) {
    throw new Error("Claimer: No prizeVaults found in subgraph");
  }

  // Page through and concat all accounts with recent non-zero balance
  // (based on current time) for all prizeVaults
  prizeVaults = await populateSubgraphPrizeVaultAccounts(
    chainId,
    prizeVaults,
    Math.floor(Date.now() / 1000)
  );

  return prizeVaults;
};

const getContracts = async () => {
  try {
    const contracts: ContractsBlob = await downloadContractsBlob(selectedChainId);
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
    chalk.blue(`Operating on chain with ID #${selectedChainId} - ${toCapitalizedWords(chainName)}`)
  );
  console.log("");

  const provider = new providers.JsonRpcProvider(getProviderUrl());

  const contracts: ContractsBlob = await getContracts();
  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const erc20MintableContracts = contracts.contracts.filter(
    contract => contract.type === "ERC20Mintable"
  );
  const prizeVaultContracts = contracts.contracts.filter(
    contract => contract.type === "PrizeVault"
  );

  const addresses = {
    userFakerAddress: USER_FAKER_ADDRESS[selectedChainId].toLowerCase(),
    tokenFaucetAddress: faucetContractData?.address.toLowerCase(),
    daiTokenAddress: erc20MintableContracts[0].address.toLowerCase(),
    usdcTokenAddress: erc20MintableContracts[1].address.toLowerCase(),
    poolTokenAddress: erc20MintableContracts[5].address.toLowerCase(),
    wethTokenAddress: erc20MintableContracts[4].address.toLowerCase(),
    daiVaultAddress: prizeVaultContracts[0].address.toLowerCase(),
    usdcVaultAddress: prizeVaultContracts[2].address.toLowerCase()
  };

  console.table(addresses);
  console.log("");

  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  if (onlyDrip) {
    await drip(contracts, signer, addresses.tokenFaucetAddress, addresses.usdcTokenAddress);
    return;
  }

  const userFaker = new ethers.Contract(addresses.userFakerAddress, userFakerAbi, signer);

  let prizeVaults: PrizeVault[] = [];
  if (useSubgraph) {
    const prizePoolInfo: PrizePoolInfo = await getPrizePoolInfo(provider, contracts);
    prizeVaults = await getPrizeVaults(selectedChainId, prizePoolInfo);
  }

  if (prizeVaults.length === 0) {
    prizeVaults = [
      { id: addresses.daiVaultAddress, accounts: [] },
      { id: addresses.usdcVaultAddress, accounts: [] }
    ];
  }

  console.log(chalk.blue(`Processing ${prizeVaults.length} vaults: `));
  console.log("");

  for (let i = 0; i < prizeVaults.length; i++) {
    try {
      const vault = prizeVaults[i];

      console.log(chalk.green("Vault ID:", vault.id));

      if (addresses.usdcVaultAddress !== vault.id && addresses.daiVaultAddress !== vault.id) {
        console.log(chalk.yellow("Skipping vault ..."));
        console.log("");
        continue;
      }

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(60, 80);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        Math.max(numUsers, 1),
        addresses.tokenFaucetAddress,
        { gasLimit: 20000000 }
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
