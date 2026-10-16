# Sets 36 to 40 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_36 = {
    "set_number": 36,
    "title": "Soft Skill Assessment - Set 36",
    "slug": "soft-skill-assessment-set-36",
    "description": "Measures relative speeds, linear arrangement, subject-verb concord with correlatives, and flaky test mitigation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 270 meters long is moving at 54 km/h. How many seconds will it take to cross a platform 180 meters long?",
            "options": ["24 seconds", "28 seconds", "30 seconds", "32 seconds"],
            "correct_index": 2,
            "explanation": "Total distance = 270 + 180 = 450 m. Speed in m/s = 54 × (5/18) = 15 m/s. Time = 450 / 15 = 30 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A merchant sells an article at 10% loss. If he had sold it for ₹45 more, he would have made a 5% profit. What was the cost price of the article?",
            "options": ["₹250", "₹280", "₹300", "₹350"],
            "correct_index": 2,
            "explanation": "Difference between 5% profit and 10% loss is 15%. 15% of CP = ₹45 => CP = (45 / 15) × 100 = ₹300."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the compound interest on ₹10,000 for 1.5 years at 10% per annum, interest compounded half-yearly.",
            "options": ["₹1,500.00", "₹1,576.25", "₹1,625.50", "₹1,650.00"],
            "correct_index": 1,
            "explanation": "Half-yearly rate = 10% / 2 = 5%. Number of periods n = 1.5 × 2 = 3. Amount = 10,000 × (1.05)^3 = 10,000 × 1.157625 = ₹11,576.25. CI = 11,576.25 - 10,000 = ₹1,576.25."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B undertake to do a piece of work for ₹600. A alone can do it in 6 days while B alone can do it in 8 days. With the help of C, they finish it in 3 days. Find C's share of the money.",
            "options": ["₹75", "₹80", "₹90", "₹100"],
            "correct_index": 0,
            "explanation": "A's 1-day work = 1/6, B's 1-day work = 1/8. Together in 3 days: A does 3/6 = 1/2 of work. B does 3/8 of work. Total work done by A and B = 1/2 + 3/8 = 7/8. Remaining work done by C = 1 - 7/8 = 1/8. C's share = 1/8 of ₹600 = ₹75."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A bag contains ₹1, 50-paise, and 25-paise coins in the ratio 3 : 4 : 5. If the total money in the bag is ₹250, how many 50-paise coins are there?",
            "options": ["150", "180", "200", "240"],
            "correct_index": 2,
            "explanation": "Value per unit ratio = 3(₹1) + 4(₹0.50) + 5(₹0.25) = 3 + 2 + 1.25 = ₹6.25. Total value = ₹250. Multiplier = 250 / 6.25 = 40. Number of 50-paise coins = 4 × 40 = 160? Wait! 250 / 6.25 = 40. 4 × 40 = 160. Let's make options: [120, 140, 160, 200] so 160 is option 2."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A cricketer has an average of 30 runs in 10 innings. How many runs must he score in his next inning to raise his average to 34?",
            "options": ["64", "70", "74", "80"],
            "correct_index": 2,
            "explanation": "Total runs in 10 innings = 10 × 30 = 300. Required total runs in 11 innings = 11 × 34 = 374. Runs needed = 374 - 300 = 74."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If the number 738A6A is divisible by 11, what is the value of the digit A?",
            "options": ["2", "3", "6", "9"],
            "correct_index": 3,
            "explanation": "Sum of odd position digits (from right): A + A + 3 = 2A + 3. Sum of even position digits: 6 + 8 + 7 = 21. Difference = 21 - (2A + 3) = 18 - 2A. For divisibility by 11, 18 - 2A must be a multiple of 11 or 0. If 18 - 2A = 0 => 2A = 18 => A = 9."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two unbiased dice are rolled simultaneously. What is the probability that the sum of the numbers appearing on top is a prime number?",
            "options": ["5/12", "7/18", "1/2", "13/36"],
            "correct_index": 0,
            "explanation": "Possible prime sums from 2 to 12: 2, 3, 5, 7, 11. Sum 2: (1,1) -> 1 way. Sum 3: (1,2),(2,1) -> 2 ways. Sum 5: (1,4),(2,3),(3,2),(4,1) -> 4 ways. Sum 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) -> 6 ways. Sum 11: (5,6),(6,5) -> 2 ways. Total favorable ways = 1 + 2 + 4 + 6 + 2 = 15. Total outcomes = 36. Probability = 15 / 36 = 5 / 12."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Only a few coders are architects. All architects are engineers. Conclusions: I. Some engineers are coders. II. No engineer is a coder.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Either conclusion I or II follows",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Since some coders are architects and all architects are engineers, those coders who are architects must also be engineers. Therefore, 'Some engineers are coders' definitely follows (I follows). Conclusion II is false."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven colleagues—A, B, C, D, E, F, G—are sitting in a single straight row facing South. C sits in the exact middle of the row. A sits third to the right of C. D sits second to the left of A. Who is seated between A and D?",
            "options": ["F", "G", "B", "None, they are adjacent"],
            "correct_index": 2,
            "explanation": "Row facing South: right is towards the West (left side from observer's view). Seats 1 to 7 from West to East: C is at middle (seat 4). Facing South, right of C is seats 1, 2, 3. A sits third to the right of C, so A is at seat 1. Left of A (facing South) is towards seat 2, 3, etc. D sits second to the left of A, so D is at seat 3. Seat 2 is between A and D. If B is at seat 2, B sits between A and D."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a coded relationship: 'A + B' means A is father of B; 'A - B' means A is wife of B; 'A * B' means A is brother of B. Which of the following means 'P is mother of R'?",
            "options": ["P - Q + R", "P + Q - R", "P * Q + R", "Q + P - R"],
            "correct_index": 0,
            "explanation": "P - Q: P is wife of Q. Q + R: Q is father of R. If Q is father of R and P is wife of Q, then P is mother of R."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the series: 5, 11, 24, 51, 106, ?",
            "options": ["215", "217", "219", "221"],
            "correct_index": 1,
            "explanation": "5 × 2 + 1 = 11; 11 × 2 + 2 = 24; 24 × 2 + 3 = 51; 51 × 2 + 4 = 106; 106 × 2 + 5 = 217."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "One morning after sunrise, Suresh was standing facing a pole. The shadow of the pole fell exactly to his right. Which direction was Suresh facing?",
            "options": ["East", "West", "North", "South"],
            "correct_index": 3,
            "explanation": "In the morning, the sun rises in the East, so shadows fall towards the West. If the shadow is to Suresh's right, West must be to his right. If West is to his right, Suresh must be facing South."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Choose the pair that shares the same relationship as 'OASIS : DESERT':",
            "options": ["ISLAND : OCEAN", "TREE : FOREST", "PENINSULA : CONTINENT", "LAKE : MOUNTAIN"],
            "correct_index": 0,
            "explanation": "An oasis is a fertile spot surrounded by desert, just as an island is a body of land completely surrounded by ocean."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: I. The company introduced mandatory two-factor authentication for all remote employees. II. Several employee credentials were discovered for sale on an underground hacker forum last week.",
            "options": [
                "Statement I is cause and II is effect",
                "Statement II is cause and I is effect",
                "Both are independent causes",
                "Both are effects of independent causes"
            ],
            "correct_index": 1,
            "explanation": "The breach/exposure of credentials (Statement II) prompted the enterprise security response of mandating 2FA (Statement I)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the correct verb form: 'The engineering director, as well as the senior architects, ______ attending the conference in Munich.'",
            "options": ["is", "are", "were", "have been"],
            "correct_index": 0,
            "explanation": "When a singular subject ('The engineering director') is connected to other nouns by 'as well as', the verb agrees with the first subject, which is singular ('is')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'EPHEMERAL':",
            "options": ["Permanent", "Fleeting", "Monolithic", "Immutable"],
            "correct_index": 1,
            "explanation": "'Ephemeral' means lasting for a very short time; synonymous with 'fleeting'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of the word 'PERNICIOUS':",
            "options": ["Harmful", "Noxious", "Beneficial", "Deleterious"],
            "correct_index": 2,
            "explanation": "'Pernicious' means having a harmful effect, especially in a gradual or subtle way. Its antonym is 'beneficial'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To burn the candle at both ends' mean?",
            "options": [
                "To celebrate a breakthrough enthusiastically",
                "To exhaust one's energy by working late nights and early mornings",
                "To waste financial resources needlessly",
                "To ignite team passion during a crisis"
            ],
            "correct_index": 1,
            "explanation": "'To burn the candle at both ends' means to overwork oneself by going to bed late and waking up early."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the sentence that contains a dangling modifier:",
            "options": [
                "Having completed the deployment, the server was restarted by the engineer.",
                "Having completed the deployment, the engineer restarted the server.",
                "After the deployment was completed, the engineer restarted the server.",
                "The engineer restarted the server once the deployment was finished."
            ],
            "correct_index": 0,
            "explanation": "In option A, 'Having completed the deployment' grammatically modifies 'the server' (the subject that follows the comma), creating an illogical dangling modifier because the server cannot complete a deployment."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the one-word substitution for: 'A soldier who fights for any country or group that will pay them'",
            "options": ["Mercenary", "Patriot", "Cadet", "Veteran"],
            "correct_index": 0,
            "explanation": "A 'Mercenary' is someone primarily concerned with making money at the expense of ethics, specifically a hired soldier."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated end-to-end integration test suite takes 45 minutes to run and fails randomly 15% of the time due to asynchronous network timing. Developers are beginning to ignore CI test failures. How should the team handle this?",
            "options": [
                "Delete all tests and rely solely on manual testing.",
                "Quarantine flaky tests immediately into an advisory pipeline, replace artificial sleep statements with explicit deterministic wait conditions, and parallelize tests to reduce duration.",
                "Ban developers from merging code until they run the 45-minute suite 10 times locally.",
                "Disable pull request gating entirely."
            ],
            "correct_index": 1,
            "explanation": "Quarantining unreliable tests, removing non-deterministic sleeps in favor of explicit pollers, and optimizing test execution time restores confidence in CI pipelines."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A developer repeatedly misses sprint commitments because they agree to help multiple teammates with their tasks during sprint hours. What guidance should the agile coach provide?",
            "options": [
                "Tell them never to speak to teammates during work hours.",
                "Help them balance team collaboration by encouraging them to log ad-hoc support in sprint capacity and practice politely deferring non-urgent requests until their primary deliverables are on track.",
                "Reassign their core tasks to someone else permanently.",
                "Publicly penalize them in retrospectives."
            ],
            "correct_index": 1,
            "explanation": "Coaching developers on capacity allocation and setting healthy boundaries preserves team collaboration without sacrificing delivery reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An external security researcher submits a valid vulnerability report showing that your public API does not validate JWT signatures on a specific staging endpoint. How do you respond?",
            "options": [
                "Threaten legal action against the researcher for unauthorized probing.",
                "Validate and triage the vulnerability through the security response program, patch the endpoint immediately, thank the researcher with appropriate attribution/bounty, and audit all remaining endpoints.",
                "Ignore the report because it is only on staging.",
                "Shut down the entire company website."
            ],
            "correct_index": 1,
            "explanation": "Professional coordinated vulnerability disclosure practices include prompt triage, rapid remediation, grateful researcher acknowledgment, and broader surface-area audits."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Under high concurrency during a flash sale, your Redis cache cluster CPU hits 98% because 50,000 requests per second are simultaneously requesting a single popular product whose cache entry just expired (cache stampede / thundering herd). What is the appropriate architectural solution?",
            "options": [
                "Reboot the Redis cluster every 5 minutes.",
                "Implement mutex locking (probabilistic early expiration / cache stampede locks) so only one thread regenerates the cache while other requests serve slightly stale data or wait briefly.",
                "Disable caching completely and direct all 50,000 requests to MySQL.",
                "Display a 404 page for the product."
            ],
            "correct_index": 1,
            "explanation": "Distributed mutex locks or probabilistic early background cache recomputation (XFetch) prevent stampede surges from crushing backend datastores upon key expiration."
        }
    ]
}

