import { ethers, providers } from "ethers";
import {
  getSubgraphVaults,
  populateSubgraphVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

const CHAIN_ID = 11155111; // sepolia

const USER_FAKER_ADDRESS = "0xb02BB09C774a1eccA01259F68373894f6eFE7164";
const TOKEN_FAUCET_ADDRESS = "0xcB0A8a7A1d37e35881461a3971148Dd432746401";

// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
const SELECTED_VAULTS = [
  "0xb634839AC5c7DDCF8523ba7Cc2a9211F4f107423" // usdc
  // "0x0c393c363bae8eebe6e1afe4716e317cbd2e9949" //  dai
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

  console.log({ USER_FAKER_ADDRESS });
  console.log({ TOKEN_FAUCET_ADDRESS });
  console.log("");

  const provider = new providers.JsonRpcProvider(process.env.SEPOLIA_RPC_PROVIDER_URL);
  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  const userFaker = new ethers.Contract(USER_FAKER_ADDRESS, userFakerAbi, signer);
  console.log(userFaker);

  // let vaults: any = await getVaults(CHAIN_ID);
  // console.log(vaults);

  let vaults = [{ id: "0xb634839AC5c7DDCF8523ba7Cc2a9211F4f107423" }];

  for (let i = 0; i < vaults.length; i++) {
    try {
      console.log("");
      const vault = vaults[i];
      if (!SELECTED_VAULTS.includes(vault.id)) {
        continue;
      }

      console.log("Vault ID:", vault.id);

      // const vaultUserCount = vault.accounts.length;
      // console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(1, 2);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = numToAdd;
      // const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        numUsers,
        TOKEN_FAUCET_ADDRESS,
        { gasLimit: 10000000 }
      );

      console.log("TransactionHash:", transactionSentToNetwork.hash);
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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
