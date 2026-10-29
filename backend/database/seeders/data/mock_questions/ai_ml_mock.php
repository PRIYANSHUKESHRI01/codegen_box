<?php

// Auto-generated curated vault questions for Mellow Vault AI Interview

return [
    'llm_rag' => [
        1 => [
            [
                'text' => 'What are text embeddings, and how do vector similarity metrics like Cosine Similarity and Dot Product determine semantic closeness?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Candidate should explain high-dimensional dense representations, cosine similarity (angle between normalized vectors), dot product, and Euclidean distance.',
            ],
            [
                'text' => 'Compare common vector databases (e.g. Pinecone, Chroma, Qdrant, pgvector). How does pgvector compare to a dedicated vector store?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Should contrast dedicated engines (distributed HNSW indexing, filtering speed) with pgvector (convenient SQL joins with existing data, lower ops overhead for small-to-medium scale).',
            ],
            [
                'text' => 'What prompt engineering techniques (e.g. Few-Shot, Chain-of-Thought, System Instructions) do you use to improve LLM reasoning accuracy?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Candidate should explain zero-shot vs few-shot exemplars, step-by-step CoT reasoning, and separating system guardrails from user input.',
            ],
            [
                'text' => 'How do you handle context window limits when sending large documents or long conversation histories to an LLM?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Techniques: conversation summarization, sliding window of recent turns, retrieval-augmented injection of only relevant document passages.',
            ],
            [
                'text' => 'What causes LLM hallucinations, and what strategies can you implement in prompt design and temperature settings to reduce them?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Hallucinations stem from probabilistic token completion without factual grounding. Mitigated by lowering temperature (e.g. 0.0-0.2), grounding prompts with reference context, and requiring citations.',
            ],
        ],
        2 => [
            [
                'text' => 'Walk through the core steps of a standard Retrieval-Augmented Generation (RAG) pipeline from document ingestion to final LLM response.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Ingestion: document parsing, chunking, embedding generation, vector store index. Query time: query embedding, vector search, top-k retrieval, prompt formatting, LLM generation.',
            ],
            [
                'text' => 'How do document chunking strategies (fixed-size, sentence-level, semantic chunking) impact retrieval relevance in a RAG system?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Fixed chunks with overlap prevent split sentences; semantic chunking groups by meaning; small chunks improve embedding precision, while large chunks provide richer context.',
            ],
            [
                'text' => 'What is Hybrid Search in RAG, and why does combining dense vector search with sparse keyword search (BM25) improve retrieval quality?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Dense search captures semantic meaning and synonyms; sparse search excels at exact matches (product codes, names, acronyms). Reciprocal Rank Fusion (RRF) merges results.',
            ],
            [
                'text' => 'How do re-ranking models (like Cohere Rerank or BGE Reranker) work, and why are they applied after the initial vector retrieval stage?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Vector search is bi-encoder based (fast, approximate); re-ranker is a cross-encoder evaluating query-document pairs together (slower, highly accurate), refining top-k candidates.',
            ],
            [
                'text' => 'How do you evaluate RAG pipeline quality using frameworks like RAGAS or TruLens (Faithfulness, Answer Relevance, Context Precision)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Faithfulness (answer grounded in retrieved context), Answer Relevance (directly answers user question), Context Precision/Recall (retrieved chunks contain necessary ground truth).',
            ],
        ],
        3 => [
            [
                'text' => 'When should you choose RAG over Fine-Tuning an open-source LLM (e.g. LLaMA/Mistral), and when does Fine-Tuning make sense?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'RAG is best for dynamic/frequently updated enterprise data, citation support, and fast setup. Fine-tuning is best for teaching tone, specialized formatting, domain terminology, or small task-specific models.',
            ],
            [
                'text' => 'What is Parameter-Efficient Fine-Tuning (PEFT/LoRA), and how does Low-Rank Adaptation train large models on consumer GPUs?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'LoRA freezes base model weights and injects trainable rank-decomposition matrices into transformer attention layers, dramatically reducing VRAM and trainable parameter count by 99%.',
            ],
            [
                'text' => 'How do you implement guardrails (e.g. NeMo Guardrails, Llama Guard) to prevent prompt injection, jailbreaks, and toxic outputs?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Input moderation: intent classification, detecting instruction overrides ("ignore previous instructions"). Output moderation: regex PII masking, safety classifier models, toxic content filtering.',
            ],
            [
                'text' => 'How do you optimize LLM inference latency and throughput in production using techniques like KV-caching, streaming (SSE), and quantization (GGUF/AWQ)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'KV caching avoids recomputing key/value states for prefix tokens; streaming Server-Sent Events reduces time-to-first-token (TTFT); 4-bit/8-bit quantization reduces memory bandwidth bottlenecks.',
            ],
            [
                'text' => 'How do you manage LLM API rate limits, costs, and failover across multiple providers (e.g. OpenAI, Anthropic, local Ollama/vLLM)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'LLM gateway / router (LiteLLM, Portkey), exponential backoff retries, semantic caching for repeated prompts, routing simple queries to smaller models and complex queries to frontier models.',
            ],
        ],
    ],
    'deeplearning_pytorch' => [
        1 => [
            [
                'text' => 'What is a PyTorch Tensor, how does it differ from a NumPy ndarray, and how do you move tensors between CPU and GPU?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Tensors support hardware acceleration (CUDA/Metal) and automatic differentiation (autograd). Moved via .to(device) or .cuda()/.cpu(). NumPy shares memory via torch.from_numpy().',
            ],
            [
                'text' => 'How does PyTorch Autograd work under the hood? Explain requires_grad, backward(), and grad.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Builds a dynamic computational directed acyclic graph (DAG) during the forward pass; backward() traverses the DAG via chain rule to compute gradients stored in tensor.grad.',
            ],
            [
                'text' => 'Explain the structure of a custom PyTorch model using torch.nn.Module, including the __init__ and forward methods.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '__init__ initializes layers and parameters with super().__init__(); forward() defines computational flow of tensors through layers during inference and training.',
            ],
            [
                'text' => 'What is the role of torch.utils.data.Dataset and DataLoader in PyTorch? How do batch_size, shuffle, and num_workers work?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Dataset defines __len__ and __getitem__ for sample loading; DataLoader handles batching, shuffling, multiprocessing prefetching (num_workers), and memory pinning (pin_memory).',
            ],
            [
                'text' => 'Walk through the standard PyTorch training loop: zero_grad(), forward pass, loss calculation, backward(), and optimizer.step().',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'optimizer.zero_grad() clears accumulated gradients; model(inputs) outputs predictions; criterion(pred, target) yields loss; loss.backward() computes gradients; optimizer.step() updates weights.',
            ],
        ],
        2 => [
            [
                'text' => 'How do Convolutional Neural Networks (CNNs) work? Explain the roles of convolutional layers, kernel size, stride, padding, and pooling.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Kernels slide over spatial feature maps extracting localized visual patterns; stride controls step size; padding maintains spatial dimensions; pooling downsamples feature maps for translation invariance.',
            ],
            [
                'text' => 'What is Batch Normalization (BatchNorm), how does it accelerate deep network training, and how does its behavior change in train vs eval mode?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Normalizes activations across mini-batch reducing internal covariate shift; tracks running mean/variance during training; freezes statistics in model.eval() to use running metrics.',
            ],
            [
                'text' => 'How does Transfer Learning work in computer vision using pre-trained models (e.g. ResNet, EfficientNet) from torchvision?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Load pre-trained weights from ImageNet; freeze feature extraction backbone layers; replace final classification head (fc layer); optionally unfreeze top layers for fine-tuning with a lower learning rate.',
            ],
            [
                'text' => 'What are Residual Connections (skip connections) in ResNet, and what problem do they solve in very deep neural networks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'F(x) + x bypasses layers, allowing gradient signals to flow directly through skip connections during backpropagation, resolving the vanishing gradient problem in 50+ layer networks.',
            ],
            [
                'text' => 'How do Vision Transformers (ViT) differ from CNNs in how they process an image?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ViT splits image into non-overlapping patches (e.g. 16x16), flattens and linearly projects them into token embeddings with positional encodings, and processes them with standard Transformer self-attention without convolutions.',
            ],
        ],
        3 => [
            [
                'text' => 'What techniques do you use to detect and mitigate overfitting during PyTorch neural network training?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Early stopping based on validation loss, Dropout, weight decay (L2 regularization), Data Augmentation (torchvision.transforms), and reducing model capacity.',
            ],
            [
                'text' => 'How do learning rate schedulers (e.g. StepLR, CosineAnnealingLR, ReduceLROnPlateau) improve model convergence?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Reduce learning rate as training progresses to settle into sharp or wide minima; warmups stabilize early training; scheduler.step() called after optimizer.step() or after each epoch.',
            ],
            [
                'text' => 'How do you save and load model checkpoints in PyTorch, and why should you save state_dict rather than the whole model object?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'torch.save(model.state_dict(), path) serializes parameter weights dictionary, avoiding Python pickle class binding issues; saving optimizer state_dict and epoch number enables seamless training resumption.',
            ],
            [
                'text' => 'What is Automatic Mixed Precision (torch.cuda.amp / torch.autocast), and how does it speed up training while conserving VRAM?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Executes operations in FP16/BF16 where safe and FP32 for numerical stability (like reductions); GradScaler scales loss to prevent underflowing small gradients in backward pass.',
            ],
            [
                'text' => 'How do you export a PyTorch model to ONNX or TorchScript for low-latency inference in production environments?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'torch.onnx.export with dummy input tensor and dynamic axes, or torch.jit.trace/script; enables cross-platform runtime execution in ONNX Runtime, C++, or TensorRT without Python.',
            ],
        ],
    ],
    'machine_learning' => [
        1 => [
            [
                'text' => 'Explain the difference between Supervised, Unsupervised, and Reinforcement Learning with real-world industry examples.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Supervised (labeled data: fraud detection, spam classification). Unsupervised (unlabeled: customer segmentation, anomaly detection). Reinforcement (agent learning policies from rewards: robotics, game play).',
            ],
            [
                'text' => 'What is the Bias-Variance Trade-off in machine learning? How do high bias and high variance manifest in model errors?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'High bias = underfitting (oversimplified assumptions, high training error). High variance = overfitting (captures noise, low training error but high test error). Optimal model balances both.',
            ],
            [
                'text' => 'How do you handle missing values and categorical features in tabular datasets using scikit-learn?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Imputation: SimpleImputer (mean/median/mode) or KNNImputer. Categorical: OneHotEncoder (nominal with low cardinality), OrdinalEncoder (ordered ranks), TargetEncoder.',
            ],
            [
                'text' => 'Why is feature scaling (StandardScaler vs MinMaxScaler) necessary for distance-based algorithms, and why do tree models not require it?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Distance-based algorithms (KNN, SVM, K-Means, gradient descent) are skewed by feature magnitudes. Tree-based models evaluate split thresholds on individual features monotonically, immune to scale.',
            ],
            [
                'text' => 'How does Principal Component Analysis (PCA) work for dimensionality reduction, and how do you choose the number of components?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Finds orthogonal axes of maximal variance using covariance matrix eigenvectors; selects components based on cumulative explained variance ratio (e.g. capturing 90-95% of total variance).',
            ],
        ],
        2 => [
            [
                'text' => 'How does Logistic Regression classify binary outcomes, and how does the Sigmoid function map logits to probabilities?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Linear combination of weights and features z = w^T x passed through sigmoid sigma(z) = 1/(1+e^-z); output interpreted as probability P(y=1); trained via Log-Loss / Binary Cross-Entropy.',
            ],
            [
                'text' => 'How do Decision Trees make split decisions? Explain Gini Impurity and Information Gain (Entropy).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Gini impurity measures likelihood of misclassifying randomly chosen element; Information Gain measures reduction in entropy after split; tree selects feature and threshold maximizing purity gain.',
            ],
            [
                'text' => 'Compare Random Forest (Bagging) and Gradient Boosted Trees (Boosting, like XGBoost or LightGBM). How do they aggregate trees?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Random Forest builds independent deep trees in parallel on bootstrap samples and averages predictions (reduces variance). Gradient Boosting builds shallow trees sequentially, each fitting the residual errors of prior trees (reduces bias).',
            ],
            [
                'text' => 'What causes data leakage during model training, and how do scikit-learn Pipelines prevent leakage during cross-validation?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Data leakage occurs when test information influences preprocessing (e.g. scaling or imputing on full dataset before train/test split). Pipeline encapsulates transformer fit_transform on train folds only.',
            ],
            [
                'text' => 'How does K-Means clustering work, how do you determine the optimal K using the Elbow method, and what are its limitations?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Iteratively assigns points to nearest centroid and recalculates centroids; Elbow method plots inertia vs K; limitations include sensitivity to outliers, spherical cluster assumption, and initial centroid choice.',
            ],
        ],
        3 => [
            [
                'text' => 'Why is Accuracy often a misleading metric for imbalanced classification problems? Explain Precision, Recall, and F1-Score.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'With 99:1 imbalance, predicting majority class yields 99% accuracy. Precision = TP/(TP+FP) (minimizes false alarms). Recall = TP/(TP+FN) (minimizes missed detections). F1 is harmonic mean.',
            ],
            [
                'text' => 'What is the ROC Curve and AUC (Area Under Curve)? How do you interpret an AUC score of 0.5 versus 0.9?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Plots True Positive Rate against False Positive Rate across all decision thresholds. AUC 0.5 represents random guessing; 0.9 represents strong discriminative ability between classes.',
            ],
            [
                'text' => 'What techniques (e.g. SMOTE, class weighting, focal loss) do you apply to train models on severely imbalanced datasets?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Oversampling minority class synthetically (SMOTE), undersampling majority, adjusting class_weight="balanced" in scikit-learn loss function to penalize minority misclassifications more heavily.',
            ],
            [
                'text' => 'How do K-Fold Cross-Validation and Stratified K-Fold work, and why is Stratification essential for classification?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Splits dataset into K equal subsets; trains on K-1 and tests on 1, rotating through all K. Stratified K-Fold preserves exact percentage of samples for each class in every fold.',
            ],
            [
                'text' => 'How do you interpret machine learning models using SHAP (Shapley Additive exPlanations) or feature importance for business stakeholders?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'SHAP uses game theory to calculate marginal contribution of each feature to individual predictions; explains both global feature importance and local single-row predictions directionally.',
            ],
        ],
    ],
    'nlp' => [
        1 => [
            [
                'text' => 'What is tokenization in NLP? Compare word-level tokenization, character-level tokenization, and subword tokenization (BPE/WordPiece).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Word tokenization struggles with out-of-vocabulary (OOV) words; character tokenization yields very long sequences; subword tokenization (Byte-Pair Encoding, WordPiece) strikes balance with compact fixed vocabulary.',
            ],
            [
                'text' => 'What are Stop Words, Stemming, and Lemmatization? When should you keep stop words instead of removing them?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Stop words are common words (a, the); stemming chops word suffixes heuristically (Porter); lemmatization resolves dictionary lemma (WordNet). Keep stop words in sentiment analysis, question answering, and modern transformers.',
            ],
            [
                'text' => 'Explain the Bag-of-Words (BoW) model and TF-IDF (Term Frequency-Inverse Document Frequency). How does TF-IDF downweight common terms?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'BoW counts raw token frequencies ignoring order. TF-IDF weights term frequency by inverse document frequency log(N/df), giving low weight to terms appearing across almost all documents.',
            ],
            [
                'text' => 'What is Named Entity Recognition (NER) and Part-of-Speech (POS) tagging? What are common libraries used for these tasks in Python?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'POS tags grammatical categories (noun, verb); NER identifies real-world entities (Person, Organization, Location). Implemented with spaCy or NLTK using pre-trained statistical or neural pipelines.',
            ],
            [
                'text' => 'What are n-grams in text processing, and how do bigrams or trigrams capture local context that single words miss?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Continuous sequences of n items; captures negations ("not good") and compound nouns ("machine learning") that unigrams treat independently.',
            ],
        ],
        2 => [
            [
                'text' => 'How does Word2Vec work? Explain the difference between Continuous Bag of Words (CBOW) and Skip-gram architectures.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'CBOW predicts target word from surrounding context words (faster, better for frequent words); Skip-gram predicts context words given target word (better for rare words and small datasets).',
            ],
            [
                'text' => 'How do Recurrent Neural Networks (RNNs) process sequential text data, and why do they suffer from the Vanishing Gradient problem?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Passes hidden state vector sequentially across time steps; during backpropagation through time (BPTT), repeated matrix multiplications cause gradients to exponentially decay or explode over long sentences.',
            ],
            [
                'text' => 'How do Long Short-Term Memory (LSTM) networks overcome the vanishing gradient problem? Explain the Forget, Input, and Output gates.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Maintains separate cell state acting as an information highway; Forget gate discards irrelevant past info; Input gate writes new candidate info; Output gate determines next hidden state.',
            ],
            [
                'text' => 'How does the Gated Recurrent Unit (GRU) simplify the LSTM architecture while retaining long-term memory?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Merges cell state and hidden state into one vector; combines gates into two gates (Reset gate and Update gate), reducing parameter count and training faster.',
            ],
            [
                'text' => 'What limitations of static word embeddings (Word2Vec, GloVe) motivated contextual embeddings (BERT, ELMo)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Static embeddings assign a single static vector per word regardless of context (polysemy: "bank" of a river vs financial "bank"). Contextual embeddings compute representations dynamically based on surrounding tokens.',
            ],
        ],
        3 => [
            [
                'text' => 'Explain the Self-Attention mechanism in the Transformer architecture. What are Query, Key, and Value vectors, and how is attention calculated?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Attention(Q,K,V) = softmax(Q K^T / sqrt(d_k)) V. Scaled dot-product computes similarity between each token query and all token keys, weighting value vectors accordingly.',
            ],
            [
                'text' => 'Compare BERT and GPT architectures. Why is BERT bidirectional (encoder) while GPT is autoregressive (decoder)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'BERT (encoder-only) sees full context simultaneously, trained on Masked Language Modeling (ideal for classification/NER). GPT (decoder-only) with causal masking predicts next token left-to-right (ideal for generation).',
            ],
            [
                'text' => 'How do you fine-tune a pre-trained transformer model for text classification using the Hugging Face transformers library?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'AutoTokenizer and AutoModelForSequenceClassification, tokenize dataset with truncation/padding, configure TrainingArguments and Trainer with evaluation metric compute_metrics.',
            ],
            [
                'text' => 'Explain NLP evaluation metrics: Perplexity, BLEU score, and ROUGE score. What are their use cases?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Perplexity measures language model prediction uncertainty (lower is better). BLEU measures n-gram precision against references (machine translation). ROUGE measures n-gram recall (summarization).',
            ],
            [
                'text' => 'How do Positional Encodings work in Transformers, and why are they necessary since attention itself has no concept of word order?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Self-attention is permutation-invariant; sinusoidal or learned positional vectors are added to input token embeddings so the model knows relative or absolute token positions.',
            ],
        ],
    ],
    'robotics' => [
        1 => [
            [
                'text' => 'What is the difference between Forward Kinematics and Inverse Kinematics for a robotic manipulator arm?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Forward kinematics computes end-effector Cartesian pose from known joint angles (unique closed-form solution). Inverse kinematics computes required joint angles to achieve a target Cartesian pose (may have multiple or zero solutions).',
            ],
            [
                'text' => 'How do Denavit-Hartenberg (DH) parameters represent coordinate frames and kinematic chains in robotics?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Four parameters per link: link length (a), link twist (alpha), link offset (d), and joint angle (theta); systematically transforms coordinate systems between consecutive robot joints.',
            ],
            [
                'text' => 'Explain how common robotics sensors work: LiDAR, Depth Cameras (RGB-D), Ultrasonic, and Inertial Measurement Units (IMU).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'LiDAR (time-of-flight laser distance measurements for 2D/3D point clouds). RGB-D (color + structured light/time-of-flight depth per pixel). Ultrasonic (sonar distance). IMU (accelerometer + gyroscope for orientation).',
            ],
            [
                'text' => 'What is sensor noise and calibration? Why must IMUs and cameras be calibrated before deployment on an autonomous robot?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Raw sensor data exhibits bias, scale factor errors, and drift (especially IMU integration drift). Calibration determines intrinsic parameters (lens distortion) and extrinsic transformations between sensors.',
            ],
            [
                'text' => 'What is wheel odometry, how is it calculated from rotary optical encoders, and what causes dead-reckoning drift over time?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Calculates distance traveled from wheel pulse counts and wheel radius. Drift accumulates from wheel slippage, uneven ground, and small orientation measurement errors.',
            ],
        ],
        2 => [
            [
                'text' => 'Explain the core communication primitives in ROS 2: Nodes, Topics (Publish/Subscribe), Services (Request/Response), and Actions.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Nodes are independent processes. Topics are asynchronous one-to-many data streams. Services are synchronous request/reply RPCs. Actions are long-running preemptible goals with feedback.',
            ],
            [
                'text' => 'What improvements did ROS 2 introduce over ROS 1, particularly regarding DDS middleware, master node, and real-time support?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ROS 2 replaces single master (roscore) with decentralized Data Distribution Service (DDS) discovery, supports real-time operating systems (RTOS), multi-robot swarms, and QoS profiles.',
            ],
            [
                'text' => 'What is the tf2 transform library in ROS/ROS 2, and why is tracking coordinate transforms over time essential for mobile robots?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'tf2 maintains a buffered tree of coordinate frames (e.g. map -> odom -> base_link -> laser_frame) over time, allowing nodes to transform sensor readings into any reference frame.',
            ],
            [
                'text' => 'How do global path planning algorithms (like A* or Dijkstra) and local trajectory planners (like Dynamic Window Approach - DWA) work together in Nav2?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Global planner finds high-level obstacle-free path across static costmap from start to goal; local planner generates immediate motor velocity commands (cmd_vel) avoiding dynamic obstacles.',
            ],
            [
                'text' => 'What is an Occupancy Grid Map in mobile robotics, and how do costmaps (global vs local costmap) represent obstacles and inflation radii?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '2D grid where cells represent probability of obstacle occupancy (0 free, 100 occupied, -1 unknown). Inflation layers add safety buffers around obstacles based on robot footprint.',
            ],
        ],
        3 => [
            [
                'text' => 'What is Simultaneous Localization and Mapping (SLAM), and why is it considered a "chicken-and-egg" problem in autonomous navigation?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Robot needs an accurate map to localize its position, but needs an accurate position estimate to build the map. Solved simultaneously via probabilistic filtering or graph optimization.',
            ],
            [
                'text' => 'How does an Extended Kalman Filter (EKF) fuse noisy IMU and wheel odometry data to estimate robot state accurately?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Predict step projects state and covariance forward using motion model; Update step incorporates incoming sensor measurements weighted by Kalman Gain based on measurement noise covariance (robot_localization package).',
            ],
            [
                'text' => 'What is loop closure in visual or LiDAR SLAM, and how does graph SLAM optimize pose history when a previously visited place is recognized?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Recognizing a previously visited location creates a constraint between non-consecutive robot poses; non-linear least squares optimization (g2o/GTSAM) adjusts the entire pose graph to eliminate accumulated drift.',
            ],
            [
                'text' => 'What safety systems, watchdog timers, and hardware emergency stops (E-Stops) must be implemented on industrial autonomous mobile robots (AMRs)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Hardware hardwired E-stop circuits, safety-rated LiDAR scanner zones (warning/protective stop), heartbeat watchdog timers halting motors if ROS node crashes, and collision bumpers.',
            ],
            [
                'text' => 'How do you simulate robotic platforms using Gazebo or Isaac Sim, and what is the "sim-to-real" gap when transferring policies to real hardware?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Physics engines simulate gravity, collisions, and sensor raycasting using URDF/SDF models. Sim-to-real gap arises from unmodeled friction, motor backlash, and lighting differences; mitigated via domain randomization.',
            ],
        ],
    ],
];