# Fix question 5 in SET_36
SET_36["questions"][4]["options"] = ["120", "140", "160", "200"]
SET_36["questions"][4]["correct_index"] = 2
SET_36["questions"][4]["explanation"] = "Total value per unit = 3(₹1) + 4(₹0.50) + 5(₹0.25) = 3 + 2 + 1.25 = ₹6.25. Multiplier = 250 / 6.25 = 40. Number of 50-paise coins = 4 × 40 = 160."

SET_37 = {
    "set_number": 37,
    "title": "Soft Skill Assessment - Set 37",
    "slug": "soft-skill-assessment-set-37",
    "description": "Explores circular tracks, multi-factor blood trees, dangling modifier identification, and zero-downtime secrets rotation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B run around a circular track of 600 meters in length at speeds of 15 m/s and 10 m/s in the same direction. After how many seconds will they meet for the first time at the starting point?",
            "options": ["60 seconds", "90 seconds", "120 seconds", "150 seconds"],
            "correct_index": 2,
            "explanation": "Time taken by A to complete 1 round = 600 / 15 = 40 seconds. Time taken by B to complete 1 round = 600 / 10 = 60 seconds. They will meet at the starting point at LCM(40, 60) = 120 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A is 50% more efficient than B. If B alone can complete a job in 15 days, how many days will A alone take to finish the same job?",
            "options": ["8 days", "10 days", "12 days", "12.5 days"],
            "correct_index": 1,
            "explanation": "Efficiency ratio of A : B = 150 : 100 = 3 : 2. Ratio of time taken = 2 : 3. If B takes 15 days, A takes (2/3) × 15 = 10 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In an election between two candidates, 10% of voters did not cast their vote and 60 votes were declared invalid. The winning candidate got 47% of the total enrolled voters and won by 308 votes. Find the total number of enrolled voters.",
            "options": ["5,400", "6,200", "6,800", "7,200"],
            "correct_index": 1,
            "explanation": "Let total enrolled voters be x. Votes cast = 0.90x. Valid votes = 0.90x - 60. Winner votes = 0.47x. Loser votes = (0.90x - 60) - 0.47x = 0.43x - 60. Margin = Winner - Loser = 0.47x - (0.43x - 60) = 0.04x + 60. 0.04x + 60 = 308 => 0.04x = 248 => x = 248 / 0.04 = 6,200."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum of money invested at simple interest triples itself in 8 years. In how many years will it become 9 times of itself at the same rate of interest?",
            "options": ["24 years", "28 years", "32 years", "36 years"],
            "correct_index": 2,
            "explanation": "Triples itself means interest earned is 2P in 8 years. Rate r = (2P × 100) / (P × 8) = 25%. To become 9 times, interest earned must be 8P. Time = (8P × 100) / (P × 25) = 800 / 25 = 32 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "How many 3-digit even numbers can be formed from the digits 1, 2, 3, 4, 5, 6 without repetition?",
            "options": ["40", "60", "72", "90"],
            "correct_index": 1,
            "explanation": "Last digit must be even: {2, 4, 6} (3 choices). Remaining 2 positions can be filled from remaining 5 digits in 5 × 4 = 20 ways. Total numbers = 20 × 3 = 60."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What was the day of the week on 15th August 1947?",
            "options": ["Thursday", "Friday", "Saturday", "Sunday"],
            "correct_index": 1,
            "explanation": "1600 years = 0 odd days. 300 years (1601-1900) = 1 odd day. 46 completed years (1901-1946): 11 leap years (22 odd days) + 35 ordinary years (35 odd days) = 57 odd days = 1 odd day (57 mod 7). Days in 1947 till Aug 15: Jan(3)+Feb(0)+Mar(3)+Apr(2)+May(3)+Jun(2)+Jul(3)+Aug(15) = 31 days = 3 odd days. Total odd days = 1 + 1 + 3 = 5. Day 5 is Friday."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A container contains 80 litres of milk. From this container, 8 litres of milk was taken out and replaced by water. This process was repeated further two times. How much milk is now contained by the container?",
            "options": ["56.84 litres", "58.32 litres", "60.48 litres", "62.16 litres"],
            "correct_index": 1,
            "explanation": "Amount of milk left = Total × (1 - y/Total)^n = 80 × (1 - 8/80)^3 = 80 × (0.9)^3 = 80 × 0.729 = 58.32 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The slant height of a right circular cone is 25 cm and its height is 24 cm. Find its curved surface area (use pi = 22/7).",
            "options": ["528 cm²", "550 cm²", "572 cm²", "616 cm²"],
            "correct_index": 1,
            "explanation": "Radius r = sqrt(l^2 - h^2) = sqrt(25^2 - 24^2) = sqrt(625 - 576) = sqrt(49) = 7 cm. Curved surface area = pi * r * l = (22/7) * 7 * 25 = 22 * 25 = 550 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All cars are vehicles. Some vehicles are electric. All electric are fast. Conclusions: I. Some fast are vehicles. II. Some cars are fast.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Since some vehicles are electric and all electric are fast, the vehicles that are electric must be fast (I follows). There is no guaranteed overlap between cars and fast (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people A, B, C, D, E, F, G, and H are sitting around a circular table. Four are facing the center and four are facing outwards. A sits second to the left of B, who faces the center. C sits third to the right of A. F sits opposite to C. D is an immediate neighbor of B and faces outwards. Who sits to the immediate right of B?",
            "options": ["D", "E", "G", "H"],
            "correct_index": 0,
            "explanation": "Since D is an immediate neighbor of B, D must sit either to the immediate right or immediate left of B. When placing A second to the left of B, the immediate right position is filled by D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the analogy: 'ARCHITECT : BLUEPRINT :: COMPOSER : ?'",
            "options": ["NOVEL", "SCORE", "CANVAS", "LYRICS"],
            "correct_index": 1,
            "explanation": "An architect creates a blueprint as the architectural notation for building, just as a composer creates a musical score for performance."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the brother of B. C is the father of A. D is the brother of E. E is the daughter of B. Who is the uncle of D?",
            "options": ["A", "B", "C", "Cannot be determined"],
            "correct_index": 0,
            "explanation": "D and E are siblings (children of B). A is the brother of their parent B. Therefore, A is the maternal or paternal uncle of D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out from the following group:",
            "options": ["Keyboard", "Mouse", "Scanner", "Monitor"],
            "correct_index": 3,
            "explanation": "Keyboard, Mouse, and Scanner are input devices, whereas Monitor is an output device."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Is positive integer X greater than 50? Statement 1: X is divisible by 25. Statement 2: X is divisible by 15.",
            "options": [
                "Statement 1 alone is sufficient",
                "Statement 2 alone is sufficient",
                "Both statements together are sufficient",
                "Both statements together are NOT sufficient"
            ],
            "correct_index": 2,
            "explanation": "Statement 1: X can be 25 (<= 50) or 75 (> 50) - insufficient. Statement 2: X can be 15, 30, 45 (<= 50) or 60 (> 50) - insufficient. Combined: X is divisible by LCM(25, 15) = 75. The smallest positive integer divisible by 75 is 75, which is strictly greater than 50. Therefore both statements together are sufficient."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'A surge in unauthorized scraping bots is degrading web search latency.' Courses of Action: I. Implement intelligent Cloudflare Bot Management and CAPTCHA rate limiting. II. Take the entire search engine offline until all bot developers are arrested.",
            "options": [
                "Only course of action I follows",
                "Only course of action II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Implementing automated bot mitigation and rate-limiting is a practical and standard technical response (I follows). Shutting down the entire platform permanently to pursue legal remedies is extreme and disproportionate (II does not follow)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the word closest in meaning to 'UBIQUITOUS':",
            "options": ["Omnipresent", "Rare", "Unique", "Ephemeral"],
            "correct_index": 0,
            "explanation": "'Ubiquitous' means present, appearing, or found everywhere; synonymous with 'omnipresent'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the antonym of 'VENERATE':",
            "options": ["Despise", "Respect", "Adore", "Cherish"],
            "correct_index": 0,
            "explanation": "'Venerate' means to regard with great respect or reverence. Its antonym is 'despise' or 'disdain'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What is the meaning of the idiom 'To spill the beans'?",
            "options": [
                "To waste valuable ingredients",
                "To disclose a secret prematurely or indiscreetly",
                "To make a disastrous financial investment",
                "To finish work ahead of schedule"
            ],
            "correct_index": 1,
            "explanation": "'To spill the beans' means to reveal secret or confidential information inadvertently or prematurely."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the correct option to fill in the blank: 'The CTO insisted that the engineering team ______ automated canary deployments before Friday.'",
            "options": ["implement", "implements", "implemented", "will implement"],
            "correct_index": 0,
            "explanation": "Verbs of urging, insisting, or demanding take the mandate subjunctive, which uses the base form of the verb ('implement') regardless of the subject."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the one-word substitution for: 'A person who practices severe self-discipline and abstains from all forms of indulgence'",
            "options": ["Hedonist", "Ascetic", "Epicurean", "Sensualist"],
            "correct_index": 1,
            "explanation": "An 'Ascetic' is someone who leads an austere life of rigorous self-denial and spiritual discipline."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a high-ranking corporate executive:",
            "options": ["Enterpreneur", "Entrepreneur", "Entreprenure", "Entrepraneur"],
            "correct_index": 1,
            "explanation": "The correct spelling is 'Entrepreneur'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an ongoing two-week sprint, the VP of Sales requests an emergency custom export button for an enterprise prospect, claiming the deal hinges on it. How should the scrum team react?",
            "options": [
                "Immediately drop all planned sprint backlog items and hack the feature in overnight.",
                "Direct the VP to the Product Owner to evaluate the commercial priority, assess whether an in-flight sprint story can be swapped out without compromising sprint goals, and preserve sprint cadence.",
                "Refuse to talk to anyone in the sales department.",
                "Promise the feature in 1 hour without checking the codebase."
            ],
            "correct_index": 1,
            "explanation": "Funneling stakeholder scope requests through the Product Owner ensures business value prioritization without derailing active sprint commitments."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are pair programming with an engineer who gets defensive whenever a bug in their commit is identified. How can you provide feedback constructively?",
            "options": [
                "Tell them their coding abilities are substandard.",
                "Frame feedback around code quality, system test cases, and shared team outcomes rather than personal capability, highlighting edge-case unit tests together.",
                "Stop pair programming and do all the work alone.",
                "File an anonymous complaint with HR."
            ],
            "correct_index": 1,
            "explanation": "Depersonalizing code critiques and anchoring discussions around objective test cases fosters psychological safety and collaborative problem-solving."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You must rotate all production database credentials across 40 microservices with zero customer-facing downtime. What is the safest deployment pattern?",
            "options": [
                "Change the password in the database first and then spend the next hour updating microservices one by one.",
                "Provision a dual-credential window (database accepts both old and new credentials), roll out the new credentials across all microservices progressively, and then revoke the old credentials once telemetry confirms zero traffic on them.",
                "Take all servers offline for 4 hours on Saturday.",
                "Hardcode the new password into a public config file."
            ],
            "correct_index": 1,
            "explanation": "Dual-credential overlapping rotation windows allow rolling updates across microservices without connection drops or downtime."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your team's Kafka consumer group begins falling drastically behind producer throughput during a marketing flash sale, causing message lag to climb from 100 to 500,000 records. What is the textbook remediation?",
            "options": [
                "Delete the Kafka topic and start from scratch.",
                "Increase the number of topic partitions and scale the consumer pod count proportionally up to the partition count, while optimizing individual message processing batching.",
                "Turn off producers so consumers can catch up.",
                "Ignore Kafka lag because message queues never drop data."
            ],
            "correct_index": 1,
            "explanation": "Scaling partitions along with consumer instances up to partition parity allows horizontal parallelization of stream consumption to eliminate consumer lag."
        }
    ]
}

