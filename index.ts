import yn from "yn";
import chalk from "chalk";
import { ethers, providers } from "ethers";
import {
  PrizeVault,
  ContractsBlob,
  downloadContractsBlob,
  getSubgraphPrizeVaults,
  populateSubgraphPrizeVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";
import { ERC20Abi } from "./abis/ERC20Abi";

const CHAIN_IDS = {
  worldSepolia: 4801,
  gnosisChiado: 10200,
  baseSepolia: 84532,
  arbitrumSepolia: 421614,
  scrollSepolia: 534351,
  sepolia: 11155111,
  optimismSepolia: 11155420
};

const CHAIN_NAMES = {
  4801: "worldSepolia",
  10200: "gnosisChiado",
  84532: "baseSepolia",
  421614: "arbitrumSepolia",
  534351: "scrollSepolia",
  11155111: "sepolia",
  11155420: "optimismSepolia"
};

const selectedChainId = Number(process.argv[2]);
const chainName = CHAIN_NAMES[selectedChainId];
const onlyDrip = yn(process.argv[3]);
const useSubgraph = yn(process.argv[4]);
const contractsJsonUrl = process.argv[5];
const subgraphUrl = process.argv[6];

const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.worldSepolia]: "0x4b9b0cc30ef739dbaa44457f36bbad8747ad5629",
  [CHAIN_IDS.gnosisChiado]: "0x7e1acab9273afe96571b6c59db669a1b7b914b40",
  [CHAIN_IDS.baseSepolia]: "0x02ac689bb6ad0e07144a520c02e5fe3a3959dfa0",
  [CHAIN_IDS.arbitrumSepolia]: "0xc086edda021d9b90c09bd0092d47c36879c879fb",
  [CHAIN_IDS.scrollSepolia]: "0x8fa41112e3f3982c20a20378c8ca77bfa0ecc2a6",
  [CHAIN_IDS.sepolia]: "0xb02bb09c774a1ecca01259f68373894f6efe7164",
  [CHAIN_IDS.optimismSepolia]: "0xbcf3095812b97b2e2cd1a1d03230b01dc326c047"
};

const getProviderUrl = (): string | undefined => {
  let url: string | undefined = "";

  switch (selectedChainId) {
    case CHAIN_IDS.worldSepolia: {
      url = process.env.WORLD_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.gnosisChiado: {
      url = process.env.GNOSIS_CHIADO_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.baseSepolia: {
      url = process.env.BASE_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.arbitrumSepolia: {
      url = process.env.ARBITRUM_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
    case CHAIN_IDS.scrollSepolia: {
      url = process.env.SCROLL_SEPOLIA_RPC_PROVIDER_URL;
      break;
    }
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

const getPrizeVaults = async () => {
  let prizeVaults = await getSubgraphPrizeVaults(subgraphUrl);
  if (prizeVaults.length === 0) {
    throw new Error("Claimer: No prizeVaults found in subgraph");
  }

  // Page through and concat all accounts
  prizeVaults = await populateSubgraphPrizeVaultAccounts(subgraphUrl, prizeVaults);

  return prizeVaults;
};

const getContracts = async () => {
  try {
    const contracts: ContractsBlob = await downloadContractsBlob(contractsJsonUrl);
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
    userFakerAddress: USER_FAKER_ADDRESS[selectedChainId]?.toLowerCase(),
    tokenFaucetAddress: faucetContractData?.address.toLowerCase(),
    daiTokenAddress: erc20MintableContracts[0].address.toLowerCase(),
    usdcTokenAddress: erc20MintableContracts[1].address.toLowerCase(),
    wethTokenAddress: erc20MintableContracts[0].address.toLowerCase(),
    poolTokenAddress: erc20MintableContracts[1].address.toLowerCase(),
    vault1Address: prizeVaultContracts[0].address.toLowerCase(),
    vault2Address: prizeVaultContracts[1].address.toLowerCase()
    // vault2Address: prizeVaultContracts[2].address.toLowerCase()
  };

  console.table(addresses);
  console.log("");

  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  if (onlyDrip) {
    await drip(
      contracts,
      signer,
      selectedChainId,
      addresses.tokenFaucetAddress,
      addresses.wethTokenAddress
    );
    return;
  }

  const userFaker = new ethers.Contract(addresses.userFakerAddress, userFakerAbi, signer);

  let prizeVaults: PrizeVault[] = [];
  if (useSubgraph) {
    prizeVaults = await getPrizeVaults();
  }

  if (prizeVaults.length === 0) {
    prizeVaults = [
      { id: addresses.vault1Address, accounts: [] },
      { id: addresses.vault2Address, accounts: [] }
    ];
  }

  console.log(chalk.blue(`Processing ${prizeVaults.length} vaults: `));
  console.log("");

  for (let i = 0; i < prizeVaults.length; i++) {
    const vault = prizeVaults[i];

    console.log(chalk.green("Vault ID:", vault.id));

    if (addresses.vault1Address !== vault.id) {
      console.log(chalk.yellow("Skipping vault ..."));
      console.log("");
      continue;
    }

    const vaultUserCount = vault.accounts.length;
    console.log("Existing vault depositors count:", vaultUserCount);

    let numToAdd = 10;
    if (vaultUserCount > 0) {
      numToAdd = getRandomInt(10, 30);
    }
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
async function drip(contracts, signer, chainId, tokenFaucetAddress, tokenAddress) {
  if (chainId === 10200) {
    console.log("is gnosis chiado, needs wxdai not weth");
    tokenAddress = "0xb2D0d7aD1D4b2915390Dc7053b9421F735A723E7";
  }

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
  await delay(10000); // sleep due to nonce re-use issues (too many tx's sent at once)
}
