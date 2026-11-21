import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file
from question_generator_core import make_q, build_set_rounds, generate_domain_parent_sets

OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

ai_data = {}

# 1. LLM & RAG
ai_data['llm_rag'] = generate_domain_parent_sets(
    'llm_rag', 'LLM Engineering & RAG',
    [
        ('Vector Embeddings & Cosine Similarity', 'Text chunks are encoded into dense high-dimensional vectors (e.g. OpenAI text-embedding-3, Cohere). Similarity is computed via Cosine Similarity, Dot Product, or Euclidean Distance.'),
        ('Retrieval-Augmented Generation (RAG) Architecture', 'User query is embedded, relevant chunks are retrieved from vector DB, injected into LLM prompt as context, and LLM generates grounded, factual answers.'),
        ('Vector Databases: Pinecone, Qdrant, Milvus, pgvector', 'Indexing algorithms (HNSW, IVF-Flat) balance search recall vs latency. pgvector provides vector indexing directly within relational PostgreSQL.'),
        ('Chunking Strategies: Semantic vs Recursive vs Fixed-size', 'Fixed-size splits by token count with overlap. Semantic chunking splits based on semantic similarity drops between adjacent sentences.'),
        ('Re-ranking with Cross-Encoders (Cohere Re-rank)', 'Initial vector search retrieves top 50 candidates. Cross-encoder re-ranks candidate chunks by scoring query-chunk pairs simultaneously, returning the top 5 most relevant.'),
    ],
    [('Prompt Engineering & Few-Shot In-Context Learning', 'Structuring system prompts, few-shot examples, dynamic prompt templates, and chain-of-thought (CoT) reasoning.') for _ in range(5)],
    [('Hallucination Mitigation & Groundedness Evaluation', 'RAGAS framework: Faithfulness, Answer Relevance, and Context Precision. Self-consistency sampling and citation validation.') for _ in range(20)],
    [('LLM Quantization & Serving with vLLM / Ollama', 'PagedAttention in vLLM optimizes KV-cache memory, enabling continuous batching. Quantization (AWQ, GPTQ, GGUF) reduces memory footprint.') for _ in range(15)],
    [('Enterprise Multi-Agent LLM Orchestration (LangGraph / AutoGen)', 'Stateful multi-agent workflows with human-in-the-loop validation, tool execution, and cyclic graph dependencies.') for _ in range(15)]
)

# 2. PYTORCH & DEEP LEARNING
ai_data['deeplearning_pytorch'] = generate_domain_parent_sets(
    'deeplearning_pytorch', 'PyTorch & Deep Learning',
    [
        ('PyTorch Autograd & Computational Graph', 'Tensors track operations when requires_grad=True, building a dynamic directed acyclic graph (DAG). loss.backward() computes gradients via reverse-mode auto-differentiation.'),
        ('Custom PyTorch Modules (nn.Module) & Forward Pass', 'Inherit from nn.Module, define layers in __init__, and implement forward pass in forward(). optimizer.step() updates weights; optimizer.zero_grad() clears old gradients.'),
        ('Loss Functions: CrossEntropyLoss vs BCEWithLogitsLoss', 'CrossEntropyLoss combines LogSoftmax and NLLLoss for multi-class classification. BCEWithLogitsLoss combines Sigmoid with BCE for multi-label stability.'),
        ('Dataset and DataLoader with Multi-Process Batching', 'Dataset defines __len__ and __getitem__. DataLoader provides batching, shuffling, multiprocessing (num_workers), and memory pinning (pin_memory=True).'),
        ('GPU Acceleration with CUDA and torch.cuda', 'tensor.to(device) transfers data to GPU memory. torch.cuda.amp (Automatic Mixed Precision) uses float16 to accelerate training and reduce VRAM.'),
    ],
    [('Distributed Training with DistributedDataParallel (DDP)', 'DDP spawns a process per GPU with separate Python interpreters, synchronizing gradients via all-reduce rings.') for _ in range(5)],
    [('Learning Rate Schedulers (Cosine Annealing, OneCycleLR)', 'Gradually adjust learning rates to escape saddle points and achieve superior convergence.') for _ in range(20)],
    [('Model Quantization (PTQ vs QAT) and TorchScript', 'Post-Training Quantization converts weights to int8. TorchScript serializes models into C++ runtime for production deployment.') for _ in range(15)],
    [('Scaling Deep Learning Clusters with Slurm & DeepSpeed', 'ZeRO (Zero Redundancy Optimizer) partitions optimizer states, gradients, and model parameters across nodes to train trillion-parameter models.') for _ in range(15)]
)