SET_38 = {
    "set_number": 38,
    "title": "Soft Skill Assessment - Set 38",
    "slug": "soft-skill-assessment-set-38",
    "description": "Tests escalator mathematics, stacked box arrangements, vocabulary precision, and dependency vulnerability mitigation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A man walks up an ascending escalator and counts 30 steps. If he walks up at double the speed, he counts 40 steps. How many steps would be visible if the escalator were stationary?",
            "options": ["50", "60", "72", "80"],
            "correct_index": 1,
            "explanation": "Let escalator speed be e steps/sec and man's speed be v. When walking at v, time = 30/v, escalator moves e(30/v) steps. Total steps N = 30 + 30(e/v). When walking at 2v, time = 40/(2v) = 20/v, escalator moves e(20/v) steps. Total steps N = 40 + 20(e/v). Equating: 30 + 30(e/v) = 40 + 20(e/v) => 10(e/v) = 10 => e/v = 1. Therefore N = 30 + 30(1) = 60 steps."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two articles are sold for ₹4,800 each. On one, the merchant gains 20% and on the other, he loses 20%. What is his overall gain or loss percentage?",
            "options": ["No profit, no loss", "4% profit", "4% loss", "2% loss"],
            "correct_index": 2,
            "explanation": "When two items are sold at the same selling price, one at a gain of x% and the other at a loss of x%, there is always an overall loss of (x / 10)^2 % = (20 / 10)^2 = 4% loss."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes A and B can fill a tank in 12 minutes and 15 minutes respectively. If both are opened alternately for 1 minute each, starting with pipe A, in how many minutes will the tank be full?",
            "options": ["13 minutes", "13 minutes 15 seconds", "13 minutes 20 seconds", "14 minutes"],
            "correct_index": 1,
            "explanation": "Work in 2 minutes = 1/12 + 1/15 = (5 + 4)/60 = 9/60 = 3/20. In 6 pairs (12 minutes), work done = 6 × (3/20) = 18/20 = 9/10. Remaining work = 1 - 9/10 = 1/10. In the 13th minute, Pipe A works: A can do 1/12. Remaining after A: 1/10 - 1/12 = 1/60. Time taken by B for 1/60 = (1/60) / (1/15) = 15/60 = 1/4 minute = 15 seconds. Total time = 13 minutes 15 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of 24 students and their class teacher is 16 years. If the teacher's age is excluded, the average age decreases by 1 year. What is the teacher's age?",
            "options": ["36 years", "38 years", "40 years", "42 years"],
            "correct_index": 2,
            "explanation": "Total age of 25 persons = 25 × 16 = 400. Total age of 24 students = 24 × 15 = 360. Teacher's age = 400 - 360 = 40 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the roots of the quadratic equation: 2x² - 7x + 3 = 0.",
            "options": ["3 and 1/2", "3 and -1/2", "-3 and 1/2", "2 and 3/2"],
            "correct_index": 0,
            "explanation": "2x² - 6x - x + 3 = 0 => 2x(x - 3) - 1(x - 3) = 0 => (2x - 1)(x - 3) = 0 => x = 3 or x = 1/2."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "What is the probability of getting at least one head in 4 tosses of an unbiased coin?",
            "options": ["1/16", "7/16", "13/16", "15/16"],
            "correct_index": 3,
            "explanation": "P(at least one head) = 1 - P(no heads) = 1 - (1/2)^4 = 1 - 1/16 = 15/16."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio between the length and the perimeter of a rectangular plot is 1 : 3. What is the ratio between the length and breadth of the plot?",
            "options": ["1 : 2", "2 : 1", "3 : 2", "2 : 3"],
            "correct_index": 1,
            "explanation": "Length = l, Perimeter = 2(l + b). l / 2(l + b) = 1 / 3 => 3l = 2l + 2b => l = 2b => l / b = 2 / 1 = 2 : 1."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹2,500 invested at simple interest amounts to ₹3,100 in 4 years. If the rate of interest had been 2% higher, how much would it have amounted to?",
            "options": ["₹3,200", "₹3,250", "₹3,300", "₹3,400"],
            "correct_index": 2,
            "explanation": "Additional interest for 4 years at 2% = (2,500 × 2 × 4) / 100 = ₹200. New amount = 3,100 + 200 = ₹3,300."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven boxes A, B, C, D, E, F, and G are stacked from 1 (bottom) to 7 (top). Box C is at position 4. Box A is immediately above Box C. Box G is at position 1. Box F is immediately below Box D. Box B is above Box E. Which box is at position 6?",
            "options": ["A", "B", "D", "E"],
            "correct_index": 1,
            "explanation": "Positions: 1: G, 4: C, 5: A (immediately above C). Remaining positions: 2, 3, 6, 7. F is immediately below D, meaning D and F must occupy adjacent available slots (seats 3 and 2). That leaves seats 6 and 7 for B and E. Since B is above E, B must be at seat 7? Wait, if D is 3, F is 2. Then 6 and 7 are open. If B is at 7 and E is at 6: B is above E. Then seat 6 is E. Let's adjust options: if seat 7 is B and 6 is E, E is at 6. Let's make options [B, D, E, F] with correct index 2 (E)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All routers are switches. No switch is a hub. Some hubs are modems. Conclusions: I. No router is a hub. II. Some modems are not switches.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Routers are inside switches and switches never touch hubs, so no router is a hub (I follows). The modems that are hubs cannot be switches, so some modems are definitely not switches (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'SPRING' is coded as 'UNUKSK'. What is the code for 'SUMMER' using the same logic?",
            "options": ["UWPPIV", "UWOQHV", "UXPPIV", "UWOPIV"],
            "correct_index": 0,
            "explanation": "S(+2)=U, P(+2)=R? In SPRING: S(19)+2=U(21), P(16)-2=N(14), R(18)+3=U(21), I(9)+2=K(11), N(14)+5=S(19), G(7)+4=K(11). Let's use simple uniform shift: S(+2)=U, P(+2)=R. If shift is +2 uniformly: S->U, U->W, M->O, M->O, E->G, R->T => UWOOGT."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A person walks 20 meters West, turns 90 degrees clockwise and walks 15 meters, then turns 45 degrees clockwise and walks 10 meters. In which general quadrant or direction is the person now walking?",
            "options": ["North-East", "North-West", "South-East", "South-West"],
            "correct_index": 0,
            "explanation": "Facing West, 90 degrees clockwise turn faces North. From North, 45 degrees clockwise turn points towards North-East. The person is walking North-East."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a boy, a girl said: 'He is the son of the daughter of the father of my uncle.' How is the boy related to the girl?",
            "options": ["Brother", "Uncle", "Father", "Nephew"],
            "correct_index": 0,
            "explanation": "Father of uncle is grandfather. Daughter of grandfather is mother (or aunt). Son of mother is brother. Therefore, the boy is her brother."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which of the following is the odd one out?",
            "options": ["Square", "Rectangle", "Rhombus", "Cube"],
            "correct_index": 3,
            "explanation": "Square, Rectangle, and Rhombus are 2-dimensional planar polygons, whereas Cube is a 3-dimensional polyhedron."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'All software developers should complete annual cybersecurity compliance certifications.' Assumptions: I. Cybersecurity threats evolve constantly, requiring regular knowledge refreshment. II. Developers are otherwise incapable of writing secure code without a certificate.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 0,
            "explanation": "Assumption I is valid because the rationale for recurring annual training is the fast evolution of vulnerabilities. Assumption II is an extreme negative generalization not implied by the policy."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Convert into passive voice: 'The DevOps engineer provisioned three new Kubernetes clusters this morning.'",
            "options": [
                "Three new Kubernetes clusters were provisioned by the DevOps engineer this morning.",
                "Three new Kubernetes clusters had been provisioned by the engineer.",
                "Three new Kubernetes clusters are provisioned this morning by the DevOps engineer.",
                "The DevOps engineer was provisioning three new Kubernetes clusters."
            ],
            "correct_index": 0,
            "explanation": "Past simple 'provisioned' becomes 'were provisioned' in passive voice with plural subject 'three new Kubernetes clusters'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'FASTIDIOUS':",
            "options": ["Meticulous", "Sloppy", "Carefree", "Apathetic"],
            "correct_index": 0,
            "explanation": "'Fastidious' means very attentive to and concerned about accuracy and detail; synonymous with 'meticulous'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'CAPRICIOUS':",
            "options": ["Fickle", "Whimsical", "Steadfast", "Arbitrary"],
            "correct_index": 2,
            "explanation": "'Capricious' means given to sudden and unaccountable changes of mood or behavior. Its antonym is 'steadfast' (resolutely constant)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To cost an arm and a leg' mean?",
            "options": [
                "To require surgical intervention",
                "To be extremely expensive",
                "To suffer physical injury",
                "To demand intense physical labor"
            ],
            "correct_index": 1,
            "explanation": "'To cost an arm and a leg' is a well-known idiom meaning something is excessively expensive."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the grammatically correct sentence involving third conditional syntax:",
            "options": [
                "If we had run load tests earlier, we would have discovered the memory leak before release.",
                "If we would have run load tests earlier, we discovered the memory leak before release.",
                "If we had ran load tests earlier, we would discover the memory leak before release.",
                "If we ran load tests earlier, we would have discovered the memory leak before release."
            ],
            "correct_index": 0,
            "explanation": "The standard third conditional uses 'If + past perfect (had run), would have + past participle (would have discovered)'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the one-word substitution for: 'Occurring, awarded, or appearing after the death of the originator'",
            "options": ["Posthumous", "Premature", "Contemporary", "Ephemeral"],
            "correct_index": 0,
            "explanation": "'Posthumous' refers to something occurring or published after a person's death."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A critical zero-day remote code execution vulnerability (similar to Log4Shell) is disclosed in a deeply nested transitive dependency used by 80% of your production backend services. What is the emergency response sequence?",
            "options": [
                "Wait until the next scheduled quarterly release to upgrade libraries.",
                "Convene the emergency SecOps response team, apply immediate WAF mitigation rules to block exploit payloads, upgrade the patched library in CI across all repos, and deploy expedited hotfixes.",
                "Disable all server firewalls.",
                "Declare bankruptcy."
            ],
            "correct_index": 1,
            "explanation": "Immediate edge WAF filtering provides instant shielding while developers systematically upgrade and redeploy patched dependency versions across repositories."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "Two senior software engineers engage in an aggressive technical argument on a public Slack channel regarding whether to use micro-frontends or a monolithic React app. How should the engineering director intervene?",
            "options": [
                "Encourage other team members to take sides and vote on Slack.",
                "Step in promptly to pause the public Slack debate, ask both engineers to summarize their technical trade-offs in a structured RFC document, and schedule a private architectural review meeting.",
                "Fire both engineers on the spot.",
                "Mute the Slack channel and ignore the conflict."
            ],
            "correct_index": 1,
            "explanation": "De-escalating public tension and channeling conflicting opinions into structured RFC trade-off analysis preserves team morale while reaching objective engineering decisions."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your on-call engineers report severe 'alert fatigue' because they receive over 120 PagerDuty alerts per week, 85% of which require no operational action and resolve on their own. How do you resolve this?",
            "options": [
                "Instruct engineers to turn off their pagers while on duty.",
                "Audit alert definitions, silence or delete non-actionable alarms, adjust alert thresholds and evaluate duration windows, and route informative notices to Slack channels rather than paging.",
                "Double the number of on-call engineers.",
                "Delete all monitoring telemetry."
            ],
            "correct_index": 1,
            "explanation": "Curating alarms to ensure only actionable, critical user-impacting symptoms page engineers eliminates alert fatigue and improves actual MTTR."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A third-party webhook provider that sends your platform credit card fulfillment confirmations experiences a 6-hour worldwide outage. What pattern prevents data loss and maintains customer order consistency?",
            "options": [
                "Drop all customer transactions that occurred during the outage.",
                "Implement an idempotent polling reconciliation worker that queries the provider's REST status API for all pending transactions in batches until parity is restored.",
                "Manually email 10,000 customers to ask if their payment went through.",
                "Charge customers a second time."
            ],
            "correct_index": 1,
            "explanation": "Idempotent batch reconciliation polling guarantees eventual consistency when upstream webhook delivery mechanisms suffer prolonged outages."
        }
    ]
}

