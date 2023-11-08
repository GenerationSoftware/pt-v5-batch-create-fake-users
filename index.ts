import { ethers, providers } from "ethers";
import {
  downloadContractsBlob,
  getSubgraphVaults,
  populateSubgraphVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

export const CHAIN_IDS = {
  arbitrumSepolia: 421614,
  sepolia: 11155111,
  optimismSepolia: 11155420
};

export const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "",
  [CHAIN_IDS.optimismSepolia]: ""
};

export const POOL_TOKEN_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "",
  [CHAIN_IDS.optimismSepolia]: "0xD675B9c8eea7f6Bd506d5FF66A10cF7B887CD293"
};

export const TOKEN_FAUCET_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "",
  [CHAIN_IDS.optimismSepolia]: "0x553a427f17ce1849b1005d0013825255d54a2122"
};

const CHAIN_ID = CHAIN_IDS.optimismSepolia;

const provider = new providers.JsonRpcProvider(process.env.OPTIMISM_SEPOLIA_RPC_PROVIDER_URL); // opt sep
// const provider = new providers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_PROVIDER_URL); // arb sep

// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
//
const SELECTED_VAULTS = [
  "0x22c6258ea5b1e742d18c27d846e2aabd4505edc2", // DAI OP SEPOLIA
  "0x2891d69786650260b9f99a7b333058fcc5418df0" // USDC OP SEPOLIA
];

const getVaults = async (chainId: number) => {
  let vaults = await getSubgraphVaults(chainId);
  if (vaults.length === 0) {
    throw new Error("Claimer: No vaults found in subgraph");
  }

  // Page through and concat all accounts for all vaults
  vaults = await populateSubgraphVaultAccounts(chainId, vaults);

  return vaults;
};

export async function main() {
  console.log("*********** BATCH CREATE FAKE USERS ***********");
  console.log("");

  const userFakerAddress = USER_FAKER_ADDRESS[CHAIN_ID];
  console.log({ userFakerAddress });

  const tokenFaucetAddress = TOKEN_FAUCET_ADDRESS[CHAIN_ID];
  console.log({ tokenFaucetAddress });

  const poolTokenAddress = POOL_TOKEN_ADDRESS[CHAIN_ID];
  console.log({ poolTokenAddress });
  console.log("");

  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  // await drip(signer, tokenFaucetAddress, poolTokenAddress);

  const userFaker = new ethers.Contract(userFakerAddress, userFakerAbi, signer);

  // let vaults: any = await getVaults(CHAIN_ID);
  let vaults: any = [];

  if (vaults.length === 0) {
    vaults = [
      { id: SELECTED_VAULTS[0], accounts: [] },
      { id: SELECTED_VAULTS[1], accounts: [] }
    ];
  }

  for (let i = 0; i < vaults.length; i++) {
    try {
      const vault = vaults[i];

      if (!SELECTED_VAULTS.includes(vault.id)) {
        console.log("skipping");
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = 10;
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        Math.max(numUsers, 1),
        TOKEN_FAUCET_ADDRESS,
        { gasLimit: 10000000 }
      );
      await transactionSentToNetwork.wait();

      console.log("TransactionHash:", transactionSentToNetwork.hash);
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

// Faucet
async function drip(signer, tokenFaucetAddress, tokenAddress) {
  console.log("drip");
  const contracts = await downloadContractsBlob(CHAIN_ID);

  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const faucetContract = new ethers.Contract(tokenFaucetAddress, faucetContractData?.abi, signer);

  const tx = await faucetContract.drip(tokenAddress);
  console.log("tx");
  console.log(tx.hash);
  console.log("");
}
