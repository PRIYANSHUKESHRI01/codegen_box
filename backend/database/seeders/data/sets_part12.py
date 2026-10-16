# Sets 56 to 60 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_56 = {
    "set_number": 56,
    "title": "Soft Skill Assessment - Set 56",
    "slug": "soft-skill-assessment-set-56",
    "description": "Evaluates grape desiccation percentages, circular seating deductions, correlative pronoun concord, and Docker layer cache optimization.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Fresh grapes contain 80% water, while dry grapes contain 10% water. How many kilograms of dry grapes can be obtained from 500 kg of fresh grapes?",
            "options": ["100 kg", "111.11 kg", "120 kg", "125 kg"],
            "correct_index": 1,
            "explanation": "Pulp content remains constant. In fresh grapes: pulp = 500 × (1 - 0.80) = 500 × 0.20 = 100 kg. In dry grapes: pulp = 90% (100% - 10%). Weight of dry grapes W = 100 / 0.90 = 111.11 kg."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A sum of money doubles itself in 8 years at simple interest. In how many years will it become 4 times of itself at the same rate?",
            "options": ["16 years", "20 years", "24 years", "28 years"],
            "correct_index": 2,
            "explanation": "Doubling means earning interest equal to P in 8 years. To become 4 times (4P), interest needed is 3P. Time = 3 × 8 = 24 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B started a business investing ₹20,000 and ₹30,000 respectively. After 6 months, A withdrew ₹5,000 while B invested ₹5,000 more. If the annual profit was ₹17,000, find A's share of the profit.",
            "options": ["₹6,000", "₹7,000", "₹7,500", "₹8,000"],
            "correct_index": 1,
            "explanation": "A's capital-months = (20,000 × 6) + (15,000 × 6) = 120,000 + 90,000 = 210,000. B's capital-months = (30,000 × 6) + (35,000 × 6) = 180,000 + 210,000 = 390,000. Ratio = 210,000 : 390,000 = 21 : 39 = 7 : 13. Total parts = 7 + 13 = 20. A's share = (7 / 20) × 17,000 = 7 × 850 = ₹5,950? Wait: 7 × 850 = 5950. Let's make annual profit ₹20,000: (7 / 20) × 20,000 = ₹7,000!"
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the unit digit of (4^45 + 9^90).",
            "options": ["3", "4", "5", "7"],
            "correct_index": 2,
            "explanation": "Powers of 4: odd power ends in 4, even in 6. 4^45 has unit digit 4. Powers of 9: odd power ends in 9, even in 1. 9^90 has unit digit 1. Sum of unit digits = 4 + 1 = 5."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 120 meters long crosses a stationary platform in 15 seconds. If the speed of the train is 48 km/h, what is the length of the platform?",
            "options": ["60 meters", "80 meters", "100 meters", "120 meters"],
            "correct_index": 1,
            "explanation": "Speed = 48 × (5/18) = 40/3 m/s. Total distance in 15s = (40/3) × 15 = 200 m. Platform length = 200 - 120 = 80 meters."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A bag contains 6 red and 4 black balls. Two balls are drawn at random. What is the probability that both are black?",
            "options": ["1/15", "2/15", "4/15", "1/5"],
            "correct_index": 1,
            "explanation": "Total ways = 10C2 = (10 × 9) / 2 = 45. Favorable ways = 4C2 = (4 × 3) / 2 = 6. Probability = 6 / 45 = 2 / 15."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B can complete a work in 15 days and 20 days respectively. Both work together for 4 days, and then A leaves. In how many more days will B alone finish the remaining work?",
            "options": ["10 days", "10.67 days", "11 days", "12 days"],
            "correct_index": 1,
            "explanation": "Work in 4 days = 4 × (1/15 + 1/20) = 4 × (7/60) = 28/60 = 7/15. Remaining work = 1 - 7/15 = 8/15. Time taken by B = (8/15) / (1/20) = (8/15) × 20 = 160 / 15 = 10.67 days."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A cylinder of height 14 cm and base radius 3 cm is melted and recast into small spheres of radius 3 cm each. How many such spheres can be formed?",
            "options": ["2", "3.5", "4", "5"],
            "correct_index": 1,
            "explanation": "Volume of cylinder = pi * r² * h = pi * 9 * 14 = 126 * pi. Volume of sphere = (4/3) * pi * R³ = (4/3) * pi * 27 = 36 * pi. Number of spheres = 126 / 36 = 3.5."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All caches are memories. Some memories are registers. No register is persistent. Conclusions: I. Some memories are not persistent. II. Some caches are registers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "The memories that are registers cannot be persistent, so some memories are not persistent (I follows). Caches and registers have no guaranteed overlap (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven colleagues—A, B, C, D, E, F, and G—sit around a circular table facing the center. A sits second to the left of C. B sits to the immediate right of A. D sits opposite to C. E sits between D and A. Who sits to the immediate left of D?",
            "options": ["E", "F", "G", "Cannot be determined without additional info"],
            "correct_index": 0,
            "explanation": "A sits 2nd left of C. D is opposite C. E sits between D and A. Since E is between D and A, looking from center at D, E sits to D's immediate left."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'LINUX' is coded as 'MJOUY' (+1 to each letter). How is 'SHELL' coded?",
            "options": ["TIFMM", "TIEMM", "TIFLL", "TJFMM"],
            "correct_index": 0,
            "explanation": "S(+1)=T, H(+1)=I, E(+1)=F, L(+1)=M, L(+1)=M => TIFMM."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A mobile robot drives 20 meters East, turns 90 degrees counter-clockwise and drives 15 meters. What is the straight-line distance from the start?",
            "options": ["25 meters", "30 meters", "35 meters", "40 meters"],
            "correct_index": 0,
            "explanation": "Facing East, 90 degrees counter-clockwise is North. Distance = sqrt(20² + 15²) = sqrt(400 + 225) = sqrt(625) = 25 meters."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said: 'His mother's husband's sister is my aunt.' How is the man related to the woman?",
            "options": ["Brother (or cousin)", "Father", "Uncle", "Nephew"],
            "correct_index": 0,
            "explanation": "Mother's husband is father. Father's sister is aunt. If his father's sister is also her aunt, they share the same paternal aunt, meaning the man is her brother or cousin."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 7, 14, 28, 56, 112, ?",
            "options": ["214", "224", "234", "244"],
            "correct_index": 1,
            "explanation": "Each term is multiplied by 2: 112 × 2 = 224."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'A major payment provider experiences intermittent gateway 504 timeouts during morning peak hours.' Course of Action: I. Implement an idempotent message queue buffer to queue checkout requests and throttle ingress traffic gracefully. II. Delete the checkout database.",
            "options": [
                "Only course of action I follows",
                "Only course of action II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Buffering and asynchronous throttling smooths traffic surges without dropping customer transactions (I follows). Deleting the database causes catastrophic data loss (II does not follow)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the error in pronoun concord: 'Neither of the candidate microservices (A) / have demonstrated (B) / sufficient throughput during the load test. (C) / No error (D)'",
            "options": ["(A)", "(B)", "(C)", "(D)"],
            "correct_index": 1,
            "explanation": "'Neither' is grammatically singular and takes the singular verb 'has demonstrated'. Error is in part (B)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'MUNIFICENT':",
            "options": ["Generous", "Stingy", "Greedy", "Deceptive"],
            "correct_index": 0,
            "explanation": "'Munificent' means characterized by or displaying great generosity."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'TACIT':",
            "options": ["Explicit", "Silent", "Implied", "Unstated"],
            "correct_index": 0,
            "explanation": "'Tacit' means understood or implied without being stated. Its antonym is 'explicit' or 'stated'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To bite the bullet' mean?",
            "options": [
                "To shoot a firearm",
                "To face an inevitable, unpleasant situation with courage",
                "To chew on metallic objects",
                "To cancel a business contract"
            ],
            "correct_index": 1,
            "explanation": "'To bite the bullet' means to endure a painful, difficult, or unpleasant situation that cannot be avoided."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who seeks to promote the welfare of others, especially by the generous donation of money to good causes'",
            "options": ["Philanthropist", "Misanthrope", "Chauvinist", "Hedonist"],
            "correct_index": 0,
            "explanation": "A 'Philanthropist' is a person who donates time, money, and resources to promote human welfare."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a standard model or pattern:",
            "options": ["Paradigm", "Paridigm", "Paradygm", "Paradime"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Paradigm'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your production database replication lag spikes to 45 minutes on read replicas during heavy reporting batch jobs, causing customer web app reads to display stale data. What is the immediate architectural remediation?",
            "options": [
                "Route critical customer reads to the primary database while offloading reporting queries to a dedicated analytical warehouse (e.g., Snowflake/BigQuery).",
                "Shut down the primary database.",
                "Delete all read replicas.",
                "Tell customers to refresh their browsers every minute."
            ],
            "correct_index": 0,
            "explanation": "Segregating OLAP batch reporting from OLTP transactional read paths prevents replication lag from corrupting customer user experience."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A code review on a pull request becomes contentious as two developers argue about tab indentation vs space indentation. How should the team lead resolve this?",
            "options": [
                "Ban code reviews entirely.",
                "Enforce an automated code formatter (e.g., Prettier, Black, or Spotless) via pre-commit hooks and CI pipelines to remove subjective stylistic formatting debates permanently.",
                "Fire both developers.",
                "Let them debate for 3 days."
            ],
            "correct_index": 1,
            "explanation": "Automating stylistic formatting via opinionated linters and formatters eliminates Bikeshedding and allows developers to focus on architecture."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An automated security scanner identifies that an intermediate Docker build layer in your public container repository contains unencrypted SSH deploy keys, even though the keys were deleted in a later `RUN rm -rf` step. What explains this and how is it fixed?",
            "options": [
                "Docker build layers are immutable, so files created in prior layers persist in layer history; use Docker multi-stage builds or BuildKit `--mount=type=secret` to ensure keys never enter image layers.",
                "The security scanner is mistaken; deleting files in later layers wipes them completely.",
                "Change the SSH key password.",
                "Delete Docker."
            ],
            "correct_index": 0,
            "explanation": "Docker layer immutability means subsequent deletes do not purge files from previous layers; multi-stage builds and BuildKit secrets prevent sensitive credentials from baking into images."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A critical payment microservice deployed in AWS EKS encounters pod evictions due to node memory pressure during a sudden traffic surge. What configuration prevents mission-critical pods from being evicted first?",
            "options": [
                "Set pod priority to negative values.",
                "Assign the pods to the `Guaranteed` Quality of Service (QoS) class by setting identical CPU/Memory `requests` and `limits`, and configure high `PriorityClass` values.",
                "Remove all memory limits.",
                "Delete the Kubernetes cluster."
            ],
            "correct_index": 1,
            "explanation": "Pods with matching requests and limits obtain the `Guaranteed` QoS class, ensuring Linux OOM-killer and kubelet evict BestEffort and Burstable pods first under resource pressure."
        }
    ]
}