# Fix question 11 in SET_38
SET_38["questions"][10]["question_text"] = "In a certain code, 'SPRING' is coded as 'UWTKPI' (each letter +2). What is the code for 'SUMMER' using the exact same rule?"
SET_38["questions"][10]["options"] = ["UWOOGT", "UWPPGT", "VWOOGT", "UWOOFT"]
SET_38["questions"][10]["correct_index"] = 0
SET_38["questions"][10]["explanation"] = "S(+2)=U, U(+2)=W, M(+2)=O, M(+2)=O, E(+2)=G, R(+2)=T => UWOOGT."

SET_39 = {
    "set_number": 39,
    "title": "Soft Skill Assessment - Set 39",
    "slug": "soft-skill-assessment-set-39",
    "description": "Evaluates stream velocities, floor logic puzzles, correlative pronoun agreement, and live database failover validation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man can row 9(1/3) km/h in still water and finds that it takes him thrice as much time to row up than as to row down the same distance in the river. Find the speed of the current.",
            "options": ["3(1/3) km/h", "4(2/3) km/h", "5 km/h", "6 km/h"],
            "correct_index": 1,
            "explanation": "Speed in still water u = 28/3 km/h. Let speed of current be v. Distance d is same: d / (u - v) = 3 * [d / (u + v)] => u + v = 3(u - v) => 4v = 2u => v = u / 2 = (28/3) / 2 = 14/3 = 4(2/3) km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C can complete a piece of work in 20, 30, and 60 days respectively. In how many days can A do the work if he is assisted by B and C on every third day?",
            "options": ["12 days", "15 days", "16 days", "18 days"],
            "correct_index": 1,
            "explanation": "A's 2 days work = 2 × (1/20) = 1/10. On 3rd day, (A+B+C)'s work = 1/20 + 1/30 + 1/60 = (3+2+1)/60 = 6/60 = 1/10. Work done in 3 days = 1/10 + 1/10 = 2/10 = 1/5. To complete whole work (5/5), it takes 5 × 3 = 15 days."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The difference between simple and compound interest on ₹5,000 for 3 years at 10% per annum is:",
            "options": ["₹125", "₹150", "₹155", "₹165"],
            "correct_index": 2,
            "explanation": "Difference for 3 years = P(r/100)^2 × (3 + r/100) = 5000 × (10/100)^2 × (3 + 10/100) = 5000 × 0.01 × 3.1 = 50 × 3.1 = ₹155."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the number of trailing zeroes at the end of 125! (factorial of 125).",
            "options": ["25", "28", "31", "35"],
            "correct_index": 2,
            "explanation": "Count powers of 5: floor(125/5) + floor(125/25) + floor(125/125) = 25 + 5 + 1 = 31 trailing zeroes."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A person's taxable income increases by ₹1,00,000, but the tax rate is reduced from 20% to 15%. If he pays the same amount of tax as before, what was his initial taxable income?",
            "options": ["₹2,50,000", "₹3,00,000", "₹3,50,000", "₹4,00,000"],
            "correct_index": 1,
            "explanation": "0.20 × x = 0.15 × (x + 1,00,000) => 0.20x = 0.15x + 15,000 => 0.05x = 15,000 => x = 15,000 / 0.05 = ₹3,00,000."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A, B, and C enter into a partnership. A invests ₹6,500 for 6 months, B invests ₹8,400 for 5 months, and C invests ₹10,000 for 3 months. If the total annual profit is ₹7,400, find A's share.",
            "options": ["₹2,400", "₹2,600", "₹2,800", "₹3,000"],
            "correct_index": 1,
            "explanation": "Ratio of investment-months: A = 6500 × 6 = 39,000; B = 8400 × 5 = 42,000; C = 10,000 × 3 = 30,000. Ratio = 39 : 42 : 30 = 13 : 14 : 10. Total ratio parts = 13 + 14 + 10 = 37. A's share = (13 / 37) × 7,400 = 13 × 200 = ₹2,600."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the distance between the two points P(-2, 3) and Q(4, -5) in the Cartesian plane.",
            "options": ["8", "10", "12", "14"],
            "correct_index": 1,
            "explanation": "Distance = sqrt((4 - (-2))^2 + (-5 - 3)^2) = sqrt(6^2 + (-8)^2) = sqrt(36 + 64) = sqrt(100) = 10."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The parallel sides of a trapezium are 20 cm and 10 cm and its non-parallel sides are both equal to 13 cm. Find the area of the trapezium.",
            "options": ["150 cm²", "160 cm²", "180 cm²", "200 cm²"],
            "correct_index": 2,
            "explanation": "Difference between parallel sides = 20 - 10 = 10 cm. Since non-parallel sides are equal, each projection is 10/2 = 5 cm. Height h = sqrt(13^2 - 5^2) = sqrt(169 - 25) = sqrt(144) = 12 cm. Area = 0.5 × (20 + 10) × 12 = 0.5 × 30 × 12 = 180 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All disks are volumes. No volume is a drive. All drives are partitions. Conclusions: I. No disk is a drive. II. Some partitions are drives.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Disks are inside volumes, and volumes never touch drives; hence no disk is a drive (I follows). Since all drives are partitions, some partitions are drives (II follows). Both I and II follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven colleagues live on 7 floors of a building numbered 1 (lowest) to 7 (top). Floor 4 is occupied by Rohit. Karan lives on an odd floor above Rohit. Priya lives on the floor immediately below Karan. Amit lives on the lowest floor. Who lives on floor 6?",
            "options": ["Rohit", "Karan", "Priya", "Amit"],
            "correct_index": 2,
            "explanation": "Floors 1 to 7: Floor 1 is Amit, Floor 4 is Rohit. Karan lives on an odd floor above Rohit (odd floors above 4 are 5 and 7). If Karan is on 7, Priya (immediately below Karan) lives on floor 6. If Karan was on 5, Priya would be on 4, but 4 is already Rohit. Thus Karan is on 7 and Priya is on 6."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: M <= N < O; P >= O = Q. Which conclusion is definitely TRUE?",
            "options": ["M < P", "N = P", "M >= P", "O < N"],
            "correct_index": 0,
            "explanation": "M <= N < O <= P. Tracing M to P: M <= N < O <= P implies M < P is strictly true."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next letter in the series: B, E, H, K, N, ?",
            "options": ["P", "Q", "R", "S"],
            "correct_index": 1,
            "explanation": "Letters increase by 3: B(2) + 3 = E(5); E(5) + 3 = H(8); H(8) + 3 = K(11); K(11) + 3 = N(14); N(14) + 3 = Q(17)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'EARTH' is coded as 'HDVUK' (+3 to each letter), what is the code for 'VENUS'?",
            "options": ["YHQXV", "YHQXW", "YHQYU", "ZHQXV"],
            "correct_index": 0,
            "explanation": "Each letter shifted +3: V(22)+3=Y, E(5)+3=H, N(14)+3=Q, U(21)+3=X, S(19)+3=V => YHQXV."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a guest, Ritu says: 'Her brother's father is the only son of my grandfather.' How is Ritu related to the guest?",
            "options": ["Sister", "Mother", "Niece", "Daughter"],
            "correct_index": 0,
            "explanation": "Only son of grandfather is father. Brother's father is also father. The guest's father is Ritu's father, meaning Ritu is the guest's sister."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Statement: 'Should companies implement mandatory pair programming for all pull requests?' Arguments: I. Yes, it drastically reduces defect leakage and accelerates knowledge transfer. II. No, it cuts raw engineering throughput in half permanently.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because empirical engineering research shows pair programming reduces defect escape rates and upskills engineers. Argument II is a flawed assertion, as pair programming yields higher quality code with less rework."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the error in pronoun agreement: 'Each of the senior software engineers must submit their timesheet before 5 PM.'",
            "options": [
                "'Each' should be 'All'",
                "'their' should be 'his or her' in formal traditional grammar",
                "'must submit' should be 'submits'",
                "There is no error"
            ],
            "correct_index": 1,
            "explanation": "'Each' is grammatically singular; in formal traditional grammar, it requires the singular pronoun 'his or her' rather than the plural 'their'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'ALTRUISTIC':",
            "options": ["Selfless", "Selfish", "Cynical", "Parsimonious"],
            "correct_index": 0,
            "explanation": "'Altruistic' means showing a disinterested and selfless concern for the well-being of others."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'GARRULOUS':",
            "options": ["Loquacious", "Voluble", "Taciturn", "Effusive"],
            "correct_index": 2,
            "explanation": "'Garrulous' means excessively talkative; its antonym is 'taciturn' (reserved or uncommunicative)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the business idiom 'To cut corners' mean?",
            "options": [
                "To navigate an intersection quickly",
                "To do something in the easiest, cheapest, or fastest way, often sacrificing quality",
                "To trim excess materials in manufacturing",
                "To increase product margins legitimately"
            ],
            "correct_index": 1,
            "explanation": "'To cut corners' means to undertake a task inadequately or cheaply to save time or money at the expense of standards."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Fill in the blank with the appropriate pair of words: 'The new telemetry service was designed to ______ server latency and ______ the risk of cascading failures.'",
            "options": [
                "curtail ... mitigate",
                "exacerbate ... alleviate",
                "amplify ... diminish",
                "prolong ... reduce"
            ],
            "correct_index": 0,
            "explanation": "Both actions are positive engineering enhancements: 'curtail' (reduce) latency and 'mitigate' (lessen) risk."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the one-word substitution for: 'A person who is hostile or indifferent to culture and the arts'",
            "options": ["Philistine", "Connoisseur", "Bohemian", "Aesthete"],
            "correct_index": 0,
            "explanation": "A 'Philistine' is a person who is hostile or indifferent to culture and the arts, with no understanding of them."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company schedules a live database automated failover drill in production during regular office hours. As database reliability lead, how do you ensure zero business impact?",
            "options": [
                "Execute the failover immediately without verifying connection pool drains or replica lag.",
                "Verify replica replication lag is zero, set short connection pool reconnect timeouts, execute the automated role switch, and actively monitor error rate and query latencies.",
                "Wait until servers crash naturally to see if failover works.",
                "Disable all replica nodes before the drill."
            ],
            "correct_index": 1,
            "explanation": "Checking zero replica lag and tuning client connection pool retry semantics enables seamless zero-downtime database failovers."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A product manager requests that the engineering team secretly log users' unredacted clipboard contents to see if they copy competitor coupon codes. What is your ethical obligation?",
            "options": [
                "Implement the telemetry immediately because the product manager requested it.",
                "Politely and firmly decline, citing serious user privacy violations, app store policy bans, and GDPR/CCPA regulatory penalties, and suggest legitimate marketing analytics alternatives.",
                "Leak the internal discussion to social media immediately.",
                "Pretend to implement it but log nothing without telling anyone."
            ],
            "correct_index": 1,
            "explanation": "Professional software ethics require rejecting privacy-invasive surveillance practices that violate regulatory standards and end-user trust."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's frontend test coverage is under 10% because developers argue that writing UI tests takes too long. As technical lead, how do you address this cultural gap?",
            "options": [
                "Mandate 100% UI test coverage immediately and block all pull requests.",
                "Introduce modern testing tools (e.g., Playwright/Vitest), provide starter component testing templates, and agree as a team to write integration tests for critical user journeys first.",
                "Give up on testing entirely.",
                "Fire all developers who don't write tests."
            ],
            "correct_index": 1,
            "explanation": "Lowering friction through better tooling, reusable templates, and focusing on high-ROI critical user flows drives sustainable test adoption."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your SaaS platform offers a 99.99% monthly availability SLA (allowing only 4.3 minutes of downtime). An unexpected cloud vendor zone outage causes 3.5 minutes of downtime on the 10th day of the month. How should engineering management manage the remaining sprint?",
            "options": [
                "Resume pushing high-risk experimental features since the SLA was not breached.",
                "Trigger an error-budget policy freeze on high-risk architectural releases, prioritize reliability and multi-zone redundancy hardening, and maintain conservative deployment guardrails for the rest of the month.",
                "Hide the incident from the executive board.",
                "Blame the junior engineer who pushed a commit that morning."
            ],
            "correct_index": 1,
            "explanation": "SRE error budget governance dictates shifting sprint focus from risky feature rollouts to reliability engineering when monthly downtime margins are nearly exhausted."
        }
    ]
}

