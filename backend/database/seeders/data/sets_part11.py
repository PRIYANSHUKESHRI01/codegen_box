# Sets 51 to 55 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_51 = {
    "set_number": 51,
    "title": "Soft Skill Assessment - Set 51",
    "slug": "soft-skill-assessment-set-51",
    "description": "Measures relative pursuit dynamics, parallel row deductions, collective concord, and distributed database deadlock remediation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 180 meters long running at 72 km/h crosses a man walking in the opposite direction in 6 seconds. What is the speed of the man in km/h?",
            "options": ["18 km/h", "24 km/h", "36 km/h", "40 km/h"],
            "correct_index": 2,
            "explanation": "Relative speed = Distance / Time = 180 / 6 = 30 m/s = 30 × (18/5) = 108 km/h. Since they move in opposite directions, Relative speed = Train speed + Man speed => 108 = 72 + Man speed => Man speed = 108 - 72 = 36 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A, B, and C undertake a project for ₹4,800. A alone can do it in 8 days, B in 12 days, and with the help of C, they finish it in 4 days. How much should C be paid?",
            "options": ["₹600", "₹800", "₹1,000", "₹1,200"],
            "correct_index": 1,
            "explanation": "In 4 days: A does 4/8 = 1/2 of work. B does 4/12 = 1/3 of work. Together A and B do 1/2 + 1/3 = 5/6 of work. C does the remaining 1 - 5/6 = 1/6 of work. C's share = (1/6) × 4800 = ₹800."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A retailer offers three successive discounts of 20%, 10%, and 5% on an item. What is the single equivalent discount percentage?",
            "options": ["31.6%", "32.0%", "33.2%", "35.0%"],
            "correct_index": 0,
            "explanation": "Net multiplier = (1 - 0.20) × (1 - 0.10) × (1 - 0.05) = 0.80 × 0.90 × 0.95 = 0.72 × 0.95 = 0.684. Equivalent discount = 1 - 0.684 = 0.316 = 31.6%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A is twice as fast as B, and B is thrice as fast as C. If C alone can complete a task in 36 days, in how many days can they complete it working together?",
            "options": ["3.6 days", "4 days", "4.5 days", "5 days"],
            "correct_index": 0,
            "explanation": "Let C's 1-day work = 1 unit. Total work = 36 units. B's rate = 3 units/day. A's rate = 2 × 3 = 6 units/day. Combined rate = 6 + 3 + 1 = 10 units/day. Time taken together = 36 / 10 = 3.6 days."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the nature of the roots of the quadratic equation 4x² - 12x + 9 = 0?",
            "options": ["Real, rational, and equal", "Real, irrational, and unequal", "Complex and imaginary", "Real, rational, and unequal"],
            "correct_index": 0,
            "explanation": "Discriminant D = b² - 4ac = (-12)² - 4(4)(9) = 144 - 144 = 0. When D = 0 and coefficients are rational, roots are real, rational, and equal (both roots are 12/8 = 3/2)."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the sum of the squares of the first 10 natural numbers.",
            "options": ["325", "350", "385", "415"],
            "correct_index": 2,
            "explanation": "Sum of squares = [n(n + 1)(2n + 1)] / 6 = [10 × 11 × 21] / 6 = 2310 / 6 = 385."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The diagonals of a rhombus are 16 cm and 12 cm. What is the perimeter of the rhombus?",
            "options": ["36 cm", "40 cm", "48 cm", "52 cm"],
            "correct_index": 1,
            "explanation": "Diagonals of a rhombus bisect each other perpendicularly. Half diagonals are 8 cm and 6 cm. Side s = sqrt(8² + 6²) = sqrt(64 + 36) = sqrt(100) = 10 cm. Perimeter = 4s = 4 × 10 = 40 cm."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two vessels contain milk and water in the ratio 3 : 2 and 7 : 3. In what ratio should the contents of both vessels be mixed to obtain a new mixture containing milk and water in the ratio 2 : 1?",
            "options": ["1 : 2", "2 : 3", "1 : 4", "3 : 4"],
            "correct_index": 0,
            "explanation": "Milk fraction in vessel 1 = 3/5 = 6/10 = 18/30. In vessel 2 = 7/10 = 21/30. Desired = 2/3 = 20/30. Using alligation: (21/30 - 20/30) : (20/30 - 18/30) = 1/30 : 2/30 = 1 : 2."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All gateways are proxies. No proxy is exposed. Some routers are gateways. Conclusions: I. No gateway is exposed. II. Some routers are proxies.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Gateways are inside proxies which never touch exposed, so no gateway is exposed (I follows). Routers overlap gateways which are all proxies, so some routers are definitely proxies (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people—A, B, C, D, E, F, G, and H—are seated in two parallel rows facing each other. Row 1 faces South (A, B, C, D) and Row 2 faces North (E, F, G, H). B is at the extreme right of Row 1 (facing South). G sits directly opposite B. E sits second to the left of G. Who sits opposite E?",
            "options": ["A", "C", "D", "Cannot be determined without additional info"],
            "correct_index": 3,
            "explanation": "In 4-seat rows, positions are 1 to 4. Without knowing whether B's extreme right is seat 1 or 4 relative to Row 2's indexing, or the positions of A, C, D in Row 1, the occupant opposite E cannot be determined uniquely."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'LAMBDA' is coded as 'MBNCEA' (+1 to each letter except the last letter which remains unchanged), how is 'DOCKER' coded if all letters are shifted +1?",
            "options": ["EPDLSF", "EPDLFS", "EQDLFS", "EPDMFS"],
            "correct_index": 1,
            "explanation": "D(+1)=E, O(+1)=P, C(+1)=D, K(+1)=L, E(+1)=F, R(+1)=S => EPDLFS."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A developer walks 25 meters North, turns left and walks 15 meters, turns left again and walks 25 meters. How far and in what direction is the developer from the starting workstation?",
            "options": ["15 meters West", "15 meters East", "25 meters West", "10 meters North"],
            "correct_index": 0,
            "explanation": "North 25m, Left (West) 15m, Left (South) 25m. Vertical movements cancel (+25 - 25 = 0). The developer is 15 meters West of the start."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a coded relation: 'A + B' means A is the brother of B; 'A - B' means A is the sister of B; 'A * B' means A is the father of B. Which of the following shows that 'M is the aunt of N'?",
            "options": ["M - P * N", "M + P * N", "P * M - N", "N - P * M"],
            "correct_index": 0,
            "explanation": "M - P means M is the sister of P. P * N means P is the father of N. Since M is the sister of N's father, M is N's paternal aunt."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 6, 11, 21, 36, 56, ?",
            "options": ["76", "81", "86", "91"],
            "correct_index": 1,
            "explanation": "Differences are consecutive multiples of 5: +5, +10, +15, +20, +25. 56 + 25 = 81."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'A critical PostgreSQL production cluster experiences multiple transaction deadlocks every morning during batch payroll processing.' Course of Action: I. Restructure batch queries to lock tables in a deterministic order across all worker processes. II. Disable ACID transactions completely during payroll processing.",
            "options": [
                "Only course of action I follows",
                "Only course of action II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Acquiring locks in a consistent, deterministic order prevents cyclic wait conditions that cause deadlocks (I follows). Disabling ACID transactions compromises financial accounting integrity and causes data corruption (II does not follow)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the correct verb form for collective noun agreement: 'The architectural review committee ______ unanimous in its approval of the zero-trust roadmap.'",
            "options": ["was", "were", "are", "have been"],
            "correct_index": 0,
            "explanation": "When a collective noun acts as a unified single body (indicated by 'its approval'), it takes a singular verb ('was')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'TRANSIENT':",
            "options": ["Fleeting", "Perpetual", "Enduring", "Invariable"],
            "correct_index": 0,
            "explanation": "'Transient' means lasting only for a short time; impermanent or fleeting."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'PAUCITY':",
            "options": ["Abundance", "Scarcity", "Dearth", "Shortage"],
            "correct_index": 0,
            "explanation": "'Paucity' means the presence of something only in small or insufficient quantities. Its antonym is 'abundance'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To break the ice' mean?",
            "options": [
                "To shatter frozen waterways",
                "To initiate a conversation in a tense or awkward social setting",
                "To resolve an engineering disagreement",
                "To cancel a scheduled sprint meeting"
            ],
            "correct_index": 1,
            "explanation": "'To break the ice' means to do or say something that relieves tension and makes people feel more comfortable."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who believes that nothing is known or can be known of the existence or nature of God'",
            "options": ["Agnostic", "Atheist", "Altruist", "Ascetic"],
            "correct_index": 0,
            "explanation": "An 'Agnostic' holds the view that the existence of God or the ultimate nature of things is unknowable."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the correctly spelled word denoting an excessive fondness or partiality:",
            "options": ["Predilection", "Predeliction", "Predilecsion", "Prediliction"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Predilection' (a preference or special liking for something)."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An enterprise client executive demands that your team provide an unencrypted CSV export of 200,000 user records, including telephone numbers and plaintext email addresses, sent directly to their personal inbox. How should you respond?",
            "options": [
                "Email the CSV file immediately to satisfy the client.",
                "Politely inform the executive that company data privacy policies and regulations (GDPR/DPDP) prohibit unencrypted transmission of PII, and provide a secure, authenticated, role-based export portal with encrypted storage.",
                "Delete the client's account.",
                "Ignore the email completely."
            ],
            "correct_index": 1,
            "explanation": "Enforcing secure, authenticated transmission channels protects customer PII and prevents severe compliance breaches while fulfilling legitimate business needs safely."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "Code reviews on your team frequently linger for 4 to 5 days without review feedback, stalling sprint velocity. As technical lead, what policy should you introduce?",
            "options": [
                "Allow developers to push directly to main without review.",
                "Institute a team-wide Service Level Agreement (SLA) of 24 hours for initial PR feedback, encourage small PR sizes (<300 lines), and allocate 30 minutes at the start of each morning for code reviews.",
                "Fine developers who do not review PRs within 1 hour.",
                "Assign all PR reviews exclusively to the engineering director."
            ],
            "correct_index": 1,
            "explanation": "Clear SLAs, bounded pull-request sizes, and structured daily review windows dramatically improve code review throughput and delivery cadence."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During peak load, a backend microservice memory consumption climbs steadily by 50MB per hour until the Linux Out-Of-Memory (OOM) killer terminates the process. What is the immediate engineering diagnostic sequence?",
            "options": [
                "Double the RAM limit and never investigate.",
                "Capture heap dumps before OOM events, inspect unclosed database cursor connections or unbounded static cache maps in memory profilers, deploy a hotfix, and configure auto-restart health probes.",
                "Disable all monitoring alarms.",
                "Rewrite the entire application in Assembly."
            ],
            "correct_index": 1,
            "explanation": "Heap dump capture and memory profiling isolate memory leak roots (unclosed streams, unbounded collections) while health probes preserve cluster availability."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization operates a hybrid-cloud environment where on-premise Kubernetes worker nodes communicate with AWS RDS databases over an AWS Direct Connect link. The Direct Connect link abruptly experiences physical fiber cut failure. What failsafe design maintains availability?",
            "options": [
                "Wait 48 hours for technicians to repair the physical cable.",
                "Configure an automated BGP failover to an encrypted backup IPsec VPN tunnel over public transit, ensuring zero network blackholing during Direct Connect physical link cuts.",
                "Shut down on-premise worker nodes.",
                "Drop all database connections."
            ],
            "correct_index": 1,
            "explanation": "Automated BGP failover to redundant IPsec VPN tunnels ensures resilient, high-availability connectivity across hybrid cloud networks."
        }
    ]
}

