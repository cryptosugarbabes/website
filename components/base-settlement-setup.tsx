"use client";

import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider, type Hex } from "viem";
import { base } from "viem/chains";

import splitterArtifact from "@/contracts/artifacts/BaseUsdcSplitter.json";

type BasePaymentConfig = {
  base?: {
    treasuryAddress?: `0x${string}`;
    usdcContractAddress?: `0x${string}`;
    splitterAddress?: `0x${string}` | null;
    atomicSettlementEnabled?: boolean;
  };
};

type BrowserWindow = Window & typeof globalThis & {
  ethereum?: EIP1193Provider;
};

const BASE_CHAIN_HEX = "0x2105";

export function BaseSettlementSetup() {
  const [config, setConfig] = useState<BasePaymentConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | "">("");

  useEffect(() => {
    fetch("/api/payments/config", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load Base payment status.");
        setConfig(data);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  async function switchToBase(provider: EIP1193Provider) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_HEX }] });
    } catch (caught) {
      const code = (caught as { code?: number }).code;
      if (code !== 4902) throw caught;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BASE_CHAIN_HEX,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"]
        }]
      });
    }
  }

  async function deploySplitter() {
    setError("");
    const provider = (window as BrowserWindow).ethereum;
    if (!provider) {
      setError("Open this page in a browser with your Base wallet extension, then try again.");
      return;
    }
    const treasury = config?.base?.treasuryAddress;
    const usdc = config?.base?.usdcContractAddress;
    if (!treasury || !usdc) {
      setError("The Base treasury or USDC contract is not configured.");
      return;
    }

    setBusy(true);
    try {
      await switchToBase(provider);
      const walletClient = createWalletClient({ chain: base, transport: custom(provider) });
      const accounts = await walletClient.requestAddresses();
      const account = accounts[0];
      if (!account) throw new Error("Your wallet did not provide an account.");

      const hash = await walletClient.deployContract({
        account,
        abi: splitterArtifact.abi,
        bytecode: splitterArtifact.bytecode as Hex,
        args: [usdc, treasury]
      });
      const publicClient = createPublicClient({ chain: base, transport: http() });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success" || !receipt.contractAddress) {
        throw new Error("The Base deployment was not confirmed.");
      }
      setDeployedAddress(receipt.contractAddress);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Base splitter could not be deployed.");
    } finally {
      setBusy(false);
    }
  }

  const activeAddress = config?.base?.splitterAddress;

  return <section className={`base-settlement-setup ${activeAddress ? "active" : ""}`}>
    <div>
      <span>BASE MAINNET · CANONICAL USDC</span>
      <h3>{activeAddress ? "Atomic Base payments are active" : "Activate atomic Base payments"}</h3>
      <p>{activeAddress
        ? "Each paid like, gift and boost settles in one transaction: 90% to the creator and 10% to the platform treasury."
        : "Deploy the audited payment splitter from your own wallet. The site never receives your private key and cannot move treasury funds."}</p>
    </div>
    {activeAddress ? <a className="admin-export-button" href={`https://basescan.org/address/${activeAddress}`} target="_blank" rel="noreferrer">View splitter on BaseScan</a> : <button className="admin-export-button" disabled={busy || !config} onClick={deploySplitter}>{busy ? "Confirming on Base…" : "Deploy Base 90/10 splitter"}</button>}
    {deployedAddress && <div className="base-deployment-result">
      <strong>Splitter deployed successfully</strong>
      <code>{deployedAddress}</code>
      <p>Copy this address and send it to Codex. It must be saved as <code>BASE_SPLITTER_ADDRESS</code> on the server before Base payments appear as live.</p>
      <a href={`https://basescan.org/address/${deployedAddress}`} target="_blank" rel="noreferrer">Verify deployment on BaseScan</a>
    </div>}
    {error && <p className="form-error">{error}</p>}
  </section>;
}