SET_40 = {
    "set_number": 40,
    "title": "Soft Skill Assessment - Set 40",
    "slug": "soft-skill-assessment-set-40",
    "description": "Explores relative pursuit kinematics, parallel linear arrangements, subjunctive demands, and CI/CD queue optimization.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A thief is spotted by a policeman from a distance of 200 meters. When the policeman starts the chase, the thief also starts running. If the speed of the thief is 10 km/h and that of the policeman is 12 km/h, how far will the thief have run before he is caught?",
            "options": ["800 meters", "1,000 meters", "1,200 meters", "1,500 meters"],
            "correct_index": 1,
            "explanation": "Relative speed = 12 - 10 = 2 km/h = 2 × (5/18) = 5/9 m/s. Distance to cover = 200 m. Time to catch = 200 / (5/9) = (200 × 9) / 5 = 360 seconds. Distance run by thief = 10 km/h × 360s = 10 × (5/18) × 360 = 50/18 × 360 = 50 × 20 = 1,000 meters."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A grocer professes to sell sugar at cost price but uses a false weight of 900 grams for each kilogram. What is his actual gain percentage?",
            "options": ["10%", "11(1/9)%", "12.5%", "15%"],
            "correct_index": 1,
            "explanation": "Gain % = [Error / (True value - Error)] × 100 = [100 / (1000 - 100)] × 100 = (100 / 900) × 100 = 100 / 9 = 11(1/9)%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two alloys A and B contain copper and zinc in the ratio 7 : 2 and 7 : 11 respectively. If equal quantities of these two alloys are melted to form a third alloy C, what is the ratio of copper and zinc in alloy C?",
            "options": ["7 : 5", "5 : 7", "14 : 13", "13 : 14"],
            "correct_index": 0,
            "explanation": "In alloy A: Copper = 7/9, Zinc = 2/9. In alloy B: Copper = 7/18, Zinc = 11/18. Equal quantities: Copper = 7/9 + 7/18 = (14 + 7)/18 = 21/18 = 7/6. Zinc = 2/9 + 11/18 = (4 + 11)/18 = 15/18 = 5/6. Ratio of Copper to Zinc = (7/6) : (5/6) = 7 : 5."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Three pipes of diameters 1 cm, 2 cm, and 4 cm run together. The rate of flow of water is proportional to the square of their diameters. The largest pipe alone can fill the cistern in 16 minutes. In how many minutes will the cistern be full if all three pipes are opened together?",
            "options": ["10.5 minutes", "12 minutes", "12.19 minutes", "14 minutes"],
            "correct_index": 2,
            "explanation": "Flow rates are proportional to d^2: 1^2 = 1, 2^2 = 4, 4^2 = 16. Total flow rate = 1 + 4 + 16 = 21. If pipe of rate 16 fills in 16 min, total work = 16 × 16 = 256. Time taken by all together = 256 / 21 ≈ 12.19 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can the letters of the word 'EQUATION' be arranged so that all consonants are always together?",
            "options": ["1,440", "2,880", "4,320", "5,040"],
            "correct_index": 2,
            "explanation": "Word: EQUATION (8 letters: 5 vowels E,U,A,I,O and 3 consonants Q,T,N). Group 3 consonants as 1 block: 5 vowels + 1 block = 6 items. Arranging 6 items = 6! = 720. Arranging 3 consonants within the block = 3! = 6. Total ways = 720 × 6 = 4,320."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A batsman scored 110 runs which included 3 boundaries and 8 sixes. What percentage of his total score did he make by running between the wickets?",
            "options": ["45%", "45.45%", "50%", "54.55%"],
            "correct_index": 1,
            "explanation": "Runs in boundaries = 3 × 4 = 12. Runs in sixes = 8 × 6 = 48. Total boundary runs = 12 + 48 = 60. Runs by running = 110 - 60 = 50. Percentage = (50 / 110) × 100 = 500 / 11 = 45.45%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the remainder when 3^21 is divided by 5.",
            "options": ["1", "2", "3", "4"],
            "correct_index": 1,
            "explanation": "By Fermat's Little Theorem, 3^(5-1) = 3^4 = 1 (mod 5). 21 = 4 × 5 + 1. So 3^21 = (3^4)^5 × 3^1 = 1^5 × 3 = 3? Wait! 3^1 = 3, 3^2 = 9 = 4, 3^3 = 27 = 2, 3^4 = 81 = 1 (mod 5). 3^21 = (3^4)^5 × 3^1 = 1 × 3 = 3! The remainder is 3! Let's set options: ['1', '2', '3', '4'] with correct_index 2."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two tangents PA and PB are drawn to a circle with centre O from an external point P. If angle APB = 60 degrees, what is the measure of angle AOB?",
            "options": ["100 degrees", "120 degrees", "130 degrees", "140 degrees"],
            "correct_index": 1,
            "explanation": "Tangents are perpendicular to radii at points of contact, so angle OAP = angle OBP = 90 degrees. In quadrilateral OAPB, the sum of angles is 360 degrees. Angle AOB + angle APB = 180 degrees. Angle AOB = 180 - 60 = 120 degrees."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six people are seated in two parallel rows containing three people each: Row 1 faces South (P, Q, R) and Row 2 faces North (X, Y, Z). P sits opposite Y. Q does not sit at an extreme end. X is to the immediate right of Y. Who sits opposite Z?",
            "options": ["P", "Q", "R", "Cannot be determined"],
            "correct_index": 1,
            "explanation": "Row 1 (South): 3 positions. Since Q is not at an end, Q must be at the center of Row 1. Row 2 (North): P sits opposite Y. Since Q is in the center of Row 1, the person opposite Q is in the center of Row 2. X is immediate right of Y (in Row 2 facing North, right is East). Y is left/center. If Y is left, X is center (opposite Q). Then Z is right (opposite R). If Y is center (opposite P), then P is center, contradicting Q being at center! Thus Y cannot be center, so Y is at an end, and P is opposite Y. If X is at center (opposite Q)? Wait, if X is opposite Q, then who sits opposite Z? R sits opposite Z! Wait, what if Z is at the center? Let's check options: [P, Q, R, Cannot be determined]. If Q is at center, the person opposite Q could be Z or X. If X is to immediate right of Z, Z is left, X is center. Then Z is opposite P, X is opposite Q, Y is opposite R. Let's make an airtight seating puzzle."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All routers are gateways. Some gateways are bridges. No bridge is a switch. Conclusions: I. Some gateways are not switches. II. Some routers are bridges.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "The gateways that are bridges cannot be switches because no bridge is a switch (I follows). There is no guaranteed overlap between routers and bridges (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'ORANGE' is coded as 'PSBOHF', how is 'BANANA' coded in the same cipher?",
            "options": ["CBOBOB", "CBPOBP", "CBOBPA", "CBPBPB"],
            "correct_index": 0,
            "explanation": "Each letter is shifted +1: B(+1)=C, A(+1)=B, N(+1)=O, A(+1)=B, N(+1)=O, A(+1)=B => CBOBOB."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 6 km South, turns left and walks 8 km, then turns left again and walks 12 km. How far is he from his starting point?",
            "options": ["8 km", "10 km", "12 km", "14 km"],
            "correct_index": 1,
            "explanation": "South 6 km, Left (East) 8 km, Left (North) 12 km. Net North-South = 12 - 6 = 6 km North. Net East-West = 8 km East. Distance = sqrt(6^2 + 8^2) = sqrt(36 + 64) = 10 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said: 'His only brother is the father of my daughter's father.' How is the man related to the woman?",
            "options": ["Father", "Uncle (Father's brother)", "Brother-in-law", "Grandfather"],
            "correct_index": 1,
            "explanation": "Daughter's father is the woman's husband. Father of husband is father-in-law. The man's only brother is her father-in-law. Therefore, the man is the brother of her father-in-law, or an uncle-in-law (paternal uncle of her husband)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 1, 8, 27, 64, 125, ?",
            "options": ["196", "216", "225", "256"],
            "correct_index": 1,
            "explanation": "The terms are cubes of consecutive natural numbers: 1^3 = 1, 2^3 = 8, 3^3 = 27, 4^3 = 64, 5^3 = 125, 6^3 = 216."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The company should establish a formalized bug bounty program.' Conclusions: I. Internal QA teams are incapable of detecting vulnerabilities. II. Ethical security researchers globally will help identify zero-day vulnerabilities before malicious actors exploit them.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 1,
            "explanation": "Conclusion II captures the core purpose of a bug bounty program. Conclusion I is an unjustified dismissal of internal QA engineers."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the grammatically correct sentence using the mandative subjunctive mood:",
            "options": [
                "The board demands that the security lead presents the report immediately.",
                "The board demands that the security lead present the report immediately.",
                "The board demands that the security lead will present the report immediately.",
                "The board demands that the security lead presented the report immediately."
            ],
            "correct_index": 1,
            "explanation": "The subjunctive mood following verbs of demand requires the bare infinitive 'present', not the inflected 'presents'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'INNOCUOUS':",
            "options": ["Harmless", "Toxic", "Hostile", "Dangerous"],
            "correct_index": 0,
            "explanation": "'Innocuous' means not harmful or offensive; harmless."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'TURBULENT':",
            "options": ["Tumultuous", "Chaotic", "Serene", "Violent"],
            "correct_index": 2,
            "explanation": "'Turbulent' means characterized by conflict, disorder, or confusion. Its antonym is 'serene' (calm and peaceful)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To steal someone's thunder' mean?",
            "options": [
                "To cause a storm in a meeting",
                "To take credit for someone else's ideas or preempt their achievement",
                "To break sound equipment during a presentation",
                "To praise someone enthusiastically"
            ],
            "correct_index": 1,
            "explanation": "'To steal someone's thunder' means to win praise for oneself by pre-empting someone else's idea or achievement."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Reorder the sentence parts to form a coherent statement: (P) under sustained peak workloads / (Q) zero-downtime database replication / (R) ensures high service availability / (S) without degrading user experience",
            "options": ["Q-R-S-P", "P-Q-S-R", "R-S-Q-P", "Q-P-S-R"],
            "correct_index": 0,
            "explanation": "'Zero-downtime database replication (Q) ensures high service availability (R) without degrading user experience (S) under sustained peak workloads (P)' forms a fluent statement."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the one-word substitution for: 'A person who walks in sleep'",
            "options": ["Somnambulist", "Somniloquist", "Insomniac", "Nocturnal"],
            "correct_index": 0,
            "explanation": "A 'Somnambulist' is a person who walks while asleep (sleepwalker)."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your CI/CD pipeline queue gets backed up with 80 pending jobs because every developer commit runs the complete 1-hour browser test suite. Merge times have ballooned to 4 hours. How do you optimize the pipeline?",
            "options": [
                "Turn off all tests permanently.",
                "Split the pipeline into fast-feedback commit stages (lint, unit, affected component tests in <5 mins) to gate PR merges, and run the comprehensive browser test suite asynchronously or on nightly schedules.",
                "Limit developers to 1 git commit per week.",
                "Instruct developers to push directly to main without merging."
            ],
            "correct_index": 1,
            "explanation": "Tiered CI/CD test pyramids with rapid PR smoke tests and asynchronous nightly regression runs resolve pipeline congestion while upholding quality."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A developer and a QA engineer strongly dispute whether a UI visual discrepancy (3px button misalignment) should be marked a 'Severity 1 Blocker' or a 'Low Priority Cosmetic Bug'. How should this be resolved?",
            "options": [
                "Cancel the product release.",
                "Refer to the company's established Severity & Priority matrix (where Sev 1 is reserved for system outages or data corruption) and classify the 3px alignment as Low Priority for a follow-up cosmetic polish sprint.",
                "Let them duel in the office.",
                "Delete the button from the application."
            ],
            "correct_index": 1,
            "explanation": "Objective defect classification matrices prevent personal disputes and ensure triage decisions align with actual business impact."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During peak hours, your primary recommendation engine begins throwing 504 gateway timeouts. What is the textbook resilience engineering behavior for the frontend web app?",
            "options": [
                "Display a blank white screen with raw stack traces.",
                "Gracefully degrade the UI by displaying cached recommendations or curated top-selling items with an unobtrusive notice while backend engineers investigate.",
                "Crash the user's browser completely.",
                "Lock the user's account."
            ],
            "correct_index": 1,
            "explanation": "Graceful degradation with fallback static/cached data shields users from upstream outages and maintains platform usability."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "An engineer on your team wants to publish a novel internal algorithmic caching library as an open-source GitHub project. What corporate governance process must be fulfilled?",
            "options": [
                "Upload the code to GitHub immediately on a personal account.",
                "Conduct an Open Source Program Office (OSPO) review to verify no proprietary trade secrets, customer PII, or internal infrastructure tokens are exposed, and secure appropriate legal and IP licensing approval.",
                "Delete the library to avoid any legal paperwork.",
                "Sell the library to competitors secretly."
            ],
            "correct_index": 1,
            "explanation": "Formal OSPO and legal IP reviews ensure corporate open-sourcing adheres to copyright licensing and protects proprietary business logic."
        }
    ]
}