# 3. MACHINE LEARNING
ai_data['machine_learning'] = generate_domain_parent_sets(
    'machine_learning', 'Machine Learning (AI/ML)',
    [
        ('Bias-Variance Trade-off & Overfitting Prevention', 'High bias leads to underfitting (oversimplified). High variance leads to overfitting. Mitigate with L1/L2 regularization, dropout, pruning, and cross-validation.'),
        ('Gradient Boosted Decision Trees: XGBoost, LightGBM, CatBoost', 'Ensemble method training trees sequentially, where each new tree corrects the residual errors of preceding trees using gradient descent.'),
        ('Feature Engineering & Missing Value Imputation', 'One-hot vs target encoding, scaling (StandardScaler vs RobustScaler), KNN/MICE imputation, and polynomial features.'),
        ('Classification Metrics: ROC-AUC, Precision, Recall, F1-Score', 'Precision = TP/(TP+FP); Recall = TP/(TP+FN). F1 harmonic mean. ROC-AUC measures discrimination across all probability thresholds. Use PR-AUC on imbalanced datasets.'),
        ('K-Fold Cross-Validation & Stratified K-Fold', 'Stratified K-Fold preserves target class distribution percentages across all folds, essential for imbalanced classification.'),
    ],
    [('Hyperparameter Tuning with Optuna & Bayesian Optimization', 'Tree-structured Parzen Estimator (TPE) models past trial results to intelligently sample optimal hyperparameter spaces.') for _ in range(5)],
    [('Model Explainability with SHAP and LIME', 'Shapley values calculate the marginal contribution of each feature to the model prediction, ensuring transparency and compliance.') for _ in range(20)],
    [('Production ML Pipelines with Scikit-learn Pipeline & ColumnTransformer', 'Encapsulate preprocessing and estimator into a single object, preventing data leakage during cross-validation and deployment.') for _ in range(15)],
    [('MLOps & Feature Stores (Feast) at Enterprise Scale', 'Managing online (low-latency Redis) and offline (data warehouse) feature stores for consistent training-serving data.') for _ in range(15)]
)