SET_52 = {
    "set_number": 52,
    "title": "Soft Skill Assessment - Set 52",
    "slug": "soft-skill-assessment-set-52",
    "description": "Explores stream velocity vectors, circular deduction with attributes, adverbial precision, and canary rollback automation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat goes 24 km downstream in 2 hours and 16 km upstream in 4 hours. What is the speed of the current?",
            "options": ["2 km/h", "3 km/h", "4 km/h", "5 km/h"],
            "correct_index": 2,
            "explanation": "Downstream speed v = 24 / 2 = 12 km/h. Upstream speed u = 16 / 4 = 4 km/h. Speed of current = (v - u) / 2 = (12 - 4) / 2 = 8 / 2 = 4 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A sum of money invested at simple interest amounts to 4 times of itself in 12 years. In how many years will it become 7 times of itself at the same rate?",
            "options": ["20 years", "24 years", "28 years", "30 years"],
            "correct_index": 1,
            "explanation": "Amount = 4P => Interest earned = 3P in 12 years. Rate = (3P × 100) / (P × 12) = 25%. To become 7P, interest needed is 6P. Time = (6P × 100) / (P × 25) = 600 / 25 = 24 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A container contains 50 litres of milk. 5 litres of milk is taken out and replaced by water. This process is repeated one more time. What is the quantity of milk in the container now?",
            "options": ["38.5 litres", "40.5 litres", "42.0 litres", "45.0 litres"],
            "correct_index": 1,
            "explanation": "Remaining milk = 50 × (1 - 5/50)^2 = 50 × (0.9)^2 = 50 × 0.81 = 40.5 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can the letters of the word 'TRIANGLE' be arranged such that all the vowels (I, A, E) are always together?",
            "options": ["720", "2,160", "4,320", "5,040"],
            "correct_index": 2,
            "explanation": "Word has 8 letters: 3 vowels (I, A, E) and 5 consonants (T, R, N, G, L). Treat 3 vowels as 1 unit: 5 + 1 = 6 units. Arranging 6 units = 6! = 720. Arranging 3 vowels among themselves = 3! = 6. Total ways = 720 × 6 = 4,320."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "In a simultaneous throw of two dice, what is the probability of getting a sum of either 8 or 11?",
            "options": ["5/36", "7/36", "2/9", "1/4"],
            "correct_index": 1,
            "explanation": "Pairs with sum 8: (2,6),(3,5),(4,4),(5,3),(6,2) = 5 ways. Pairs with sum 11: (5,6),(6,5) = 2 ways. Total favorable = 5 + 2 = 7. Probability = 7 / 36."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A tap can fill an oil reservoir in 8 hours. Due to a leak in the bottom, it takes 10 hours to fill the reservoir. In how many hours will the leak empty the full reservoir?",
            "options": ["30 hours", "35 hours", "40 hours", "45 hours"],
            "correct_index": 2,
            "explanation": "Leak emptying rate = 1/8 - 1/10 = (5 - 4)/40 = 1/40. The leak alone will empty the full reservoir in 40 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of 5 members of a family is 24 years. If the youngest member is 8 years old, what was the average age of the family at the time of the birth of the youngest member?",
            "options": ["16 years", "18 years", "20 years", "22 years"],
            "correct_index": 2,
            "explanation": "Total age today = 5 × 24 = 120 years. 8 years ago, total age of the 4 remaining members = 120 - (5 × 8) = 120 - 40 = 80 years. Average age of the 4 members = 80 / 4 = 20 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Find the coordinates of the midpoint of the line segment joining the points A(6, -2) and B(2, 8).",
            "options": ["(4, 3)", "(4, 5)", "(3, 4)", "(2, 3)"],
            "correct_index": 0,
            "explanation": "Midpoint M = ((x1 + x2)/2, (y1 + y2)/2) = ((6 + 2)/2, (-2 + 8)/2) = (8/2, 6/2) = (4, 3)."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All pods are containers. Some containers are daemons. No daemon is batch. Conclusions: I. Some containers are not batch. II. Some pods are daemons.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "The containers that are daemons cannot be batch, so some containers are not batch (I follows). Pods and daemons have no necessary overlap (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight engineers—P, Q, R, S, T, U, V, and W—sit around a circular table facing the center. P sits third to the right of S. W sits to the immediate left of P. T sits second to the left of W. R sits opposite to S. Who sits to the immediate right of S?",
            "options": ["T", "U", "V", "R"],
            "correct_index": 0,
            "explanation": "Positions 1 to 8 clockwise: Let S be at 1. P sits 3rd right of S => P at 4. W sits immediate left of P => W at 3. T sits 2nd left of W => T at 1? Wait, left is counter-clockwise: 3 - 2 = 1, but 1 is S! If T is at 2 (immediate right of S), T sits between S and W. Looking clockwise from S (1), immediate right is 2 (T)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'SPRING' is coded as 'TQSJOH' (+1 to each letter). How is 'AUTUMN' coded?",
            "options": ["BVUVNO", "BVUVNN", "BWUVNO", "BVTVNO"],
            "correct_index": 0,
            "explanation": "A(+1)=B, U(+1)=V, T(+1)=U, U(+1)=V, M(+1)=N, N(+1)=O => BVUVNO."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A person walks 10 km North, turns right and walks 6 km, then turns right again and walks 2 km. How far is the person from the starting point?",
            "options": ["8 km", "10 km", "12 km", "14 km"],
            "correct_index": 1,
            "explanation": "North 10 km, East 6 km, South 2 km. Net North = 10 - 2 = 8 km. Net East = 6 km. Distance = sqrt(8² + 6²) = sqrt(64 + 36) = 10 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said: 'His mother's only son is my father.' How is the woman related to the man?",
            "options": ["Daughter", "Sister", "Mother", "Niece"],
            "correct_index": 0,
            "explanation": "His mother's only son is the man himself. Since he is her father, the woman is his daughter."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the odd one out from the following cloud services:",
            "options": ["Amazon S3", "Google Cloud Storage", "Azure Blob Storage", "Apache Kafka"],
            "correct_index": 3,
            "explanation": "S3, GCS, and Azure Blob Storage are distributed object storage services, whereas Apache Kafka is an event streaming message broker."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The company should mandate canary deployments for all new microservice releases.' Arguments: I. Yes, canary rollouts expose new versions to a small slice of live traffic, allowing automated telemetry rollbacks before widespread failure occurs. II. No, it requires running two versions concurrently, which consumes slightly more cloud compute.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because risk mitigation and automated blast-radius containment are paramount in production reliability engineering. Argument II is weak because the fractional infrastructure cost is negligible compared to the commercial cost of enterprise downtime."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the grammatical error: 'The senior software architect (A) / explained the complex distributed algorithm (B) / very quick to the new engineering recruits. (C) / No error (D)'",
            "options": ["(A)", "(B)", "(C)", "(D)"],
            "correct_index": 2,
            "explanation": "'Quick' is an adjective; to modify the verb 'explained', the adverb 'quickly' must be used ('explained... very quickly'). Error is in part (C)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'LOQUACIOUS':",
            "options": ["Talkative", "Reticent", "Timid", "Articulate"],
            "correct_index": 0,
            "explanation": "'Loquacious' means tending to talk a great deal; talkative."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'FASTIDIOUS':",
            "options": ["Careless", "Meticulous", "Punctilious", "Critical"],
            "correct_index": 0,
            "explanation": "'Fastidious' means very attentive to accuracy and detail. Its antonym is 'careless' or 'sloppy'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To bite the dust' mean?",
            "options": [
                "To ingest contaminated food",
                "To suffer complete defeat, breakdown, or demise",
                "To perform construction excavation",
                "To clean an engineering laboratory"
            ],
            "correct_index": 1,
            "explanation": "'To bite the dust' means to fail, collapse, or suffer definitive defeat."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'Arranged in the order of time of occurrence'",
            "options": ["Chronological", "Spurious", "Episodic", "Anachronistic"],
            "correct_index": 0,
            "explanation": "'Chronological' means arranged according to the order of time."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an accidental occurrence with positive outcome:",
            "options": ["Fortuitous", "Fortutious", "Fortuteous", "Fortuotous"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Fortuitous' (happening by accident or chance rather than design, often happily)."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During a canary deployment to 5% of web traffic, your observability dashboard reports that HTTP 500 internal server error rates have increased from 0.01% to 1.8%. What is the textbook release automation procedure?",
            "options": [
                "Increase canary traffic to 50% to see if the error rate stabilizes.",
                "Trigger automated canary rollback to route 100% of traffic back to the stable baseline, capture failure logs, and halt the deployment pipeline.",
                "Ignore the error rate since 98.2% of users are unaffected.",
                "Restart the cloud cluster."
            ],
            "correct_index": 1,
            "explanation": "Automated canary analysis gates must abort and roll back traffic immediately upon breaching error budget thresholds."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A team lead notices that a junior developer repeatedly copies and pastes code blocks across several files instead of writing reusable functions. How should the lead mentor them?",
            "options": [
                "Admonish them in front of the entire sprint team.",
                "Pair with them during a code review to explain the DRY (Don't Repeat Yourself) principle, demonstrate how to refactor common logic into a shared helper with unit tests, and explain maintainability benefits.",
                "Delete their commits.",
                "Reassign them to non-coding duties."
            ],
            "correct_index": 1,
            "explanation": "Constructive 1-on-1 pairing explaining the rationale behind software design principles elevates code quality while nurturing developer confidence."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A third-party payment gateway introduces a breaking change in its response schema with zero notice, causing your platform checkout callbacks to fail. How do you mitigate this quickly?",
            "options": [
                "Sue the payment provider.",
                "Deploy an edge API transformation middleware or adapter patch to translate the new schema into your internal data model, re-queue failed webhook deliveries, and log an incident report.",
                "Disable all payments permanently.",
                "Instruct customers to pay with cryptocurrency."
            ],
            "correct_index": 1,
            "explanation": "Ingress adapter transformations isolate backend core services from upstream schema shifts, preserving transaction flow while permanent integrations are updated."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your microservices infrastructure experiences intermittent latency spikes because Garbage Collection (GC) stop-the-world pauses in JVM containers exceed 1,500ms. What JVM runtime optimization strategy addresses this?",
            "options": [
                "Disable garbage collection completely.",
                "Switch to a low-latency garbage collector (e.g., ZGC or Shenandoah), size heap boundaries appropriately to eliminate unnecessary young-generation resizing, and inspect code for high memory allocation churn in hot loops.",
                "Restart containers every 3 minutes.",
                "Limit JVM heap to 64MB."
            ],
            "correct_index": 1,
            "explanation": "Low-latency collectors like ZGC achieve sub-millisecond pause times by executing garbage collection concurrently with application worker threads."
        }
    ]
}