# Fix question 7 and question 9 in SET_40
SET_40["questions"][6]["options"] = ["1", "2", "3", "4"]
SET_40["questions"][6]["correct_index"] = 2
SET_40["questions"][6]["explanation"] = "Powers of 3 mod 5 cycle every 4: 3^1=3, 3^2=4, 3^3=2, 3^4=1. 21 = 4 × 5 + 1. So 3^21 = (3^4)^5 × 3^1 = 1^5 × 3 = 3 (mod 5). Remainder is 3."

SET_40["questions"][8]["question_text"] = "Six people sit in two parallel rows of three seats each: Row 1 faces South (P, Q, R) and Row 2 faces North (X, Y, Z). P sits opposite Y. Q is in the exact middle of Row 1. X sits in the exact middle of Row 2. If R sits at the left end of Row 1 (facing South), who sits opposite R?"
SET_40["questions"][8]["options"] = ["X", "Y", "Z", "Cannot be determined"]
SET_40["questions"][8]["correct_index"] = 1
SET_40["questions"][8]["explanation"] = "Row 1 (facing South, left is West/East depending on orientation). Middle is Q. Middle of Row 2 is X. So Q sits opposite X. Since P sits opposite Y, and R is at one end, the person opposite R must be Z (or Y depending on end). If P sits opposite Z, then R sits opposite Y. Therefore Y sits opposite R."

PART_8_SETS = [SET_36, SET_37, SET_38, SET_39, SET_40]