# 4. NLP
ai_data['nlp'] = generate_domain_parent_sets(
    'nlp', 'Natural Language Processing (NLP / NLTK)',
    [
        ('Transformer Architecture & Self-Attention Mechanism', 'Self-attention calculates Query, Key, Value matrices. Attention scores = softmax(QK^T / sqrt(d_k))V. Multi-head attention captures relationships from diverse representation subspaces.'),
        ('Tokenization Algorithms: BPE, WordPiece, SentencePiece', 'Byte-Pair Encoding merges frequent character pairs into subwords, balancing vocabulary size and handling out-of-vocabulary (OOV) tokens gracefully.'),
        ('BERT (Encoder) vs GPT (Decoder) vs T5 (Encoder-Decoder)', 'BERT uses bidirectional masked language modeling (understanding/classification). GPT uses autoregressive causal attention (generation). T5 unifies text-to-text tasks.'),
        ('Named Entity Recognition (NER) & Part-of-Speech Tagging', 'Classifying tokens into entity categories (Person, Organization, Location) using conditional random fields (CRF) or fine-tuned transformer token classification heads.'),
        ('Word Embeddings: Word2Vec, GloVe, FastText', 'Word2Vec (Skip-gram/CBOW) trains neural weights. FastText models subword character n-grams to handle typos and unseen words.'),
    ],
    [('Fine-Tuning Pretrained Models with HuggingFace Transformers', 'Trainer API, AutoModelForSequenceClassification, AutoTokenizer, and optimizer configurations.') for _ in range(5)],
    [('Parameter-Efficient Fine-Tuning (PEFT) with LoRA and QLoRA', 'Low-Rank Adaptation freezes base weights and injects trainable rank-decomposition matrices, reducing trainable parameters by 99% with zero performance loss.') for _ in range(20)],
    [('Text Summarization (Extractive vs Abstractive)', 'Extractive selects key sentences. Abstractive uses sequence-to-sequence models to synthesize novel concise summaries.') for _ in range(15)],
    [('High-Throughput NLP Inference with ONNX Runtime & TensorRT', 'Optimizing transformer inference graphs with TensorRT for sub-5ms latency in production.') for _ in range(15)]
)

# 5. ROBOTICS
ai_data['robotics'] = generate_domain_parent_sets(
    'robotics', 'AI & Robotics',
    [
        ('ROS 2 Architecture: Nodes, Topics, Services, and Actions', 'DDS (Data Distribution Service) middleware. Topics for continuous pub-sub data (sensor streams). Services for synchronous RPC. Actions for long-running preemptible goals with feedback.'),
        ('Simultaneous Localization and Mapping (SLAM)', 'Robot constructs a map of an unknown environment while tracking its location within the map using LiDAR, visual odometry, and particle filters.'),
        ('Extended Kalman Filter (EKF) & Sensor Fusion', 'Combines noisy sensor readings (IMU, wheel encoders, GPS) through prediction and update steps to estimate true robot state and pose accurately.'),
        ('Forward and Inverse Kinematics (FK / IK)', 'FK calculates end-effector pose from joint angles. IK calculates joint angles required to position end-effector at a desired spatial coordinate.'),
        ('Path Planning: A*, Dijkstra, RRT, and Dynamic Window Approach (DWA)', 'A* finds optimal global path on grid. RRT (Rapidly-exploring Random Tree) navigates high-dimensional joint spaces. DWA handles local obstacle avoidance.'),
    ],
    [('Robot Simulation with Gazebo & Unity ROS-TCP-Connector', 'Physics engines (ODE, Bullet), URDF robot modeling, sensor noise simulation, and sim-to-real transfer.') for _ in range(5)],
    [('Computer Vision for Robotics with OpenCV & Point Cloud Library (PCL)', 'Depth image processing, point cloud segmentation, object detection (YOLO), and 6D pose estimation.') for _ in range(20)],
    [('Real-Time Linux (PREEMPT_RT) & Deterministic Control Loops', 'Low-latency kernel patches ensuring motor control loops execute with deterministic microsecond guarantees.') for _ in range(15)],
    [('Autonomous Mobile Robot (AMR) Navigation Stack (Nav2)', 'Configuring Nav2 costmaps (global/local), planners, controllers, and recovery behaviors for industrial AGVs.') for _ in range(15)]
)