# Fix SET_56 Q3
SET_56["questions"][2]["question_text"] = "A and B started a business investing ₹20,000 and ₹30,000 respectively. After 6 months, A withdrew ₹5,000 while B invested ₹5,000 more. If the annual profit was ₹20,000, find A's share of the profit."
SET_56["questions"][2]["options"] = ["₹6,000", "₹7,000", "₹7,500", "₹8,000"]
SET_56["questions"][2]["correct_index"] = 1
SET_56["questions"][2]["explanation"] = "A's capital-months = (20,000 × 6) + (15,000 × 6) = 210,000. B's capital-months = (30,000 × 6) + (35,000 × 6) = 390,000. Ratio = 210 : 390 = 7 : 13. Total parts = 20. A's share = (7 / 20) × 20,000 = ₹7,000."

SET_57 = {
    "set_number": 57,
    "title": "Soft Skill Assessment - Set 57",
    "slug": "soft-skill-assessment-set-57",
    "description": "Tests police-pursuit kinematics, eight-tier floor deductions, parenthetical subject concord, and microservice backoff jitter.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A thief is noticed by a policeman from a distance of 150 meters. The thief starts running and the policeman chases him. The thief and the policeman run at the rate of 9 km/h and 12 km/h respectively. What is the distance run by the thief before he is overtaken?",
            "options": ["350 meters", "400 meters", "450 meters", "500 meters"],
            "correct_index": 2,
            "explanation": "Relative speed = 12 - 9 = 3 km/h = 3 × (5/18) = 5/6 m/s. Time to catch = 150 / (5/6) = (150 × 6) / 5 = 180 seconds. Distance run by thief = Speed × Time = (9 × 5/18) × 180 = 2.5 × 180 = 450 meters."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A dealer professes to sell tea at cost price but uses a 900-gram weight for a kilogram. What is his percentage gain?",
            "options": ["10%", "11.11%", "12.5%", "15%"],
            "correct_index": 1,
            "explanation": "Gain % = [Error / (True Value - Error)] × 100 = [100 / 900] × 100 = 11.11%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the compound interest on ₹16,000 at 10% per annum for 1.5 years, interest compounded semi-annually.",
            "options": ["₹2,400", "₹2,522", "₹2,640", "₹2,720"],
            "correct_index": 1,
            "explanation": "Semi-annual rate = 10% / 2 = 5%. Periods n = 1.5 × 2 = 3. Amount = 16,000 × (1.05)³ = 16,000 × 1.157625 = ₹18,522. CI = 18,522 - 16,000 = ₹2,522."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A container contains 40 litres of pure milk. 4 litres are taken out and replaced with water. This process is repeated twice more. How much milk is left in the container now?",
            "options": ["29.16 litres", "30.00 litres", "32.40 litres", "34.20 litres"],
            "correct_index": 0,
            "explanation": "Milk left = 40 × (1 - 4/40)³ = 40 × (0.9)³ = 40 × 0.729 = 29.16 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average weight of 24 students in a section is 40 kg. If the weight of the teacher is included, the average rises by 1 kg. What is the weight of the teacher?",
            "options": ["62 kg", "64 kg", "65 kg", "68 kg"],
            "correct_index": 2,
            "explanation": "Total initial weight = 24 × 40 = 960 kg. With teacher included, total weight for 25 people = 25 × 41 = 1,025 kg. Teacher's weight = 1,025 - 960 = 65 kg."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the roots of the quadratic equation: x² - 9x + 20 = 0.",
            "options": ["4 and 5", "-4 and -5", "2 and 10", "3 and 6"],
            "correct_index": 0,
            "explanation": "(x - 4)(x - 5) = 0 => x = 4 or x = 5."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The area between two concentric circles of radii 14 cm and 7 cm is (use pi = 22/7):",
            "options": ["440 cm²", "462 cm²", "484 cm²", "506 cm²"],
            "correct_index": 1,
            "explanation": "Area = pi * (R² - r²) = (22/7) * (14² - 7²) = (22/7) * (196 - 49) = (22/7) * 147 = 22 * 21 = 462 cm²."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the greatest number that will divide 148, 246, and 623 leaving remainders 4, 6, and 11 respectively?",
            "options": ["12", "14", "16", "18"],
            "correct_index": 0,
            "explanation": "Required number = HCF of (148 - 4 = 144), (246 - 6 = 240), and (623 - 11 = 612). Since 144 = 12 × 12, 240 = 12 × 20, and 612 = 12 × 51, the HCF is 12."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Only a few pods are stateful. All stateful pods are persistent. Conclusions: I. Some persistent pods are stateful. II. All stateful pods can never be persistent.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Since all stateful pods are persistent, by conversion some persistent pods are stateful (I follows). Statement explicitly states all stateful pods are persistent, making II false. Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight developers live on 8 different floors of a residential building numbered 1 (lowest) to 8 (top). Floor 1 is occupied by Maya. Floor 8 is occupied by Dev. Karan lives on floor 5. Priya lives on the floor immediately below Karan (floor 4). Aman lives on an even floor below Priya. Who lives on floor 4?",
            "options": ["Maya", "Dev", "Karan", "Priya"],
            "correct_index": 3,
            "explanation": "Priya lives on the floor immediately below Karan (floor 5 - 1 = floor 4). Priya lives on floor 4."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'BYTE' is coded as 'CYUF' (+1 to each letter). How is 'DATA' coded?",
            "options": ["EBUB", "EBVA", "EBUA", "ECUB"],
            "correct_index": 0,
            "explanation": "D(+1)=E, A(+1)=B, T(+1)=U, A(+1)=B => EBUB."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A courier rides 14 km North, turns right and rides 10 km, then turns right again and rides 14 km. How far is the courier from the start?",
            "options": ["10 km", "14 km", "20 km", "24 km"],
            "correct_index": 0,
            "explanation": "North 14 km, East 10 km, South 14 km. Vertical displacement is 0. The courier is 10 km East of the start."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a photograph of a gentleman, Shreya said: 'His only brother is the father of my daughter's father.' How is the gentleman related to Shreya?",
            "options": ["Father-in-law's brother (Uncle-in-law)", "Father", "Maternal Uncle", "Brother"],
            "correct_index": 0,
            "explanation": "Shreya's daughter's father is Shreya's husband. The father of Shreya's husband is her father-in-law. The gentleman's only brother is her father-in-law, so the gentleman is her husband's paternal uncle (Uncle-in-law)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out from the following cloud databases:",
            "options": ["Amazon DynamoDB", "Google Cloud Spanner", "Azure Cosmos DB", "Apache Hadoop"],
            "correct_index": 3,
            "explanation": "DynamoDB, Cloud Spanner, and Cosmos DB are managed cloud databases, whereas Apache Hadoop is a distributed big-data processing framework."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Under sustained high load, upstream API calls must implement exponential backoff with randomized jitter.' Conclusions: I. Adding randomized jitter prevents thundering-herd retry storms from overwhelming struggling backend databases. II. Retrying immediately without delays guarantees faster recovery.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Randomized jitter spreads retry attempts across time intervals, dampening spikes and preventing thundering-herd retry storms (I follows). Retrying immediately without delay amplifies system overload and prolongs outages (II does not follow)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the correct verb form: 'The engineering lead, as well as the senior architects, ______ attending the architecture review board.'",
            "options": ["is", "are", "were", "have been"],
            "correct_index": 0,
            "explanation": "When a singular subject ('The engineering lead') is joined to other nouns by 'as well as', the verb agrees with the primary subject ('is')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'TACITURN':",
            "options": ["Untalkative", "Voluble", "Garrulous", "Loquacious"],
            "correct_index": 0,
            "explanation": "'Taciturn' means reserved or uncommunicative in speech; untalkative."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'LACONIC':",
            "options": ["Garrulous", "Concise", "Brief", "Terse"],
            "correct_index": 0,
            "explanation": "'Laconic' means using very few words; concise. Its antonym is 'garrulous' or 'verbose'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To burn the midnight oil' mean?",
            "options": [
                "To waste lighting resources",
                "To work or study late into the night",
                "To suffer insomnia",
                "To fuel industrial engines"
            ],
            "correct_index": 1,
            "explanation": "'To burn the midnight oil' means to work or study late into the night."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'An excessive or irrational fear of confined or enclosed spaces'",
            "options": ["Claustrophobia", "Agoraphobia", "Acrophobia", "Hydrophobia"],
            "correct_index": 0,
            "explanation": "'Claustrophobia' is the extreme or irrational fear of confined or small spaces."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a false perception:",
            "options": ["Illusion", "Ilusion", "Illution", "Elusion"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Illusion'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A Redis cache cluster in front of your customer session store crashes simultaneously across all instances. Every incoming user request immediately hits the underlying relational database, causing total connection pool exhaustion (cache stampede). What architectural mechanism prevents this cascade during cache recovery?",
            "options": [
                "Restart the database repeatedly until load drops.",
                "Implement mutual exclusion locks (mutexes) or probabilistic early expiration (XFetch) alongside rate-limiting and warm-up priming scripts before reopening full traffic to the database.",
                "Disable caching completely and scale the database to 1,000 read replicas.",
                "Tell users to stop refreshing web pages."
            ],
            "correct_index": 1,
            "explanation": "A cache stampede occurs when cache misses overwhelm backend databases. Employing locking/single-flight requests, warm-up priming, and graceful request throttling protects the database during cache re-initialization."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A software engineer notices that the staging database credentials are being stored in an unencrypted `.env` file checked into a public git repository. What should the engineer do immediately?",
            "options": [
                "Ignore it because it is only staging.",
                "Alert the security lead, revoke and rotate the staging credentials in the database immediately, purge the commit history, and configure automated secrets scanning in git.",
                "Delete the repository entirely.",
                "Change the staging database name."
            ],
            "correct_index": 1,
            "explanation": "Revoking exposed credentials, purging history, and adding secret linters prevents unauthorized reconnaissance and compliance exposure."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an ongoing sprint, sales leadership commits to a custom billing integration for an enterprise deal closing this Friday, asking the engineering team to deploy it un-tested tonight. How should the engineering director handle this?",
            "options": [
                "Deploy untested code directly to production tonight.",
                "Decline deploying untested code, outline the catastrophic financial risk of billing regression bugs, and collaborate with sales and product to offer a verified manual billing fallback while scheduling proper testing for the next release.",
                "Resign immediately.",
                "Refuse to answer sales emails."
            ],
            "correct_index": 1,
            "explanation": "Protecting financial data integrity while offering pragmatic operational fallbacks preserves client deals without risking production data corruption."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your team is designing a multi-region active-active database architecture across US-East and EU-West. How do you resolve write conflicts for simultaneous updates to the same user profile?",
            "options": [
                "Discard all EU writes.",
                "Implement Conflict-Free Replicated Data Types (CRDTs) or Last-Write-Wins (LWW) timestamp ordering with synchronized TrueTime/NTP clocks, or route user profile writes deterministically to the user's home region.",
                "Disable replication between regions.",
                "Make the database read-only."
            ],
            "correct_index": 1,
            "explanation": "CRDTs or deterministic home-region routing eliminates multi-region active-active write collision anomalies."
        }
    ]
}

