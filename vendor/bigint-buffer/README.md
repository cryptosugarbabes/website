# bigint-buffer compatibility package

This local package replaces the vulnerable native-converter path in `bigint-buffer` while preserving the small API used by the Solana dependency tree. It uses the safe JavaScript conversion path only.

Keep the workspace override until the upstream Solana packages no longer resolve the affected package or a reviewed upstream fix is published. Re-run `pnpm audit --prod` whenever those dependencies are upgraded.
