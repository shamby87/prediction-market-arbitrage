import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { CONFIG } from "../config";

// Build a read/write CLOB client using your private key and funder (profile) address. 
export async function makeClobClient(): Promise<ClobClient> {
  const signer = new Wallet(CONFIG.polyPrivateKey);

  // First, make a temporary client to derive API credentials (L2). 
  const temp = new ClobClient(CONFIG.clobHost, CONFIG.chainId, signer);
  // return temp;

  // console.log("test");
  const apiCreds = await temp.createOrDeriveApiKey();
  // console.log(`Using API credentials: ${JSON.stringify(apiCreds)}`);

  // Signature type: 2 (browser wallet) or 1 (email login). Adjust as needed; 2 is common for Metamask-like logins. 
  const signatureType = 2;

  const client = new ClobClient(
    CONFIG.clobHost,
    CONFIG.chainId,
    signer,
    apiCreds,
    signatureType,
    CONFIG.profileAddress,
  );

  return client;
}