SET_58 = {
    "set_number": 58,
    "title": "Soft Skill Assessment - Set 58",
    "slug": "soft-skill-assessment-set-58",
    "description": "Explores upstream velocity vectors, modular totients, mandative subjunctive concord, and edge zero-trust security.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat's speed in still water is 15 km/h. It travels 30 km downstream and returns to the starting point in a total of 4 hours 30 minutes. What is the speed of the stream?",
            "options": ["3 km/h", "5 km/h", "6 km/h", "7 km/h"],
            "correct_index": 1,
            "explanation": "30 / (15 + s) + 30 / (15 - s) = 4.5. Testing s = 5: 30 / 20 + 30 / 10 = 1.5 + 3 = 4.5 hours. Speed of the stream is 5 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A merchant marks an article 30% above the cost price and allows a 10% discount on the marked price. What is his profit percentage?",
            "options": ["15%", "17%", "20%", "22%"],
            "correct_index": 1,
            "explanation": "Let CP = 100. MP = 130. SP = 130 × 0.90 = 117. Profit = 117 - 100 = 17%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the remainder when 2^50 is divided by 7.",
            "options": ["1", "2", "4", "6"],
            "correct_index": 2,
            "explanation": "2^1 = 2, 2^2 = 4, 2^3 = 8 = 1 (mod 7). Period is 3. 50 = 3 × 16 + 2. So 2^50 = (2^3)^16 × 2^2 = 1^16 × 4 = 4 (mod 7). Remainder is 4."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A loan of ₹6,600 is repaid in two equal annual installments at 20% compound interest per annum. What is the value of each installment?",
            "options": ["₹4,120", "₹4,200", "₹4,320", "₹4,500"],
            "correct_index": 2,
            "explanation": "6,600 = x / 1.2 + x / 1.44 = (1.2x + x) / 1.44 = 2.2x / 1.44 => x = (6600 × 1.44) / 2.2 = 3000 × 1.44 = ₹4,320."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 6 numbers is 30. If the average of the first 4 is 25 and the last 3 is 35, what is the fourth number?",
            "options": ["25", "30", "35", "40"],
            "correct_index": 0,
            "explanation": "Total sum = 6 × 30 = 180. Sum of first 4 = 4 × 25 = 100. Sum of last 3 = 3 × 35 = 105. Sum = 100 + 105 = 205. The fourth number is counted twice: 205 - 180 = 25."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a group of 6 men and 4 women, a committee of 5 is to be formed. In how many ways can this be done so that the committee contains at least 3 men?",
            "options": ["180", "186", "192", "200"],
            "correct_index": 1,
            "explanation": "Cases: (3 men, 2 women) = 6C3 × 4C2 = 20 × 6 = 120. (4 men, 1 woman) = 6C4 × 4C1 = 15 × 4 = 60. (5 men, 0 women) = 6C5 × 4C0 = 6 × 1 = 6. Total ways = 120 + 60 + 6 = 186."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can do a piece of work in 20 days and B in 30 days. They work together for 5 days, and then both leave. How much work is left unfinished?",
            "options": ["1/4", "1/3", "5/12", "7/12"],
            "correct_index": 3,
            "explanation": "Combined 1-day work = 1/20 + 1/30 = 5/60 = 1/12. In 5 days, work done = 5/12. Remaining work = 1 - 5/12 = 7/12."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The parallel sides of a trapezium are 12 cm and 8 cm and the distance between them is 10 cm. What is the area of the trapezium?",
            "options": ["80 cm²", "90 cm²", "100 cm²", "120 cm²"],
            "correct_index": 2,
            "explanation": "Area = 0.5 × (a + b) × h = 0.5 × (12 + 8) × 10 = 0.5 × 20 × 10 = 100 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All routers are gateways. Some gateways are bridges. No bridge is a repeater. Conclusions: I. Some gateways are not repeaters. II. No router is a repeater.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Gateways that are bridges cannot be repeaters, so some gateways are not repeaters (I follows). Routers and repeaters have no necessary separation (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven boxes A, B, C, D, E, F, and G are stacked from 1 (bottom) to 7 (top). Box D is at position 4. Box A is immediately above D (position 5). Box G is at position 1. Box F is immediately below B. Box E is above F. If B is at position 3, which box is at position 2?",
            "options": ["C", "E", "F", "Cannot be determined without additional info"],
            "correct_index": 2,
            "explanation": "F is immediately below B. Since B is at position 3, F must be at position 2."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'SPRING' is coded as 'UQTIPI' (+2 to each letter). How is 'AUTUMN' coded using the same rule?",
            "options": ["CWVWOP", "CWVWNP", "BVTVNO", "DWVXOP"],
            "correct_index": 0,
            "explanation": "Each letter is shifted forward by 2 positions in the alphabetical series: A(+2)=C, U(+2)=W, T(+2)=V, U(+2)=W, M(+2)=O, N(+2)=P => CWVWOP."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: P >= Q > R; R = S < T. Which of the following is definitively TRUE?",
            "options": ["P > S", "Q < S", "R > P", "T = R"],
            "correct_index": 0,
            "explanation": "P >= Q > R = S implies P > S is definitely true."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the son of B. C is the sister of A. D is the mother of C. How is D related to B?",
            "options": ["Wife", "Sister", "Mother", "Daughter"],
            "correct_index": 0,
            "explanation": "A and C are brother and sister. B is the father (or parent) of A, and D is the mother of C. Therefore, D is the wife of B."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 5, 25, 125, 625, ?",
            "options": ["1,250", "2,500", "3,125", "3,750"],
            "correct_index": 2,
            "explanation": "Each term is multiplied by 5: 625 × 5 = 3,125."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should company databases enforce TLS encryption in transit for all internal microservice-to-microservice database traffic?' Arguments: I. Yes, encrypting in transit prevents eavesdropping and lateral movement attacks within the internal cloud network. II. No, TLS encryption adds a fractional CPU overhead to SSL handshakes.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because modern Zero-Trust architecture requires encryption in transit regardless of internal perimeter trust. Modern CPU hardware acceleration makes TLS overhead negligible, making Argument II weak."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence using the mandative subjunctive mood following a demand:",
            "options": [
                "The board demands that the chief security officer present the vulnerability report immediately.",
                "The board demands that the chief security officer presents the vulnerability report immediately.",
                "The board demands that the chief security officer will present the vulnerability report immediately.",
                "The board demands that the chief security officer presented the vulnerability report immediately."
            ],
            "correct_index": 0,
            "explanation": "The mandative subjunctive requires the bare infinitive 'present' following verbs of demand."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'OBDURATE':",
            "options": ["Stubborn", "Flexible", "Yielding", "Submissive"],
            "correct_index": 0,
            "explanation": "'Obdurate' means stubbornly refusing to change one's opinion or course of action; stubborn or unyielding."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'LOQUACIOUS':",
            "options": ["Taciturn", "Garrulous", "Voluble", "Effusive"],
            "correct_index": 0,
            "explanation": "'Loquacious' means very talkative. Its antonym is 'taciturn' (uncommunicative or reserved)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To face the music' mean?",
            "options": [
                "To attend a musical concert",
                "To accept the unpleasant consequences of one's actions",
                "To conduct an audio rehearsal",
                "To argue with colleagues"
            ],
            "correct_index": 1,
            "explanation": "'To face the music' means to confront and accept the unpleasant reality or consequences of one's decisions."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who walks in sleep'",
            "options": ["Somnambulist", "Somniloquist", "Insomniac", "Noctambulist"],
            "correct_index": 0,
            "explanation": "A 'Somnambulist' is a sleepwalker."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an expression of praise:",
            "options": ["Eulogy", "Eulogey", "Eulojy", "Eulegy"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Eulogy'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During a routine production blue-green deployment, the router switches 100% of traffic to the green deployment, but health checks immediately fail due to an incorrect database connection pool password in the green environment. What is the immediate automated mitigation?",
            "options": [
                "Debug the password live on the production green cluster while users receive 500 errors.",
                "Trigger an automated instant rollback reversing the traffic router back to the healthy blue cluster while taking the green cluster offline for investigation.",
                "Restart all load balancers simultaneously.",
                "Wipe the database and reseed all customer records."
            ],
            "correct_index": 1,
            "explanation": "Blue-green deployment architectures are designed for zero-downtime rollback; upon immediate health check failure in the new environment, traffic must immediately revert to the known-good blue environment."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A software engineer notices that another engineer on the team has been working late every night for three consecutive weeks and appears exhausted during morning meetings. How should they support their peer?",
            "options": [
                "Assign them more tickets to test their endurance.",
                "Reach out privately with empathetic concern, offer to pair on or take over specific sprint tickets, and encourage them to speak with the manager about workload rebalancing.",
                "Publicly announce that the engineer is struggling.",
                "Ignore the situation entirely."
            ],
            "correct_index": 1,
            "explanation": "Peer empathy and proactive workload sharing support team well-being and prevent severe burnout."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A SaaS customer discovers that an export feature downloads an Excel file containing other tenants' organization names due to a missing tenant ID filter in a raw SQL query. How should you respond?",
            "options": [
                "Deny the leak and tell the customer they uploaded those names themselves.",
                "Classify as a Severity-1 multi-tenancy breach, patch the query immediately with tenant scoping, notify the data privacy officer, audit logs to identify all affected tenants, and communicate transparently with impacted parties.",
                "Silently delete the export feature without explaining anything.",
                "Wait for the customer to file a lawsuit."
            ],
            "correct_index": 1,
            "explanation": "Multi-tenant data isolation leaks require immediate patch enforcement, DPO notification, tenant audit, and transparent compliance reporting under data privacy laws."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "An e-commerce company notices during flash sales that hundreds of orders are created for items with zero inventory remaining because concurrent checkout requests read stale stock counts before updating them (race condition). What architectural design fixes this issue?",
            "options": [
                "Tell users to buy items one person at a time.",
                "Implement pessimistic locking (`SELECT FOR UPDATE`) or atomic inventory decrements (`UPDATE inventory SET stock = stock - 1 WHERE id = ? AND stock > 0`) combined with Redis distributed locks.",
                "Cancel all flash sales permanently.",
                "Allow infinite overselling and apologize to customers later."
            ],
            "correct_index": 1,
            "explanation": "Atomic SQL decrements with condition checks (`stock > 0`) or distributed locking (e.g. Redlock) prevent concurrent read-check-update race conditions in inventory systems."
        }
    ]
}

