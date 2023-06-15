import { ethers, providers } from "ethers";
import { getSubgraphVaults, populateSubgraphVaultAccounts } from "@pooltogether/v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

const CHAIN_ID = 11155111; // sepolia

const USER_FAKER_ADDRESS = "0xb02BB09C774a1eccA01259F68373894f6eFE7164";
const TOKEN_FAUCET_ADDRESS = "0x7c01a0343595403422190C6Af9a3342c8b2Dc4C7";

const OMITTED_VAULTS = [
  "0xd6d82beb1243a254a61ae4b3a1936da962f947b7",
  "0x7ea2e76587962c526b60492bd8342aae859f1219"
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

  let vaults: any = await getVaults(CHAIN_ID);

  for (let i = 0; i < vaults.length; i++) {
    try {
      console.log("");
      const vault = vaults[i];
      if (OMITTED_VAULTS.includes(vault.id)) {
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(30, 50);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        numUsers,
        TOKEN_FAUCET_ADDRESS
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
