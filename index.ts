import { ethers, providers } from "ethers";
import { getSubgraphVaults, populateSubgraphVaultAccounts } from "@pooltogether/v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

const USER_FAKER_ADDRESS = "0xb02BB09C774a1eccA01259F68373894f6eFE7164";

const TOKEN_FAUCET_ADDRESS = "0x7c01a0343595403422190C6Af9a3342c8b2Dc4C7";

const CHAIN_ID = 11155111; // sepolia

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

  const vaults = await getVaults(CHAIN_ID);

  for (let i = 0; i < vaults.length; i++) {
    try {
      console.log("");
      const vault = vaults[i];

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault deposit count:", vaultUserCount);

      const numToAdd = Math.ceil(Math.random() * 30);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        numUsers,
        TOKEN_FAUCET_ADDRESS
      );
      // const transactionReceipt = await transactionSentToNetwork.wait(1);

      console.log("TransactionHash:", transactionSentToNetwork.hash);
      // console.log("transactionReceipt.gasUsed:", transactionReceipt.gasUsed.toString());
    } catch (error) {
      throw new Error(error);
    }
  }
}

main();
