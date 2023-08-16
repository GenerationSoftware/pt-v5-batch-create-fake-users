import { ethers, providers } from "ethers";
import {
  getSubgraphVaults,
  populateSubgraphVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

const CHAIN_ID = 11155111; // sepolia

const USER_FAKER_ADDRESS = "0xb02BB09C774a1eccA01259F68373894f6eFE7164";
const TOKEN_FAUCET_ADDRESS = "0xcB0A8a7A1d37e35881461a3971148Dd432746401";

//
// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
//
const SELECTED_VAULTS = [
  "0xa036647ec8c956475f8b8fe473ec49f959846fa1", //DAI?
  // "0xc7e0df4a00f9a99012a828dbd2a26dc8c01e624e", //DAI?
  "0xb634839ac5c7ddcf8523ba7cc2a9211f4f107423" // usdc
  // "0x2682c2ff5510ff943f2ebfd0a665e3203a9bee4e",
  // "0xf4236b70bfc155b65a5571a5e4f8961107abfce6",
  // "0xdc140f0193a9899982c8446c249a94dea147c20b",
  // "0x80f5984aD748878c9822Af1231dEEF7466Ad85Bf"
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
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(15, 20);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
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