SET_59 = {
    "set_number": 59,
    "title": "Soft Skill Assessment - Set 59",
    "slug": "soft-skill-assessment-set-59",
    "description": "Measures circular track kinematics, parallel seating permutations, misplaced modifier syntax, and PII masking.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B run around a circular track of 1,200 meters from the same point in the same direction at speeds of 30 m/s and 20 m/s respectively. After how many seconds will they meet for the first time?",
            "options": ["60 seconds", "90 seconds", "120 seconds", "150 seconds"],
            "correct_index": 2,
            "explanation": "Relative speed in same direction = 30 - 20 = 10 m/s. Time to meet = Track length / Relative speed = 1,200 / 10 = 120 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A, B, and C can complete a task in 10, 15, and 30 days respectively. In how many days can they complete the task if they all work together?",
            "options": ["4 days", "5 days", "6 days", "7.5 days"],
            "correct_index": 1,
            "explanation": "Combined 1-day rate = 1/10 + 1/15 + 1/30 = (3 + 2 + 1)/30 = 6/30 = 1/5. Working together, they complete it in 5 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Find the compound interest on ₹25,000 for 1 year at 12% per annum, compounded semi-annually.",
            "options": ["₹3,000", "₹3,090", "₹3,150", "₹3,200"],
            "correct_index": 1,
            "explanation": "Semi-annual rate = 12% / 2 = 6%. Periods n = 2. Amount = 25,000 × (1.06)² = 25,000 × 1.1236 = ₹28,090. CI = 28,090 - 25,000 = ₹3,090."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "An alloy contains copper and tin in the ratio 4 : 1. In another alloy, copper and tin are in the ratio 3 : 2. If equal weights of both alloys are melted together, what is the ratio of copper and tin in the resulting alloy?",
            "options": ["5 : 3", "7 : 3", "9 : 5", "11 : 5"],
            "correct_index": 1,
            "explanation": "In alloy 1: Copper = 4/5, Tin = 1/5. In alloy 2: Copper = 3/5, Tin = 2/5. Equal weights: Copper = 4/5 + 3/5 = 7/5. Tin = 1/5 + 2/5 = 3/5. Ratio = (7/5) : (3/5) = 7 : 3."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average salary of 12 employees in an engineering squad is ₹75,000. When the salary of the engineering director is included, the average salary rises to ₹85,000. What is the salary of the engineering director?",
            "options": ["₹180,000", "₹195,000", "₹205,000", "₹220,000"],
            "correct_index": 2,
            "explanation": "Total initial salary = 12 × ₹75,000 = ₹9,00,000. Total salary including the director = 13 × ₹85,000 = ₹11,05,000. Director's salary = ₹11,05,000 - ₹9,00,000 = ₹2,05,000."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the highest power of 5 that divides 100! without leaving a remainder?",
            "options": ["20", "22", "24", "25"],
            "correct_index": 2,
            "explanation": "floor(100/5) + floor(100/25) = 20 + 4 = 24."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two fair dice are thrown simultaneously. What is the probability that the sum of the scores is divisible by 5?",
            "options": ["1/6", "5/36", "7/36", "2/9"],
            "correct_index": 2,
            "explanation": "Possible sums divisible by 5 are 5 and 10. Sum 5: (1,4),(2,3),(3,2),(4,1) = 4. Sum 10: (4,6),(5,5),(6,4) = 3. Total favorable = 4 + 3 = 7. Probability = 7 / 36."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The sides of a triangle are 5 cm, 12 cm, and 13 cm. What is its area?",
            "options": ["25 cm²", "30 cm²", "32.5 cm²", "60 cm²"],
            "correct_index": 1,
            "explanation": "5, 12, 13 is a Pythagorean right-angled triangle (5² + 12² = 25 + 144 = 169 = 13²). Area = 0.5 × base × height = 0.5 × 5 × 12 = 30 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six team members are seated in two parallel rows of three each: Row 1 faces South (P, Q, R) and Row 2 faces North (X, Y, Z). P sits opposite Y. Q is in the exact middle of Row 1. X sits in the exact middle of Row 2. If R sits at the left end of Row 1 (facing South), who sits opposite R?",
            "options": ["X", "Y", "Z", "Cannot be determined"],
            "correct_index": 1,
            "explanation": "Row 1 (facing South): Middle is Q. Middle of Row 2 is X (Q is opposite X). P is opposite Y. Since R is at one end and P is at the other, Y sits opposite R."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All compilers are optimizers. No optimizer is slow. Some engines are compilers. Conclusions: I. Some engines are not slow. II. No compiler is slow.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Compilers are inside optimizers which never touch slow, so no compiler is slow (II follows). Engines overlap compilers which are not slow, so some engines are not slow (I follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'RED' is coded as 'UHG' (+3 to each letter). How is 'BLUE' coded under the exact same shift rule?",
            "options": ["EOXH", "ENXH", "EOXI", "DNXH"],
            "correct_index": 0,
            "explanation": "B(+3)=E, L(+3)=O, U(+3)=X, E(+3)=H => EOXH."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A developer walks 8 km South, turns right and walks 6 km. What is the straight-line displacement from the starting point?",
            "options": ["10 km South-West", "10 km North-East", "14 km South-West", "12 km South"],
            "correct_index": 0,
            "explanation": "Facing South, right turn is West. Distance = sqrt(8² + 6²) = 10 km in the South-West direction."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said: 'His mother is the only daughter of my father.' How is the woman related to the man?",
            "options": ["Mother", "Aunt", "Sister", "Daughter"],
            "correct_index": 0,
            "explanation": "The woman's father's only daughter is the woman herself. She is the mother of the man."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 10, 20, 30, 40, 50, ?",
            "options": ["55", "60", "65", "70"],
            "correct_index": 1,
            "explanation": "Each term increases by 10: 50 + 10 = 60."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The engineering team should migrate logging from local server files to a centralized log aggregator (e.g., Elasticsearch or Datadog).' Assumptions: I. Centralized logging enables rapid cross-service correlation during production incidents. II. Local server log files are completely immune to disk-space exhaustion.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 0,
            "explanation": "Assumption I is the primary architectural driver for centralized logging. Assumption II is false; local log files frequently cause disk-space exhaustion."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the sentence that avoids a dangling modifier:",
            "options": [
                "Walking through the data center, the flashing LED indicators caught Sarah's attention.",
                "Walking through the data center, Sarah noticed the flashing LED indicators on the server rack.",
                "Walking through the data center, the server rack's flashing LEDs were seen by Sarah.",
                "The flashing LED indicators caught Sarah's attention walking through the data center."
            ],
            "correct_index": 1,
            "explanation": "In option B, the subject immediately following the introductory participial clause 'Walking through the data center' is 'Sarah', the person who was actually walking, thereby avoiding a dangling modifier."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'ZEALOUS':",
            "options": ["Passionate", "Apathetic", "Indifferent", "Lethargic"],
            "correct_index": 0,
            "explanation": "'Zealous' means having or showing great energy or enthusiasm in pursuit of a cause or objective; passionate."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'EPHEMERAL':",
            "options": ["Permanent", "Transitory", "Fleeting", "Short-lived"],
            "correct_index": 0,
            "explanation": "'Ephemeral' means lasting for a very short time. Its antonym is 'permanent' or 'eternal'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To bark up the wrong tree' mean?",
            "options": [
                "To make a noise in an orchard",
                "To pursue a mistaken line of thought or misdirect one's efforts",
                "To train automated classifiers incorrectly",
                "To speak rudely to a senior stakeholder"
            ],
            "correct_index": 1,
            "explanation": "'To bark up the wrong tree' means to follow a false lead, pursue a mistaken course of action, or blame the wrong person."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who attacks or criticizes cherished beliefs or institutions'",
            "options": ["Iconoclast", "Philistine", "Heretic", "Apostate"],
            "correct_index": 0,
            "explanation": "An 'Iconoclast' is a person who attacks cherished beliefs or established institutions."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an abundance or excess:",
            "options": ["Plethora", "Plathora", "Plethra", "Plethura"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Plethora'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A developer notices that an API gateway debug log statement is printing unmasked customer credit card numbers into an AWS CloudWatch log group. What is the emergency compliance protocol?",
            "options": [
                "Wait until the quarterly security audit to mention it.",
                "Deploy an immediate hotfix to strip or mask PCI fields in the logger, purge the affected CloudWatch log streams per PCI-DSS compliance, and notify the Security & Compliance lead.",
                "Delete the entire CloudWatch log group without telling anyone.",
                "Ignore it because CloudWatch is private."
            ],
            "correct_index": 1,
            "explanation": "Immediate masking, log purging, and compliance escalation is mandatory under PCI-DSS standards when unencrypted payment card data enters log streams."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A developer repeatedly misses daily standups or arrives 10 minutes late. How should the Scrum Master address this professionally?",
            "options": [
                "Lock the door or mute them from the call.",
                "Have a private 1-on-1 check-in to understand if there is a scheduling conflict or personal hurdle, explain how punctuality respects team time, and adjust standup timing collaboratively if needed.",
                "Deduct money from their salary.",
                "Complain to the entire team about them."
            ],
            "correct_index": 1,
            "explanation": "Private empathetic inquiry uncovers root causes and reinforces team accountability without public embarrassment."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated CI/CD pipeline fails during deployment because an npm dependency package version was updated with a breaking upstream minor release (unpinned dependency). How do you resolve this permanently?",
            "options": [
                "Never update dependencies again.",
                "Commit a strict `package-lock.json` lockfile, pin exact semantic version numbers, and use automated dependency scanning bots (e.g., Dependabot/Renovate) to test upgrades in isolated PRs.",
                "Run npm install with `--force`.",
                "Delete node_modules in production."
            ],
            "correct_index": 1,
            "explanation": "Enforcing lockfiles and isolated upgrade PRs guarantees deterministic reproducible builds across all CI and production environments."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your SaaS application is expanding to serve German financial institutions that mandate strict EU data sovereignty (customer data must never leave the European Union). How do you architect your AWS footprint?",
            "options": [
                "Host everything in us-east-1 and tell auditors it is in Germany.",
                "Deploy a dedicated EU regional cell in Frankfurt (eu-central-1), enforce AWS IAM SCP boundary policies restricting data transfer outside the region, and implement localized backups.",
                "Refuse European customers.",
                "Use a public FTP server in Berlin."
            ],
            "correct_index": 1,
            "explanation": "Deploying dedicated regional cloud cells governed by AWS Service Control Policies (SCPs) guarantees physical and regulatory data residency compliance."
        }
    ]
}

