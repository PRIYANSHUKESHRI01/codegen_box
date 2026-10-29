<?php

// Auto-generated curated vault questions for Mellow Vault AI Interview

return [
    'emerging_tech-blockchain-s1-set1' => [
        [
            'text' => 'Explain the core architecture of a blockchain. How do cryptographic hashes, previous block hashes, and Merkle trees guarantee data immutability?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Each block contains the cryptographic hash of the prior block header, forming an append-only chain. Merkle trees aggregate transactions into a single root hash, allowing O(log N) cryptographic proof of transaction inclusion (Merkle proofs). Any tampering changes the hash, breaking downstream chain validity.',
        ],
        [
            'text' => 'Compare Proof of Work (PoW) and Proof of Stake (PoS) consensus mechanisms. How do they prevent Sybil attacks and double-spending?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'PoW requires computational expenditure (finding nonce satisfying difficulty target), tying voting power to physical energy. PoS replaces miners with validators staking native capital, securing the chain via slashing conditions (forfeiting stake for malicious double-signing or invalid blocks).',
        ],
        [
            'text' => 'How does public-key cryptography enable blockchain accounts and transactions? Trace how an Ethereum address is derived from a private key.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A 256-bit private key generates a public key via elliptic curve multiplication (secp256k1). The public key is hashed using Keccak-256, and the last 20 bytes (40 hex characters prefixed with 0x) constitute the Ethereum address. Private keys sign transactions; network nodes verify ECDSA signatures against the address.',
        ],
        [
            'text' => 'Explain the difference between the Bitcoin UTXO (Unspent Transaction Output) model and the Ethereum Account-based model. What are the trade-offs of each?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'UTXO treats currency as indivisible coins consumed and recreated in transactions, offering high parallelizability, privacy, and stateless verification. The Account model maintains global state (balance and nonce per address), enabling simpler smart contract programmability and rich statefulness at the expense of sequential transaction execution.',
        ],
        [
            'text' => 'What is the Ethereum Virtual Machine (EVM)? How does gas work, and what is the purpose of Gas Limit vs Gas Price vs Base Fee (EIP-1559)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'The EVM is a stack-based runtime executing bytecode deterministically across nodes. Gas meters computational resources (opcodes, storage) to prevent infinite loops (halting problem). Gas Limit is maximum units of gas a sender allows; Base Fee is dynamically burned per block based on network congestion, and Priority Fee (tip) incentivizes miner/validator ordering.',
        ],
    ],
    'emerging_tech-blockchain-s1-set2' => [
        [
            'text' => 'In Solidity, explain the differences between memory, storage, and calldata data locations. How do they affect gas consumption and mutation?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Storage is persistent on the blockchain state (expensive: 20,000 gas for cold write, 5,000 gas for update). Memory is temporary mutable byte array allocated per function execution. Calldata is non-modifiable, non-persistent execution area where function arguments reside (cheapest, avoids copying calldata to memory).',
        ],
        [
            'text' => 'Explain function visibility modifiers (public, external, internal, private) and state mutability modifiers (view, pure, payable) in Solidity.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Visibility: public (accessible internally and externally), external (only callable externally, reads directly from calldata), internal (contract and inherited contracts), private (only defining contract). Mutability: view reads state without modifying it; pure neither reads nor modifies state; payable accepts native ETH transfers.',
        ],
        [
            'text' => 'What is the anatomy of the ERC-20 token standard? Explain the purpose of balanceOf, transfer, approve, and transferFrom, and how the allowance pattern works.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ERC-20 standardizes fungible tokens. `balanceOf(address)` checks holdings. `transfer(to, amount)` sends tokens directly. `approve(spender, amount)` grants an allowance mapping `[owner][spender]`, enabling contracts (like Uniswap) to pull approved tokens on user behalf via `transferFrom(from, to, amount)`.',
        ],
        [
            'text' => 'How do Solidity Events and Indexed Topics work? Where is event data stored, and can a smart contract read its own emitted events?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Events output logs stored in transaction receipts in block data, not in contract state storage (drastically cheaper gas). Contracts CANNOT read their own historical emitted events or logs; they are designed for external indexers (The Graph, ethers.js). Up to 3 parameters can be `indexed` (topics) for efficient bloom filter querying.',
        ],
        [
            'text' => 'How does Hardhat or Foundry assist in testing and compiling smart contracts? Explain the advantages of Solidity-based testing in Foundry over JavaScript/TypeScript in Hardhat.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Hardhat runs Node.js tests using ethers.js and waffle with local mock EVM. Foundry writes unit and fuzz tests directly in Solidity (`forge test`), executing with native Rust performance, offering instant compilation, cheatcodes (`vm.prank`, `vm.warp`), and property-based fuzzing without JS serialization overhead.',
        ],
    ],
    'emerging_tech-blockchain-s1-set3' => [
        [
            'text' => 'What is the classic Reentrancy vulnerability in smart contracts? Walk through the DAO hack scenario and explain the Checks-Effects-Interactions pattern and ReentrancyGuard.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Reentrancy occurs when a contract sends ETH/external calls before updating internal balance state, allowing the recipient fallback/receive function to recursively call withdraw before state is decremented. Prevention: Checks-Effects-Interactions (validate inputs, modify balances, then send external calls) or OpenZeppelin ReentrancyGuard mutex lock.',
        ],
        [
            'text' => 'How do Oracle Manipulation attacks happen on decentralized lending or AMM protocols? Why is using Uniswap spot price as a price oracle dangerous, and how do TWAP or Chainlink mitigate it?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Flash loans allow attackers to borrow millions risk-free within a single transaction, artificially skewing the spot reserve ratio of an on-chain AMM pool. Protocols relying on `reserveA / reserveB` evaluate collateral at false prices, enabling undercollateralized borrowing. Mitigations: Chainlink decentralized off-chain oracle aggregators or Time-Weighted Average Price (TWAP) oracles resistant to atomic single-block manipulation.',
        ],
        [
            'text' => 'Explain smart contract upgradeability patterns. Compare Transparent Proxy Pattern vs Universal Upgradeable Proxy Standard (UUPS).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Proxies use `delegatecall` to execute implementation contract bytecode in the proxy\'s storage context. Transparent proxies place upgrade logic in proxy with admin selector routing checks. UUPS places upgrade logic inside the implementation contract itself, saving deployment gas and reducing proxy overhead while requiring careful upgrade functions in each implementation.',
        ],
        [
            'text' => 'Compare Layer 2 scaling architectures: Optimistic Rollups (Arbitrum, Optimism) vs Zero-Knowledge (ZK) Rollups (zkSync, Starknet). Discuss fraud proofs vs validity proofs and withdrawal finality.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Optimistic rollups assume transactions are valid by default and post state roots to L1; security relies on interactive fraud proofs during a 7-day dispute window (delaying L1 native withdrawals). ZK rollups generate succinct cryptographic validity proofs (SNARKs/STARKs) off-chain verified on L1, providing immediate finality and mathematical security without challenge periods.',
        ],
        [
            'text' => 'What is MEV (Maximal Extractable Value)? Explain front-running, sandwich attacks, and how private mempools (e.g. Flashbots Protect) protect decentralized users.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'MEV is profit validators/searchers extract by reordering, inserting, or censoring transactions in a block. A sandwich attack detects a pending large AMM swap in the public mempool, front-runs with a buy to raise price, and back-runs with a sell. Flashbots relays bypass public mempools, sending bundles directly to block builders over private encrypted RPC.',
        ],
    ],
    'emerging_tech-blockchain-s2-set1' => [
        [
            'text' => 'What is a cryptographic hash function, and what three properties make it suitable for blockchain (pre-image resistance, second pre-image resistance, collision resistance)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Pre-image resistance: computationally infeasible to find input $x$ given hash $h(x)$. Second pre-image resistance: given $x$, infeasible to find $y 
eq x$ such that $h(x) = h(y)$. Collision resistance: infeasible to find any distinct pair $(x, y)$ such that $h(x) = h(y)$. Guarantees irreversible, unique block fingerprints.',
        ],
        [
            'text' => 'What is a 51% attack on a Proof of Work blockchain? What can an attacker with 51% hashrate achieve, and what are they mathematically unable to do?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'An attacker with >50% hashrate can produce the longest chain privately, allowing double-spending of their own past transactions and transaction reorganization/censorship. They CANNOT forge signatures to steal others\' private keys, create coins out of thin air outside consensus rules, or alter historical transactions prior to their reorg depth.',
        ],
        [
            'text' => 'Explain the difference between Public (permissionless), Private (permissioned), and Consortium blockchains. Give realistic business use cases for each.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Public (Ethereum/Bitcoin): open access, decentralized censorship resistance, global finance. Private (Hyperledger Fabric): controlled by single enterprise, restricted read/write, high TPS for supply chain tracking. Consortium: governed by coalition of institutions (e.g. interbank settlements, healthcare consortia) balancing privacy and distributed trust.',
        ],
        [
            'text' => 'What is a digital signature algorithm (like ECDSA or Ed25519)? How does a blockchain node verify that a transaction was authorized by the sender without exposing the private key?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Sender hashes transaction payload and signs with private key, yielding $(r, s, v)$. Nodes compute elliptic curve point recovery (`ecrecover`), recovering the public key from the signature and hash, verifying it matches sender address without ever learning the private scalar $k$.',
        ],
        [
            'text' => 'Explain the concept of HD (Hierarchical Deterministic) Wallets and standards BIP-32, BIP-39, and BIP-44. How does a 12 or 24-word seed phrase generate infinite accounts?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'BIP-39 maps random entropy to a mnemonic wordlist, then hashes with PBKDF2 to derive a master seed. BIP-32 derives a tree of keys using HMAC-SHA512. BIP-44 defines standard derivation paths (`m / 44\' / coin_type\' / account\' / change / address_index`), allowing one backup phrase to deterministically generate wallets across multiple blockchains.',
        ],
    ],
    'emerging_tech-blockchain-s2-set2' => [
        [
            'text' => 'What is the ERC-721 non-fungible token (NFT) standard? Explain the difference between ERC-721 and ERC-1155 (Multi-Token standard), particularly regarding batch transfers and gas.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ERC-721 tracks discrete `tokenId` ownership individually (`ownerOf(tokenId)`), costing significant gas when minting or transferring multiple items. ERC-1155 combines fungible and non-fungible tokens in a single contract, supporting batch transfers (`safeBatchTransferFrom`) and shared state, reducing gas by up to 80% for gaming and digital items.',
        ],
        [
            'text' => 'Explain integer overflow and underflow in Solidity. Why was SafeMath required in Solidity 0.7, and how did Solidity 0.8 change native arithmetic checks?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Prior to Solidity 0.8.0, 256-bit arithmetic wrapped around silently ($2^{256}-1 + 1 = 0$), causing catastrophic exploits (e.g. BeautyChain). SafeMath asserted bounds. Solidity 0.8+ introduced native compiler overflow/underflow checks that automatically revert transactions on failure, with the `unchecked { ... }` block reserved for gas-optimized loops.',
        ],
        [
            'text' => 'How does contract-to-contract communication work in the EVM? Compare call, staticcall, and delegatecall in terms of execution context and storage.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '`call` invokes target contract code in target contract storage context (can mutate target state). `staticcall` invokes target code read-only, reverting if state modification is attempted. `delegatecall` executes target contract code inside the CALLER\'S storage context, preservation of `msg.sender` and `msg.value`, foundational for proxies and libraries.',
        ],
        [
            'text' => 'Explain the storage layout in Ethereum smart contracts. How are 32-byte storage slots assigned for primitive types, structs, fixed arrays, dynamic arrays, and mappings?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'State variables are assigned sequentially to 32-byte slots ($0, 1, 2...$). Contiguous items under 32 bytes are packed into the same slot (right-to-left). Dynamic arrays store their length in slot $p$, with elements located at `keccak256(p) + index`. Mappings store nothing at slot $p$; values are located at `keccak256(key . p)`.',
        ],
        [
            'text' => 'How do frontend dApps interact with Ethereum nodes? Walk through the roles of Web3 providers (EIP-1193), Signers, ethers.js / viem, and JSON-RPC methods (eth_call vs eth_sendRawTransaction).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A browser wallet (MetaMask) injects `window.ethereum` (EIP-1193). Libraries (viem/ethers) wrap the provider. Read calls use `eth_call` (simulated locally on node, instantaneous, zero gas). Write calls request user signature via wallet, then transmit signed payload via `eth_sendRawTransaction` to the mempool, awaiting block inclusion.',
        ],
    ],
    'emerging_tech-blockchain-s2-set3' => [
        [
            'text' => 'What is the Delegatecall injection vulnerability? How can an uninitialized proxy or faulty upgrade pattern lead to complete contract destruction or takeover?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'If an implementation contract contains `selfdestruct` or an uninitialized `initialize()` function callable by anyone, an attacker can initialize themselves as owner and execute `selfdestruct`. Furthermore, slot collisions in proxy storage layouts cause the implementation to overwrite critical proxy variables (like admin address).',
        ],
        [
            'text' => 'Explain Flash Loan attacks and how uncollateralized lending can be used to exploit liquidity pools and governance votes. What defensive architectural controls must be deployed?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Flash loans (Aave, Uniswap) lend millions without collateral provided principal plus fee is returned in the same atomic transaction. Attackers manipulate spot prices or purchase governance voting tokens to execute malicious proposals. Defenses: TWAP/decentralized oracles, snapshot voting based on historical block heights, multi-step timelocks, and withdrawal delays.',
        ],
        [
            'text' => 'How does Cross-Chain Bridging work? Explain the difference between Lock-and-Mint, Burn-and-Mint, and Liquidity Pool bridges. What makes bridges frequent targets for high-value hacks?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Lock-and-Mint locks native asset on source chain and mints wrapped synthetic token on target chain. Bridges rely on off-chain relayers, multisig validators, or light client proofs to attest to source chain events. If validator keys are compromised (e.g. Ronin) or smart contract verification logic has flaws (Nomad, Wormhole), attackers forge deposit proofs and drain locked native collateral.',
        ],
        [
            'text' => 'Explain Zero-Knowledge Proofs in blockchain. What is the fundamental difference between zk-SNARKs and zk-STARKs (trusted setup, proof size, post-quantum resistance)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ZK proofs allow a prover to prove possession of a secret or correctness of computation without revealing the data. zk-SNARKs produce tiny constant-size proofs (~hundreds of bytes) that are fast to verify on L1, but require a trusted setup ceremony and rely on elliptic curves (vulnerable to quantum). zk-STARKs require no trusted setup, rely on collision-resistant hashes (quantum-resistant), but generate significantly larger proof payloads.',
        ],
        [
            'text' => 'When should a system use a blockchain versus a traditional distributed SQL database? Detail three architectural criteria where choosing blockchain is an antipattern.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Blockchain is only justified when there is mutual distrust among multiple writing parties and no trusted central intermediary is acceptable. Antipatterns: 1) High throughput, low latency real-time data logging (e.g. IoT sensor streaming); 2) Private enterprise data requiring GDPR \'Right to be Forgotten\' (blockchain is immutable); 3) Single-tenant or trusted consortium where a managed database with cryptographic audit logs (Postgres + QLDB) is $1000	imes$ faster and cheaper.',
        ],
    ],
    'emerging_tech-blockchain-s3-set1' => [
        [
            'text' => 'What is a Byzantine Fault Tolerant (BFT) consensus algorithm? How does PBFT (Practical Byzantine Fault Tolerance) reach consensus, and what is the maximum fraction of malicious nodes it can tolerate?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'BFT consensus allows distributed nodes to agree on state even if some nodes crash, fail, or deliberately send conflicting messages. PBFT tolerates up to $f = \\lfloor(n-1)/3floor$ Byzantine nodes (less than one-third malicious). It uses pre-prepare, prepare, and commit phases with quadratic message complexity $O(n^2)$.',
        ],
        [
            'text' => 'Explain the difference between a Hard Fork and a Soft Fork in blockchain protocol updates. Provide a historical example of each (e.g. BTC SegWit vs ETH/ETC).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A Hard Fork is a backwards-incompatible change where non-upgraded nodes reject the new blocks, splitting the chain if not universally adopted (e.g. Ethereum DAO fork creating ETH and ETC). A Soft Fork is backwards-compatible where new rules are stricter than old rules, so old nodes still accept new blocks (e.g. Bitcoin SegWit BIP-141).',
        ],
        [
            'text' => 'What is the role of a Merkle Patricia Trie in Ethereum? How does Ethereum maintain State Trie, Storage Trie, and Transaction Trie simultaneously?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Merkle Patricia Trie combines a Radix trie with Merkle hashing for deterministic key-value state indexing. Ethereum maintains: State Trie (mapping address to account nonce, balance, storageRoot, codeHash), Storage Trie (per-contract internal variables), and Transaction/Receipt Tries per block. Only the root hash changes when state updates, enabling light clients to verify any account balance.',
        ],
        [
            'text' => 'Explain the purpose of the Nonce in an Ethereum account. What happens if you send transactions with out-of-order nonces, and how do you cancel or speed up a pending transaction?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'The account nonce counts outgoing confirmed transactions, preventing replay attacks and enforcing strict ordering. Transactions with nonces higher than current sequence remain stuck in the mempool. To cancel or speed up, submit a new transaction with the EXACT same nonce and a significantly higher Gas Price / Priority Fee (>10-15%), replacing the stuck tx in miners\' queues.',
        ],
        [
            'text' => 'What are Layer 1 finality models? Compare probabilistic finality (Bitcoin Nakamoto 6-block confirmation) with deterministic finality (Tendermint / Ethereum Casper FFG).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Probabilistic finality means as blocks build on top of a transaction, the statistical likelihood of a deeper reorganization asymptotically approaches zero, but never reaches absolute zero. Deterministic finality means once two-thirds of validators commit on a checkpoint (Casper 2 epochs / 64-96 slots), the block cannot be reverted without slashing at least 33% of the entire staked supply.',
        ],
    ],
    'emerging_tech-blockchain-s3-set2' => [
        [
            'text' => 'How does gas optimization work in Solidity at the EVM opcode level? Explain the gas impact of SSTORE vs SLOAD, variable packing, and custom errors vs require strings.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'SLOAD costs 2,100 gas (cold) vs 100 gas (warm); caching state variables in stack memory saves thousands of gas in loops. Packing variables into single 32-byte slots reduces SSTOREs. Custom errors (`error Unauthorized(); revert Unauthorized();`) save significant deployment and execution gas by encoding a 4-byte selector instead of storing long ASCII strings in bytecode.',
        ],
        [
            'text' => 'Explain the mechanics of Decentralized Exchanges (DEX) using the Automated Market Maker (AMM) constant product formula: $x \\cdot y = k$. What is slippage and impermanent loss?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Constant product formula maintains pool product invariant $x \\cdot y = k$ after trades (taking swap fees). Slippage is price movement caused by order size relative to pool liquidity. Impermanent loss occurs when the external price ratio of pooled assets diverges from deposit ratio, leaving the LP with lower dollar value than simply holding outside the pool.',
        ],
        [
            'text' => 'What is EIP-712 typed structured data signing? Why is it superior to eth_sign or personal_sign for user security in permits and gasless meta-transactions?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '`eth_sign` signs arbitrary hex data, which malicious sites can trick users into signing raw transaction payloads blindly. EIP-712 standardizes human-readable typed data structuring (domain separator, type hashes, schema), so wallets display exact parameters (spender, value, deadline) clearly, enabling secure gasless permits (ERC-2612).',
        ],
        [
            'text' => 'How does ERC-4337 Account Abstraction work without requiring protocol-level Ethereum consensus changes? Explain Bundlers, EntryPoint contract, and Paymasters.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ERC-4337 replaces EOAs with smart contract wallets without changing L1 consensus. Users sign `UserOperation` structs sent to an alternate mempool. Bundlers package UserOperations and submit them to a global `EntryPoint` contract. `Paymaster` contracts can sponsor user gas (enabling gasless UX or paying gas in ERC-20 tokens).',
        ],
        [
            'text' => 'What is continuous integration and automated formal verification for smart contracts? How do tools like Slither (static analysis) and Certora / Halmos (symbolic execution) detect bugs?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Slither converts Solidity AST into intermediate representation (SlithIR) to run static analyses detecting known anti-patterns (uninitialized variables, reentrancy). Certora and Halmos use formal verification and SMT solvers to mathematically prove whether invariants (e.g. \'total minted tokens never exceeds total staked assets\') hold across all possible execution branches.',
        ],
    ],
    'emerging_tech-blockchain-s3-set3' => [
        [
            'text' => 'Design a secure, highly scalable cross-chain bridge architecture between Ethereum L1 and a standalone app-chain. How do you defend against relayer compromise and finality rollback?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Candidate should design light client state verification on both sides, or optimistic bridge with 7-day challenge periods and bonded watchers. Defend relayer compromise by requiring multi-party computation (MPC) with rotating threshold signatures (t-of-n) and on-chain rate limiters that throttle maximum hourly token withdrawals to cap potential exploit blast radius.',
        ],
        [
            'text' => 'Analyze the security vulnerabilities of Read-Only Reentrancy in DeFi protocols. How did the Curve/Euler Finance exploits unfold, and how can protocols protect view functions?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Occurs when a contract modifies internal balances and calls an external address; while write functions are protected by nonReentrant locks, `view` functions (like `get_virtual_price()`) return transiently corrupted values during mid-execution. Third-party lending protocols consuming this view function assess collateral at false valuations. Fix: apply reentrancy locks to view functions or use transient storage (EIP-1153) guards.',
        ],
        [
            'text' => 'Explain Data Availability (DA) in modular blockchain architectures. Compare Ethereum EIP-4844 (Proto-Danksharding) blob transactions with specialized DA layers like Celestia and EigenDA.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Modular blockchains decouple Execution (Rollups), Settlement, and Data Availability. EIP-4844 introduces transient \'data blobs\' on Ethereum pruned after ~18 days, drastically lowering rollup posting fees. Celestia provides a dedicated DA layer using 2D Reed-Solomon erasure coding and Data Availability Sampling (DAS), allowing light nodes to verify data availability with high probability without downloading full blocks.',
        ],
        [
            'text' => 'What is the architectural impact of EVM state bloat, and how does the Ethereum roadmap address history expiry (EIP-4444) and statelessness with Verkle Trees?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'The global state size grows continuously, increasing hardware requirements for archive and full validation nodes. History expiry (EIP-4444) stops serving historical receipts older than 1 year over the execution layer. Verkle trees replace Merkle Patricia tries, shrinking witness proof sizes from megabytes to sub-kilobytes, allowing stateless validators to verify blocks without storing global state locally.',
        ],
        [
            'text' => 'How does zero-knowledge proof aggregation work in recursive SNARKs (e.g. Halo2, Plonky2)? Why is recursion essential for building zk-EVMs and high-throughput zk-Rollups?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Recursive SNARKs verify one or more ZK proofs inside another ZK circuit, producing a single aggregated proof of proofs. This allows verifying thousands of individual block transactions or sub-circuits in parallel on different workers, then folding them into one final succinct proof verified on L1 for constant gas, eliminating verification bottlenecks.',
        ],
    ],
    'emerging_tech-quantum_computing-s1-set1' => [
        [
            'text' => 'What is a qubit, and how does it fundamentally differ from a classical bit? Explain quantum superposition using Dirac bra-ket notation ($|0\\rangle$ and $|1\\rangle$).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A classical bit is strictly deterministic 0 or 1. A qubit exists in a linear superposition $|\\psi\\rangle = lpha|0\\rangle + eta|1\\rangle$, where $lpha, eta \\in \\mathbb{C}$ and $|lpha|^2 + |eta|^2 = 1$. The probabilities of measuring outcome 0 or 1 are $|lpha|^2$ and $|eta|^2$ respectively.',
        ],
        [
            'text' => 'What happens during a quantum measurement? Explain wave function collapse and why quantum information cannot be read without disturbing the state.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Measurement projects a continuous superposition onto one of the orthonormal basis states ($|0\\rangle$ or $|1\\rangle$), irreversibly collapsing the quantum wave function. Because reading forces the state into an eigenstate, unmeasured quantum phase and superposition information is destroyed.',
        ],
        [
            'text' => 'Describe the Bloch Sphere representation of a single qubit. How do the polar angle $\\theta$ and azimuthal angle $\\phi$ map to quantum state amplitudes?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'The Bloch sphere is a unit sphere mapping $|\\psi\\rangle = \\cos(	heta/2)|0\\rangle + e^{i\\phi}\\sin(	heta/2)|1\\rangle$. The north pole represents $|0\\rangle$, the south pole $|1\\rangle$, and the equator contains equal superpositions ($|+\\rangle, |-\\rangle$). Any single-qubit quantum operation corresponds to a 3D rotation of the state vector.',
        ],
        [
            'text' => 'Explain the primary single-qubit quantum gates: Pauli-X, Pauli-Y, Pauli-Z, and the Hadamard (H) gate. What are their matrix representations and state transitions?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Pauli-X is a quantum NOT gate (flips $|0\\rangle \\leftrightarrow |1\\rangle$). Pauli-Z is a phase flip ($|1\\rangle 	o -|1\\rangle$). Hadamard gate creates equal superposition from computational basis: $H|0\\rangle = (|0\\rangle + |1\\rangle)/\\sqrt{2} = |+\\rangle$ and $H|1\\rangle = (|0\\rangle - |1\\rangle)/\\sqrt{2} = |-\\rangle$.',
        ],
        [
            'text' => 'What is quantum entanglement? Write the state of the canonical Bell state $|\\Phi^+\\rangle$ and explain why measuring one qubit instantly determines the other.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Entanglement is a quantum mechanical correlation where the composite quantum state cannot be factored into product states of individual subsystems: $|\\Phi^+\\rangle = (|00\\rangle + |11\\rangle)/\\sqrt{2}$. Measuring qubit A as 0 collapses the system so qubit B is measured as 0 with 100% certainty, regardless of spatial distance.',
        ],
    ],
    'emerging_tech-quantum_computing-s1-set2' => [
        [
            'text' => 'How is a CNOT (Controlled-NOT) gate defined? Construct a two-qubit quantum circuit that transforms $|00\\rangle$ into the maximally entangled Bell state $|\\Phi^+\\rangle$.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'CNOT flips the target qubit if and only if the control qubit is $|1\\rangle$. Circuit: apply Hadamard ($H$) to qubit 0 (creating $(|0\\rangle + |1\\rangle)/\\sqrt{2} \\otimes |0\\rangle = (|00\\rangle + |10\\rangle)/\\sqrt{2}$), then apply CNOT with qubit 0 as control and qubit 1 as target, yielding $(|00\\rangle + |11\\rangle)/\\sqrt{2}$.',
        ],
        [
            'text' => 'What is the No-Cloning Theorem in quantum mechanics? Why does it prevent creating an exact duplicate of an unknown quantum state, and what does it imply for quantum error correction?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Linearity of quantum unitary operators proves that no unitary operator $U$ can satisfy $U(|\\psiangle|0angle) = |\\psiangle|\\psiangle$ for arbitrary unknown $|\\psiangle$. Consequently, classical redundancy (copying bits $0 	o 000$) is impossible in quantum computing, necessitating indirect parity checks across entangled auxiliary qubits.',
        ],
        [
            'text' => 'Explain the Deutsch-Jozsa algorithm. What problem does it solve, and how does it achieve exponential speedup over classical deterministic algorithms?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Determines whether an oracle function $f: \\{0,1\\}^n 	o \\{0,1\\}$ is constant (returns same value for all inputs) or balanced (returns 0 for half, 1 for half). Classically requires up to $2^{n-1} + 1$ queries in the worst case; Deutsch-Jozsa solves it with exactly 1 quantum query using quantum parallelism and constructive/destructive phase interference.',
        ],
        [
            'text' => 'How does Grover\'s Search Algorithm work? Explain the two alternating operators: the Phase Inversion Oracle and the Grover Diffusion Operator (inversion about the mean).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Grover searches an unstructured database of $N$ items in $O(\\sqrt{N})$ time. The Oracle flips the phase of the marked target state ($|x^*angle 	o -|x^*angle$). The Diffusion operator performs reflection about the average amplitude ($2|sangle\\langle s| - I$), amplifying the marked state amplitude while suppressing non-target states.',
        ],
        [
            'text' => 'How do you construct and execute a basic quantum circuit using Qiskit in Python? Detail QuantumCircuit, adding gates, applying measurement, and running on AerSimulator.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Create `qc = QuantumCircuit(2, 2)`, call `qc.h(0)`, `qc.cx(0, 1)`, and `qc.measure([0,1], [0,1])`. Execute using `AerSimulator()`: `transpiled_qc = transpile(qc, simulator)`, `job = simulator.run(transpiled_qc, shots=1024)`, and extract measurement counts via `job.result().get_counts()`.',
        ],
    ],
    'emerging_tech-quantum_computing-s1-set3' => [
        [
            'text' => 'What is Quantum Decoherence? Explain relaxation time ($T_1$) and dephasing time ($T_2$), and how environmental thermal noise degrades quantum information.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '$T_1$ (longitudinal relaxation) is the time constant for an excited qubit $|1angle$ to decay energy to ground state $|0angle$. $T_2$ (transverse dephasing) is the time over which relative phase coherence between $|0angle$ and $|1angle$ is lost due to magnetic fluctuations. When gate execution times exceed coherence time, quantum calculations produce pure noise.',
        ],
        [
            'text' => 'Explain the Quantum Fourier Transform (QFT). What is its computational complexity compared to the classical Fast Fourier Transform (FFT), and what role does it play in Shor\'s algorithm?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'QFT transforms quantum state amplitudes into frequency space in $O(n^2)$ gate operations for $n$ qubits, compared to classical FFT $O(n 2^n)$. In Shor\'s algorithm, QFT efficiently extracts the periodicity $r$ of the modular exponentiation function $f(x) = a^x \\pmod N$, enabling polynomial time prime factorization.',
        ],
        [
            'text' => 'What is the NISQ (Noisy Intermediate-Scale Quantum) era? What are its limits (50-1000 qubits, lack of fault tolerance), and why are variational algorithms (VQE, QAOA) dominant today?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'NISQ refers to current devices with dozens to hundreds of physical qubits lacking full error correction. Circuits must have shallow depth before decoherence ruins results. Variational algorithms (VQE for chemistry, QAOA for optimization) use hybrid classical-quantum loops: quantum processor evaluates state energy on shallow ansatz, while classical optimizer updates parameters.',
        ],
        [
            'text' => 'Compare quantum complexity classes: BQP (Bounded-Error Quantum Polynomial Time) vs P, NP, and BPP. Can quantum computers solve all NP-complete problems in polynomial time?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'BQP encompasses decision problems solvable by a quantum computer in polynomial time with error probability $\\le 1/3$. $P \\subseteq BPP \\subseteq BQP$. It is widely believed that $NP 
ot\\subseteq BQP$; quantum computers do NOT provide exponential speedup for arbitrary NP-complete problems (e.g. 3-SAT), only quadratic speedup via Grover\'s algorithm.',
        ],
        [
            'text' => 'What is the quantum threat to modern cryptography (RSA, ECC)? What is Post-Quantum Cryptography (PQC), and why are lattice-based algorithms (like CRYSTALS-Kyber/Dilithium) immune to Shor\'s algorithm?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Shor\'s algorithm solves discrete log and integer factorization in polynomial time, breaking RSA and Elliptic Curve Diffie-Hellman. Post-Quantum Cryptography relies on hard mathematical problems with no known quantum period-finding advantage, such as Learning With Errors (LWE) and shortest vector problems in high-dimensional lattices.',
        ],
    ],
    'emerging_tech-quantum_computing-s2-set1' => [
        [
            'text' => 'Explain the difference between a pure quantum state and a mixed quantum state. How is the Density Matrix $\\rho$ defined, and how do you calculate $\\text{Tr}(\\rho^2)$ to verify purity?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A pure state is represented by a single state vector $|\\psiangle$ with density matrix $ho = |\\psiangle\\langle\\psi|$ and $	ext{Tr}(ho^2) = 1$. A mixed state represents a statistical ensemble of pure states $ho = \\sum p_i |\\psi_iangle\\langle\\psi_i|$ with $	ext{Tr}(ho^2) < 1$. Mixed states occur when a subsystem is entangled with an unmeasured environment.',
        ],
        [
            'text' => 'What is Quantum Phase Kickback? Explain how applying a controlled unitary gate to a target qubit in state $|-angle$ transfers phase information back to the control qubit.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'When an operator $U$ acts on an eigenstate $|vangle$ with eigenvalue $e^{i	heta}$ ($U|vangle = e^{i	heta}|vangle$), a controlled-$U$ gate where target is $|vangle$ leaves target invariant and multiplies the control qubit\'s $|1angle$ component by $e^{i	heta}$. This transfers eigenvalue phase into the control qubit\'s interference profile.',
        ],
        [
            'text' => 'Explain the Quantum Phase Estimation (QPE) algorithm. What are its inputs, circuit components, and how does it determine the unknown phase $\\theta$ of unitary operator $U$?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'QPE estimates eigenvalue phase $	heta$ where $U|\\psiangle = e^{2\\pi i 	heta}|\\psiangle$. Circuit consists of $t$ evaluation qubits initialized with Hadamards, successive controlled-$U^{2^j}$ operations inducing phase kickback onto evaluation qubits, followed by an Inverse Quantum Fourier Transform ($QFT^\\dagger$) and computational measurement of the $t$ qubits.',
        ],
        [
            'text' => 'Compare the physical implementations of qubits: Superconducting Transmon qubits (IBM, Google) vs Trapped Ion qubits (IonQ) vs Photonic qubits (Xanadu).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Superconducting: Josephson junctions on chip, very fast gate speeds (nanoseconds), but require millikelvin dilution refrigerators and suffer short coherence times ($T_2 \\sim 100\\mu s$). Trapped ions: individual ions suspended by RF traps, near-perfect fidelity and long coherence (seconds/hours), all-to-all connectivity, but slower gate times. Photonic: room temperature, high speed, but challenging deterministic two-qubit entangling gates.',
        ],
        [
            'text' => 'What is the SWAP gate and Toffoli (CCNOT) gate? How are they decomposed into fundamental single-qubit rotations and CNOT gates?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'SWAP exchanges two qubit states; decomposed into 3 alternating CNOT gates: `cx(0,1); cx(1,0); cx(0,1)`. Toffoli is a 3-qubit controlled-controlled-NOT gate; standard decomposition requires at least 6 CNOT gates along with single-qubit $T$, $T^\\dagger$, and Hadamard gates.',
        ],
    ],
    'emerging_tech-quantum_computing-s2-set2' => [
        [
            'text' => 'Explain the Variational Quantum Eigensolver (VQE) algorithm. How does the Rayleigh-Ritz variational principle guarantee an upper bound on ground state molecular energy?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Variational principle states $\\langle\\psi(ec{	heta})|H|\\psi(ec{	heta})angle \\ge E_0$, meaning expectation value of Hamiltonian $H$ with parameterized ansatz state $|\\psi(ec{	heta})angle$ is always $\\ge$ true ground state energy $E_0$. Quantum computer measures terms in decomposed Hamiltonian; classical optimizer updates parameters $ec{	heta}$ to minimize energy.',
        ],
        [
            'text' => 'What is the Barren Plateau problem in variational quantum machine learning and optimization? How does gradient vanishing occur in deep random parameterized circuits?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'As the number of qubits $n$ increases, the variance of the gradients of parameterized quantum circuits vanishes exponentially ($	ext{Var}[\\partial C / \\partial 	heta] \\in O(2^{-n})$) when states form 2-designs under Haar-random distribution. Mitigations include shallow depth circuits, local cost functions, and physics-informed ansatz design.',
        ],
        [
            'text' => 'How does Quantum Approximate Optimization Algorithm (QAOA) solve combinatorial graph problems like Max-Cut? Explain the Problem Hamiltonian $H_C$ and Mixer Hamiltonian $H_B$.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Encodes problem cost function into diagonal Hamiltonian $H_C = \\sum C(x)|xangle\\langle x|$ and uses non-commuting transverse field mixer $H_B = \\sum X_i$. Circuit applies alternating unitary layers $e^{-ieta H_B} e^{-i\\gamma H_C}$ to equal superposition, iteratively tuning $ec{\\gamma}, ec{eta}$ via classical optimizer to sample high-weight graph cuts.',
        ],
        [
            'text' => 'Explain Quantum State Tomography (QST) and Quantum Process Tomography. Why does full state tomography scale exponentially ($4^n - 1$ measurements) with qubit count?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'QST reconstructs unknown density matrix $ho$ by repeatedly preparing state and measuring across non-commuting Pauli bases ($X, Y, Z$). Because an $n$-qubit density matrix has $4^n - 1$ independent real parameters, full characterization scales exponentially, making state tomography intractable beyond 8-10 qubits (replaced by Randomized Benchmarking).',
        ],
        [
            'text' => 'How does circuit compilation and transpilation work in Qiskit? Explain gate basis transformation, qubit routing, and swap insertion for constrained hardware coupling maps.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Transpiler transforms abstract algorithmic circuits into physical hardware constraints. 1) Unrolls gates into target backend\'s native basis (e.g. `[cx, id, rz, sx, x]`); 2) Maps virtual qubits to physical qubits; 3) Inserts SWAP gates to satisfy physical hardware coupling graph (routing); 4) Optimizes gate sequences by canceling adjacent self-inverse gates.',
        ],
    ],
    'emerging_tech-quantum_computing-s2-set3' => [
        [
            'text' => 'Explain the Quantum Surface Code for fault-tolerant quantum computing. How do data qubits and syndrome (measure) qubits detect bit-flip ($X$) and phase-flip ($Z$) errors without collapsing data?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Data qubits reside on vertices of a 2D square lattice; syndrome qubits reside on faces ($Z$-stabilizers) and vertices ($X$-stabilizers). Measuring syndrome operators measures multi-qubit parities ($\\sigma_z \\otimes \\sigma_z \\otimes \\sigma_z \\otimes \\sigma_z$ and $\\sigma_x^{\\otimes 4}$), revealing error locations without collapsing superposition of data states.',
        ],
        [
            'text' => 'What is the Fault-Tolerance Threshold Theorem? What physical error rate per gate (e.g. 1% for surface code) is required before adding qubits reduces net logical error rate?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'States that if physical gate error rate is below a critical threshold $p_{th}$ ($\\sim 1\\%$ for surface code, $\\sim 10^{-4}$ for concatenation), arbitrarily long quantum computations can be executed with arbitrary accuracy by increasing code distance $d$. If physical error rate exceeds threshold, adding physical qubits increases overall logical error.',
        ],
        [
            'text' => 'Explain Magic State Distillation. Why is the Clifford group alone insufficient for universal quantum computing (Gottesman-Knill theorem), and how do $T$ gates achieve universality?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Gottesman-Knill theorem proves quantum circuits containing only Clifford gates (H, S, CNOT, Pauli) can be simulated efficiently in polynomial time on classical computers. Universal quantum computing requires a non-Clifford gate (such as the $T = 	ext{diag}(1, e^{i\\pi/4})$ gate). Fault-tolerant systems create noisy non-Clifford \'magic states\' and purify them via iterative distillation circuits.',
        ],
        [
            'text' => 'What is Quantum Teleportation? Walk through the protocol step-by-step: shared Bell pair, Bell measurement, classical communication, and Pauli correction.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Alice wants to send unknown state $|\\psiangle$ to Bob. 1) Alice and Bob share entangled pair $(|00angle + |11angle)/\\sqrt{2}$. 2) Alice performs Bell state measurement on $|\\psiangle$ and her half of the pair. 3) Alice transmits the 2 classical measurement bits to Bob. 4) Bob applies corresponding Pauli correction ($I, X, Z, 	ext{or } XZ$) to his qubit, perfectly recovering $|\\psiangle$.',
        ],
        [
            'text' => 'How does Quantum Key Distribution (QKD) work in the BB84 protocol? How does Heisenberg\'s uncertainty principle detect eavesdropping (Eve) on the quantum channel?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Alice sends single photons randomly encoded in computational ($Z$: $\\{|0angle, |1angle\\}$) or diagonal ($X$: $\\{|+angle, |-angle\\}$) bases. Bob measures in randomly chosen bases. Over classical channel, they compare bases and keep matching bits. If Eve intercepts, measuring in the wrong basis inevitably introduces a 25% error rate on sifted keys, exposing the interceptor immediately.',
        ],
    ],
    'emerging_tech-quantum_computing-s3-set1' => [
        [
            'text' => 'Explain the mathematical formulation of Quantum Operators as Unitary Matrices. Why must closed quantum system evolution be unitary ($U^\\dagger U = I$), and how does it preserve probability conservation?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Total probability $\\langle\\psi|\\psiangle = 1$ must be conserved over time. Evolving state $|\\psi(t)angle = U|\\psi(0)angle$ gives $\\langle\\psi(t)|\\psi(t)angle = \\langle\\psi(0)|U^\\dagger U|\\psi(0)angle = 1$, which strictly requires $U^\\dagger U = I$. Unitarity guarantees time-reversibility and preservation of inner products.',
        ],
        [
            'text' => 'What is the Schmidt Decomposition of a bipartite quantum state? How do the Schmidt coefficients quantify the degree of entanglement between systems $A$ and $B$?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Any pure bipartite state $|\\psi_{AB}angle$ can be written as $\\sum_{i} \\lambda_i |u_iangle_A |v_iangle_B$, where $\\lambda_i \\ge 0$ and $\\sum \\lambda_i^2 = 1$. The number of non-zero Schmidt coefficients (Schmidt rank) measures entanglement: rank 1 means the state is separable (unentangled); rank $>1$ indicates entanglement, quantified by von Neumann entropy $S = -\\sum \\lambda_i^2 \\log(\\lambda_i^2)$.',
        ],
        [
            'text' => 'What is the Solovay-Kitaev Theorem? What does it state regarding the efficient approximation of arbitrary single-qubit unitary operations using a finite universal gate set?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Proves that any arbitrary single-qubit unitary $U$ can be approximated to within precision $\\epsilon$ using a sequence of $O(\\log^c(1/\\epsilon))$ gates ($c pprox 3.97$) drawn from a finite universal gate set (such as $\\{H, T\\}$). This guarantees that compiling arbitrary continuous rotation angles onto discrete fault-tolerant gates requires only poly-logarithmic overhead.',
        ],
        [
            'text' => 'Explain the difference between Analog Quantum Simulation (e.g. Rydberg atoms, cold atoms) and Digital Quantum Simulation (Trotterized circuits).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Analog simulation tunes the physical interaction Hamiltonian of the experimental apparatus (e.g. laser-trapped neutral atom arrays) to directly emulate the target physical system\'s dynamics. Digital simulation maps the Hamiltonian onto discrete qubits and decomposes time-evolution operator $e^{-iHt}$ into discrete quantum gates using Suzuki-Trotter product formulas.',
        ],
        [
            'text' => 'What is Randomized Benchmarking (RB) in quantum hardware characterization? Why is it superior to quantum process tomography for measuring average Clifford gate fidelity?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'RB applies sequences of random Clifford gates of increasing length $m$, followed by an inversion gate returning the system to ground state. Measuring survival probability as a function of $m$ produces an exponential decay curve whose rate isolates physical gate error per Clifford without confounding state-preparation and measurement (SPAM) errors.',
        ],
    ],
    'emerging_tech-quantum_computing-s3-set2' => [
        [
            'text' => 'Explain the Suzuki-Trotter decomposition for quantum Hamiltonian simulation. What is Trotter error, and how does the Baker-Campbell-Hausdorff (BCH) formula explain the non-commuting operator error?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'For non-commuting Hamiltonians $H = A + B$ where $[A,B] 
eq 0$, $e^{i(A+B)t} 
eq e^{iAt}e^{iBt}$. First-order Trotter approximates $e^{i(A+B)t} pprox (e^{iAt/r} e^{iBt/r})^r$. The BCH formula reveals Trotterization error scales as $O(t^2/r [A,B])$; higher-order symmetric Trotter formulas cancel odd-order commutators, reducing circuit depth for given error bounds.',
        ],
        [
            'text' => 'How does Jordan-Wigner transformation map fermionic creation and annihilation operators to Pauli spin matrices for molecular electronic structure simulation?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Fermions obey anti-commutation relations $\\{c_i, c_j^\\dagger\\} = \\delta_{ij}$. Jordan-Wigner maps fermionic operators to qubit operators by attaching a string of Pauli $Z$ operators ($c_j^\\dagger = rac{1}{2}(X_j - iY_j) igotimes_{k<j} Z_k$) to enforce anti-symmetry, transforming molecular electronic Hamiltonians into sums of Pauli strings computable on quantum hardware.',
        ],
        [
            'text' => 'What is Quantum Error Mitigation (QEM) in NISQ hardware? Compare Zero-Noise Extrapolation (ZNE) with Probabilistic Error Cancellation (PEC).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'QEM extracts error-mitigated expectation values without full fault-tolerant logical qubits. Zero-Noise Extrapolation (ZNE) intentionally amplifies hardware noise (via pulse stretching or gate insertion) at noise factors $\\lambda = 1, 3, 5$, then fits a curve extrapolating back to zero noise ($\\lambda 	o 0$). PEC characterizes noise models and samples inverted quasi-probability gate distributions.',
        ],
        [
            'text' => 'Explain the stabilizer formalism for quantum error correction. How do stabilizer generators $S_i$ define a logical code subspace $\\mathcal{C} = \\{|\\psi\\rangle : S_i|\\psi\\rangle = |\\psi\\rangle\\}$?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A stabilizer group $\\mathcal{S}$ is an abelian subgroup of the $n$-qubit Pauli group not containing $-I$. The code space is the simultaneous $+1$ eigenspace of all generators. An error $E$ anti-commuting with generator $S_i$ flips the measurement eigenvalue from $+1$ to $-1$ ($S_i E |\\psiangle = -E S_i |\\psiangle = -E|\\psiangle$), yielding an error syndrome.',
        ],
        [
            'text' => 'What is Quantum Supremacy / Quantum Advantage? Analyze the Google Sycamore (random circuit sampling) experiment and the classical counter-arguments (tensor networks).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Demonstrating a programmable quantum processor performing a computational task intractable on world-class supercomputers. Sycamore sampled output distributions of 53-qubit pseudo-random circuits in 200 seconds (claiming 10,000 years for classical). Classical researchers quickly countered by optimizing tensor network contraction algorithms, reducing classical simulation to days.',
        ],
    ],
    'emerging_tech-quantum_computing-s3-set3' => [
        [
            'text' => 'Architect a fault-tolerant quantum computing system running Shor\'s algorithm to factor a 2048-bit RSA key. Calculate physical qubit requirements and error thresholds under surface code.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Factoring 2048-bit RSA requires $\\sim 4,000$ logical qubits and $\\sim 10^9$ logical $T$ gates. Under surface code with physical error rate $10^{-3}$, each logical qubit requires a code distance $d pprox 27-31$ ($\\sim 2d^2 pprox 1,500-2,000$ physical data and syndrome qubits). Including magic state distillation factories, the system requires $\\sim 4-8$ million physical qubits running continuously for several hours/days.',
        ],
        [
            'text' => 'Compare Block Encoding and Quantum Singular Value Transformation (QSVT). Why is QSVT considered a grand unifying framework for quantum algorithms?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Block encoding embeds a non-unitary matrix $A$ into the upper-left block of a larger unitary matrix $U$. QSVT applies polynomial transformations to the singular values of $A$ using sequences of alternating project-controlled rotations. It unifies Grover search, Hamiltonian simulation, matrix inversion (HHL), and quantum walks as special polynomial instances of QSVT.',
        ],
        [
            'text' => 'Explain the Quantum Walk algorithm. Compare Continuous-Time Quantum Walk (CTQW) with Discrete-Time Quantum Walk (DTQW), and detail the speedup over classical random walks.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Classical random walks disperse with distance $\\sigma \\propto \\sqrt{t}$. Quantum walks disperse quadratically faster ($\\sigma \\propto t$) due to coherent wave interference. CTQW evolves continuously under graph adjacency Hamiltonian $e^{-iAt}$. DTQW introduces a coin Hilbert space and shift operator, enabling quadratic and exponential speedups in spatial search and graph traversal algorithms.',
        ],
        [
            'text' => 'What are the engineering bottlenecks in scaling physical quantum hardware from 1,000 to 1,000,000 qubits? Analyze cryogenic wiring, RF crosstalk, and classical control electronics.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Bottlenecks: 1) Thermal heat loads from individual coaxial RF cables down dilution fridges at 15 mK; 2) Microwave crosstalk and capacitive parasitic coupling between tightly packed transmons; 3) Routing classical control electronics on-chip using cryogenic CMOS or optical interconnects; 4) Real-time sub-microsecond syndrome decoding for active error correction feedback loops.',
        ],
        [
            'text' => 'Design a hybrid enterprise quantum-classical pipeline for financial portfolio optimization or drug discovery. How do classical data ingestion, quantum kernel estimation, and classical inference interface?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Classical preprocessing normalizes high-dimensional feature vectors. Quantum processor maps features into exponentially large Hilbert space via parameterized quantum feature maps (ZZFeatureMap) to compute Quantum Kernel matrices. The resulting kernel matrix is passed back to a classical Support Vector Machine (SVM) for classification or optimization, bypassing NISQ optimizer barren plateaus.',
        ],
    ],
    'digital_marketing-digital_marketing-s1-set1' => [
        [
            'text' => 'Analyze a multi-stage e-commerce funnel experiencing an acute 65% drop-off between \'Initiate Checkout\' and \'Purchase Completed\' while top-of-funnel traffic remains strong. Walk through your step-by-step diagnostic workflow across UX friction, shipping cost transparency, payment gateway error rates, and checkout abandonment email automations.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Candidate should outline structured investigation: 1) Technical validation (inspect payment gateway webhook failures, 3D Secure drop-offs, JS console errors on checkout); 2) User experience friction (unexpected shipping costs revealed only at final step, forced account creation vs guest checkout, redundant form fields); 3) Device segmentation (mobile vs desktop checkout conversion parity); 4) Recovery mechanics (deploying 1-hour and 24-hour dynamic cart abandonment emails with direct checkout links).',
        ],
        [
            'text' => 'How do ad auction algorithms work in Google Ads and Meta Ads? Explain how Quality Score (in Google) or Total Value (in Meta: Bid $\\times$ Estimated Action Rate + User Value) determine actual Cost Per Click, and why higher creative relevance allows an advertiser to win impressions at lower bids than competitors.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Ad networks run generalized second-price auctions. In Google, Ad Rank = Bid * Quality Score (Expected CTR, Ad Relevance, Landing Page Experience); an ad with Quality Score 10 pays significantly lower CPC than one with QS 4 for the same position. In Meta, auction winner maximizes Total Value = V_bid * p_action + V_quality; creative relevance and engagement velocity directly lower effective CPMs.',
        ],
        [
            'text' => 'Explain the core digital marketing performance metrics: CAC (Customer Acquisition Cost), LTV (Customer Lifetime Value), and ROAS (Return on Ad Spend). What is an ideal LTV:CAC ratio?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'CAC = Total sales and marketing spend divided by new customers acquired. LTV = Average revenue per customer $\\times$ gross margin $\\times$ average retention lifespan. ROAS = Revenue generated from advertising divided by advertising cost. A healthy benchmark for sustainable SaaS/e-commerce businesses is an LTV:CAC ratio of 3:1 or higher.',
        ],
        [
            'text' => 'Compare manual CPC bidding with algorithmic smart bidding strategies: Target CPA (tCPA), Target ROAS (tROAS), and Maximize Conversions. What minimum conversion data volume (e.g. 30-50 conversions/month) is required before switching to automated value-based bidding, and what happens when budgets are changed abruptly?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Manual CPC sets fixed click bids; smart bidding uses machine learning evaluating real-time auction signals (device, location, time, browser history). Target CPA optimizes volume at target cost per lead; Target ROAS bids higher for users predicted to have larger basket sizes. Switching requires sufficient baseline conversion history (>=30-50 conversions/month per campaign); changing budgets by >20% resets algorithm back into volatile \'Learning Phase\'.',
        ],
        [
            'text' => 'What are the essential technical foundations of Email Marketing deliverability? Explain SPF, DKIM, and DMARC records and why missing them hurts inbox placement.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'SPF (Sender Policy Framework) lists authorized IP addresses in DNS. DKIM (DomainKeys Identified Mail) attaches a cryptographic public/private key signature verifying email content hasn\'t been altered in transit. DMARC aligns SPF/DKIM and instructs receiving servers how to handle failures (`none`, `quarantine`, `reject`). Without them, mailbox providers (Gmail/Yahoo) route messages to Spam.',
        ],
    ],
    'digital_marketing-digital_marketing-s1-set2' => [
        [
            'text' => 'How does campaign hierarchy work in Google Ads and Meta Ads Manager? Explain Account > Campaign > Ad Set / Ad Group > Ad levels.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Account level governs billing and administrative rights. Campaign level sets the primary business objective (Sales, Leads, Traffic) and macro budget (in CBO/Advantage+). Ad Set / Ad Group governs audience targeting, placements, geographic location, scheduling, and bids. Ad level contains creative assets (headlines, copy, videos, destination URLs).',
        ],
        [
            'text' => 'Explain how A/B Split Testing works in digital advertising. What rules must be followed regarding sample size, statistical significance, and isolating a single variable?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Only change ONE variable at a time (e.g. headline vs hero image vs CTA button) while keeping audience and budget identical. Run until reaching statistical significance (typically 95% confidence level with $p < 0.05$) across a sufficient sample size of conversions (minimum 100-200 conversions per variant) to eliminate random noise.',
        ],
        [
            'text' => 'What are UTM parameters? Break down the five standard UTM tags (utm_source, utm_medium, utm_campaign, utm_term, utm_content) and show a fully tagged URL.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'UTMs are query string parameters appended to URLs for analytics attribution. `utm_source` (platform, e.g. newsletter), `utm_medium` (channel type, e.g. email, cpc), `utm_campaign` (campaign name, e.g. summer_launch), `utm_term` (keyword for paid search), `utm_content` (creative variant, e.g. blue_button). Example: `https://site.com/pricing?utm_source=linkedin&utm_medium=cpc&utm_campaign=q3_growth&utm_content=v2_video`.',
        ],
        [
            'text' => 'How does Google Analytics 4 (GA4) event-based tracking differ from legacy Universal Analytics session-based model? Explain events, parameters, and user properties.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Universal Analytics relied on hits grouped into sessions and pageviews. GA4 is strictly event-based: every interaction (page_view, scroll, click, purchase) is an event with key-value parameters. User properties store persistent demographic and behavioral traits (e.g. `subscription_tier: enterprise`). This unified model tracks web and mobile apps seamlessly.',
        ],
        [
            'text' => 'What is Retargeting / Remarketing? How do browser pixels or server-side Conversion APIs (CAPI) track abandoned carts and serve tailored dynamic ads?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Targets users who visited a website or initiated a checkout without completing purchase. Pixels and Server CAPI track custom events (`AddToCart`) linked to hashed user IDs/emails. The ad platform dynamically populates product catalog creatives showing the exact item left in the cart to prompt return and purchase.',
        ],
    ],
    'digital_marketing-digital_marketing-s1-set3' => [
        [
            'text' => 'Compare Multi-Touch Attribution models: First-Touch, Last-Touch, Linear, Time-Decay, and Data-Driven Attribution. What are the blind spots of Last-Touch attribution?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Last-touch assigns 100% revenue credit to the final clicked link, over-crediting branded search and retargeting while starving top-of-funnel channels (display, organic social, podcasts) that initially introduced the brand. Data-Driven Attribution (DDA) uses machine learning to evaluate fractional incremental contribution across the entire touchpoint path.',
        ],
        [
            'text' => 'How did Apple\'s iOS 14.5 App Tracking Transparency (ATT) update disrupt digital advertising attribution? What is SKAdNetwork and Server-Side Tagging?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ATT required users to opt in to cross-app IDFA tracking, causing over 80% to opt out and blinding Meta/TikTok client-side pixels. Apple introduced SKAdNetwork (SKAN) for aggregated, delayed, privacy-preserving attribution without device IDs. Advertisers adapted by deploying server-side tagging (GTM Server-Side + Meta CAPI) to match conversions via first-party server data.',
        ],
        [
            'text' => 'You notice a 40% drop in overall e-commerce conversion rate while advertising traffic and ad spend remain constant. Walk through your step-by-step diagnostic workflow.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Segment traffic by channel and device (did mobile conversion collapse due to a broken responsive layout?); 2) Check technical health (page load speed, 5xx server errors, broken payment gateway or checkout JS); 3) Inspect traffic quality (did ad campaigns shift to low-intent audience or fraudulent display network clicks?); 4) Check pricing, shipping fees, or coupon code bugs.',
        ],
        [
            'text' => 'Explain Marketing Mix Modeling (MMM). How does it use statistical regression to evaluate marketing efficiency without relying on cookies or individual user tracking?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'MMM uses multivariable econometric regression (e.g. Robyn, LightweightMMM) on aggregate historical data (sales revenue, ad spend by channel, seasonality, promotions, macroeconomic trends). It incorporates adstock decay (lingering brand effects) and diminishing returns curves to compute channel elasticity without tracking individual cookies.',
        ],
        [
            'text' => 'How do you calculate Payback Period on Customer Acquisition Cost? Why is a 6-month CAC payback period superior to a 24-month payback period for venture-backed growth?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'CAC Payback Period = $	ext{CAC} / (	ext{Monthly Gross Profit per Customer})$. A 6-month payback recoups cash quickly, allowing that capital to be recycled into new marketing spend 2x a year, accelerating self-funded compounding growth and reducing working capital risk compared to a 24-month payback that burns cash reserves.',
        ],
    ],
    'digital_marketing-digital_marketing-s2-set1' => [
        [
            'text' => 'What is a Customer Persona (Ideal Customer Profile)? What demographic, psychographic, and behavioral data points must be gathered to build one?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Demographics: age, job title, company size, annual income, location. Psychographics: professional goals, core values, primary fears, business aspirations. Behavioral data: media consumption channels, software tool stack, purchase decision criteria, and primary pain points preventing them from hitting their quarterly KPIs.',
        ],
        [
            'text' => 'Explain the difference between Owned, Earned, and Paid media. How do these three media types interact in an omnichannel growth strategy?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Owned: digital properties under brand control (website, blog, email list). Paid: promotional distribution paid for (Google Ads, Meta ads, sponsorships). Earned: public word-of-mouth and PR acquired organically (press coverage, customer tweets, viral reviews). Strategy: Paid media drives initial audience into Owned media, which nurtures loyalty and generates Earned advocacy.',
        ],
        [
            'text' => 'What is Bounce Rate in web analytics? How has GA4 redefined bounce rate compared to Universal Analytics (Engaged Sessions vs 0-second pageviews)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'UA defined bounce rate as single-page sessions with zero interaction hits. GA4 inverted this to \'Engagement Rate\': sessions lasting $>10$ seconds, containing $\\ge 2$ page views, or triggering $\\ge 1$ conversion event. GA4 Bounce Rate is simply $100\\% - 	ext{Engagement Rate}$, eliminating false bounces where a user reads a long article for 5 minutes and leaves satisfied.',
        ],
        [
            'text' => 'Explain Value Proposition and Positioning in marketing. How does a strong value proposition reduce Customer Acquisition Cost across cold ad traffic?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Positioning defines where the product stands in the prospect\'s mind relative to alternatives. A strong value proposition states clearly: 1) Who it is for; 2) What specific painful problem it solves; 3) How it is uniquely superior to competitors. Clear messaging increases click-through and landing page conversion rates, directly lowering blended CAC.',
        ],
        [
            'text' => 'What is Lead Scoring in CRM systems (HubSpot/Salesforce)? Differentiate explicit criteria vs implicit behavioral criteria.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Lead scoring assigns numerical points to rank prospect sales readiness. Explicit criteria: user-provided demographic data (e.g. VP title = +20 pts, enterprise company size = +30 pts, student = -50 pts). Implicit criteria: tracked digital behaviors (e.g. visited pricing page 3 times = +25 pts, downloaded whitepaper = +10 pts, inactive for 30 days = -15 pts).',
        ],
    ],
    'digital_marketing-digital_marketing-s2-set2' => [
        [
            'text' => 'Explain Google Ads Quality Score. What three components dictate Quality Score (Expected CTR, Ad Relevance, Landing Page Experience), and how does it lower actual CPC?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Quality Score (1-10) measures ad relevance compared to competing advertisers. Ad Rank = Bid $	imes$ Quality Score. Higher Quality Score enables advertisers to win top ad positions at significantly lower actual Cost Per Click than competitors with higher bids but lower relevance.',
        ],
        [
            'text' => 'Compare Broad Match, Phrase Match, and Exact Match keyword types in Google Ads. How do Negative Keywords prevent ad budget waste?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Exact match (`[keyword]`) triggers only queries with exact meaning. Phrase match (`"keyword"`) triggers searches containing the core phrase meaning. Broad match (`keyword`) triggers related concepts and intent evaluated by Google AI. Negative keywords exclude unwanted terms (e.g. \'free\', \'jobs\', \'crack\'), preventing wasted spend on non-commercial clicks.',
        ],
        [
            'text' => 'How does Meta\'s Advantage+ Shopping Campaigns (ASC) algorithm work compared to manual interest/lookalike audience targeting?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Manual campaigns require setting granular age, interest, and lookalike segments. Advantage+ Shopping uses broad targeting paired with machine learning, testing combinations of up to 150 creative assets across entire platform placements, dynamically allocating spend to highest-converting audiences while capping existing customer spend.',
        ],
        [
            'text' => 'What is Conversion Rate Optimization (CRO)? Explain how heatmaps, session recordings (Hotjar/FullStory), and user friction analysis inform landing page redesigns.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'CRO improves the percentage of site visitors completing a desired action. Heatmaps show click density and scroll depth; session recordings reveal user confusion (rage clicks, dead clicks, form abandonment). Identifying friction points (excessive form fields, unclear CTAs, slow load times) guides hypothesis-driven A/B testing.',
        ],
        [
            'text' => 'Explain the mechanics of automated Email Nurture Sequences (Drip Campaigns). How do you design an onboarding sequence to maximize product activation?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Day 0: Welcome email + immediate value/login link. Day 1: Single core product feature tutorial driving the primary \'Aha!\' moment. Day 3: Case study demonstrating customer transformation. Day 5: Overcoming common objections or offering live onboarding support. Day 7: Urgent call to upgrade before trial expiration.',
        ],
    ],
    'digital_marketing-digital_marketing-s2-set3' => [
        [
            'text' => 'How do you manage diminishing returns when scaling ad spend from $10,000/month to $100,000/month on a single platform? What is ad fatigue and audience saturation?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'As spend increases, the ad algorithm exhausts the highest-intent audience subset and expands into colder prospects, increasing frequency and lowering CTR (ad fatigue). Solutions: 1) High-volume creative testing (refreshing angles, hooks, formats weekly); 2) Expanding target market horizontally (new personas); 3) Diversifying to complementary channels (TikTok, Google Search, YouTube).',
        ],
        [
            'text' => 'Explain Google Consent Mode v2 and its role in European privacy compliance (GDPR/ePrivacy). What are the differences between Basic and Advanced consent mode?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Consent Mode communicates user cookie consent state to Google tags. In Basic mode, tags are completely blocked until consent is granted. In Advanced mode, tags load immediately; if user denies consent, tags transmit cookieless pings without persistent identifiers, allowing Google to use behavioral modeling to recover lost conversion data.',
        ],
        [
            'text' => 'What is Customer Churn Rate? Compare Gross Revenue Churn vs Net Revenue Churn in SaaS marketing. Why can Net Revenue Churn be negative, and why is negative churn the Holy Grail?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Gross Churn measures percentage of recurring revenue lost to cancellations/downgrades. Net Churn = $[(	ext{Lost ARR} - 	ext{Expansion/Upsell ARR}) / 	ext{Starting ARR}] 	imes 100\\%$. If expansion revenue from existing customers exceeds churned revenue, Net Churn becomes negative ($<0\\%$), meaning company revenue grows automatically each year even without acquiring a single new customer.',
        ],
        [
            'text' => 'Explain Incrementality Testing and Geo-lift experiments in paid media. Why are A/B holdout groups necessary to measure true advertising lift?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Attribution reports often count conversions that would have occurred anyway organically (e.g. branded search clicks). Incrementality testing designates matched geographic regions: test markets receive advertising while control markets receive zero ads. Comparing net lift between markets isolates true causal incremental revenue generated by ad spend.',
        ],
        [
            'text' => 'How do you build a comprehensive Digital Marketing Budget allocation across channels for an early-stage B2B SaaS company aiming for $1M ARR?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Allocate 50% to high-intent capturing channels (Google Search for problem/solution keywords, LinkedIn targeted account ads); 30% to content and SEO foundation (evergreen guides, comparison pages, technical articles) for sustainable compounding organic pipeline; 20% to experimentation (podcast sponsorships, influencer collaborations, webinars) while maintaining tight feedback loops on lead-to-opportunity conversion rates.',
        ],
    ],
    'digital_marketing-digital_marketing-s3-set1' => [
        [
            'text' => 'What is Customer Segmentation? Compare demographic, behavioral, geographic, and RFM (Recency, Frequency, Monetary) segmentation in e-commerce.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'RFM segmentation scores customers on: Recency (how recently did they buy?), Frequency (how often do they purchase?), and Monetary value (total spend). Identifies segments: Champions (reward with VIP perks), At-Risk customers (re-engage with winback offers), and Hibernating churn risks (discount clearance campaigns).',
        ],
        [
            'text' => 'Explain the difference between Organic Social Media strategy and Paid Social Media strategy. Why has organic reach declined on Meta/Instagram, and how do brands adapt?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Organic social builds community, customer advocacy, and brand voice. Paid social scales predictable, targeted customer acquisition. Organic reach declined because platforms prioritize paid ad inventory and algorithmic engagement (Reels/TikTok). Brands adapt by partnering with UGC creators and utilizing Spark Ads / Whitelisting to amplify top organic posts.',
        ],
        [
            'text' => 'What is Affiliate Marketing? Explain how affiliate tracking networks, cookie durations, rev-share vs CPA payouts, and coupon site leakage work.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Affiliates promote products and receive commission on sales via unique tracking links and first-party cookies (e.g. 30-day window). Rev-share pays percentage of order value; CPA pays flat fee per sign-up. Coupon site leakage occurs when coupon aggregators rank for \'[Brand] coupon\' and steal last-click attribution on users already in the checkout funnel.',
        ],
        [
            'text' => 'Explain Content Marketing ROI. Why does high-quality technical content compound over time, whereas paid ads cease providing value the moment spend is cut?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Paid ads are ephemeral: traffic stops the instant spending ceases. In contrast, high-authority content ranks in search engines, continuing to generate qualified organic visits, backlinks, and brand authority for years at near-zero marginal ongoing cost, driving down blended CAC over time.',
        ],
        [
            'text' => 'What is Brand Sentiment Analysis? How do social listening tools (e.g. Brandwatch, Sprout Social) analyze Natural Language Processing (NLP) to detect brand reputation shifts?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Scrapes social platforms, review sites, and forums in real-time, using sentiment analysis and entity recognition to categorize mentions as positive, neutral, or negative. Helps marketing leadership detect PR crises, assess product launch reception, and monitor competitor customer frustration.',
        ],
    ],
    'digital_marketing-digital_marketing-s3-set2' => [
        [
            'text' => 'How does programmatic display advertising work? Explain Real-Time Bidding (RTB), Demand-Side Platforms (DSP), Supply-Side Platforms (SSP), and Ad Exchanges.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'When a user loads a webpage, publisher sends ad slot impression to SSP. SSP offers impression to Ad Exchange. DSPs evaluate user profile, bidding on behalf of advertisers based on targeting criteria. The exchange conducts a second-price or first-price auction, selecting winning bid and rendering ad within ~100 milliseconds.',
        ],
        [
            'text' => 'What is Customer Data Platform (CDP, like Segment or RudderStack)? How does it unify disparate customer identities across web, mobile, CRM, and offline stores?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A CDP ingests raw clickstream and transactional events from all touchpoints, resolves identities by mapping anonymous session IDs, email hashes, and mobile advertising IDs into a unified customer profile, and syncs unified behavioral audiences downstream to ad networks, email tools, and data warehouses.',
        ],
        [
            'text' => 'Explain the mechanics of B2B Account-Based Marketing (ABM). How do you align marketing and sales teams around a tier-1 target account list using platforms like 6sense or Demandbase?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'ABM treats individual high-value target companies as single markets. Intent platforms (6sense) monitor third-party IP searches and content consumption to identify target accounts in active buying cycles. Marketing runs hyper-personalized ads to decision-makers while sales reps simultaneously execute warm outreach.',
        ],
        [
            'text' => 'What are dynamic landing pages? How do tools like Mutiny or Google Optimize personalize headlines and social proof based on visitor industry, firmographics, or UTM source?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Dynamic personalization swaps page elements (H1 headline, client logos, case studies) based on IP firmographics (Clearbit) or inbound UTM parameters. A visitor from a healthcare company sees healthcare customer testimonials and terminology, increasing relevance and lifting conversion rates by 20-50%.',
        ],
        [
            'text' => 'How do you establish a statistically sound experimentation culture in a marketing team? Explain sample ratio mismatch (SRM) and false positive risks.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'SRM occurs when the expected traffic split (e.g. 50/50) deviates significantly in actual traffic (e.g. 52/48 with $p < 0.001$), indicating underlying technical tracking failures that invalidate test results. Prevent false positives by avoiding early stopping (peeking) and pre-registering sample sizes and minimum detectable effects (MDE).',
        ],
    ],
    'digital_marketing-digital_marketing-s3-set3' => [
        [
            'text' => 'Design a comprehensive go-to-market (GTM) growth strategy for launching an AI-powered developer tool targeting 100,000 active developers in Year 1.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Candidate should outline a product-led growth (PLG) motion: frictionless self-serve onboarding, GitHub integration, transparent documentation, developer advocacy via technical tutorials on Hacker News and Dev.to, open-source CLI/community tier, developer discord, and programmatic SEO targeting technical error logs.',
        ],
        [
            'text' => 'Analyze the impact of third-party cookie deprecation in modern web browsers. How should enterprise marketing stacks transition to first-party data architecture?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Third-party cookies enable cross-site tracking across ad networks; their removal degrades retargeting and view-through attribution. Transition strategy: 1) Build robust first-party data capture (gated assets, loyalty programs, direct sign-ins); 2) Deploy server-side tagging on custom first-party subdomains; 3) Adopt clean rooms (Snowflake, AWS) for secure publisher data matching.',
        ],
        [
            'text' => 'How do you architect an enterprise multi-million dollar annual media mix model incorporating diminishing marginal returns and carryover adstock effects?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Model adstock using Weibull or geometric decay distributions to capture lingering psychological memory of advertising. Apply Hill functions to model saturation curves where additional spend yields diminishing returns. Regularly calibrate regression coefficients against empirical geo-lift test results to prevent model drift.',
        ],
        [
            'text' => 'A D2C brand\'s blended CAC increased from $35 to $90 over 12 months while monthly revenue stagnated. Conduct an executive post-mortem and present a turnaround plan.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Diagnose: channel over-reliance (Meta fatigue), rising CPMs, low repeat purchase rate, and ineffective email retention. Plan: cut bottom 20% unprofitable ad sets; shift focus to existing customer retention (subscriptions, cross-sells to lift 90-day LTV); launch creator-led TikTok native creative; introduce referral programs.',
        ],
        [
            'text' => 'Explain the strategic governance of Privacy Regulations (GDPR, CCPA/CPRA) across marketing automation. What are the operational liabilities of non-compliant data processing?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Requires explicit lawful basis for processing, granular opt-in consent for tracking, honoring Data Subject Access Requests (DSARs - right to access, rectify, delete data within 30 days), and maintaining vendor Data Processing Agreements (DPAs). Fines can reach 4% of global annual turnover or €20M under GDPR.',
        ],
    ],
    'digital_marketing-seo-s1-set1' => [
        [
            'text' => 'Explain JavaScript SEO and Google\'s two-wave indexing architecture. Why does Googlebot crawl the raw HTML payload in Wave 1 and defer JavaScript execution to Wave 2 when rendering resources become available, and how does this affect indexation timing and Core Web Vitals for Single Page Applications (SPAs)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'In Wave 1, Googlebot downloads and parses the initial server HTML response, indexing links and text immediately. If content is client-side rendered (CSR React/Vue), the HTML is empty; Googlebot queues the URL for rendering (Wave 2) in a headless Chromium sandbox. Because rendering requires massive compute, Wave 2 can lag by days or weeks, causing newly published content or dynamic links to remain unindexed.',
        ],
        [
            'text' => 'What is the Canonical Tag (rel=\'canonical\') and how does it prevent duplicate content penalties in e-commerce? How do you configure canonicalization and robots.txt directives for faceted navigation (e.g. product filters by color, size, and sort order) to prevent search engine index bloat and crawl budget exhaustion?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Faceted navigation generates thousands of parameter combinations (?color=red&size=xl&sort=price_asc) with duplicate product lists. rel=\'canonical\' points every parameter variation back to the master category URL, telling Google to consolidate link equity. For infinite filter permutations, use robots.txt disallow rules (e.g. Disallow: /*?*sort=) to stop bots from wasting crawl budget on low-value parameter URLs.',
        ],
        [
            'text' => 'Analyze the SEO impact of HTTP status codes and redirects: 301 (Permanent), 302 (Temporary), 404 (Not Found), and 410 (Gone). Why are multi-hop redirect chains (e.g. HTTP -> HTTPS -> non-www -> www -> final URL) damaging to crawl equity (PageRank) and Core Web Vitals, and how do you resolve them?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '301 passes permanent link equity and updates index; 302 retains original URL in index; 404 signals missing page (retried by Googlebot); 410 explicitly signals permanently removed content (pruned from index faster). Redirect chains compound latency, degrade Largest Contentful Paint (LCP), waste crawl budget, and risk search engines dropping equity or abandoning the redirect loop after 5 hops. Resolve by updating internal links and server rules to redirect directly from origin to final target in a single 301 hop.',
        ],
        [
            'text' => 'What are Google\'s E-E-A-T guidelines (Experience, Expertise, Authoritativeness, Trustworthiness)? Why is Trust the central pillar, especially for YMYL sites?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'E-E-A-T evaluates content creator credibility. Experience (firsthand usage), Expertise (credentials and depth), Authoritativeness (industry reputation and citations), Trustworthiness (accurate, secure, transparent). On YMYL (Your Money or Your Life) topics (health, finance), lacking trust or verified author credentials causes severe ranking penalties.',
        ],
        [
            'text' => 'Explain Internal Linking and Anchor Text. Why is internal linking crucial for distributing PageRank and establishing site information architecture?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Internal links connect pages within the same domain, passing authority (PageRank) from high-power pages (homepage) to deeper conversion pages. Descriptive anchor text (avoiding \'click here\') signals contextual relevance of the destination URL to search engine crawlers.',
        ],
    ],
    'digital_marketing-seo-s1-set2' => [
        [
            'text' => 'What is the purpose of robots.txt? Explain User-agent, Disallow, Allow, and Sitemap directives, and clarify whether robots.txt prevents a page from being indexed.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'robots.txt provides crawl directives to web robots. It instructs crawlers where NOT to crawl (`Disallow: /admin/`). CRITICAL: robots.txt does NOT prevent indexing; if external sites link to a disallowed URL, Google will still index the URL without crawling its contents. To prevent indexing, use `<meta name="robots" content="noindex">`.',
        ],
        [
            'text' => 'What is the Canonical Tag (rel=\'canonical\')? When and why do duplicate content issues occur in e-commerce, and how does the canonical tag resolve them?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Canonical tag specifies master preferred URL when multiple URLs serve identical or substantially similar content (e.g. product pages with sorting/filtering parameters: `?color=blue&size=m`). It consolidates link equity and tells search engines which single URL to index and display in SERPs.',
        ],
        [
            'text' => 'Explain Google\'s Core Web Vitals: Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS). What are the target thresholds for each?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'LCP measures loading speed: render time of largest image or text block (target: $\\le 2.5s$). INP (replaced FID) measures page responsiveness to user interactions (target: $\\le 200ms$). CLS measures visual stability: unexpected layout shifts during load (target: $\\le 0.1$).',
        ],
        [
            'text' => 'What is Structured Data / Schema Markup? How does JSON-LD help search engines understand entities and generate Rich Results (FAQ, Product, Review snippets)?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'JSON-LD scripts embedded in `<head>` provide machine-readable metadata adhering to Schema.org vocabulary. It explicitly defines entities, prices, ratings, and FAQs, allowing Google to parse context unambiguously and grant eye-catching SERP enhancements (star ratings, price tags, breadcrumbs) that boost CTR.',
        ],
        [
            'text' => 'Compare HTTP 301 Permanent Redirects with HTTP 302 Temporary Redirects. What happens to link equity (PageRank) during each redirect type?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A 301 redirect indicates permanent relocation; search engines update their index to the new URL and transfer virtually all link equity (PageRank) over time. A 302 redirect indicates temporary relocation; search engines keep the original URL indexed and do not pass full long-term link equity.',
        ],
    ],
    'digital_marketing-seo-s1-set3' => [
        [
            'text' => 'Walk through your methodology for conducting an end-to-end Technical SEO Audit using tools like Screaming Frog and Google Search Console.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Crawl analysis: crawl depth, HTTP 4xx/5xx status codes, redirect chains; 2) Indexability: robots.txt blocks, noindex tags, canonical mismatches; 3) Architecture: orphan pages, XML sitemap validation, internal link distribution; 4) Performance: Core Web Vitals, mobile usability; 5) On-page: missing H1s, duplicate title tags, thin content.',
        ],
        [
            'text' => 'Your website experiences a sudden 50% drop in organic search traffic over a two-week period. Detail your diagnostic troubleshooting framework.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Check Google Search Console for Manual Actions or Security issues; 2) Determine if drop aligns with a known Google Core or Helpful Content algorithm update; 3) Segment traffic by directory and page type (is the drop sitewide or isolated to a specific template?); 4) Check technical releases (accidental sitewide `noindex` tag, robots.txt block, canonical loop); 5) Check tracking/analytics tag breakage.',
        ],
        [
            'text' => 'What is Crawl Budget? How does Google determine crawl budget, and how do you optimize crawl efficiency for an enterprise site with over 1,000,000 URLs?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Crawl budget is the number of pages Googlebot can and wants to crawl on a site within a given timeframe, determined by crawl demand (page popularity) and crawl rate limit (server speed). Optimization: prune dead/thin pages, disallow faceted navigation parameter URLs in robots.txt, eliminate redirect chains, and speed up server response times (TTFB).',
        ],
        [
            'text' => 'Explain the difference between White Hat, Grey Hat, and Black Hat link building techniques. What are PBNs (Private Blog Networks) and how does Google detect and penalize them?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'White Hat acquires links through merit and outreach (digital PR, original research). Black Hat manipulates rankings (PBNs, automated spam links, hidden text). Grey Hat includes paid guest posts with unflagged dofollow links. Google detects PBNs via shared hosting IPs, identical WHOIS data, sudden influx of unnatural exact-match anchor text, and AI link spam classifiers, issuing manual penalties.',
        ],
        [
            'text' => 'How does International SEO work? Explain hreflang tags (`hreflang="es-ES"` vs `hreflang="es-MX"`), canonical implementation across language versions, and ccTLD vs subfolder strategy.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'hreflang tags specify language and geographical targeting, preventing international duplicate content issues. Must be reciprocal: page A links to page B in hreflang, page B must link back to page A. Each version must self-canonicalize. Subfolders (`site.com/de/`) consolidate domain authority best, whereas ccTLDs (`site.de`) provide strongest local country signal at higher cost.',
        ],
    ],
    'digital_marketing-seo-s2-set1' => [
        [
            'text' => 'What is Keyword Cannibalization? How does it harm rankings, and how do you diagnose and resolve it across multiple competing blog articles?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Occurs when multiple pages on the same website target identical or overlapping search intent, causing Google to split authority and oscillate rankings. Diagnose using GSC query filter showing multiple URLs competing for the same query. Fix: merge content into single authoritative pillar guide and 301 redirect weaker URLs, or differentiate intent and re-optimize anchor text.',
        ],
        [
            'text' => 'Explain Long-Tail Keywords versus Fat-Head Keywords. Why do long-tail queries often yield higher conversion rates despite lower search volume?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Fat-head keywords (e.g. \'shoes\') have massive search volume, high competition, and vague intent. Long-tail keywords (e.g. \'best waterproof trail running shoes for wide feet\') have low volume but ultra-specific commercial/transactional intent. Prospects know exactly what they need, translating to higher conversion rates.',
        ],
        [
            'text' => 'What is Google Search Console (GSC)? Differentiate between Impressions, Clicks, Average CTR, and Average Position in the Performance Report.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Impressions: number of times a user saw your URL link in Google SERPs. Clicks: actual clicks from SERP to site. CTR: Clicks divided by Impressions. Average Position: average ranking of the URL across all search queries. High impressions with low CTR indicates an opportunity to optimize title tags and meta descriptions.',
        ],
        [
            'text' => 'How do featured snippets work (Paragraph, List, Table snippets)? How do you optimize content to win \'Position Zero\' in Google search results?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Featured snippets extract concise answers directly onto SERPs. Optimization: identify queries where Google already displays snippets; structure the target answer directly beneath an H2 question in a concise 40-50 word paragraph, bulleted list, or clean HTML table format, matching search intent precisely.',
        ],
        [
            'text' => 'What is Image SEO? Explain file naming conventions, alt attributes, next-gen image formats (WebP, AVIF), and responsive image sizing.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Use descriptive hyphenated file names (`red-leather-jacket.webp`, not `IMG_123.jpg`). Alt text provides accessibility for screen readers and semantic context for image indexing. Modern formats (WebP, AVIF) reduce file sizes by 30-70% without quality loss. Responsive `srcset` attributes serve appropriate resolutions for mobile vs desktop.',
        ],
    ],
    'digital_marketing-seo-s2-set2' => [
        [
            'text' => 'Explain JavaScript SEO. Compare Client-Side Rendering (CSR), Server-Side Rendering (SSR), and Static Site Generation (SSG) in terms of crawler discoverability and two-wave indexing.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'In CSR (plain React/Vue), HTML is empty initially; Googlebot crawls HTML (Wave 1) but defers JavaScript rendering (Wave 2) until render resources are available, delaying indexation of dynamic content. SSR (Next.js) and SSG generate complete HTML on the server or at build time, ensuring immediate, reliable indexing upon first crawl.',
        ],
        [
            'text' => 'What is an XML Sitemap, and what are best practices for maintaining it? What types of URLs should be strictly EXCLUDED from an XML sitemap?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'An XML sitemap lists canonical URLs you want search engines to crawl. Best practices: keep under 50,000 URLs and 50MB per sitemap file; use sitemap index files for large sites; update `<lastmod>` timestamps accurately. STRICTLY EXCLUDE: non-canonical URLs, 4xx/5xx error pages, 301 redirects, and pages blocked by `noindex`.',
        ],
        [
            'text' => 'Explain the Page Experience signals and how HTTPS, mobile-friendliness, and absence of intrusive interstitials impact search rankings.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Google uses page experience as a ranking tiebreaker. HTTPS encrypts data; mobile-friendliness ensures text is readable without zooming and tap targets are appropriately spaced. Intrusive interstitials (popups that obstruct the main content immediately on mobile entry) are penalized because they degrade user experience.',
        ],
        [
            'text' => 'How does Faceted Navigation create severe SEO issues in e-commerce websites? How do you prevent index bloat caused by filter combinations?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Faceted filters (color, size, price, sorting) generate millions of parameter URL combinations containing duplicate or near-duplicate product lists. If crawled unchecked, they consume crawl budget and cause index bloat. Mitigations: canonicalize faceted URLs to the main category, disallow multi-parameter query strings in robots.txt, or use AJAX without modifying URL history.',
        ],
        [
            'text' => 'What is Backlink Profile Analysis? Explain Domain Authority / Domain Rating metrics, toxic backlinks, and the role of the Google Disavow Tool.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'DA/DR (Moz/Ahrefs) are third-party logarithmic estimates of site link authority based on backlink quantity and quality. Toxic links originate from automated link farms or spam directories. While Google\'s algorithms (Penguin) now automatically ignore most spam links, the Disavow Tool remains necessary if a site receives a manual unnatural links penalty.',
        ],
    ],
    'digital_marketing-seo-s2-set3' => [
        [
            'text' => 'Design a comprehensive site migration strategy for migrating an enterprise e-commerce platform from Magento to Shopify with zero organic traffic loss.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Benchmark rankings, organic sessions, and backlink equity; 2) Create comprehensive 1-to-1 URL redirect map (mapping old URLs to exact new Shopify equivalents with 301s); 3) Mirror metadata, headings, and canonical structures in staging; 4) Validate staging redirects and ensure staging has noindex; 5) Post-launch: verify sitemaps in GSC, monitor 404 crawl errors daily, and track indexation parity.',
        ],
        [
            'text' => 'What is Programmatic SEO? How do companies like TripAdvisor, Zapier, and Canva build and rank hundreds of thousands of landing pages using database templates without thin content penalties?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Programmatic SEO uses relational databases to populate standardized page templates dynamically for long-tail search queries (e.g. \'connect [App A] to [App B]\'). Prevents thin content by ensuring each page provides unique proprietary data, customized user reviews, unique schema markup, and real utility rather than spun generic text.',
        ],
        [
            'text' => 'Explain Google\'s Helpful Content System (HCS). What core criteria distinguish \'people-first content\' from \'search-engine-first content\'?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'HCS is a sitewide machine learning classifier. Search-engine-first content: produced primarily for search engine rankings, automated AI summaries aggregating search results without adding original value, answering topics outside brand expertise. People-first content: provides firsthand experience, answers searcher questions completely without requiring them to return to SERPs, and possesses unique proprietary insights.',
        ],
        [
            'text' => 'How does Digital PR drive tier-1 editorial backlinks at scale? Compare proactive data-driven storytelling with reactive newsjacking (HARO / Connectively).',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Data-driven PR analyzes proprietary internal data or government surveys to publish compelling visual research reports that journalists cite as primary sources, yielding authoritative editorial backlinks. Reactive newsjacking monitors real-time journalist queries (HARO/Connectively) providing expert quotes on breaking news stories.',
        ],
        [
            'text' => 'How do you calculate the financial ROI of an enterprise SEO campaign? Project organic revenue growth against engineering and content investment costs.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Forecast: $(	ext{Target Search Volume} 	imes 	ext{Projected CTR at Rank} 	imes 	ext{Website Conversion Rate} 	imes 	ext{Average Order Value}) = 	ext{Projected Revenue}$. Compare projected net profit against total investment (retainer fees, engineering hours, content production). Calculate Payback Period and compare blended CAC of organic vs paid search channels.',
        ],
    ],
    'digital_marketing-seo-s3-set1' => [
        [
            'text' => 'What is Semantic Search and how did Google algorithms like Hummingbird, RankBrain, and BERT transform search from keyword matching to entity understanding?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Historic search matched literal keyword strings. Hummingbird and RankBrain introduced conceptual understanding of entities and conversational queries. BERT uses bidirectional Transformer attention to understand nuance, prepositions (\'to\', \'for\'), and contextual relationships in natural language, prioritizing true semantic intent over keyword density.',
        ],
        [
            'text' => 'What is a Topic Cluster and Pillar Page architecture? How do supporting subtopic cluster articles interlink to establish comprehensive topical authority?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A Pillar Page is a broad, comprehensive guide on a core topic (e.g. \'Cloud Security\'). Cluster pages cover specific subtopics in depth (e.g. \'IAM Best Practices\', \'VPC Peering Security\'). All cluster pages link back to the pillar page using targeted anchor text, and the pillar links out to clusters, signaling complete topical authority to Google.',
        ],
        [
            'text' => 'Explain Local SEO mechanics: Google Business Profile (GBP), local map pack ranking factors, NAP consistency (Name, Address, Phone), and local citations.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Local pack rankings are driven by: Relevance (matching search intent), Distance (proximity of business to user), and Prominence (review volume and velocity, backlinks, domain authority). Exact NAP consistency across directory citations (Yelp, YellowPages) validates business legitimacy to Google algorithms.',
        ],
        [
            'text' => 'What are Orphan Pages? How do they occur, why are they detrimental to SEO, and how do you systematically detect and remediate them?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Orphan pages are live URLs with zero internal links pointing to them from the rest of the website. Crawlers cannot discover them via site navigation, and they receive zero PageRank. Detect by cross-referencing all URLs crawled by Screaming Frog with URLs recorded in Google Analytics or XML sitemaps. Remediate by integrating into site hierarchy or 301 redirecting/deleting.',
        ],
        [
            'text' => 'What is Mobile-First Indexing? What happens if your mobile website version serves different or truncated content compared to your desktop version?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Googlebot crawls and indexes the web almost exclusively using a smartphone user agent. If your mobile site hides text, omits structured data, or alters navigation compared to desktop, Google completely ignores the desktop version, resulting in dropped rankings and missed indexation for the omitted content.',
        ],
    ],
    'digital_marketing-seo-s3-set2' => [
        [
            'text' => 'Explain the technical implementation of dynamic rendering vs edge rendering for JavaScript-heavy single-page applications. When is edge SSR preferred over dynamic rendering?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Dynamic rendering detects user-agents and routes bot requests to a headless browser (Rendertron/Prerender.io) while serving CSR to human users. Google treats dynamic rendering as a temporary workaround. Edge SSR (Cloudflare Workers, Vercel) is preferred: it compiles and serves identical pre-rendered HTML to both users and bots instantly with low TTFB at edge servers worldwide.',
        ],
        [
            'text' => 'How does Log File Analysis uncover crawler behavior? What specific insights can you extract from web server access logs (Apache/Nginx/Cloudflare) that Google Search Console hides?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Server access logs record 100% of HTTP requests made by verified Googlebot IPs without sampling. Uncovers: exact crawl frequency per page type, wasted crawl budget on parameter URLs, Googlebot response codes (actual 5xx/4xx errors), crawl response times (TTFB), and unindexed orphan pages Googlebot crawls that analytics never track.',
        ],
        [
            'text' => 'What are the SEO risks of using Subdomains versus Subdirectories (e.g. `blog.domain.com` vs `domain.com/blog`)? Analyze the empirical data on root domain authority consolidation.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Google often treats subdomains as separate web properties with independent link profiles and trust metrics. Hosting a blog or content hub on a subfolder (`/blog`) directly inherits the root domain\'s accumulated PageRank and backlink authority. Countless case studies demonstrate massive organic traffic increases simply by migrating from subdomain to subdirectory.',
        ],
        [
            'text' => 'Explain the mechanics of Algorithmic Penalties vs Manual Actions in Google. How do you identify a manual penalty in GSC, submit a Reconsideration Request, and verify recovery?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Manual actions are issued by human reviewers for guideline violations (unnatural links, scraped content) and appear explicitly in GSC\'s \'Security & Manual Actions\' tab with a required Reconsideration Request. Algorithmic penalties (Core, Spam, Helpful Content updates) do not trigger GSC warnings; recovery requires sitewide content quality and architectural overhauls over several update cycles.',
        ],
        [
            'text' => 'What is the role of entity extraction, Knowledge Graph, and Wikidata in modern enterprise SEO? How do you establish your brand as a recognized entity in Google\'s Knowledge Graph?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Google\'s Knowledge Graph organizes real-world entities (people, organizations, places) and their relationships. Establish brand entity by: implementing detailed `Organization` schema with `sameAs` links to official Wikipedia, Wikidata, LinkedIn, and Crunchbase profiles; obtaining consistent third-party citations in authoritative news outlets; maintaining an active Google Business Profile.',
        ],
    ],
    'digital_marketing-seo-s3-set3' => [
        [
            'text' => 'Architect an SEO recovery plan for a media publishing website with 500,000 articles that lost 70% of its traffic following a Google Helpful Content Update.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'Candidate must recognize that HCS is a sitewide signal: low-quality content pulls down high-quality pages. Strategy: 1) Classify articles into 3 buckets (Keep, Update, Prune); 2) Ruthlessly 410 or noindex low-value, thin, or AI-generated rehashes; 3) Consolidate fragmented articles into authoritative master resources; 4) Update author bios with verified real-world expertise and credentials; 5) Remove intrusive ads and excessive affiliate links.',
        ],
        [
            'text' => 'Explain the technical architecture of Headless CMS SEO. How do you manage preview environments, on-demand ISR (Incremental Static Regeneration), and cache invalidation across CDNs?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'A headless CMS (Contentful/Sanity) delivers content via webhooks to static site generators (Next.js/Gatsby). When editors publish, webhooks trigger on-demand ISR (`res.revalidate(\'/page\')`) updating edge cache without full site rebuilds. Technical SEO must ensure preview draft URLs are blocked from indexing, and XML sitemaps update dynamically on publish events.',
        ],
        [
            'text' => 'What is Generative Engine Optimization (GEO) / Search Generative Experience (SGE / Google AI Overviews)? How must SEO strategies adapt when Google AI synthesizes answers directly on SERPs?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => 'AI Overviews synthesize direct answers above organic results, compressing traditional CTR on purely informational queries. Strategies: 1) Optimize for brand citation inside AI overviews by providing concise, high-authority data nuggets and quotes; 2) Focus on proprietary primary research, case studies, and subjective human opinions that LLMs cannot synthesize; 3) Target high-intent transactional queries where users demand direct tool or product interaction.',
        ],
        [
            'text' => 'How do you build a programmatic SEO architecture capable of rendering and maintaining 500,000 dynamically generated landing pages without tripping spam algorithms?',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Secure clean, proprietary, structured data; 2) Enforce strict indexing thresholds: pages with insufficient data are held back as draft (`noindex`); 3) Implement hierarchical breadcrumbs and dynamic internal link grids so every page has strong crawl paths; 4) Monitor indexing ratios in GSC: if Googlebot indexes $<50\\%$ of submitted URLs, pause generation and raise data quality threshold.',
        ],
        [
            'text' => 'Design a global multi-region, multi-language technical SEO framework for a multinational corporation operating across 40 countries and 15 languages.',
            'category' => 'technical',
            'duration_seconds' => 180,
            'note' => '1) Use clean subfolders (`domain.com/fr/`, `domain.com/de/`) or dedicated ccTLDs for key markets; 2) Generate automated XML sitemaps with complete reciprocal `xhtml:link rel="alternate" hreflang` mappings; 3) Set up IP geo-detection banners offering language switching without automatic forced 302 redirects (which block Googlebot US crawlers); 4) Localize currency, contact information, Schema, and payment gateways per locale.',
        ],
    ],
];