# 6. DOCKER & K8S
ai_data['docker_k8s'] = generate_domain_parent_sets(
    'docker_k8s', 'Docker & Kubernetes',
    [
        ('Container Runtime Architecture: Linux Namespaces, Cgroups, and OverlayFS', 'Namespaces provide process, network, and mount isolation. Cgroups enforce CPU and memory resource limits. OverlayFS combines image layers into a unified copy-on-write filesystem.'),
        ('Multi-stage Dockerfile Optimization & Minimal Distroless Images', 'Separate build environment from runtime container, discarding compilers and devDependencies to produce secure 20MB production images.'),
        ('Kubernetes Pod Lifecycle, Probes (Liveness/Readiness/Startup), and PreStop Hooks', 'Startup probe verifies initialization before liveness/readiness probes run. PreStop hook executes cleanup commands before container receives SIGTERM.'),
        ('Kubernetes Services: ClusterIP, NodePort, LoadBalancer, and Ingress', 'ClusterIP provides internal VIP. NodePort exposes on node IPs. LoadBalancer provisions cloud ELB. Ingress routes HTTP/S traffic by host and path with TLS termination.'),
        ('ConfigMaps, Secrets, and Projected Volume Mounts', 'ConfigMaps store plain text configuration. Secrets store base64 encoded credentials (integrate with HashiCorp Vault or AWS KMS). Mount as environment variables or volume files.'),
    ],
    [('Horizontal Pod Autoscaler (HPA) & Custom Metrics via Prometheus Adapter', 'HPA scales replica counts automatically based on CPU/RAM or custom business metrics (requests per second, queue backlog).') for _ in range(5)],
    [('Kubernetes StatefulSets, PersistentVolumes, and CSI Storage', 'StatefulSets provide stable network identities (pod-0, pod-1) and dedicated persistent storage for databases.') for _ in range(20)],
    [('Helm Charts Architecture & GitOps with ArgoCD', 'Template Kubernetes manifests with Helm. ArgoCD continuously monitors Git repository and reconciles cluster state automatically.') for _ in range(15)],
    [('Kubernetes Network Policies, Service Mesh (Istio), and mTLS', 'NetworkPolicies enforce zero-trust pod firewalls. Istio sidecar proxies handle automatic mTLS and traffic splitting.') for _ in range(15)]
)

# 7. CLOUD COMPUTING (AWS/Azure/GCP)
ai_data['cloud_computing'] = generate_domain_parent_sets(
    'cloud_computing', 'Cloud Computing (AWS / Azure / GCP)',
    [
        ('AWS Well-Architected Framework: The 6 Pillars', 'Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability.'),
        ('IAM Policies: Principal, Action, Resource, Condition, and Least Privilege', 'Define JSON IAM policies following least privilege. Role assumption (STS AssumeRole) for temporary credentials without long-lived API keys.'),
        ('VPC Architecture: Public/Private Subnets, Route Tables, NAT Gateways, Internet Gateways', 'Internet Gateway routes public subnets. Private subnets route outbound traffic through NAT Gateways in public subnets with zero inbound access from public internet.'),
        ('Serverless Architecture: AWS Lambda, API Gateway, and Cold Starts', 'Event-driven compute. Manage cold starts with provisioned concurrency, keep bundle size minimal, and use connection pooling with RDS Proxy.'),
        ('Amazon S3 Storage Classes, Lifecycle Rules, and Bucket Policies', 'S3 Standard, Infrequent Access (IA), Glacier, and Glacier Deep Archive. Lifecycle rules transition objects automatically to reduce storage costs by 80%.'),
    ],
    [('Amazon RDS Aurora Architecture: Shared Distributed Storage Engine', 'Aurora separates compute from storage, replicating 6 copies across 3 AZs. Read replicas share storage with <10ms replication lag.') for _ in range(5)],
    [('Amazon ECS vs EKS for Container Orchestration', 'ECS provides AWS-native simplicity and seamless IAM integration. EKS provides standard Kubernetes portability for complex enterprise clusters.') for _ in range(20)],
    [('Cloud Cost Optimization: FinOps, Savings Plans, and Spot Instances', 'Spot instances for fault-tolerant workers (up to 90% savings). Compute Savings Plans for baseline workloads. Right-sizing instances with CloudWatch metrics.') for _ in range(15)],
    [('Disaster Recovery Strategies: Backup & Restore, Pilot Light, Warm Standby, Multi-Region Active-Active', 'RTO (Recovery Time Objective) and RPO (Recovery Point Objective) trade-offs across regional disaster recovery architectures.') for _ in range(15)]
)

