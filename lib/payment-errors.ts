export function paymentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/transfer amount exceeds balance|insufficient.*usdc|not enough.*usdc/i.test(message)) {
    return "This wallet does not have enough USDC for this payment.";
  }
  if (/insufficient funds|network fee|intrinsic gas|gas required exceeds/i.test(message)) {
    return "This wallet does not have enough ETH on Base for the network fee.";
  }
  if (/user rejected|user denied|rejected the request|denied transaction signature/i.test(message)) {
    return "The payment was cancelled in your wallet.";
  }
  if (/internal error/i.test(message)) {
    return "Your wallet could not submit the payment. Check the connected account and try again.";
  }
  if (/quote expired|payment quote expired/i.test(message)) {
    return "That payment quote expired. Please start the payment again.";
  }

  return "The payment could not be completed. Check your wallet balance and network, then try again.";
}