SET_60 = {
    "set_number": 60,
    "title": "Soft Skill Assessment - Set 60",
    "slug": "soft-skill-assessment-set-60",
    "description": "Explores escalator counter-kinematics, mixed-orientation circular arrangements, inverted syntax, and rollback safety gates.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A person walks down a moving escalator in 30 seconds. If he runs down at double his walking speed, he takes 18 seconds. How many seconds would he take to walk down if the escalator were stationary?",
            "options": ["45 seconds", "60 seconds", "75 seconds", "90 seconds"],
            "correct_index": 3,
            "explanation": "Let walking speed be w, running speed be 2w, and escalator speed be e. Total steps S = (w + e) × 30 = (2w + e) × 18. 30w + 30e = 36w + 18e => 12e = 6w => w = 2e => e = 0.5w. S = (w + 0.5w) × 30 = 1.5w × 30 = 45w? Wait: 30w + 30e = 36w + 18e => 12e = 6w => w = 2e. S = (2e + e) × 30 = 90e. Walking speed = w = 2e. Time on stationary escalator = S / w = 90e / 2e = 45 seconds! Let's verify: at w=2, e=1: (2+1)*30 = 90. At 2w=4: (4+1)*18 = 90. Stationary time at w=2: 90 / 2 = 45 seconds! Options: 45s is index 0."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Two articles are sold for ₹9,900 each. On one, the merchant gains 10% and on the other, he loses 10%. What is his overall gain or loss percentage?",
            "options": ["No profit, no loss", "1% gain", "1% loss", "2% loss"],
            "correct_index": 2,
            "explanation": "When two items are sold at the same selling price, one at a gain of x% and the other at a loss of x%, there is always an overall loss of (x / 10)² % = (10 / 10)² = 1% loss."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes of diameters 2 cm and 4 cm run together. The rate of flow of water is proportional to the square of their diameters. If the larger pipe alone fills the cistern in 20 minutes, in how many minutes will both pipes together fill it?",
            "options": ["12 minutes", "15 minutes", "16 minutes", "18 minutes"],
            "correct_index": 2,
            "explanation": "Flow rates are proportional to d²: 2² = 4, 4² = 16. Total flow rate = 4 + 16 = 20. Total work = 16 × 20 = 320. Time taken together = 320 / 20 = 16 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum was put at simple interest at a certain rate for 4 years. Had it been put at 3% higher rate, it would have fetched ₹1,440 more. Find the sum.",
            "options": ["₹10,000", "₹12,000", "₹14,000", "₹15,000"],
            "correct_index": 1,
            "explanation": "Additional interest = P × (3/100) × 4 = 0.12P. 0.12P = 1,440 => P = 1,440 / 0.12 = ₹12,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the distance between the two points A(3, 4) and B(7, 1) in the 2D Cartesian plane.",
            "options": ["4", "5", "6", "7"],
            "correct_index": 1,
            "explanation": "Distance = sqrt((7 - 3)² + (1 - 4)²) = sqrt(4² + (-3)²) = sqrt(16 + 9) = sqrt(25) = 5."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can the letters of the word 'DETAIL' be arranged so that the vowels occupy only the odd positions?",
            "options": ["36", "48", "60", "72"],
            "correct_index": 0,
            "explanation": "Word DETAIL has 6 letters: 3 vowels (E, A, I) and 3 consonants (D, T, L). Odd positions are 1, 3, 5 (3 slots). Vowels can be arranged in 3! = 6 ways. Consonants can be arranged in remaining 3 even positions in 3! = 6 ways. Total arrangements = 6 × 6 = 36."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "If 4 men or 6 women can do a piece of work in 12 days, how long will 6 men and 3 women take to complete the same work?",
            "options": ["4 days", "4.8 days", "5 days", "6 days"],
            "correct_index": 1,
            "explanation": "4 men = 6 women => 1 man = 1.5 women. 6 men + 3 women = 6(1.5) + 3 = 9 + 3 = 12 women. If 6 women take 12 days, 12 women will take (6 × 12) / 12 = 6 days? Wait! 4 men = 6 women => 1M = 1.5W. 6M + 3W = 9W + 3W = 12W. M1 × D1 = M2 × D2 => 6 × 12 = 12 × D2 => D2 = 6 days! If options: 6 days is index 3."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 5 numbers is 20. If each number is increased by 5, what is the new average?",
            "options": ["20", "22.5", "25", "30"],
            "correct_index": 2,
            "explanation": "When a constant k is added to every number in a dataset, the average increases by k: 20 + 5 = 25."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All pods are instances. Some instances are nodes. All nodes are clusters. Conclusions: I. Some clusters are instances. II. Some pods are nodes.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Instances overlap nodes which are all clusters, so clusters definitely overlap instances (I follows). Pods and nodes have no guaranteed overlap (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six team members A, B, C, D, E, and F sit around a circular table. Four face the center and two face outside. A faces the center. B sits second to the left of A and faces outside. C sits to the immediate right of B. D sits opposite to A. Who sits to the immediate left of A?",
            "options": ["C", "E", "F", "Cannot be determined without additional info"],
            "correct_index": 0,
            "explanation": "A faces center. Immediate left of A (facing center) is positioned clockwise. If B is second to left of A, C sits between A and B to the immediate right of B. Thus C sits to the immediate left of A."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'CODE' is coded as 'DPEF' (+1 to each letter), how is 'TEST' coded?",
            "options": ["UFTU", "UFSU", "UGTU", "TFTU"],
            "correct_index": 0,
            "explanation": "T(+1)=U, E(+1)=F, S(+1)=T, T(+1)=U => UFTU."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A delivery vehicle drives 9 km North, turns right and drives 12 km. What is the straight-line distance to the vehicle from the start?",
            "options": ["13 km", "15 km", "17 km", "21 km"],
            "correct_index": 1,
            "explanation": "Distance = sqrt(9² + 12²) = sqrt(81 + 144) = sqrt(225) = 15 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the father of B. C is the sister of B. D is the mother of C. How is D related to A?",
            "options": ["Wife", "Sister", "Mother", "Daughter"],
            "correct_index": 0,
            "explanation": "B and C are siblings. A is their father and D is their mother. Therefore, D is the wife of A."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out from the following network protocols:",
            "options": ["HTTP", "HTTPS", "FTP", "Ethernet"],
            "correct_index": 3,
            "explanation": "HTTP, HTTPS, and FTP are Application Layer (Layer 7) protocols, whereas Ethernet is a Data Link/Physical Layer (Layer 2/1) protocol."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'All high-risk production deployments should mandate an automated canary rollback safety gate.' Conclusions: I. Automated canary gates reduce the mean time to recover (MTTR) during bad releases. II. Canary deployments completely eliminate all coding defects in development.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I captures the precise reliability goal of automated canary analysis. Conclusion II is an impossible claim; canaries limit blast radius in production, they do not prevent development defects."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence using correlative conjunctions 'not only... but also':",
            "options": [
                "The new platform not only reduces memory consumption by 40% but also enhances throughput under concurrency.",
                "The new platform not only reduces memory consumption by 40% but enhances also throughput under concurrency.",
                "Not only the new platform reduces memory consumption by 40% but also enhances throughput.",
                "The new platform reduces not only memory consumption by 40% but also it enhances throughput under concurrency."
            ],
            "correct_index": 0,
            "explanation": "Correlative conjunctions require parallel grammatical structures. Here, 'not only [reduces memory consumption] but also [enhances throughput]' cleanly parallels two transitive verb phrases."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SURREPTITIOUS':",
            "options": ["Clandestine", "Overt", "Blatant", "Transparent"],
            "correct_index": 0,
            "explanation": "'Surreptitious' means kept secret, especially because it would not be approved of; clandestine or stealthy."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'NADIR':",
            "options": ["Zenith", "Abyss", "Base", "Bottom"],
            "correct_index": 0,
            "explanation": "'Nadir' is the lowest or most unsuccessful point in a situation. Its direct antonym is 'zenith' (the highest point)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To spill the beans' mean?",
            "options": [
                "To make a mess in the kitchen",
                "To disclose a secret prematurely or inadvertently",
                "To conduct a unit test failure triage",
                "To invest heavily in risky assets"
            ],
            "correct_index": 1,
            "explanation": "'To spill the beans' means to disclose a secret or reveal confidential information inadvertently."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who is excessively greedy for wealth or material gain'",
            "options": ["Avaricious", "Altruistic", "Ascetic", "Philanthropic"],
            "correct_index": 0,
            "explanation": "'Avaricious' means having or showing an extreme greed for wealth."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a standard or quintessential model:",
            "options": ["Epitome", "Epiteme", "Epitomy", "Epytome"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Epitome'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Following an overnight database schema migration, several customer search queries begin taking 12 seconds instead of 15ms because a vital composite index was accidentally omitted from the migration script. What is the production mitigation?",
            "options": [
                "Roll back all application servers and tell customers that search is permanently deprecated.",
                "Execute an online non-blocking index creation (`CREATE INDEX CONCURRENTLY` in Postgres or `ALGORITHM=INPLACE` in MySQL) directly on the production database without locking write tables.",
                "Take down the entire customer portal for a 24-hour maintenance window.",
                "Reboot the cloud virtual machine hosting the database."
            ],
            "correct_index": 1,
            "explanation": "Online index creation (`CONCURRENTLY` / `INPLACE`) builds missing indexes without acquiring exclusive table write locks, immediately resolving catastrophic query performance regressions with zero user disruption."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During code review, a senior developer repeatedly leaves harsh personal comments like 'Who taught you to code like this?' on a junior engineer's pull request. How should the engineering manager intervene?",
            "options": [
                "Ignore it because senior engineers have earned the right to be blunt.",
                "Speak with the senior developer privately to set clear standards for respectful, constructive, and objective code review comments focused on technical rationale rather than personal attacks.",
                "Fire the junior engineer for writing poor code.",
                "Ban the junior engineer from submitting PRs."
            ],
            "correct_index": 1,
            "explanation": "Constructive code review guidelines maintain psychological safety, professional culture, and effective engineering collaboration."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company is implementing a European customer portal. The legal compliance team notes that customer cookies for tracking require explicit prior user opt-in under GDPR ePrivacy regulations. What is the frontend implementation standard?",
            "options": [
                "Assume consent by default and track users anyway.",
                "Block non-essential tracking cookies until the user explicitly clicks 'Accept' on a clear cookie preference banner, and provide easy revocation settings.",
                "Block European visitors entirely.",
                "Delete all cookies on every click."
            ],
            "correct_index": 1,
            "explanation": "GDPR ePrivacy mandates explicit, informed opt-in consent before executing non-essential analytics or advertising tracking scripts."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A Kubernetes pod running an order fulfillment worker crashes because it ignores the `SIGTERM` signal sent during node draining, leading to hard termination (`SIGKILL`) after 30 seconds and leaving half-processed orders in an inconsistent state. How do you fix this?",
            "options": [
                "Increase terminationGracePeriodSeconds to 10 hours.",
                "Update the worker application code to trap and handle `SIGTERM` gracefully: stop accepting new work, finish in-flight order database transactions, flush state, and exit cleanly within the grace period.",
                "Disable Kubernetes node draining.",
                "Never restart worker nodes."
            ],
            "correct_index": 1,
            "explanation": "Proper POSIX signal handling (`SIGTERM`) allows workers to drain in-flight transactions safely before termination, maintaining database consistency."
        }
    ]
}

# Fix SET_60 Q1 and Q7
SET_60["questions"][0]["options"] = ["45 seconds", "60 seconds", "75 seconds", "90 seconds"]
SET_60["questions"][0]["correct_index"] = 0
SET_60["questions"][0]["explanation"] = "Total steps S = (w + e) × 30 = (2w + e) × 18 => 30w + 30e = 36w + 18e => 12e = 6w => w = 2e. S = (2e + e) × 30 = 90e. Time on stationary escalator = S / w = 90e / 2e = 45 seconds."

SET_60["questions"][6]["options"] = ["4 days", "4.8 days", "5 days", "6 days"]
SET_60["questions"][6]["correct_index"] = 3
SET_60["questions"][6]["explanation"] = "4 men = 6 women => 1 man = 1.5 women. 6 men + 3 women = 6(1.5) + 3 = 9 + 3 = 12 women. If 6 women complete in 12 days, 12 women complete in (6 × 12) / 12 = 6 days."

PART_12_SETS = [SET_56, SET_57, SET_58, SET_59, SET_60]