# 8. CLOUD INFRASTRUCTURE & IAC
ai_data['cloud_infrastructure'] = generate_domain_parent_sets(
    'cloud_infrastructure', 'Cloud Infrastructure & IaC (Terraform / Ansible)',
    [
        ('Terraform State Management, Remote Backends & State Locking', 'Terraform records managed infrastructure in terraform.tfstate. Remote backend (S3) stores state centrally; DynamoDB provides distributed locking to prevent concurrent apply collisions.'),
        ('Terraform Modules, Reusability, and Input/Output Variables', 'Encapsulate infrastructure patterns into versioned reusable modules. Variables define parameters with type validation; outputs expose attributes to caller stacks.'),
        ('Terraform Plan, Apply, and Drift Detection', 'terraform plan compares configuration with real-world state and desired state. Drift occurs when out-of-band manual changes happen in cloud consoles.'),
        ('Ansible Playbooks, Roles, and Idempotency', 'Ansible executes agentless configuration management over SSH. Playbooks declare desired state; modules check current state and execute changes only if needed (idempotency).'),
        ('Infrastructure CI/CD with Atlantis, GitHub Actions, or Terraform Cloud', 'Automate PR plan output review, security linting (tfsec, checkov), and automated apply upon pull request merge.'),
    ],
    [('Terraform Workspaces vs Directory-based Environment Separation', 'Workspaces share configuration files for multi-environment deployments. Directory separation provides strict isolation for blast radius control.') for _ in range(5)],
    [('Managing Secrets in IaC with HashiCorp Vault or AWS Secrets Manager', 'Never hardcode secrets in Terraform code or commit tfvars to Git. Read secrets dynamically at runtime from Vault or KMS-encrypted stores.') for _ in range(20)],
    [('Pulumi vs Terraform: General-Purpose Languages vs HCL', 'Pulumi uses TypeScript/Python/Go, offering native unit testing, loops, and abstractions. Terraform uses declarative HCL with universal ecosystem adoption.') for _ in range(15)],
    [('Enterprise Multi-Account Cloud Architecture with AWS Organizations & Control Tower', 'Automate account provisioning, Service Control Policies (SCPs) enforcing guardrails, and centralized security logging.') for _ in range(15)]
)

# 9. DATA ANALYTICS
ai_data['data_analytics'] = generate_domain_parent_sets(
    'data_analytics', 'Data Analytics',
    [
        ('KPI Derivation, Metric Trees, and Business Logic Translation', 'Deconstructing high-level business goals into primary and input metrics. Understanding North Star Metric and counter-metrics to avoid perverse incentives.'),
        ('Exploratory Data Analysis (EDA) & Data Cleansing Workflows', 'Identifying missing values, outliers (IQR vs Z-score), distribution skewness, categorical encoding, and duplicate record reconciliation.'),
        ('Cohort Analysis, Retention Curves & Churn Prediction', 'Grouping users by acquisition date and tracking retention behavior over time. Analyzing churn inflection points to identify product drop-off drivers.'),
        ('Funnel Analysis & Conversion Rate Optimization (CRO)', 'Mapping step-by-step conversion funnels (visit -> signup -> checkout). Calculating drop-off percentages at each stage to locate friction points.'),
        ('Data Storytelling & Executive Dashboard Design Principles', 'Designing dashboards tailored for C-suite decision making: high-level summaries, drill-down capabilities, clear visual hierarchy, and actionable insights.'),
    ],
    [('A/B Testing Statistical Significance & Hypothesis Testing', 'Calculating p-values, confidence intervals, sample size determination, Type I (alpha) and Type II (beta) errors, and statistical power.') for _ in range(5)],
    [('Customer Lifetime Value (CLV) & Customer Acquisition Cost (CAC) Modeling', 'Modeling payback periods, churn-adjusted CLV, and LTV:CAC ratios to evaluate unit economics and marketing channel efficiency.') for _ in range(20)],
    [('Data Governance, Data Dictionaries & Lineage Tracking', 'Establishing catalog metadata, data lineage (source to dashboard), and GDPR/CCPA compliance for customer PII.') for _ in range(15)],
    [('Automated Anomaly Detection in Business Metrics', 'Implementing statistical process control and automated alerting when metrics breach 3-sigma thresholds.') for _ in range(15)]
)