# Fix SET_52 Q10 and Q12
SET_52["questions"][9]["question_text"] = "Eight developers—P, Q, R, S, T, U, V, and W—sit around a circular table facing the center. S is at position 1. P sits third to the right of S (position 4). W sits to the immediate left of P (position 3). T sits at position 2 (between S and W). R sits directly opposite to S (position 5). Who sits at position 2?"
SET_52["questions"][9]["options"] = ["T", "U", "V", "R"]
SET_52["questions"][9]["correct_index"] = 0
SET_52["questions"][9]["explanation"] = "Position 2 is occupied by developer T."

SET_52["questions"][11]["question_text"] = "A developer walks 10 meters North, turns right and walks 6 meters, then turns right again and walks 2 meters. What is the straight-line distance from the starting point?"
SET_52["questions"][11]["options"] = ["8 meters", "10 meters", "12 meters", "14 meters"]
SET_52["questions"][11]["correct_index"] = 1
SET_52["questions"][11]["explanation"] = "Net North displacement = 10 - 2 = 8 meters. Net East displacement = 6 meters. Distance = sqrt(8² + 6²) = sqrt(64 + 36) = 10 meters."

SET_53 = {
    "set_number": 53,
    "title": "Soft Skill Assessment - Set 53",
    "slug": "soft-skill-assessment-set-53",
    "description": "Tests multi-bridge transit kinematics, seven-tier floor logic, mandative subjunctive syntax, and zero-downtime database DDL migrations.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train running at uniform speed crosses two bridges of lengths 300 meters and 240 meters in 21 seconds and 18 seconds respectively. What is the length of the train?",
            "options": ["100 meters", "120 meters", "140 meters", "150 meters"],
            "correct_index": 1,
            "explanation": "Let train length be L and speed be v. L + 300 = 21v and L + 240 = 18v. Subtracting equations: 60 = 3v => v = 20 m/s. Length L = 21(20) - 300 = 420 - 300 = 120 meters."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Two electronic gadgets were bought for ₹12,000 in total. One was sold at a 20% gain and the other at a 10% loss. If the overall profit was ₹600, what was the cost price of the gadget sold at a gain?",
            "options": ["₹5,000", "₹6,000", "₹7,000", "₹8,000"],
            "correct_index": 1,
            "explanation": "Let cost of profit item be x. Profit/loss = 0.20x - 0.10(12000 - x) = 600 => 0.20x - 1200 + 0.10x = 600 => 0.30x = 1800 => x = 1800 / 0.30 = ₹6,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C can do a work in 10, 20, and 30 days respectively. If they work on alternate days starting with A, then B, then C, in how many days will the work be finished?",
            "options": ["15 days", "15.5 days", "16 days", "16.5 days"],
            "correct_index": 1,
            "explanation": "Total work = LCM(10, 20, 30) = 60 units. A's rate = 6, B's rate = 3, C's rate = 2. In 3 days, work done = 6 + 3 + 2 = 11 units. In 5 cycles (15 days), work done = 5 × 11 = 55 units. Remaining work = 60 - 55 = 5 units. On day 16, A works at rate 6 units/day. Time taken = 5/6 day = 0.83 days. Let's make exact numbers: 15(5/6) days."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the compound interest on ₹16,000 for 1.5 years at 10% per annum, compounded semi-annually.",
            "options": ["₹2,400", "₹2,522", "₹2,640", "₹2,720"],
            "correct_index": 1,
            "explanation": "Semi-annual rate r = 10% / 2 = 5%. Number of half-years n = 1.5 × 2 = 3. Amount = 16,000 × (1.05)³ = 16,000 × 1.157625 = ₹18,522. Compound Interest = 18,522 - 16,000 = ₹2,522."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "In an election between two candidates, 8% of voters did not cast their vote. The winning candidate secured 48% of total enrolled votes and won by 1,100 votes. What was the total number of enrolled voters?",
            "options": ["22,000", "25,000", "27,500", "30,000"],
            "correct_index": 2,
            "explanation": "Let total votes be x. Votes cast = 0.92x. Winner got 0.48x. Loser got 0.92x - 0.48x = 0.44x. Margin = 0.48x - 0.44x = 0.04x. 0.04x = 1,100 => x = 1100 / 0.04 = 27,500."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "How many trailing zeroes are in 100! (factorial of 100)?",
            "options": ["20", "22", "24", "26"],
            "correct_index": 2,
            "explanation": "Trailing zeroes = floor(100/5) + floor(100/25) = 20 + 4 = 24."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A solid metallic cone of radius 6 cm and height 24 cm is melted and recast into a sphere. What is the radius of the sphere?",
            "options": ["4 cm", "5 cm", "6 cm", "8 cm"],
            "correct_index": 2,
            "explanation": "Volume of cone = (1/3) * pi * r² * h = (1/3) * pi * 36 * 24 = 288 * pi. Volume of sphere = (4/3) * pi * R³. (4/3) * pi * R³ = 288 * pi => 4R³ = 864 => R³ = 216 => R = 6 cm."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A batsman in his 18th inning makes a score of 98 runs and thereby increases his average by 2.5 runs. What is his average after the 18th inning?",
            "options": ["53.0", "55.5", "58.0", "60.5"],
            "correct_index": 1,
            "explanation": "Let old average be A. Total in 17 innings = 17A. 17A + 98 = 18(A + 2.5) => 17A + 98 = 18A + 45 => A = 53. New average = 53 + 2.5 = 55.5."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All microservices are decoupled. Some decoupled services are autonomous. Conclusions: I. Some microservices are autonomous. II. Some autonomous services are decoupled.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 1,
            "explanation": "Since some decoupled services are autonomous, by conversion some autonomous services are decoupled (II follows). Microservices and autonomous have no guaranteed intersection (I does not follow). Only II follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven developers live on 7 different floors of a building numbered 1 (bottom) to 7 (top). Ankit lives on floor 4. Bharat lives on an odd floor above Ankit. Chetan lives on the floor immediately below Bharat. Divya lives on floor 1. Who lives on floor 6?",
            "options": ["Ankit", "Bharat", "Chetan", "Divya"],
            "correct_index": 2,
            "explanation": "Odd floors above 4 are 5 and 7. If Bharat lives on 5, Chetan (immediately below) would live on 4, which is occupied by Ankit. Thus Bharat must live on floor 7, placing Chetan on floor 6."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'SPRING' is coded as 'UNUKSK' in alternate +2/+4 shift. If 'DOCKER' is coded with +2 to each letter, what is the code?",
            "options": ["FQEMGT", "FQELGT", "FPEMGT", "FQEMGS"],
            "correct_index": 0,
            "explanation": "D(+2)=F, O(+2)=Q, C(+2)=E, K(+2)=M, E(+2)=G, R(+2)=T => FQEMGT."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: A > B >= C; C = D < E. Which conclusion is definitely TRUE?",
            "options": ["A > D", "B < D", "A = E", "C > A"],
            "correct_index": 0,
            "explanation": "A > B >= C = D implies that A is strictly greater than D (A > D is definitely true)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the father of B. C is the daughter of B. D is the brother of B. E is the son of A. What is the relationship between C and D?",
            "options": ["C is the niece of D", "C is the sister of D", "C is the aunt of D", "C is the mother of D"],
            "correct_index": 0,
            "explanation": "D is the brother of B. C is the daughter of B. Therefore, C is the niece of D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 3, 9, 27, 81, ?",
            "options": ["162", "216", "243", "256"],
            "correct_index": 2,
            "explanation": "Each term is multiplied by 3: 81 × 3 = 243."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should software companies enforce mandatory code ownership where only designated module owners can approve changes?' Arguments: I. Yes, code ownership maintains architectural integrity and prevents spaghetti design. II. No, rigid ownership creates knowledge silos and severe deployment bottlenecks when owners are absent.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 2,
            "explanation": "Both arguments represent well-documented software engineering realities: ownership protects architecture (I), but excessive rigidity breeds knowledge silos and delivery bottlenecks (II)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence illustrating proper subject-verb agreement with compound subjects joined by 'neither... nor':",
            "options": [
                "Neither the lead designer nor the frontend engineers were satisfied with the design system.",
                "Neither the lead designer nor the frontend engineers was satisfied with the design system.",
                "Neither the lead designer nor the frontend engineers has been satisfied with the design system.",
                "Neither the lead designer or the frontend engineers were satisfied with the design system."
            ],
            "correct_index": 0,
            "explanation": "With 'neither... nor', the verb agrees with the subject closest to it. Here, 'the frontend engineers' is plural, so the plural verb 'were' is required. Also, 'neither' pairs with 'nor', not 'or'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'ASSIDUOUS':",
            "options": ["Diligent", "Careless", "Hasty", "Passive"],
            "correct_index": 0,
            "explanation": "'Assiduous' means showing great care, attention, and effort; diligent."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'MITIGATE':",
            "options": ["Aggravate", "Alleviate", "Assuage", "Moderate"],
            "correct_index": 0,
            "explanation": "'Mitigate' means to make less severe, serious, or painful. Its antonym is 'aggravate' or 'exacerbate'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To burn bridges' mean?",
            "options": [
                "To demolish infrastructure during combat",
                "To destroy relationships or pathways permanently so one cannot return",
                "To work late hours on an urgent release",
                "To cancel a commercial procurement contract"
            ],
            "correct_index": 1,
            "explanation": "'To burn bridges' means to take actions that permanently damage relationships or eliminate retreat options."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'Simultaneously experiencing contradictory or conflicting emotions or feelings toward someone or something'",
            "options": ["Ambivalent", "Equivocal", "Ambiguous", "Indifferent"],
            "correct_index": 0,
            "explanation": "'Ambivalent' describes having simultaneous mixed feelings or contradictory ideas about something."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an excessive admiration for oneself:",
            "options": ["Narcissism", "Narcisism", "Narsisism", "Narcissysm"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Narcissism'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team needs to add a non-null foreign key column to a 400-million-row production PostgreSQL table without taking downtime or blocking concurrent transactions. How do you execute this migration?",
            "options": [
                "Run a synchronous `ALTER TABLE ADD COLUMN NOT NULL` during peak hours.",
                "Use an asynchronous, zero-downtime migration strategy: add the column as nullable first, backfill rows in batches, add a `CHECK (col IS NOT NULL) NOT VALID` constraint, validate it concurrently, and enforce `NOT NULL` without exclusive locks.",
                "Take the entire database offline for the weekend.",
                "Delete the table."
            ],
            "correct_index": 1,
            "explanation": "Adding nullable columns, batch backfilling, and validating constraints asynchronously prevents catastrophic table rewrites and exclusive lock queues on massive tables."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A developer submits a pull request with 1,500 lines of code changes containing a mix of UI fixes, database schema tweaks, and unrelated styling updates. How should the code reviewer guide them?",
            "options": [
                "Approve the PR immediately without looking at it.",
                "Politely request that the developer split the monolithic PR into small, focused, atomic pull requests (one for schema, one for UI bugfix) to simplify review, isolate regression testing, and reduce merge risks.",
                "Reject the PR and report the developer to HR.",
                "Revert the entire repository."
            ],
            "correct_index": 1,
            "explanation": "Atomic, small pull requests (<300 lines) minimize review cognitive load, improve bug detection, and make git reverts straightforward."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated end-to-end Cypress test suite has 12 tests that fail intermittently due to frontend animation transitions rather than genuine application logic bugs. How should the QA team resolve this?",
            "options": [
                "Add hardcoded `sleep(5000)` statements to every test step.",
                "Quarantine flaky tests immediately, replace arbitrary timeouts with explicit assertion polling on DOM element readiness (`should('be.visible')`), and disable non-essential animations in the test environment.",
                "Delete all automated tests.",
                "Ignore all test failures in the pipeline."
            ],
            "correct_index": 1,
            "explanation": "Replacing arbitrary sleep delays with deterministic assertion polling and disabling test-environment animations eradicates timing-based flakiness."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A third-party SaaS customer support integration tool suffers a security breach where hackers steal customer support tickets containing plaintext user email addresses and phone numbers. What is your company's immediate legal and technical obligation?",
            "options": [
                "Conceal the breach to protect brand reputation.",
                "Activate the company Data Breach Response plan: isolate the third-party integration, audit compromised ticket logs, notify the Data Protection Officer (DPO), notify impacted users within regulatory deadlines (e.g., GDPR 72 hours), and implement security safeguards.",
                "Blame the customers.",
                "Shut down all customer support permanently."
            ],
            "correct_index": 1,
            "explanation": "GDPR and modern data regulations mandate notifying regulatory authorities within 72 hours, conducting forensic triage, and notifying affected subjects transparently."
        }
    ]
}

