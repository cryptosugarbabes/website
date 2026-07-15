# Base USDC splitter

`BaseUsdcSplitter.sol` makes the creator/platform distribution atomic on Base. The USDC approval may be a separate transaction, but it does not move funds. `payAndSplit` either completes both transfers or reverts both.

Production activation requirements:

1. Compile and test with Solidity 0.8.24 or later.
2. Obtain an independent smart-contract security review.
3. Deploy with canonical Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` and treasury `0x7293F09B131B99D564c602538D0777b18075c9b4`.
4. Verify the source on BaseScan.
5. Set `BASE_SPLITTER_ADDRESS` in the VPS environment.
6. Make a controlled low-value payment and verify the event and both transfers before enabling general Base payments.

The application keeps the existing two-transfer fallback while `BASE_SPLITTER_ADDRESS` is absent. Do not configure an unreviewed or unverified deployment.