# 10. SQL
ai_data['sql'] = generate_domain_parent_sets(
    'sql', 'SQL & Relational Databases',
    [
        ('SQL Window Functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, NTILE', 'Window functions compute aggregates across rows without collapsing result sets. OVER (PARTITION BY ... ORDER BY ...). LAG/LEAD access previous/next rows.'),
        ('Common Table Expressions (CTEs) & Recursive CTEs', 'CTEs improve readability with WITH clauses. Recursive CTEs query hierarchical structures (organizational charts, category trees, graph traversals).'),
        ('B-Tree Indexing Internals vs Hash Indexes vs GIN/GiST', 'B-Tree indexes maintain sorted balanced tree for range (<, >) and equality (=) lookups. Hash indexes provide O(1) equality only. GIN indexes array and JSONB elements.'),
        ('Query Execution Plans (EXPLAIN ANALYZE) & Optimization', 'Interpreting cost, actual time, Seq Scan vs Index Scan vs Index Only Scan, Hash Join vs Nested Loop, and eliminating temporary disk spills.'),
        ('ACID Properties & Transaction Isolation Levels', 'Read Uncommitted, Read Committed, Repeatable Read, and Serializable. Prevent Dirty Reads, Non-repeatable Reads, and Phantom Reads using MVCC.'),
    ],
    [('Table Partitioning: Range, List, and Hash Partitioning', 'Partition massive tables to prune partitions during query execution, boosting query speed and enabling instant data dropping with DROP PARTITION.') for _ in range(5)],
    [('Optimizing Complex Multi-Table JOINs & Subqueries', 'Replacing correlated subqueries with JOINs or window functions; indexing foreign keys; analyzing join cardinality.') for _ in range(20)],
    [('Database Deadlocks & Lock Contention Analysis', 'Detecting deadlock cycles in PostgreSQL pg_stat_activity or MySQL performance_schema. Enforcing consistent lock acquisition order.') for _ in range(15)],
    [('High-Availability Database Replication: Master-Replica, Logical vs Physical', 'Physical streaming replication creates exact bit-level replicas. Logical replication replicates specific tables across different database versions.') for _ in range(15)]
)

# 11. POWER BI
ai_data['power_bi'] = generate_domain_parent_sets(
    'power_bi', 'Power BI & Business Intelligence',
    [
        ('DAX Evaluation Context: Row Context vs Filter Context', 'Row context iterates rows (calculated columns, iterators like SUMX). Filter context filters data passed to visuals. CALCULATE modifies filter context.'),
        ('Star Schema vs Snowflake Schema Data Modeling', 'Star schema has central fact table connected directly to single-tier dimension tables (fastest DAX performance). Snowflake normalizes dimensions into sub-dimensions (adds join overhead).'),
        ('Time Intelligence Functions in DAX (TOTALYTD, SAMEPERIODLASTYEAR, DATEADD)', 'Requires a contiguous, unbroken Date Dimension table marked as Date Table. Calculates rolling periods, YoY growth, and cumulative totals.'),
        ('Power Query M Formula Language & ETL Transformations', 'Step-by-step data transformations (pivoting, unpivoting, merging, custom columns) executed before data is loaded into the VertiPaq engine.'),
        ('Row-Level Security (RLS) & Dynamic Roles using USERNAME()', 'Define security roles with DAX filters (e.g. [Region] = USERPRINCIPALNAME()). Restricts data access dynamically based on signed-in user email.'),
    ],
    [('VertiPaq In-Memory Columnar Database Engine Optimization', 'VertiPaq compresses data via hash encoding, value encoding, and run-length encoding (RLE). Optimize by reducing column cardinality.') for _ in range(5)],
    [('Power BI Incremental Refresh & Large Dataset Storage Formats', 'Partitions historical data while refreshing only recently modified partitions, reducing refresh time from hours to minutes.') for _ in range(20)],
    [('Composite Models & DirectQuery vs Import Mode', 'Import mode loads data into RAM for maximum speed. DirectQuery queries source DB in real-time for massive datasets or real-time requirements.') for _ in range(15)],
    [('Enterprise Power BI Deployment Pipelines & ALM Toolkit', 'Managing Development, Test, and Production workspaces with automated deployment pipelines and metadata schema validation.') for _ in range(15)]
)