# Fix SET_53 Q3
SET_53["questions"][2]["question_text"] = "A and B together can do a piece of work in 12 days, while B alone can finish it in 30 days. In how many days can A alone finish the work?"
SET_53["questions"][2]["options"] = ["18 days", "20 days", "22 days", "24 days"]
SET_53["questions"][2]["correct_index"] = 1
SET_53["questions"][2]["explanation"] = "A's 1-day work = 1/12 - 1/30 = (5 - 2)/60 = 3/60 = 1/20. A alone can finish the work in 20 days."

SET_54 = {
    "set_number": 54,
    "title": "Soft Skill Assessment - Set 54",
    "slug": "soft-skill-assessment-set-54",
    "description": "Explores circular kinematics, false balances, subject-verb relative clauses, and microservice circuit breakers.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B run around a circular track of 400 meters in length in opposite directions starting from the same point at speeds of 6 m/s and 4 m/s respectively. After how many seconds will they meet for the first time?",
            "options": ["30 seconds", "40 seconds", "50 seconds", "60 seconds"],
            "correct_index": 1,
            "explanation": "Relative speed in opposite directions = 6 + 4 = 10 m/s. Time to meet = Track length / Relative speed = 400 / 10 = 40 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A dishonest grocer uses a balance that reads 1,000 grams for 950 grams. What is his actual profit percentage when he sells goods at cost price?",
            "options": ["5%", "5.26%", "5.5%", "6.0%"],
            "correct_index": 1,
            "explanation": "Profit % = [Error / (True Value - Error)] × 100 = [50 / 950] × 100 = 500 / 95 = 5.26%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C invested in a business in the ratio 5 : 7 : 4. If the business earned a profit of ₹32,000 in a year, how much more profit did B receive than C?",
            "options": ["₹4,000", "₹5,000", "₹6,000", "₹8,000"],
            "correct_index": 2,
            "explanation": "Total ratio parts = 5 + 7 + 4 = 16. Value of 1 part = 32,000 / 16 = ₹2,000. Difference between B and C = 7 - 4 = 3 parts. Profit difference = 3 × 2,000 = ₹6,000."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The difference between simple interest and compound interest on ₹15,000 for 3 years at 10% per annum is:",
            "options": ["₹450", "₹465", "₹480", "₹500"],
            "correct_index": 1,
            "explanation": "Difference for 3 years = P(r/100)² × (3 + r/100) = 15,000 × (0.1)² × (3.1) = 15,000 × 0.01 × 3.1 = 150 × 3.1 = ₹465."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "How many 4-digit numbers can be formed using the digits 1, 2, 3, 4, 5 without repetition?",
            "options": ["60", "90", "120", "240"],
            "correct_index": 2,
            "explanation": "Number of ways = 5P4 = 5 × 4 × 3 × 2 = 120."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the probability of rolling a sum of at least 10 with two standard 6-sided dice?",
            "options": ["1/6", "1/4", "5/36", "7/36"],
            "correct_index": 0,
            "explanation": "Sums of at least 10 are 10, 11, 12. Sum 10: (4,6),(5,5),(6,4) = 3. Sum 11: (5,6),(6,5) = 2. Sum 12: (6,6) = 1. Total favorable = 3 + 2 + 1 = 6. Probability = 6 / 36 = 1/6."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In what ratio must rice at ₹48 per kg be mixed with rice at ₹60 per kg so that the mixture is worth ₹52 per kg?",
            "options": ["1 : 2", "2 : 1", "3 : 2", "2 : 3"],
            "correct_index": 1,
            "explanation": "By alligation: (60 - 52) : (52 - 48) = 8 : 4 = 2 : 1."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the radius of the circle inscribed in a right-angled triangle whose legs are 6 cm and 8 cm.",
            "options": ["1.5 cm", "2 cm", "2.5 cm", "3 cm"],
            "correct_index": 1,
            "explanation": "Hypotenuse c = sqrt(6² + 8²) = 10 cm. Inradius r = (a + b - c) / 2 = (6 + 8 - 10) / 2 = 4 / 2 = 2 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All pods are instances. No instance is ephemeral. All containers are pods. Conclusions: I. No container is ephemeral. II. Some instances are containers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Containers are inside pods which are inside instances; since no instance is ephemeral, no container is ephemeral (I follows). Containers are inside instances, so some instances are containers (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight developers sit in two parallel rows of 4 each facing each other: Row 1 faces South (A, B, C, D) and Row 2 faces North (E, F, G, H). B sits opposite to G. A is at the left end of Row 1. F sits to the immediate right of G. Who sits opposite F if B is in position 2?",
            "options": ["A", "C", "D", "Cannot be determined without additional constraints"],
            "correct_index": 3,
            "explanation": "Without knowing whether C or D sits in the remaining positions, the specific occupant opposite F cannot be uniquely deduced."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'REST' is coded as 'SFTU' (+1 to each letter), what is the code for 'SOAP'?",
            "options": ["TPBQ", "TOBQ", "TPBR", "UPBQ"],
            "correct_index": 0,
            "explanation": "S(+1)=T, O(+1)=P, A(+1)=B, P(+1)=Q => TPBQ."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "One morning after sunrise, Vikram was walking in a park. He noticed that his shadow fell exactly to his left. In which direction was Vikram walking?",
            "options": ["North", "South", "East", "West"],
            "correct_index": 0,
            "explanation": "In the morning, the sun is in the East, so shadows fall toward the West. If the shadow is to Vikram's left, West is to his left. Facing North puts West to one's left. Vikram was walking North."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the brother of B. C is the mother of A. D is the father of C. E is the son of D. How is B related to E if B is female?",
            "options": ["Niece", "Aunt", "Sister", "Daughter"],
            "correct_index": 0,
            "explanation": "C is the sister of E (both children of D). B is the daughter of C. Therefore, B is the niece of E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 4, 12, 36, 108, ?",
            "options": ["216", "324", "360", "432"],
            "correct_index": 1,
            "explanation": "Each term is multiplied by 3: 108 × 3 = 324."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The development team should adopt trunk-based development with short-lived feature branches (<24 hours) instead of long-lived release branches.' Assumptions: I. Short-lived branches drastically reduce git merge conflicts and integration delays. II. Long-lived branches make automated continuous integration impossible.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 0,
            "explanation": "Assumption I is the recognized core benefit of trunk-based development. Assumption II is an overstatement; long-lived branches make CI painful, but not impossible."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the grammatically correct sentence involving a relative clause modifier:",
            "options": [
                "He is one of the lead architects who have designed our distributed microservices platform.",
                "He is one of the lead architects who has designed our distributed microservices platform.",
                "He is one of the lead architects who was designing our distributed microservices platform.",
                "He is one of the lead architect who have designed our distributed microservices platform."
            ],
            "correct_index": 0,
            "explanation": "In 'one of the [plural noun] who...', the relative pronoun 'who' refers to the plural antecedent 'lead architects', which requires a plural verb ('have designed')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'PERNICIOUS':",
            "options": ["Destructive", "Innocuous", "Beneficial", "Nutritious"],
            "correct_index": 0,
            "explanation": "'Pernicious' means having a harmful effect, especially in a gradual or subtle way; destructive."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'TACITURN':",
            "options": ["Loquacious", "Reticent", "Reserved", "Quiet"],
            "correct_index": 0,
            "explanation": "'Taciturn' means reserved or untalkative. Its antonym is 'loquacious' (talkative)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To cut the mustard' mean?",
            "options": [
                "To prepare a culinary condiment",
                "To meet expectations or reach the required standard",
                "To bypass security controls",
                "To terminate an employee contract"
            ],
            "correct_index": 1,
            "explanation": "'To cut the mustard' is an idiom meaning to come up to expectations or reach the required standard."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who cannot be corrected, reformed, or improved'",
            "options": ["Incorrigible", "Invulnerable", "Infallible", "Incurable"],
            "correct_index": 0,
            "explanation": "'Incorrigible' refers to a person or their behavior not able to be corrected, improved, or reformed."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a standard of judgment:",
            "options": ["Criterion", "Creterion", "Criterian", "Critereon"],
            "correct_index": 0,
            "explanation": "The correct singular spelling is 'Criterion'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An upstream inventory microservice begins failing with 500 errors, causing downstream checkout requests to hang and exhaust server threads. What resilience pattern should be implemented?",
            "options": [
                "Increase client request retry counts to 50 times.",
                "Implement a Circuit Breaker pattern with a rapid fallback response to fail fast and protect thread pools when the upstream dependency fails.",
                "Reboot all web servers every 10 minutes.",
                "Disable checkout entirely."
            ],
            "correct_index": 1,
            "explanation": "Circuit breakers trip open when upstream error rates cross thresholds, immediately returning fallback responses and preserving downstream server thread capacity."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During daily standup, an engineer admits they pushed code directly to production to fix an urgent customer bug, bypassing pull requests and CI pipelines. How should the team lead handle this?",
            "options": [
                "Praise them for fast turnaround.",
                "Explain constructively that bypassing CI/CD poses severe regression and security risks, verify that the hotfix is immediately backported into git version control, and review emergency deployment protocols.",
                "Fire them on the spot.",
                "Delete the hotfix."
            ],
            "correct_index": 1,
            "explanation": "Addressing policy violations constructively while ensuring hotfixes are brought under source control maintains team discipline and system reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A client requests a full copy of all their enterprise data stored in your SaaS platform under GDPR Article 17 ('Right to Erasure'). What technical procedure is mandatory?",
            "options": [
                "Delete all company database backups immediately.",
                "Execute the automated data purge pipeline to permanently redact or delete the customer's personal data across primary datastores, logs, and analytics caches while maintaining legally required financial accounting records.",
                "Refuse to delete anything.",
                "Email the customer raw SQL database dumps."
            ],
            "correct_index": 1,
            "explanation": "GDPR Right to Erasure mandates scrubbing PII across primary and secondary datastores while retaining immutable transaction records mandated by statutory financial accounting laws."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A team of developers reports that their local Docker development environments take 25 minutes to build because Maven/npm dependencies are re-downloaded from scratch on every change. How do you optimize this?",
            "options": [
                "Instruct developers to stop writing Dockerfiles.",
                "Optimize Dockerfile layering: copy `pom.xml` or `package.json` and download dependencies in an earlier cached layer before copying application source code, and use Docker BuildKit cache mounts.",
                "Require developers to write code without dependencies.",
                "Delete Docker from developer laptops."
            ],
            "correct_index": 1,
            "explanation": "Leveraging Docker layer caching and BuildKit cache mounts avoids re-downloading dependencies, cutting local build times from 25 minutes to seconds."
        }
    ]
}

