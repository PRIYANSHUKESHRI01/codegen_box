"""Generate mock interview questions Part 5: Data Stacks (6 stacks)

Stacks:
  data_analytics
  sql
  power_bi
  data_science
  data_mining
  data_engineering

Outputs:
  backend/database/seeders/data/mock_questions/data_mock.php
"""
from pathlib import Path
from vault_helper import write_php_file

STACKS = {
    'data_analytics': {
        1: [
            {
                'text': 'How do you perform Exploratory Data Analysis (EDA) on a messy raw spreadsheet or CSV in Python (Pandas) or Excel before building reports?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Checking summary statistics (describe/info), null counts, duplicate records, data types, unexpected outliers with boxplots, and distributions with histograms.',
            },
            {
                'text': 'What are the most essential Excel formulas for an analyst (e.g. XLOOKUP, INDEX/MATCH, SUMIFS, COUNTIFS), and when do you use Pivot Tables?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'XLOOKUP replaces VLOOKUP with left/right lookups and default values; SUMIFS/COUNTIFS for multi-criteria aggregations; Pivot Tables for rapid multidimensional summarization.',
            },
            {
                'text': 'How do you detect and handle outliers in a dataset, and when is it appropriate to keep them versus remove or cap them?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Z-score (> 3 standard deviations) or IQR method (1.5 * IQR above Q3 or below Q1); keep legitimate business phenomena (e.g. high-value enterprise sales) or cap (winsorizing); remove data entry errors.',
            },
            {
                'text': 'What is the difference between Mean, Median, and Mode? Why is Median preferred over Mean when analyzing skewed metrics like salaries or housing prices?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Mean is the arithmetic average, heavily pulled by extreme right-tail outliers. Median represents the 50th percentile midpoint, remaining robust and representative of central tendency in skewed data.',
            },
            {
                'text': 'How do you clean and standardize date and time formats across diverse data sources with different time zones?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Parsing strings into datetime objects (pd.to_datetime), converting all timestamps to UTC as canonical standard, and formatting into ISO 8601 strings (YYYY-MM-DD HH:MM:SS).',
            },
        ],
        2: [
            {
                'text': 'Write an explanation of how to calculate Monthly Active Users (MAU) and month-over-month user retention rate using SQL.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'COUNT(DISTINCT user_id) grouped by date_trunc("month", activity_timestamp); cohort retention joins user activity in month M to month M+1, calculating percentage retained.',
            },
            {
                'text': 'Explain the difference between INNER JOIN, LEFT JOIN, FULL OUTER JOIN, and CROSS JOIN with a concrete customer/orders example.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'INNER JOIN (matching rows in both), LEFT JOIN (all customers, with order data if present), FULL OUTER (all customers and all unassigned orders), CROSS JOIN (Cartesian product of all rows).',
            },
            {
                'text': 'What is the difference between WHERE and HAVING clauses in SQL? Can you use aggregate functions in a WHERE clause?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'WHERE filters individual records before aggregation (cannot take aggregate functions); HAVING filters grouped result sets after GROUP BY execution.',
            },
            {
                'text': 'How do you calculate Customer Lifetime Value (CLV) and Customer Acquisition Cost (CAC), and what is a healthy LTV:CAC ratio?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CLV = Average Purchase Value * Frequency * Average Lifespan (or Gross Margin / Churn). CAC = Total Sales & Marketing Spend / New Customers Acquired. Healthy benchmark is typically 3:1 or higher.',
            },
            {
                'text': 'How do you handle NULL values in SQL aggregations and mathematical calculations (e.g. COALESCE, IFNULL)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Math with NULL returns NULL; COUNT(column) ignores NULLs while COUNT(*) counts all rows; COALESCE(col, default) replaces NULL with fallback values like 0.',
            },
        ],
        3: [
            {
                'text': 'How do you design a business dashboard so that executives can grasp primary KPIs in under five seconds?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Place headline KPI cards at top (F-pattern layout), use consistent clean color palette (avoid rainbow charts), keep uncluttered whitespace, and provide drill-down filters below.',
            },
            {
                'text': 'Explain the basic principles of A/B testing: hypothesis definition, sample size calculation, statistical significance (p-value), and avoiding peeking.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Null vs alternative hypothesis, determining sample size beforehand based on power (80%) and alpha (0.05), p-value < 0.05 rejecting null, and peeking inflating false positive rate.',
            },
            {
                'text': 'What chart type should you choose to visualize: (a) part-to-whole composition, (b) trend over time, and (c) relationship between two continuous variables?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': '(a) Stacked bar or donut chart (limited slices), (b) Line chart with time on X-axis, (c) Scatter plot with optional trendline.',
            },
            {
                'text': 'How do you investigate a sudden 20% drop in revenue reported on a Monday morning? Walk through your root cause analysis.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'First verify data pipeline health; segment by platform, region, payment gateway, traffic source, and device; check for external factors (holidays, outages, tracking script bugs).',
            },
            {
                'text': 'How do you translate complex technical statistical findings into actionable business recommendations for non-technical stakeholders?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Focus on revenue, retention, and operational efficiency outcomes rather than algorithmic jargon; lead with the executive summary/recommendation; use clear visuals with annotated callouts.',
            },
        ],
    },

    'sql': {
        1: [
            {
                'text': 'What is the logical query processing order of an SQL SELECT statement (FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Execution order: FROM/JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT/OFFSET. Explains why column aliases defined in SELECT cannot be used in WHERE.',
            },
            {
                'text': 'What is the difference between UNION and UNION ALL in SQL, and what are the performance implications of each?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'UNION removes duplicate rows by performing an expensive internal sort or hash deduplication; UNION ALL appends result sets directly without deduplication (much faster).',
            },
            {
                'text': 'What is the difference between CHAR, VARCHAR, and TEXT data types, and how do database engines store them?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CHAR is fixed-length (padded with spaces); VARCHAR is variable-length up to N characters with length prefix byte(s); TEXT is variable-length stored out-of-row for large blocks of text.',
            },
            {
                'text': 'What are primary keys, foreign keys, and unique constraints? How do cascading deletes (ON DELETE CASCADE) work?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Primary key uniquely identifies row and enforces non-null; foreign key maintains referential integrity to another table; ON DELETE CASCADE automatically removes child rows when parent is deleted.',
            },
            {
                'text': 'How does the LIKE operator with wildcards (% and _) differ from the IN and BETWEEN operators?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': '% matches zero or more characters; _ matches exactly one character; IN checks membership against discrete list; BETWEEN checks inclusive continuous range (lower AND upper).',
            },
        ],
        2: [
            {
                'text': 'What are SQL Window Functions, and how do ROW_NUMBER(), RANK(), and DENSE_RANK() differ when handling ties?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Window functions compute across a row partition without collapsing rows. ROW_NUMBER assigns distinct sequential numbers (1,2,3); RANK assigns same rank on ties and skips (1,2,2,4); DENSE_RANK assigns same rank without skipping (1,2,2,3).',
            },
            {
                'text': 'How do you use Common Table Expressions (CTEs) with the WITH clause? When is a recursive CTE used (e.g. organizational hierarchy)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CTEs improve query readability and modularity. Recursive CTE has anchor member UNION ALL recursive member terminating when no new rows are produced, ideal for trees/graphs.',
            },
            {
                'text': 'Explain LEAD() and LAG() window functions and how you use them to calculate period-over-period differences or running trends.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'LAG(col, offset) accesses previous row value in partition; LEAD(col, offset) accesses subsequent row value; subtracting LAG(revenue) from revenue yields growth between periods.',
            },
            {
                'text': 'What is the difference between a Correlated Subquery and a Non-Correlated Subquery? What are the performance implications?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Non-correlated subquery executes once independently of outer query. Correlated subquery references columns from outer query, re-evaluating for every candidate row (potentially O(N^2) if not optimized by query planner).',
            },
            {
                'text': 'How do running totals and moving averages work using SUM() OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN ...)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Running total: SUM(amount) OVER (ORDER BY trans_date ROWS UNBOUNDED PRECEDING). 7-day moving avg: AVG(amount) OVER (ORDER BY trans_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW).',
            },
        ],
        3: [
            {
                'text': 'How do B-Tree indexes work in relational databases, and what does it mean when an index is a Covering Index?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Self-balancing tree structure providing O(log N) lookups, range scans, and sorting. Covering index includes all columns required by the query in the index itself, avoiding table heap lookups entirely.',
            },
            {
                'text': 'How do you read an EXPLAIN or EXPLAIN ANALYZE execution plan to identify performance bottlenecks (Index Scan vs Sequential Scan)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Seq Scan indicates full table scan (missing index or high selectivity); Index Scan traverses B-tree; Index Only Scan reads index only; look at estimated rows vs actual rows and execution time.',
            },
            {
                'text': 'What is the Leftmost Prefix Rule in composite (multi-column) indexes, and why does column order matter?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Index on (A, B, C) can satisfy queries filtering on (A), (A, B), or (A, B, C), but cannot be used for queries filtering only on (B) or (C) because the tree is sorted primarily by column A.',
            },
            {
                'text': 'Explain the four standard ANSI SQL transaction isolation levels: Read Uncommitted, Read Committed, Repeatable Read, and Serializable.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain Dirty Reads, Non-Repeatable Reads, and Phantom Reads, and how each isolation level balances data consistency against concurrent transaction throughput.',
            },
            {
                'text': 'What are database deadlocks, how do database engines detect them, and what application design strategies prevent deadlocks?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Two transactions hold locks that each other need, creating a circular wait. Engine detects via wait-for graph and aborts one transaction; prevent by always acquiring row locks in consistent order across all transactions.',
            },
        ],
    },

    'power_bi': {
        1: [
            {
                'text': 'What is Power Query (M language) in Power BI, and what types of data transformations do you typically perform in it before loading into the model?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Data extraction and transformation engine: changing data types, unpivoting columns, trimming whitespace, splitting columns by delimiter, merging and appending queries.',
            },
            {
                'text': 'Explain the difference between a Star Schema and a Snowflake Schema in Power BI data modeling. Why is Star Schema preferred?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Star schema has central fact tables connected directly to denormalized dimension tables. Snowflake normalizes dimensions into multiple levels. Star schema optimizes VertiPaq engine compression and DAX performance.',
            },
            {
                'text': 'What is the difference between Fact Tables and Dimension Tables with an e-commerce retail example?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Fact table holds numeric transactional measurements (sales quantity, amount, order date). Dimension table holds descriptive attributes to filter or group by (customers, products, stores, calendar).',
            },
            {
                'text': 'Why is creating a dedicated Date/Calendar Table critical in Power BI, and what requirements must it meet for Time Intelligence functions?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must have continuous date range with no missing dates, cover full years of transactional data, have a column marked as Date table, and contain fields like Year, Quarter, Month, and Fiscal periods.',
            },
            {
                'text': 'How do relationship cardinalities (1-to-many, many-to-many) and cross-filter directions (Single vs Both) impact data models in Power BI?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': '1-to-many is standard; many-to-many causes ambiguity and performance hits. Single cross-filter flows filter from dimension to fact; Both cross-filters both directions, which can cause circular paths and unexpected filter propagation.',
            },
        ],
        2: [
            {
                'text': 'What is the fundamental difference between a Calculated Column and a DAX Measure in Power BI? When should you use each?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Calculated column is evaluated row-by-row during data refresh and stored in memory (consumes RAM). Measure is calculated on-the-fly based on visual filter context (consumes CPU, zero RAM footprint).',
            },
            {
                'text': 'Explain the concept of Filter Context and Row Context in DAX. How does the CALCULATE function modify filter context?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Row context exists in calculated columns or iterator functions (SUMX). Filter context is the active filters from slicers, visuals, and page filters. CALCULATE transitions row context to filter context and applies new filter overrides.',
            },
            {
                'text': 'How do DAX iterator functions (SUMX, AVERAGEX, COUNTX) work, and how do they differ from simple aggregators (SUM, AVERAGE)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Iterators take a table and an expression, iterating row-by-row to evaluate the expression (e.g. Quantity * UnitPrice) before aggregating the results; simple SUM operates on a single pre-existing column.',
            },
            {
                'text': 'Walk through writing a Year-to-Date (YTD) and Same Period Last Year (SPLY) sales measure in DAX using Time Intelligence functions.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'TOTALYTD([Total Sales], DimDate[Date]) and CALCULATE([Total Sales], SAMEPERIODLASTYEAR(DimDate[Date])). Candidate explains requirement for contiguous date table.',
            },
            {
                'text': 'What does the ALL() and ALLEXCEPT() function do in DAX, and how do you use them to calculate a percentage-of-total measure?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ALL() removes active filter context from specified table or columns. Percentage of total: DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(DimProduct))).',
            },
        ],
        3: [
            {
                'text': 'How do you implement Row-Level Security (RLS) in Power BI to restrict data access so managers only see their regional branch?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Define roles in Power BI Desktop with DAX filter expression (e.g. [Region] = USERNAME() or USERPRINCIPALNAME() for dynamic RLS); map Azure AD security groups or users to roles in Power BI Service.',
            },
            {
                'text': 'How do you use the Performance Analyzer in Power BI to diagnose slow visual loading times (DAX query vs Visual display vs DirectQuery)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Record visual durations; inspect breakdown between DAX Query time, Visual Display rendering, and Other (wait time). Copy DAX query into DAX Studio to analyze server timings and SE/FE engine splits.',
            },
            {
                'text': 'Compare Import Mode, DirectQuery, and Composite Models in Power BI. What are the trade-offs in performance, freshness, and feature support?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Import mode loads data into in-memory VertiPaq engine (fastest, scheduled refresh). DirectQuery queries source live (always fresh, slower, limited DAX). Composite models combine both.',
            },
            {
                'text': 'How do bookmarks, selection panes, and drill-through actions enhance user interactivity and report navigation in Power BI?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Bookmarks capture report state (visual visibility, slicer filters) to create tab navigation and pop-up filter panels. Drill-through passes entity context to detailed destination report pages.',
            },
            {
                'text': 'What best practices should you follow to optimize a Power BI file size and memory consumption before publishing to Power BI Service?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Remove unused columns (especially high-cardinality GUIDs or timestamp fractions), disable Auto Date/Time, optimize relationship cardinality, and summarize granular transactions if detail is not required.',
            },
        ],
    },

    'data_science': {
        1: [
            {
                'text': 'Explain the difference between Descriptive, Predictive, and Prescriptive Analytics in a data science lifecycle.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Descriptive (what happened: historical aggregations, dashboards). Predictive (what will happen: ML models, forecasting). Prescriptive (what should we do: optimization algorithms, decision engines).',
            },
            {
                'text': 'What is a p-value in hypothesis testing, and what does it mean to reject the null hypothesis at an alpha level of 0.05?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Probability of obtaining test results at least as extreme as observed, assuming null hypothesis is true. p < 0.05 means less than 5% chance the observed effect was random chance, rejecting the null.',
            },
            {
                'text': 'Explain Type I (False Positive) and Type II (False Negative) errors with a clinical or fraud detection example.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Type I error: rejecting true null (convicting innocent person / flagging valid payment as fraud). Type II error: failing to reject false null (missing a cancer diagnosis / approving fraudulent charge).',
            },
            {
                'text': 'What is the Central Limit Theorem (CLT), and why does it justify applying parametric statistical tests to non-normal population data?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'States that the distribution of sample means approaches a normal distribution as sample size N grows (typically N >= 30), regardless of the underlying population distribution shape.',
            },
            {
                'text': 'How do you test for differences between two or more groups (t-test vs ANOVA)? When do you use non-parametric tests like Mann-Whitney U?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Two-sample t-test compares means of 2 groups; ANOVA compares means across 3+ groups. Use non-parametric tests (Mann-Whitney / Kruskal-Wallis) when normality assumption is severely violated or sample size is very small.',
            },
        ],
        2: [
            {
                'text': 'Explain the mathematical assumptions of Ordinary Least Squares (OLS) Linear Regression (linearity, independence, homoscedasticity, normality).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Linear relationship between X and Y, independent observations (no autocorrelation), constant residual variance across predictions (homoscedasticity), and normally distributed error terms.',
            },
            {
                'text': 'What is Multicollinearity in regression models, how do Variance Inflation Factor (VIF) scores detect it, and how do you resolve it?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'High correlation between independent predictor variables. Inflates coefficient standard errors making them unstable. VIF > 5 or 10 signals multicollinearity; resolved by dropping redundant features or applying PCA/L2 regularization.',
            },
            {
                'text': 'Compare Ridge Regression (L2 penalty) and Lasso Regression (L1 penalty). Why does Lasso drive coefficients to exactly zero?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Ridge shrinks coefficients asymptotically towards zero (handles multicollinearity). Lasso adds absolute penalty ||w||_1 whose diamond constraint contour intersects loss surface at sharp corners, performing automatic feature selection.',
            },
            {
                'text': 'How do you engineer interaction features and polynomial features to help linear models capture non-linear relationships?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Interaction terms (x1 * x2) capture synergistic effects where impact of one feature depends on another; polynomial features (x^2, x^3) fit curved relationships without using non-linear models.',
            },
            {
                'text': 'How do time-series models handle seasonality, trends, and stationarity? What is the Augmented Dickey-Fuller (ADF) test?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Stationarity requires constant mean and variance over time; ADF test checks for presence of unit root (p < 0.05 indicates stationarity); non-stationary series are made stationary via differencing or log transformations.',
            },
        ],
        3: [
            {
                'text': 'How do you evaluate regression models using MAE, MSE, RMSE, and R-squared (R²)? When is MAE preferred over RMSE?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'MAE treats all errors linearly; RMSE squares errors penalizing large outlier errors heavily; R² indicates proportion of variance explained by model. MAE is preferred when data contains heavy-tailed outliers.',
            },
            {
                'text': 'How does cross-validation for time-series data (TimeSeriesSplit / Walk-Forward Validation) differ from standard K-Fold cross-validation?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Standard K-Fold shuffles future data into training folds, causing look-ahead bias and temporal leakage. TimeSeriesSplit uses expanding historical windows where test set always occurs strictly after training window.',
            },
            {
                'text': 'What is target leakage in predictive modeling, and what red flags in training metrics usually signal its presence?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Target leakage occurs when training data includes variables created after or directly derived from the target outcome. Red flag: an unrealistically perfect ROC-AUC score of 0.999 or 1.00 on the first attempt.',
            },
            {
                'text': 'How do you set a classification probability threshold based on asymmetric business costs (e.g. false negative cost vs false positive cost)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Default 0.5 threshold assumes equal cost. In disease or fraud detection, missing a case (FN) costs \$10,000 while false alert (FP) costs \$50. Threshold is lowered (e.g. to 0.15) to maximize recall and minimize expected financial loss.',
            },
            {
                'text': 'What is concept drift and data drift in production ML models, and how do you monitor for drift over time?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Data drift: P(X) changes (input feature distribution shifts). Concept drift: P(Y|X) changes (underlying relationship changes). Monitored using population stability index (PSI), Kolmogorov-Smirnov test, and ground-truth error tracking.',
            },
        ],
    },

    'data_mining': {
        1: [
            {
                'text': 'What is Market Basket Analysis, and how does the Apriori algorithm identify frequent itemsets in transaction logs?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Identifies products frequently purchased together. Apriori uses downward closure property: all non-empty subsets of a frequent itemset must also be frequent, pruning search space iteratively.',
            },
            {
                'text': 'Explain the three core metrics of Association Rule Mining: Support, Confidence, and Lift. How do you interpret Lift > 1?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Support = P(A and B); Confidence = P(B|A); Lift = P(A and B) / (P(A)*P(B)). Lift > 1 indicates item B is purchased more frequently when item A is present than by independent chance (positive association).',
            },
            {
                'text': 'How does the FP-Growth (Frequent Pattern Growth) algorithm improve mining performance over the candidate-generation approach of Apriori?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Builds a compact FP-tree structure in only two database passes and mines frequent patterns recursively via conditional FP-trees without generating millions of candidate itemsets.',
            },
            {
                'text': 'What is the difference between Structured, Semi-Structured, and Unstructured data in data mining pipelines?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Structured: tabular relational rows and columns. Semi-structured: schema-flexible hierarchical documents (JSON, XML). Unstructured: raw text, audio, video, images without predefined data models.',
            },
            {
                'text': 'How do you normalize transaction data into one-hot encoded or sparse transaction format for association rule algorithms?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Transforming list of items per basket into binary matrix where rows are transactions and columns are unique items (e.g. TransactionEncoder from mlxtend).',
            },
        ],
        2: [
            {
                'text': 'How does DBSCAN (Density-Based Spatial Clustering of Applications with Noise) work? Explain core points, border points, and noise points.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Groups points with eps radius and min_samples threshold. Core point has >= min_samples within eps; border point has < min_samples but is within eps of a core point; noise points are outliers outside any dense neighborhood.',
            },
            {
                'text': 'Why is DBSCAN often preferred over K-Means when clustering spatial data with arbitrary shapes or containing background noise?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'K-Means assumes spherical clusters and assigns every outlier to a cluster; DBSCAN identifies clusters of arbitrary non-convex shapes (concentric rings, roads) and isolates noise explicitly.',
            },
            {
                'text': 'What is Hierarchical Agglomerative Clustering, and how do single-linkage, complete-linkage, and average-linkage distance criteria differ?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Bottom-up merging of clusters represented in a dendrogram. Single-linkage measures minimum pairwise distance; complete-linkage measures maximum distance; average-linkage measures mean pairwise distance.',
            },
            {
                'text': 'What is the Isolation Forest algorithm, and how does it detect anomalies in high-dimensional datasets?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Isolates anomalies instead of modeling normal points; randomly partitions features using tree cuts. Anomalies are few and attribute-different, so they require fewer cuts and have shorter path lengths in the trees.',
            },
            {
                'text': 'How does Local Outlier Factor (LOF) identify anomalous data points based on local density relative to their neighbors?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Compares local density of a sample to local densities of its k nearest neighbors; points with significantly lower density than their surrounding neighbors are flagged as outliers (LOF score > 1).',
            },
        ],
        3: [
            {
                'text': 'What is the Curse of Dimensionality in data mining, and how does it degrade distance-based algorithms like KNN and K-Means?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'As dimensions grow, volume of feature space increases exponentially, making data extremely sparse; distances between nearest and farthest neighbors converge, rendering Euclidean distance uninformative.',
            },
            {
                'text': 'Compare Filter, Wrapper, and Embedded feature selection methods in data mining. Give an example of each.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Filter: statistical ranking independent of model (Chi-square, Pearson correlation). Wrapper: iterative search using model evaluation (RFE, forward selection). Embedded: feature selection during training (Lasso, tree importance).',
            },
            {
                'text': 'How does t-SNE (t-Distributed Stochastic Neighbor Embedding) differ from UMAP for non-linear dimensionality reduction and cluster visualization?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 't-SNE preserves local similarities using Student-t distribution (slow, O(N^2)). UMAP uses Riemannian geometry and fuzzy simplicial sets, preserving both local and global structure much faster at scale.',
            },
            {
                'text': 'What is Topic Modeling, and how does Latent Dirichlet Allocation (LDA) uncover hidden thematic structures across text corpora?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Generative probabilistic model assuming documents are mixtures of topics, and topics are probability distributions over words; infers topic-word distributions via Gibbs sampling or variational inference.',
            },
            {
                'text': 'How do you validate unsupervised clustering results quantitatively without true class labels (Silhouette Score vs Davies-Bouldin Index)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Silhouette Score measures intra-cluster cohesion vs nearest-cluster separation (-1 to +1, higher is better); Davies-Bouldin Index measures ratio of within-cluster scatter to between-cluster separation (lower is better).',
            },
        ],
    },

    'data_engineering': {
        1: [
            {
                'text': 'What is the difference between an ETL (Extract, Transform, Load) pipeline and an ELT (Extract, Load, Transform) pipeline?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ETL transforms data on intermediate compute before loading into warehouse (legacy, privacy scrubbing). ELT loads raw data directly into scalable cloud warehouses (Snowflake, BigQuery) and transforms in-place using SQL.',
            },
            {
                'text': 'Explain Kimball dimensional modeling: Fact tables, Conformed Dimensions, and Slowly Changing Dimensions (SCD Type 1 vs SCD Type 2).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Conformed dimensions shared across multiple business marts. SCD Type 1 overwrites old value (no history). SCD Type 2 adds new row with effective start/end dates and current flag (preserves full historical snapshot).',
            },
            {
                'text': 'Compare row-oriented storage (PostgreSQL, CSV) with columnar storage (Parquet, ORC). Why is columnar storage dramatically faster for analytical queries?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Analytical queries read only a few columns across millions of rows; columnar reads only required column blocks from disk, achieves 10x higher compression of similar data types, and leverages vectorized CPU execution.',
            },
            {
                'text': 'What is the difference between Batch Processing and Stream Processing? When is near-real-time streaming necessary versus periodic micro-batches?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Batch processes bounded historical chunks periodically (daily/hourly). Streaming processes unbounded event streams record-by-record with sub-second latency (fraud alerts, live sensor metrics).',
            },
            {
                'text': 'How do you design a staging area and bronze/silver/gold medallion architecture in a modern data lakehouse?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Bronze: raw append-only ingestion logs. Silver: cleaned, filtered, standardized, and joined records. Gold: business-level aggregated star schemas and reporting marts ready for BI tools.',
            },
        ],
        2: [
            {
                'text': 'Explain Apache Spark architecture: Driver Program, Cluster Manager, Executors, Tasks, and Resilient Distributed Datasets (RDDs).',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Driver coordinates job execution and builds DAG; Cluster Manager (K8s/YARN) allocates executor resources; Executors execute tasks in parallel worker JVMs holding memory partitions.',
            },
            {
                'text': 'What is the difference between narrow transformations and wide transformations in Apache Spark? Why do wide transformations cause data shuffling?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Narrow transformations (map, filter) execute independently within a partition without network transfer. Wide transformations (groupBy, join, distinct) require redistributing data across network partitions (expensive shuffle).',
            },
            {
                'text': 'How does PySpark Catalyst Optimizer optimize query execution plans (logical plan to physical plan)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Performs rule-based and cost-based optimizations: predicate pushdown (filtering at storage level), projection pruning (dropping unused columns), and choosing optimal join algorithms (Broadcast Hash Join).',
            },
            {
                'text': 'What is a Broadcast Join in Spark, and when should you broadcast a small dimension table to avoid network shuffles?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Copies small table (< 10-100MB) to all executor nodes via broadcast variables; each executor joins local partition of large table directly, avoiding expensive shuffle sort-merge join across the network.',
            },
            {
                'text': 'What causes data skew in distributed Spark jobs, and how do you resolve it using salting or adaptive query execution (AQE)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Skew occurs when one partition key has disproportionate rows, causing one executor task to stall. Salting adds random prefix to key to distribute across partitions; Spark 3 AQE dynamically coalesces skewed partitions.',
            },
        ],
        3: [
            {
                'text': 'How do you design an Apache Airflow DAG? Explain Directed Acyclic Graph concepts, Operators, Sensors, and XComs.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'DAG defines workflow dependency graph without cycles; Operators define tasks (Python, Bash, Postgres); Sensors wait for external criteria; XComs pass small metadata payloads between tasks.',
            },
            {
                'text': 'What is idempotency in data pipelines, and why must backfilling a historical date range never duplicate records in the destination warehouse?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Running pipeline multiple times with same input produces exact same output state. Implemented via staging partitions with atomic overwrite (DELETE + INSERT or MERGE INTO / UPSERT on natural keys).',
            },
            {
                'text': 'What are ACID transactions in modern table formats like Delta Lake, Apache Iceberg, or Apache Hudi over raw object storage (S3)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Maintains commit log (transaction log) of Parquet files; enables ACID isolation, time travel / historical rollbacks, schema enforcement, and concurrent reader/writer isolation on S3/ADLS.',
            },
            {
                'text': 'How do you implement data quality validation checks in production pipelines using tools like Great Expectations or Soda SQL?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Assert expectations on data arriving in staging (e.g. expect_column_values_to_not_be_null, expect_column_values_to_be_unique); fail pipeline execution before promoting bad records into reporting tables.',
            },
            {
                'text': 'How does Change Data Capture (CDC) with Debezium and Apache Kafka extract database updates without impacting operational database performance?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Reads write-ahead transaction logs (WAL/binlog) at the engine level without executing polling SQL queries, streaming insert/update/delete change events into Kafka topics with zero impact on database query latency.',
            },
        ],
    },
}

if __name__ == '__main__':
    out_dir = Path(__file__).resolve().parent / 'mock_questions'
    out_file = out_dir / 'data_mock.php'
    write_php_file(out_file, STACKS)
    print(f"Wrote {out_file} ({len(STACKS)} sets)")