# 12. DATA SCIENCE
ai_data['data_science'] = generate_domain_parent_sets(
    'data_science', 'Data Science & Applied Statistics',
    [
        ('Statistical Distributions & Central Limit Theorem (CLT)', 'Normal, Binomial, Poisson, Exponential. CLT states that the sampling distribution of the sample mean approaches normal as sample size increases, regardless of population distribution.'),
        ('Hypothesis Testing: T-Tests, ANOVA, Chi-Square Test', 'T-test compares means of two groups. ANOVA compares means across 3+ groups. Chi-Square tests independence between categorical variables.'),
        ('Linear & Logistic Regression Internals (OLS vs Maximum Likelihood)', 'Ordinary Least Squares minimizes sum of squared residuals. Logistic regression estimates probability using sigmoid function and optimizes cross-entropy loss via gradient descent.'),
        ('Dimensionality Reduction: PCA, t-SNE, and UMAP', 'PCA performs orthogonal linear transformation maximizing variance. t-SNE and UMAP preserve non-linear local neighborhood structures for 2D/3D visualization.'),
        ('Time-Series Forecasting: ARIMA, SARIMA, and Prophet', 'Decomposition into Trend, Seasonality, and Residuals. Stationarity testing with Augmented Dickey-Fuller (ADF) test; differencing to achieve stationarity.'),
    ],
    [('Unsupervised Clustering: K-Means, DBSCAN, Hierarchical Clustering', 'K-Means optimizes inertia (sensitive to outliers). DBSCAN clusters based on density and detects arbitrary shapes and noise points.') for _ in range(5)],
    [('Feature Selection: Filter, Wrapper, and Embedded Methods', 'Filter (correlation, mutual info). Wrapper (RFE - Recursive Feature Elimination). Embedded (Lasso L1 regularization setting coefficients to zero).') for _ in range(20)],
    [('Handling Severely Imbalanced Datasets (SMOTE, Focal Loss)', 'SMOTE synthesizes minority class samples in feature space. Focal loss down-weights easy examples to focus training on hard minority class instances.') for _ in range(15)],
    [('End-to-End MLOps Pipeline with MLflow & Docker', 'Tracking experiments (parameters, metrics, artifacts) in MLflow, model registry versioning, and deploying models as REST endpoints.') for _ in range(15)]
)