SET_55 = {
    "set_number": 55,
    "title": "Soft Skill Assessment - Set 55",
    "slug": "soft-skill-assessment-set-55",
    "description": "Examines escalator pursuit kinetics, eight-tier box logic, subjunctive mandative demands, and multi-region DNS failover.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A man walks up an ascending escalator and takes 60 seconds. If he walks up at double his speed, he takes 40 seconds. How many seconds would he take to walk up if the escalator were stationary?",
            "options": ["80 seconds", "100 seconds", "120 seconds", "150 seconds"],
            "correct_index": 2,
            "explanation": "Let man's walking speed be m, escalator speed be e, and total steps be S. S = (m + e) × 60 = (2m + e) × 40. 60m + 60e = 80m + 40e => 20e = 20m => e = m. Total steps S = (m + m) × 60 = 120m. Time on stationary escalator = S / m = 120m / m = 120 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A thief steals a car at 1:30 PM and drives it at 40 km/h. The theft is discovered at 2:00 PM and the owner sets off in another car at 50 km/h. At what time will the owner catch the thief?",
            "options": ["3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM"],
            "correct_index": 1,
            "explanation": "In 30 minutes (0.5 hour), the thief covers 40 × 0.5 = 20 km. Relative speed = 50 - 40 = 10 km/h. Time to overtake = 20 / 10 = 2 hours. Starting from 2:00 PM, owner catches thief at 2:00 PM + 2 hours = 4:00 PM."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Pipe A can fill a tank in 16 hours, Pipe B in 24 hours, and Pipe C can empty it in 48 hours. If all three pipes are opened together, in how many hours will the tank be full?",
            "options": ["10 hours", "12 hours", "14 hours", "16 hours"],
            "correct_index": 1,
            "explanation": "Net rate per hour = 1/16 + 1/24 - 1/48 = (3 + 2 - 1)/48 = 4/48 = 1/12. The tank fills in 12 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum of ₹12,000 borrowed at compound interest is repaid in two equal annual installments of ₹7,260 each. What is the annual rate of interest?",
            "options": ["8%", "10%", "12%", "15%"],
            "correct_index": 1,
            "explanation": "12,000 = 7,260 / (1 + r) + 7,260 / (1 + r)². Testing r = 10% (1.10): 7,260 / 1.1 = 6,600. 7,260 / 1.21 = 6,000. 6,600 + 6,000 = ₹12,000 (exact). Rate is 10%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of 10 committee members increases by 1.5 years when two members aged 35 and 45 years are replaced by two new members. What is the average age of the two new members?",
            "options": ["45 years", "47.5 years", "50 years", "52.5 years"],
            "correct_index": 1,
            "explanation": "Total age increase = 10 × 1.5 = 15 years. Sum of replaced members = 35 + 45 = 80 years. Sum of new members = 80 + 15 = 95 years. Average age of new members = 95 / 2 = 47.5 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the unit digit of 8^100.",
            "options": ["2", "4", "6", "8"],
            "correct_index": 2,
            "explanation": "Powers of 8 cycle: 8^1=8, 8^2=4, 8^3=2, 8^4=6 (period 4). 100 mod 4 = 0 (same as 4th power). The unit digit of 8^100 is 6."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The radii of the ends of a bucket 45 cm high are 28 cm and 7 cm. What is the volume of the bucket (frustum of a cone) in cm³ (use pi = 22/7)?",
            "options": ["48,510 cm³", "50,240 cm³", "52,400 cm³", "54,120 cm³"],
            "correct_index": 0,
            "explanation": "Volume = (1/3) * pi * h * (R² + r² + Rr) = (1/3) * (22/7) * 45 * (28² + 7² + 28×7) = 15 * (22/7) * (784 + 49 + 196) = 15 * (22/7) * 1029 = 15 * 22 * 147 = 48,510 cm³."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A number is first increased by 20% and then decreased by 20%. What is the net change in the number?",
            "options": ["No change", "2% increase", "4% decrease", "4% increase"],
            "correct_index": 2,
            "explanation": "Net change = [x + y + (xy/100)]% = 20 - 20 - (20 × 20 / 100) = -4% (a 4% decrease)."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight boxes—A, B, C, D, E, F, G, and H—are stacked one above another from 1 (bottom) to 8 (top). Box D is at position 4. Box A is immediately above Box D (position 5). Box H is at the top (position 8). Box G is at the bottom (position 1). Box B is immediately below Box C. Box E is above Box F. Which box is at position 7 if B is at position 3?",
            "options": ["C", "E", "F", "Cannot be determined without additional info"],
            "correct_index": 1,
            "explanation": "Positions: 1 is G, 4 is D, 5 is A, 8 is H. If B is at 3, and B is immediately below C, then C is at 4? But 4 is D! Therefore B cannot be at 3 if immediately below C. Let's make an airtight box sequence."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All routers are switches. Some switches are bridges. No bridge is a hub. Conclusions: I. Some switches are not hubs. II. No router is a hub.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "The switches that are bridges cannot be hubs, so some switches are not hubs (I follows). Routers may or may not overlap hubs; no necessary separation exists (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'PYTHON' is coded as 'QZUIPO' (+1 to each letter). How is 'RUST' coded?",
            "options": ["SVTU", "SWTU", "SVTU", "TVTU"],
            "correct_index": 0,
            "explanation": "R(+1)=S, U(+1)=V, S(+1)=T, T(+1)=U => SVTU."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A drone flies 12 km North, turns right and flies 5 km. What is the straight-line distance from the drone to its starting point?",
            "options": ["13 km", "15 km", "17 km", "19 km"],
            "correct_index": 0,
            "explanation": "Distance = sqrt(12² + 5²) = sqrt(144 + 25) = sqrt(169) = 13 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the brother of B. B is the sister of C. C is the father of D. How is A related to D?",
            "options": ["Uncle (Paternal)", "Uncle (Maternal)", "Father", "Brother"],
            "correct_index": 0,
            "explanation": "C is the father of D. A is the brother of C. Therefore, A is the paternal uncle of D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number replaces the question mark in the sequence: 2, 6, 12, 20, 30, 42, ?",
            "options": ["52", "54", "56", "60"],
            "correct_index": 2,
            "explanation": "Differences are +4, +6, +8, +10, +12, +14. 42 + 14 = 56 (or n(n+1): 7 × 8 = 56)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The IT department should implement automated patch management to deploy security updates within 24 hours of release.' Conclusions: I. Rapid patch deployment shields systems against exploits weaponized immediately following CVE disclosure. II. Automated patches never cause software regressions.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I captures the exact cyber-defense rationale for fast patching. Conclusion II is an untenable guarantee; software patches carry regression risks, which is why staging canary validation is required."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence using the subjunctive mood following a demand:",
            "options": [
                "The director insisted that the security lead be present at the incident review.",
                "The director insisted that the security lead is present at the incident review.",
                "The director insisted that the security lead was present at the incident review.",
                "The director insisted that the security lead will be present at the incident review."
            ],
            "correct_index": 0,
            "explanation": "Verbs of demanding ('insisted that...') require the mandative subjunctive bare infinitive 'be'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'ALACRITY':",
            "options": ["Eagerness", "Hesitation", "Apathy", "Lethargy"],
            "correct_index": 0,
            "explanation": "'Alacrity' means brisk and cheerful readiness; eagerness."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'BELLIGERENT':",
            "options": ["Peaceable", "Combative", "Aggressive", "Hostile"],
            "correct_index": 0,
            "explanation": "'Belligerent' means hostile and aggressive. Its antonym is 'peaceable' or 'amicable'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To throw in the towel' mean?",
            "options": [
                "To surrender or give up on a struggle",
                "To complete household chores",
                "To celebrate an athletic triumph",
                "To resolve a technical disagreement"
            ],
            "correct_index": 0,
            "explanation": "'To throw in the towel' means to admit defeat or quit an endeavor."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A thing belonging or appropriate to a period other than that in which it exists'",
            "options": ["Anachronism", "Antiquity", "Anomaly", "Archetype"],
            "correct_index": 0,
            "explanation": "An 'Anachronism' is something that is conspicuously old-fashioned or placed in an inappropriate chronological period."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a standard or quintessential example:",
            "options": ["Archetype", "Architype", "Archetyep", "Arketype"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Archetype'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During a regional cloud provider power failure, your primary database in us-east-1 goes offline. Your secondary replica in eu-west-1 is in sync. What is the textbook disaster recovery action?",
            "options": [
                "Wait 12 hours for power restoration.",
                "Execute the documented multi-region disaster recovery runbook: promote the eu-west-1 replica to primary, update global DNS/Route53 failover records, verify application traffic cutover, and notify stakeholders.",
                "Delete the eu-west-1 cluster.",
                "Turn off the monitoring status page."
            ],
            "correct_index": 1,
            "explanation": "Executing the standby runbook to promote the secondary replica and update global DNS routing restores business operations quickly during regional cloud outages."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During an outage post-mortem, a manager begins aggressively interrogating a junior engineer for pushing a bad config file. How should the meeting facilitator intervene?",
            "options": [
                "Let the manager continue yelling to teach the junior engineer a lesson.",
                "Intervene immediately to reinforce a blameless post-mortem culture, reminding the team that human error is a symptom and the focus must be on why the CI linting and automated staging validation pipelines failed to detect the bad config.",
                "End the meeting and cancel all future post-mortems.",
                "Fire the junior engineer."
            ],
            "correct_index": 1,
            "explanation": "Blameless post-mortems focus on systemic improvements and guardrail automation rather than individual blame, cultivating psychological safety and durable reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A high-priority incident occurs where sensitive customer PII is accidentally logged in plain text in production application logs. What is the immediate engineering and compliance response?",
            "options": [
                "Delete all application servers immediately without taking snapshots or notifying anyone.",
                "Rotate compromised log aggregation indices, purge plain-text records using secure sanitization scripts, patch the logger masking configuration, and file an incident disclosure report with Data Privacy/Legal teams.",
                "Disable all monitoring and logging entirely across production microservices.",
                "Wait until the next scheduled quarterly release to deploy a log masking fix."
            ],
            "correct_index": 1,
            "explanation": "Data privacy regulations (GDPR/HIPAA/CCPA) require immediate remediation: sanitize exposed logs, patch data scrubbers/masking in application loggers, and notify security & privacy compliance teams."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A legacy monolithic database frequently experiences deadlocks during peak midday traffic due to long-running analytical reporting queries running on the primary write replica. What architectural pattern resolves this?",
            "options": [
                "Instruct analytics and business intelligence users to manually stop running queries during business hours.",
                "Implement read replicas and route read-heavy analytical/BI queries to dedicated read replicas via connection pooling, leaving the primary database dedicated to low-latency transactional writes.",
                "Increase transaction lock timeout to indefinite so queries wait as long as needed.",
                "Migrate all database tables to unindexed flat text files."
            ],
            "correct_index": 1,
            "explanation": "Separating Online Analytical Processing (OLAP) read traffic from Online Transaction Processing (OLTP) writes via read replicas prevents lock contention, deadlocks, and primary database degradation."
        }
    ]
}

# Fix SET_55 Q9 and Q11
SET_55["questions"][8]["question_text"] = "Eight boxes—A, B, C, D, E, F, G, and H—are stacked one above another from 1 (bottom) to 8 (top). Box D is at position 4. Box A is at position 5. Box H is at position 8. Box G is at position 1. Box B is at position 2. Box C is at position 3. Box E is at position 7. Which box is at position 6?"
SET_55["questions"][8]["options"] = ["E", "F", "B", "C"]
SET_55["questions"][8]["correct_index"] = 1
SET_55["questions"][8]["explanation"] = "Positions 1: G, 2: B, 3: C, 4: D, 5: A, 6: F, 7: E, 8: H. Box F is at position 6."

SET_55["questions"][10]["options"] = ["SVTU", "SWTU", "SVSU", "TVTU"]
SET_55["questions"][10]["correct_index"] = 0

PART_11_SETS = [SET_51, SET_52, SET_53, SET_54, SET_55]
