"""Generate mock interview questions Part 7: Game, Emerging Tech & Marketing (5 stacks)

Stacks:
  game_development
  blockchain
  quantum_computing
  digital_marketing
  seo

Outputs:
  backend/database/seeders/data/mock_questions/game_emerging_marketing_mock.php
"""
from pathlib import Path
from vault_helper import write_php_file

STACKS = {
    'game_development': {
        1: [
            {
                'text': 'How does the core game loop work (Process Input, Update Game State, Render)? Why is Delta Time (dt) necessary for physics updates?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Loop executes continuously; Delta Time (time elapsed between frames) decouples object movement speed from rendering framerate, ensuring consistent game speed on 30Hz or 144Hz displays.',
            },
            {
                'text': 'Explain fundamental 2D and 3D vector math operations used in games: Vector Addition, Dot Product, and Cross Product.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Addition: displacement/velocity. Dot product: calculates angle between vectors, field-of-view checks, lighting incidence (Lambertian cosine). Cross product: finds perpendicular normal vector in 3D space.',
            },
            {
                'text': 'Compare Axis-Aligned Bounding Box (AABB) collision detection with Oriented Bounding Box (OBB) and Sphere collision detection.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Sphere (distance check, fastest). AABB (aligned with coordinate axes, simple min/max interval overlap tests). OBB (rotates with object, requires Separating Axis Theorem (SAT), more accurate but computationally heavier).',
            },
            {
                'text': 'What is the difference between Rigid Body physics and Kinematic physics bodies in game engines?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Rigid body is simulated dynamically by the physics engine (forces, gravity, collisions). Kinematic body is moved explicitly via script code/transforms and pushes other bodies without being affected by forces.',
            },
            {
                'text': 'How do coordinate spaces (Local Space, World Space, View/Camera Space, Screen Space) transform an 3D asset onto a 2D monitor?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Local/Model space transformed via Model matrix to World space, via View matrix to Camera space, via Projection matrix to Clip space (perspective divide), and finally mapped to Screen viewport pixels.',
            },
        ],
        2: [
            {
                'text': 'Compare the Component-Based Architecture (like Unity GameObject-Component) with Data-Oriented Technology Stack (Entity Component System - ECS).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'GameObject-Component is object-oriented with memory scattered across heap (pointer chasing). ECS separates pure Data (Components) into contiguous memory arrays processed by Systems, maximizing CPU cache lines.',
            },
            {
                'text': 'In Unity (C#) or Unreal Engine (C++), what is the difference between Update(), FixedUpdate(), and LateUpdate()?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Update: called once per render frame (variable interval, input/visuals). FixedUpdate: called at deterministic fixed timesteps (physics simulation). LateUpdate: called after all Update calls (ideal for smooth camera following).',
            },
            {
                'text': 'What is Object Pooling in game programming, and why is it essential for high-frequency game objects like bullets or particle effects?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Frequent Instantiate() and Destroy() calls allocate heap memory triggering garbage collection (GC) spikes and frame stutter. Object pools pre-instantiate objects, activating and deactivating them without memory allocations.',
            },
            {
                'text': 'How does an asset management and prefab/blueprint system streamline level design and reusable game mechanics?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Prefabs/Blueprints package mesh, materials, colliders, and scripts into an asset template; changes to template propagate to all instances across scenes with support for prefab variants and overrides.',
            },
            {
                'text': 'How do state machines (Finite State Machines - FSM) organize character animation states (idle, run, jump, attack)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'States represent distinct behavioral modes; transitions define trigger conditions and transition blending durations (cross-fading between skeletal animation clips).',
            },
        ],
        3: [
            {
                'text': 'How do game AI systems use NavMesh and A* pathfinding to guide non-player characters (NPCs) around game worlds?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'NavMesh bakes walkable polygon geometry; A* algorithm searches polygon graph using heuristic cost (g + h); character steers along path waypoints avoiding dynamic obstacles via local avoidance (RVO).',
            },
            {
                'text': 'What is a Draw Call in rendering pipelines, and what techniques (Static Batching, Dynamic Batching, GPU Instancing) reduce draw calls?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CPU command sending mesh and material state to GPU. Static batching combines motionless meshes; dynamic batching groups small meshes on CPU; GPU instancing renders identical meshes with different transforms in a single call.',
            },
            {
                'text': 'Explain Vertex Shaders and Fragment (Pixel) Shaders in modern graphics pipelines.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Vertex shader executes per vertex, computing clip space positions and passing UVs/normals. Fragment shader executes per rasterized pixel, calculating final RGB color using textures, normals, and lighting models (PBR).',
            },
            {
                'text': 'What is Level of Detail (LOD) and Occlusion Culling, and how do they maintain a steady 60+ FPS in expansive open-world games?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'LOD swaps high-poly models for low-poly meshes as distance increases. Frustum culling discards objects outside camera view. Occlusion culling disables rendering of geometry hidden behind large opaque occluders (walls/mountains).',
            },
            {
                'text': 'How do you diagnose CPU-bound versus GPU-bound performance bottlenecks using engine profilers (Unity Profiler / Unreal Unreal Insights)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Inspect frame timeline: if CPU frame time > GPU frame time, bottleneck is scripts, physics, or high draw calls. If GPU frame time is high, bottleneck is fill rate, heavy post-processing shaders, or complex uncompressed textures.',
            },
        ],
    },

    'blockchain': {
        1: [
            {
                'text': 'What is a Blockchain, and how do cryptographic hash pointers link blocks together into an immutable tamper-evident chain?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Decentralized distributed ledger; each block contains transactions, timestamp, and the cryptographic hash of the previous block header; altering historical transactions changes its hash, breaking all downstream block hashes.',
            },
            {
                'text': 'What is a Merkle Tree in a blockchain block header, and how does a Merkle Proof verify transaction inclusion in O(log N) time?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Binary tree where leaf nodes are transaction hashes, and parent nodes are hashes of combined children up to Merkle root. Light clients verify inclusion by hashing transaction with log2(N) sibling hashes up to the root.',
            },
            {
                'text': 'Compare Proof of Work (PoW) and Proof of Stake (PoS) consensus mechanisms in terms of security, energy consumption, and finality.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'PoW: miners expend computational hash power solving cryptographic puzzles (51% attack requires majority hashrate, energy intensive). PoS: validators stake capital (ETH), pseudo-randomly selected to propose blocks, slashing for double signing, 99.9% less energy.',
            },
            {
                'text': 'How do Public-Private Key pairs generate blockchain wallet addresses (e.g. ECDSA curve secp256k1 and Keccak-256)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Private key is random 256-bit number; public key derived via elliptic curve multiplication (k * G); Ethereum address is rightmost 20 bytes of Keccak-256 hash of the uncompressed public key prefixed with 0x.',
            },
            {
                'text': 'What is the Byzantine Generals Problem, and how do distributed blockchain consensus algorithms achieve fault tolerance across untrusted peers?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Challenge of reaching consensus in distributed network where participants may be malicious or send conflicting messages; solved via economic incentives, cryptographic proofs, and Sybil resistance (PoW/PoS) tolerating up to 1/3 or 1/2 malicious actors.',
            },
        ],
        2: [
            {
                'text': 'What is the Ethereum Virtual Machine (EVM), and how does Gas meter computational execution steps to prevent infinite loops?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Turing-complete quasi-state machine executing bytecode; every opcode (ADD, SSTORE, SLOAD) has fixed Gas cost paid in Gwei; transactions provide gasLimit; if gas runs out, state reverts and unused gas is refunded.',
            },
            {
                'text': 'What is the difference between storage, memory, and calldata data locations in Solidity smart contracts?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Storage: persistent on-chain state, extremely expensive (SSTORE 20,000 gas). Memory: temporary mutable byte array wiped between external calls (cheaper). Calldata: non-modifiable read-only external function argument buffer (cheapest).',
            },
            {
                'text': 'Explain the ERC-20 token standard interface: totalSupply, balanceOf, transfer, transferFrom, approve, and allowance.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Fungible token standard; transfer moves tokens directly from caller; approve authorizes third party (e.g. Uniswap router) to spend up to allowance via transferFrom, preventing direct wallet drain.',
            },
            {
                'text': 'How does the ERC-721 Non-Fungible Token (NFT) standard differ from ERC-20 and ERC-1155 (Multi-Token Standard)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ERC-20 is fungible (identical units). ERC-721 is non-fungible (each token has unique uint256 tokenId and tokenURI metadata). ERC-1155 allows batch transfers and manages both fungible and non-fungible tokens in a single contract.',
            },
            {
                'text': 'How do Solidity view and pure functions differ, and why do they not consume gas when called externally by off-chain clients?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'view reads blockchain state without modifying it; pure neither reads nor modifies state. When called off-chain via eth_call, execution runs locally on node EVM without mining or consensus, costing zero gas.',
            },
        ],
        3: [
            {
                'text': 'Explain the classic Reentrancy vulnerability (The DAO hack) in Solidity. How do Checks-Effects-Interactions pattern and ReentrancyGuard prevent it?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Attacker contract fallback() recursively calls victim withdraw() before victim updates user balance. Mitigation: update state balance to zero before external ether transfer (Checks-Effects-Interactions) or apply OpenZeppelin nonReentrant modifier.',
            },
            {
                'text': 'What strategies reduce Gas consumption in Solidity smart contracts (packing storage variables, custom errors, immutable/constant)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Pack smaller uints into single 32-byte storage slot (uint128 + uint128); use custom errors (error InsufficientFunds()) instead of revert strings; mark values constant or immutable to embed in bytecode; cache storage array length in memory.',
            },
            {
                'text': 'What is an Oracle (e.g. Chainlink), and why do smart contracts need decentralized oracles to access off-chain data (price feeds, weather)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Blockchains are deterministic closed environments; contracts cannot make HTTP calls. Decentralized oracles aggregate signed data from independent node operators into on-chain reference contracts to prevent single-point price manipulation.',
            },
            {
                'text': 'How do Automated Market Makers (AMMs like Uniswap v2) maintain liquidity using the constant product formula (x * y = k)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Pool maintains reserve balances of token x and token y; trades keep product k invariant (ignoring 0.3% fee); price of x relative to y is y/x, which shifts automatically with buy/sell pressure without order books.',
            },
            {
                'text': 'What are Layer 2 scaling solutions? Compare Optimistic Rollups (Arbitrum/Optimism) and Zero-Knowledge Rollups (zkSync/Starknet).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Execute transactions off-chain and post compressed state batches to Ethereum L1. Optimistic assumes valid state with 7-day fraud-proof challenge window. ZK-Rollups generate cryptographic validity proofs (SNARKs/STARKs) offering instant mathematical finality.',
            },
        ],
    },

    'quantum_computing': {
        1: [
            {
                'text': 'What is a Qubit (quantum bit), and how does it differ from a classical digital bit in terms of state representation and superposition?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Classical bit is deterministic 0 or 1. Qubit is a two-level quantum system represented as state vector |psi> = alpha|0> + beta|1>, where alpha and beta are complex probability amplitudes such that |alpha|^2 + |beta|^2 = 1.',
            },
            {
                'text': 'Explain the Bloch Sphere representation of a single qubit state. What do the polar angle theta and azimuthal angle phi represent?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Unit sphere representing single qubit pure states: |psi> = cos(theta/2)|0> + e^(i phi) sin(theta/2)|1>. North pole is |0>, South pole is |1>, and equator represents equal superpositions with different relative phases.',
            },
            {
                'text': 'What happens during quantum measurement according to the Born Rule, and what is wave function collapse?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Measurement collapses superposition probabilistically into one basis state (|0> with probability |alpha|^2, |1> with probability |beta|^2). Irreversible projective measurement destroying superposition.',
            },
            {
                'text': 'What is the No-Cloning Theorem in quantum mechanics, and why is it impossible to create an identical copy of an arbitrary unknown quantum state?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Unitary quantum operators are linear: U(|psi>|0>) = |psi>|psi>. Linearity prevents a single operator from cloning both arbitrary states |psi> and |phi> without orthogonality, fundamentally distinguishing quantum data from classical copying.',
            },
            {
                'text': 'What physical technologies are currently used to build quantum processors (Superconducting transmon qubits, Trapped Ions, Photonic qubits)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Superconducting (IBM/Google: Josephson junctions cooled to millikelvin dilution fridges, fast gates). Trapped Ion (IonQ/Quantinuum: laser-manipulated ions, high fidelity/coherence time). Photonic (PsiQuantum: room-temp optical photons).',
            },
        ],
        2: [
            {
                'text': 'Explain the operation of single-qubit quantum logic gates: Pauli-X, Pauli-Y, Pauli-Z, and the Hadamard (H) gate.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'X gate flips bit (|0> to |1>, classical NOT). Z gate flips relative phase (|1> to -|1>). H gate creates equal superposition from computational basis: H|0> = (|0>+|1>)/sqrt(2), H|1> = (|0>-|1>)/sqrt(2).',
            },
            {
                'text': 'What is the Controlled-NOT (CNOT) gate, and how does its 4x4 unitary matrix operate on a two-qubit state (|control, target>)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Flips target qubit if and only if control qubit is in state |1>. Leaves state unchanged if control is |0>. Matrix swaps |10> and |11> amplitudes, acting as fundamental entangling gate.',
            },
            {
                'text': 'How do you create an entangled Bell State (|Phi+> = (|00> + |11>) / sqrt(2)) using a Hadamard gate followed by a CNOT gate?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Start in |00>; apply H to qubit 0 -> (|0>+|1>)|0>/sqrt(2) = (|00>+|10>)/sqrt(2); apply CNOT with control 0 and target 1 -> (|00>+|11>)/sqrt(2). Measuring one qubit instantly determines measurement outcome of second.',
            },
            {
                'text': 'What is Quantum Phase Kickback, and how do controlled gates transfer eigenvalue phase information from target qubit to control qubit?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'When target qubit is an eigenstate of unitary operator U with eigenvalue e^(i theta), applying controlled-U kicks the phase factor e^(i theta) into the control qubit state; essential building block of Shor’s and Deutsch-Jozsa algorithms.',
            },
            {
                'text': 'Why must all quantum logic gates represented by matrices be Unitary (U * U† = I)? What does this imply about reversibility?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Unitary operators preserve vector norm (sum of probabilities must always equal 1). Every unitary operation is reversible: U† undoes U, meaning quantum computation without measurement is completely reversible with zero thermodynamic entropy loss.',
            },
        ],
        3: [
            {
                'text': 'Explain Grover’s Quantum Search algorithm. How does it achieve a quadratic speedup (O(sqrt(N))) over classical brute-force search (O(N))?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Initializes uniform superposition, repeatedly applies Grover iteration: Phase Oracle (inverts sign of target state) and Diffusion Operator (inversion about the average amplitude), amplifying target state probability to ~100% in O(sqrt(N)) steps.',
            },
            {
                'text': 'What problem does Shor’s Algorithm solve in polynomial time, and what role does the Quantum Fourier Transform (QFT) play in period finding?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Finds prime factors of integer N in O((log N)^3) time. Reduces factoring to order/period finding of f(x) = a^x mod N; QFT extracts periodic interference peaks from superposition register with exponential speedup over classical DFT.',
            },
            {
                'text': 'What is Quantum Decoherence, and how do T1 (relaxation time) and T2 (dephasing time) limit quantum computation depth?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Environmental interaction causes loss of quantum information. T1 is energy relaxation time (decay from |1> to ground state |0>). T2 is dephasing time (loss of phase coherence between amplitudes). Circuit depth is constrained by T2.',
            },
            {
                'text': 'What are Quantum Error-Correcting Codes (e.g. Surface Code), and why do they require physical-to-logical qubit overheads (e.g. 1000:1)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Quantum states cannot be cloned; error correction entangles one logical qubit across a 2D lattice of physical data and syndrome qubits, measuring syndrome operators (X and Z stabilizers) to detect and correct bit/phase flips continuously.',
            },
            {
                'text': 'How do you build and execute a simple quantum circuit using IBM Qiskit (QuantumCircuit, QuantumRegister, ClassicalRegister, AerSimulator)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Instantiate QuantumCircuit(2, 2); add gates qc.h(0), qc.cx(0, 1); add measurements qc.measure([0,1], [0,1]); execute on AerSimulator backend with shots=1024; retrieve counts dictionary with plot_histogram.',
            },
        ],
    },

    'digital_marketing': {
        1: [
            {
                'text': 'Explain the digital marketing funnel (AIDA: Awareness, Interest, Desire, Action) and the types of content suitable for each stage.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Awareness (Top of Funnel: blog posts, social videos, infographics). Interest (Middle: webinars, comparison guides, case studies). Desire (email nurture, customer testimonials, product demos). Action (Bottom: free trials, discounts, direct checkout CTAs).',
            },
            {
                'text': 'How do you create an Ideal Customer Profile (ICP) and Buyer Persona for a B2B SaaS startup versus a B2C direct-to-consumer brand?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'B2B ICP: company size, annual revenue, industry, tech stack, job title of decision maker, pain points. B2C Persona: demographics, personal interests, purchasing triggers, preferred social platforms, lifestyle habits.',
            },
            {
                'text': 'What is Content Marketing, and how do you design an editorial calendar aligned with customer search intent and business goals?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Creating valuable educational content to attract and retain qualified audience; editorial calendar balances top-funnel organic search guides, middle-funnel product walkthroughs, distribution cadence, and keyword targets.',
            },
            {
                'text': 'Compare Organic Marketing (SEO, social, community) with Paid Marketing (PPC, sponsored posts) in terms of scalability, cost, and time-to-results.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Paid offers immediate traffic, precise targeting, and instant validation, but traffic stops when budget ends. Organic takes 3-6 months to build momentum, has compounding ROI, and builds sustainable long-term domain authority.',
            },
            {
                'text': 'What are key performance indicators (KPIs) for evaluating the success of a brand social media marketing campaign?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Engagement rate (likes, comments, shares / reach), impressions vs reach, Click-Through Rate (CTR) to landing page, video completion rate, follower growth rate, and conversion rate of social referrals.',
            },
        ],
        2: [
            {
                'text': 'How does Google Ads auction work? Explain Quality Score (Ad Relevance, Expected CTR, Landing Page Experience) and Ad Rank.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Ad Rank = Max CPC Bid x Quality Score. High Quality Score lowers actual cost per click (CPC) and earns higher position above higher-bidding competitors with lower relevance.',
            },
            {
                'text': 'Compare Google Search Ads (intent-driven) with Meta/Facebook Ads (interruption/discovery-driven). When do you use each?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Search ads capture existing high-intent demand (users actively searching for solutions). Meta ads generate new demand by targeting audiences based on demographics, interests, and lookalikes while users scroll feeds.',
            },
            {
                'text': 'What are Lookalike Audiences and Custom Audiences in Meta Ads Manager, and how do you build them from customer email lists or pixel data?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Custom Audience uploads hashed customer emails/phone numbers or pixel event visitors. Lookalike Audience uses Meta machine learning to find users mirroring the top 1% characteristics of high-value seed customers.',
            },
            {
                'text': 'Explain Google Ads automated bidding strategies: Maximize Conversions, Target CPA (Cost Per Acquisition), and Target ROAS (Return On Ad Spend).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Maximize Conversions spends budget to achieve highest number of conversions; Target CPA adjusts real-time auction bids to maintain specific average cost per lead; Target ROAS optimizes for highest revenue return on ad spend.',
            },
            {
                'text': 'How do you set up conversion tracking using Google Tag Manager (GTM) and Meta Pixel (or Conversions API - CAPI) to track purchases?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'GTM injects container script on site; triggers on thank-you page URL or custom dataLayer event (purchase); passes transaction ID, currency, and value to Meta Pixel and Google Ads tags; CAPI sends server-to-server events bypassing ad blockers.',
            },
        ],
        3: [
            {
                'text': 'Explain Customer Acquisition Cost (CAC) and Return on Ad Spend (ROAS). How do you calculate break-even ROAS for an e-commerce store with 60% gross margins?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ROAS = Revenue / Ad Spend. Break-even ROAS = 1 / Gross Margin percentage. With 60% gross margin, break-even ROAS is 1 / 0.60 = 1.67x (every \$100 ad spend requires \$167 revenue to break even on product costs).',
            },
            {
                'text': 'Compare Marketing Attribution Models: First-Touch, Last-Touch, Linear, Time-Decay, and Data-Driven Attribution (DDA). Why is Last-Touch biased?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Last-touch gives 100% credit to final channel before conversion, severely overvaluing branded search/retargeting and undervaluing top-of-funnel discovery channels (blog, YouTube, paid social). DDA uses algorithmic ML modeling across all touchpoints.',
            },
            {
                'text': 'How do you design an automated email marketing welcome sequence and abandoned cart recovery workflow in Klaviyo or Mailchimp?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Welcome series: Email 1 (instant discount code delivery), Email 2 (brand story/mission), Email 3 (social proof/bestsellers). Abandoned cart: 1 hr reminder with item picture, 24 hr urgency reminder with FAQ, 48 hr time-limited promo incentive.',
            },
            {
                'text': 'How did Apple’s iOS 14.5 App Tracking Transparency (ATT) update affect digital marketing tracking, and how do marketers adapt?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Users must opt-in to IDFA cross-app tracking, causing 80%+ drop in third-party cookie visibility and delayed 72-hr aggregated attribution (SKAdNetwork). Marketers adapted via Server-Side Tracking (CAPI), first-party data capture, and Marketing Mix Modeling (MMM).',
            },
            {
                'text': 'How do you structure an A/B split test for an e-commerce product landing page to systematically improve conversion rate (CRO)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Formulate data-backed hypothesis (e.g. adding sticky ATC button and social reviews will increase checkout initiates); test single primary variable; split traffic 50/50 evenly; run until sample reaches statistical significance (95% confidence).',
            },
        ],
    },

    'seo': {
        1: [
            {
                'text': 'Explain the difference between Search Intent types: Informational, Navigational, Commercial, and Transactional. How does intent shape your content?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Informational ("how to clean leather shoes" -> comprehensive guide). Navigational ("Nike login" -> homepage/portal). Commercial ("best running shoes 2024" -> comparison listicle). Transactional ("buy nike air zoom size 10" -> e-commerce product page).',
            },
            {
                'text': 'What are the most critical On-Page SEO elements on a webpage, and how should title tags, meta descriptions, and header hierarchy (H1-H3) be structured?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Unique Title tag (< 60 chars with primary keyword near front); compelling Meta Description (< 155 chars with CTA); single semantic H1 containing main topic; logical nested H2/H3 tags; descriptive image alt tags.',
            },
            {
                'text': 'How do you perform keyword research using tools like Ahrefs, SEMrush, or Google Keyword Planner? Explain Search Volume vs Keyword Difficulty (KD).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Analyze seed terms; evaluate search volume (monthly searches) vs Keyword Difficulty (backlink strength of top ranking pages); target long-tail low-KD keywords for new domains to build early ranking momentum.',
            },
            {
                'text': 'What is Keyword Cannibalization in SEO, how do you diagnose it, and what are strategies to fix it?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Occurs when multiple pages on same website compete for identical keyword intent, splitting ranking signals and confusing Google. Diagnosed via site: search or GSC queries showing multiple fluctuating URLs; resolved by 301 redirects, content consolidation, or canonical tags.',
            },
            {
                'text': 'How do internal linking and anchor text distribution pass PageRank ("link equity") and establish topical authority across your site?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Links connect pillar pages to supporting cluster articles; contextual descriptive anchor text signals page topic to crawlers without over-optimizing; directs crawlers to deep orphan pages and distributes link equity throughout the domain.',
            },
        ],
        2: [
            {
                'text': 'How do search engine web crawlers (e.g. Googlebot) discover, crawl, render, and index pages on the web?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Crawl (discovers URLs via links and sitemaps), Render (executes JavaScript and parses HTML via headless Chromium), Index (analyzes semantic content, signals, and stores in inverted search index), Rank (evaluates algorithms to return SERPs).',
            },
            {
                'text': 'What is the role of robots.txt versus meta robots tags (noindex, nofollow)? What happens if a page blocked by robots.txt has external backlinks?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'robots.txt instructs crawlers not to fetch a URL (saves crawl budget); meta noindex allows crawling but forbids indexing. If a page is disallowed in robots.txt, Google cannot see a noindex tag and may still index the bare URL if external backlinks point to it.',
            },
            {
                'text': 'What are Canonical Tags (rel="canonical"), and how do they resolve duplicate content issues across URL variations (e.g. HTTP/HTTPS, tracking parameters)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Specifies preferred master URL to search engines; tells Google to consolidate ranking signals, backlinks, and metrics to canonical URL when content is duplicated across UTM tags, faceted sorting filters, or trailing slash variations.',
            },
            {
                'text': 'Explain Google’s Core Web Vitals metrics: Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'LCP: loading performance (main content render < 2.5s). INP: responsiveness (page latency to user interactions < 200ms). CLS: visual stability (unexpected layout shifts < 0.1).',
            },
            {
                'text': 'What is Schema Markup (Structured Data / JSON-LD), and how does it help pages qualify for Rich Results (FAQ, Product, Recipe, Review snippets) in SERPs?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Standardized schema.org vocabulary formatted in JSON-LD script blocks providing unambiguous semantic context to Google; qualifies page for visual SERP enhancements that dramatically boost organic CTR.',
            },
        ],
        3: [
            {
                'text': 'What makes a backlink high-quality versus toxic or spammy in the eyes of Google’s search algorithms?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'High-quality: editorially earned from a topical, authoritative website with real organic traffic and natural contextual anchor text. Toxic: paid PBN links, link farms, automated comment spam, or foreign language link networks violating Google spam guidelines.',
            },
            {
                'text': 'What is Google’s E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) quality framework, especially for Your Money Your Life (YMYL) topics?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Human Search Quality Rater guidelines: First-hand Experience, demonstrated Expertise, recognized Authoritativeness, and central Trustworthiness. Crucial for financial, health, and legal topics where misinformation causes severe harm.',
            },
            {
                'text': 'How do you perform a comprehensive technical SEO site audit using Google Search Console and crawling tools like Screaming Frog?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Crawl site to uncover 4xx/5xx broken links, redirect chains/loops, missing title/H1 tags, unoptimized images, non-indexable canonicals, orphan pages, XML sitemap validation, and GSC Page Indexing reports.',
            },
            {
                'text': 'How does server-side rendering (SSR) or dynamic rendering solve JavaScript SEO challenges for Single Page Applications (React/Vue)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Client-side SPA sends empty HTML shell; Googlebot enters "render queue" delaying indexing for days or weeks. SSR or Next.js prerenders full HTML server-side, ensuring search engine bots immediately parse complete text, links, and schema on first fetch.',
            },
            {
                'text': 'How do you safely execute a site migration (domain name change, HTTP to HTTPS, or CMS platform redesign) without losing existing organic search rankings?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Map 1-to-1 redirect mapping spreadsheet for all existing URLs; implement permanent 301 redirects; update canonical tags and internal links; submit change of address in Google Search Console; submit updated XML sitemaps; monitor 404 crawl errors daily.',
            },
        ],
    },
}

if __name__ == '__main__':
    out_dir = Path(__file__).resolve().parent / 'mock_questions'
    out_file = out_dir / 'game_emerging_marketing_mock.php'
    write_php_file(out_file, STACKS)
    print(f"Wrote {out_file} ({len(STACKS)} sets)")

