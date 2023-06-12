import { ethers, providers } from "ethers";

import { userFakerAbi } from "./abis/userFakerAbi";

const USER_FAKER_ADDRESS = "0xb02BB09C774a1eccA01259F68373894f6eFE7164";

const TOKEN_FAUCET_ADDRESS = "0x7c01a0343595403422190C6Af9a3342c8b2Dc4C7";

const VAULT_ADDRESSES = [
  "0xD6D82beB1243A254A61ae4B3a1936Da962F947b7",
  "0x7Ea2e76587962c526B60492bd8342AAe859f1219",
  "0xebC5c1257A6DB56d2c3C9466A5271C5Be4FB1397",
  "0x0B87bF0822AFAecDEb367cfAaCcf40c0e895F3AD",
  "0xe288828FFb4087F633E17D4715103648266C0cdb",
  "0x171df7a2D8547322de5BA27FD9856B04620A3562",
  "0x0C393C363bAE8Eebe6E1Afe4716e317CbD2E9949"
];

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

  try {
    const sampledVaultAddress = VAULT_ADDRESSES[3];
    console.log({ sampledVaultAddress });

    const numUsers = Math.ceil(Math.random() * 40);
    console.log({ numUsers });

    const transactionSentToNetwork = await userFaker.setFakeUsers(
      sampledVaultAddress,
      numUsers,
      TOKEN_FAUCET_ADDRESS
    );
    const transactionReceipt = await transactionSentToNetwork.wait(1);

    console.log("transactionReceipt:", transactionReceipt);
    console.log("TransactionHash:", transactionSentToNetwork.hash);
  } catch (error) {
    throw new Error(error);
  }
}

main();