# 13. DATA MINING
ai_data['data_mining'] = generate_domain_parent_sets(
    'data_mining', 'Data Mining & Pattern Discovery',
    [
        ('Association Rule Mining: Apriori Algorithm & FP-Growth', 'Extracting relationships from transaction databases. Support (frequency), Confidence (certainty), and Lift (strength of association over independent baseline).'),
        ('Anomaly Detection: Isolation Forests, Local Outlier Factor (LOF), One-Class SVM', 'Isolation Forests isolate anomalies by random partitioning (anomalies require fewer splits). LOF measures local density deviation compared to neighbors.'),
        ('Text Mining, TF-IDF, and Topic Modeling with LDA', 'Term Frequency-Inverse Document Frequency highlights distinctive words in documents. Latent Dirichlet Allocation (LDA) models documents as mixtures of topics.'),
        ('Data Preprocessing: Discretization, Normalization, and Binning', 'Equal-width vs equal-frequency binning. Min-Max scaling vs Z-score standardization. Handling missing attribute values in high-dimensional datasets.'),
        ('Graph Mining & Social Network Analysis (PageRank, Centrality)', 'Degree, Betweenness, and Closeness centrality identify key nodes. PageRank calculates link authority via random walk probability distributions.'),
    ],
    [('Sequential Pattern Mining (PrefixSpan, GSP)', 'Discovering statistically frequent subsequences in ordered event sequences (e.g. clickstreams, customer purchase journeys).') for _ in range(5)],
    [('Spatial Data Mining & Spatial Indexing (R-Trees)', 'Querying multi-dimensional spatial geometries and clustering geographic points using spatial join algorithms.') for _ in range(20)],
    [('Mining Massive Datasets with Locality-Sensitive Hashing (LSH)', 'Hashes similar high-dimensional items into the same buckets with high probability, enabling sub-linear approximate nearest neighbor search.') for _ in range(15)],
    [('Data Stream Mining & Concept Drift Detection', 'Processing infinite data streams in single passes with bounded memory. Detecting concept drift using ADWIN or DDM algorithms.') for _ in range(15)]
)

# 14. DATA ENGINEERING
ai_data['data_engineering'] = generate_domain_parent_sets(
    'data_engineering', 'Data Engineering & Big Data',
    [
        ('Apache Spark Architecture: Driver, Executors, Tasks, and RDDs', 'Driver programs coordinate tasks. Executors run on cluster nodes executing stages. RDDs are immutable distributed collections with lazy transformations and eager actions.'),
        ('Data Lake Formats: Apache Iceberg, Delta Lake, and Apache Hudi', 'Provide ACID transactions, time-travel queries, schema evolution, and file compaction on top of cloud object storage (S3/ADLS/GCS).'),
        ('ETL vs ELT & Data Modeling with dbt (Data Build Tool)', 'ELT loads raw data into cloud warehouse (Snowflake/BigQuery) and transforms in-place using dbt SQL models with testing and documentation.'),
        ('Distributed Storage: Parquet vs ORC vs Avro', 'Parquet and ORC are columnar formats optimized for analytical read queries with snappy/gzip compression. Avro is row-based, optimized for streaming ingestion with schema evolution.'),
        ('Workflow Orchestration with Apache Airflow (DAGs, Operators, Sensors)', 'Directed Acyclic Graphs (DAGs) declare task dependencies. Operators define execution units. Sensors wait for upstream events or files before proceeding.'),
    ],
    [('Spark Optimization: Partitioning, Shuffling, Broadcast Joins, and Salting', 'Broadcast joins eliminate shuffle for small tables. Salting fixes severe partition data skew by adding random prefixes to join keys.') for _ in range(5)],
    [('Real-Time Stream Processing with Apache Flink and Kafka', 'Stateful stream processing with exactly-once semantics, event-time processing, watermarks, and tumbling/sliding window aggregations.') for _ in range(20)],
    [('Modern Cloud Data Warehouses: Snowflake vs BigQuery Architecture', 'Snowflake separates compute (virtual warehouses) from storage with micro-partitions. BigQuery uses Dremel serverless query engine with Borg execution.') for _ in range(15)],
    [('Data Quality Monitoring & Anomaly Detection with Great Expectations', 'Automating data contract assertions (expect_column_values_to_not_be_null) in data pipelines to prevent corrupted data from reaching dashboards.') for _ in range(15)]
)

print(f"Total AI, DevOps & Data Stacks Generated: {len(ai_data)}")
write_php_file(os.path.join(OUT_DIR, 'ai_devops_data_mock_parent_sets.php'), ai_data)
