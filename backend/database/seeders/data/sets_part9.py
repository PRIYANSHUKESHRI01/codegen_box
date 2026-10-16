# Sets 41 to 45 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_41 = {
    "set_number": 41,
    "title": "Soft Skill Assessment - Set 41",
    "slug": "soft-skill-assessment-set-41",
    "description": "Assesses race kinematics, circular deduction networks, inverted concord syntax, and zero-trust perimeter deployment.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In a 100-meter race, A beats B by 20 meters or 4 seconds. What is A's time to complete the race?",
            "options": ["16 seconds", "18 seconds", "20 seconds", "24 seconds"],
            "correct_index": 0,
            "explanation": "B takes 4 seconds to cover 20 meters, so B's speed = 20 / 4 = 5 m/s. Time taken by B to run 100 meters = 100 / 5 = 20 seconds. Since A beats B by 4 seconds, A's time = 20 - 4 = 16 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum was put at simple interest at a certain rate for 3 years. Had it been put at 2% higher rate, it would have fetched ₹360 more. Find the sum.",
            "options": ["₹5,000", "₹6,000", "₹7,200", "₹8,000"],
            "correct_index": 1,
            "explanation": "Extra interest in 3 years at 2% higher rate = P × 2 × 3 / 100 = 0.06P. 0.06P = 360 => P = 360 / 0.06 = ₹6,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A trader marks his goods 30% above the cost price and gives a discount of 15% on marked price. What is his overall profit percentage?",
            "options": ["10%", "10.5%", "11%", "12%"],
            "correct_index": 1,
            "explanation": "Let CP = 100. MP = 130. SP = 130 × (1 - 0.15) = 130 × 0.85 = 110.50. Profit = 110.50 - 100 = 10.5%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the highest power of 3 that divides 100! completely.",
            "options": ["44", "46", "48", "50"],
            "correct_index": 2,
            "explanation": "Highest power of prime 3 in n! = floor(100/3) + floor(100/9) + floor(100/27) + floor(100/81) = 33 + 11 + 3 + 1 = 48."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can the letters of the word 'MACHINE' be arranged so that the vowels may occupy only odd positions?",
            "options": ["120", "288", "576", "720"],
            "correct_index": 2,
            "explanation": "Word MACHINE has 7 letters with 3 vowels (A, I, E) and 4 consonants (M, C, H, N). The odd positions in 7 slots are 1, 3, 5, 7 (4 positions). 3 vowels can occupy 4 odd positions in 4P3 = 24 ways. The remaining 4 consonants can occupy the remaining 4 positions in 4! = 24 ways. Total arrangements = 24 × 24 = 576."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average score of a cricket player in 12 innings is 25 runs. How many runs must he score in the 13th inning to raise his average to 28?",
            "options": ["56", "60", "64", "68"],
            "correct_index": 2,
            "explanation": "Total runs in 12 innings = 12 × 25 = 300. Required total runs in 13 innings = 13 × 28 = 364. Runs required in 13th inning = 364 - 300 = 64."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Three pipes A, B, and C can fill a cistern in 6 hours. After working together for 2 hours, C is closed and A and B fill the remaining part in 7 hours. In how many hours can C alone fill the cistern?",
            "options": ["12 hours", "14 hours", "16 hours", "18 hours"],
            "correct_index": 1,
            "explanation": "Work done by (A+B+C) in 2 hours = 2/6 = 1/3. Remaining work = 1 - 1/3 = 2/3. (A+B) do 2/3 work in 7 hours, so (A+B) 1 hour work = (2/3) / 7 = 2/21. C's 1 hour work = (A+B+C) rate - (A+B) rate = 1/6 - 2/21 = (7 - 4)/42 = 3/42 = 1/14. C alone fills it in 14 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the slope of the line perpendicular to the line 3x + 4y = 12?",
            "options": ["-3/4", "3/4", "-4/3", "4/3"],
            "correct_index": 3,
            "explanation": "Slope of line 3x + 4y = 12 is m1 = -3/4. The slope of a perpendicular line is m2 = -1 / m1 = -1 / (-3/4) = 4/3."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All caches are memories. Some memories are registers. No register is disk. Conclusions: I. Some memories are not disks. II. Some caches are registers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "The memories that are registers cannot be disks, so some memories are not disks (I follows). Caches and registers have no guaranteed overlap (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight friends—A, B, C, D, E, F, G, and H—are seated around a circular table facing the center. A sits third to the right of B. H sits second to the left of A. C is an immediate neighbor of H. F sits second to the right of C. Who sits opposite B?",
            "options": ["D", "E", "F", "G"],
            "correct_index": 2,
            "explanation": "Arranging 8 seats (1 to 8): B at 1 facing center. A sits 3rd right of B -> A at 4. H sits 2nd left of A -> H at 2. C is neighbor of H -> C can be 3 (since 1 is B). F sits 2nd right of C: if C is 3, 2nd right is seat 5. Seat 5 is exactly opposite seat 1 (B) in an 8-person circle (1 is opposite 5). Thus F sits opposite B."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a girl said: 'He is the only brother of the wife of my father.' How is the man related to the girl?",
            "options": ["Maternal Uncle", "Paternal Uncle", "Father", "Brother"],
            "correct_index": 0,
            "explanation": "Wife of father is mother. Brother of mother is maternal uncle."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 6, 13, 28, 59, ?",
            "options": ["118", "120", "122", "124"],
            "correct_index": 2,
            "explanation": "6 × 2 + 1 = 13; 13 × 2 + 2 = 28; 28 × 2 + 3 = 59; 59 × 2 + 4 = 122."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A desk clock is positioned so that at 12:00 PM its hour hand points North-East. In which direction will the hour hand point at 6:00 PM?",
            "options": ["North-West", "South-East", "South-West", "South"],
            "correct_index": 2,
            "explanation": "At 12:00 PM the hour hand points at 12 (ordinarily North). Since it points North-East, the clock orientation is rotated 45 degrees clockwise. At 6:00 PM, the hour hand points directly opposite 12 (ordinarily South). Rotated 45 degrees clockwise from South is South-West."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'PYTHON' is coded as 'QZUIPO' (each letter +1). What is the code for 'KOTLIN'?",
            "options": ["LPUUJO", "LPUMJO", "LPUKJO", "LPUOKN"],
            "correct_index": 1,
            "explanation": "K(+1)=L, O(+1)=P, T(+1)=U, L(+1)=M, I(+1)=J, N(+1)=O => LPUMJO."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The IT sector must invest heavily in employee upskilling in Generative AI tools.' Assumptions: I. Generative AI tools are disrupting traditional coding and software engineering workflows. II. Upskilled developers demonstrate higher productivity and reduced project turnaround times.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 2,
            "explanation": "The premise for investing in new technology training rests on both the transformative disruption of that technology (I) and the positive business impact of worker proficiency (II)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the grammatically correct inverted sentence:",
            "options": [
                "Seldom the engineering team had experienced such high database latency.",
                "Seldom had the engineering team experienced such high database latency.",
                "Seldom had experienced the engineering team such high database latency.",
                "Seldom the engineering team has experienced such high database latency."
            ],
            "correct_index": 1,
            "explanation": "Negative adverbial openers like 'Seldom', 'Rarely', or 'Scarcely' require subject-auxiliary inversion: 'Seldom had the engineering team experienced...'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the word closest in meaning to 'EQUIVOCAL':",
            "options": ["Clear", "Ambiguous", "Determined", "Unanimous"],
            "correct_index": 1,
            "explanation": "'Equivocal' means open to more than one interpretation; ambiguous."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the antonym of 'SPURIOUS':",
            "options": ["Authentic", "Bogus", "Deceptive", "Counterfeit"],
            "correct_index": 0,
            "explanation": "'Spurious' means false or fake. Its antonym is 'authentic' or 'genuine'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What is the meaning of the idiom 'To cry over spilt milk'?",
            "options": [
                "To mourn an irreversible past mistake or loss pointlessly",
                "To clean up an engineering workspace",
                "To celebrate a close victory",
                "To dispute financial balance sheets"
            ],
            "correct_index": 0,
            "explanation": "'To cry over spilt milk' means to dwell uselessly on something that has already happened and cannot be changed."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person displaying excessive or prejudiced loyalty or support for a particular group or cause'",
            "options": ["Chauvinist", "Egalitarian", "Altruist", "Polyglot"],
            "correct_index": 0,
            "explanation": "A 'Chauvinist' is someone showing aggressive, fanatical, or blind patriotism/partisanship."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the correctly spelled word denoting a temporary cessation of hostility:",
            "options": ["Armistice", "Armestice", "Armistis", "Armestic"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Armistice'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A new release causes an unexpected 30% drop in user checkout completions. The deployment log shows 40 commits across 5 teams. What is the immediate engineering leadership decision?",
            "options": [
                "Leave production as is while spending 3 days bisecting commits on staging.",
                "Execute an immediate production rollback to the previous known stable release, restore checkout conversion rates, and then isolate the regression in staging.",
                "Shut down the checkout page entirely.",
                "Blame the payment vendor."
            ],
            "correct_index": 1,
            "explanation": "In production outages affecting core revenue funnels, standard SRE protocol mandates rolling back first to restore business metrics before debugging."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During sprint review, a client stakeholder aggressively criticizes an API feature because it does not support XML, even though the contract explicitly specified JSON only. How should the team respond?",
            "options": [
                "Argue loudly that XML is an obsolete format and dismiss the client.",
                "Calmly reference the agreed-upon technical specification document, validate their underlying business use case for XML, and offer to scope an XML-JSON adapter as a subsequent change request.",
                "Immediately promise to rewrite the entire backend in XML by tomorrow morning.",
                "Walk out of the meeting."
            ],
            "correct_index": 1,
            "explanation": "Grounding discussions in contracted specifications while empathetically offering scoped future solutions maintains professional trust without scope creep."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A junior engineer spends two weeks refactoring a functioning microservice into a complex design pattern without discussing it with the tech lead or creating a ticket. The PR is 3,000 lines long. How should the tech lead handle this?",
            "options": [
                "Merge the 3,000 lines immediately to reward initiative.",
                "Conduct a kind but direct 1-on-1 to explain why large uncoordinated refactors introduce regression risks, establish that major architectural changes require prior RFC proposals, and review whether smaller modular parts can be safely adopted.",
                "Delete the junior engineer's branch without comment.",
                "Report them to human resources."
            ],
            "correct_index": 1,
            "explanation": "Coaching on team coordination, incremental delivery, and RFC standards channels developer enthusiasm constructively without risking destabilizing massive PRs."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your infrastructure team is transitioning from perimeter-based VPN access to a Zero Trust Network Access (ZTNA) model. What is the core architectural principle that must be enforced?",
            "options": [
                "Trust all network traffic originating from inside the corporate office subnet.",
                "Never trust, always verify: authenticate and authorize every device, user identity, and request context dynamically regardless of network location.",
                "Disable encryption on internal network calls to boost speed.",
                "Give all employees full root access on internal Bastion hosts."
            ],
            "correct_index": 1,
            "explanation": "Zero Trust operates on the principle of 'never trust, always verify', enforcing contextual authentication and least-privilege authorization for every request."
        }
    ]
}

SET_42 = {
    "set_number": 42,
    "title": "Soft Skill Assessment - Set 42",
    "slug": "soft-skill-assessment-set-42",
    "description": "Examines overtaking dynamics, possibility syllogisms, mass-noun grammatical concord, and API lifecycle deprecation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train passes two persons walking in the same direction at 3 km/h and 5 km/h in 10 seconds and 11 seconds respectively. What is the speed of the train?",
            "options": ["22 km/h", "25 km/h", "27 km/h", "30 km/h"],
            "correct_index": 1,
            "explanation": "Let train speed be v km/h and length be L. Relative speeds are (v - 3) and (v - 5) km/h = (v - 3) × (5/18) and (v - 5) × (5/18) m/s. L = (v - 3) × (5/18) × 10 = (v - 5) × (5/18) × 11. 10(v - 3) = 11(v - 5) => 10v - 30 = 11v - 55 => v = 25 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The difference between compound interest and simple interest on ₹12,500 for 1 year at 16% per annum compounded quarterly is:",
            "options": ["₹96.00", "₹120.50", "₹121.25", "₹125.00"],
            "correct_index": 2,
            "explanation": "SI for 1 year = 12500 × 16 / 100 = ₹2,000. For quarterly compounding: rate r = 16% / 4 = 4%, periods n = 4. CI amount = 12500 × (1.04)^4 = 12500 × 1.16985856 = ₹14,623.23. CI = ₹2,123.23. Difference = 2123.23 - 2000 = ₹123.23? Wait, let's calculate (1.04)^4: 1.04^2 = 1.0816. 1.0816^2 = 1.16985856. 12500 × 0.16985856 = 2123.23. With SI = 2000, diff is 123.23? Wait, what about half-yearly: at 8%, (1.08)^2 = 1.1664 => diff is 80. For quarterly, options: ₹121.25 is when rate is 16%? Let's check 12500 × [(1.04)^4 - 1 - 0.16] = 12500 × [0.00985856] = 123.23."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two vessels A and B contain milk and water in the ratios 7 : 5 and 17 : 7 respectively. In what ratio should quantities from A and B be mixed so that the new mixture has milk and water in the ratio 3 : 1?",
            "options": ["1 : 2", "2 : 1", "2 : 3", "3 : 2"],
            "correct_index": 0,
            "explanation": "Fraction of milk in A = 7/12. In B = 17/24. In desired mixture = 3/4 = 18/24. Using alligation: (17/24 - 18/24) wait: 17/24 < 18/24, but 7/12 = 14/24 < 18/24? If both are less than 3/4, a mixture can never reach 3/4! Let's check: 7/12 = 0.583, 17/24 = 0.708. 3/1 is 75% = 0.75. Since both are less than 75%, 3:1 is impossible. Let's fix ratio to 2 : 1 (which is 66.7%). Fraction = 2/3 = 16/24. (17/24 - 16/24) : (16/24 - 14/24) = 1 : 2!"
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A batsman has a certain average of runs for 16 innings. In the 17th inning, he scores 85 runs thereby increasing his average by 3 runs. What is his average after the 17th inning?",
            "options": ["34", "37", "40", "43"],
            "correct_index": 1,
            "explanation": "Let old average be A. Total runs in 16 innings = 16A. 16A + 85 = 17(A + 3) => 16A + 85 = 17A + 51 => A = 34. New average = A + 3 = 34 + 3 = 37."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The area of a circle inscribed in a square of side 14 cm is (use pi = 22/7):",
            "options": ["144 cm²", "154 cm²", "176 cm²", "196 cm²"],
            "correct_index": 1,
            "explanation": "Diameter of inscribed circle = side of square = 14 cm. Radius r = 7 cm. Area = pi * r^2 = (22/7) * 7 * 7 = 154 cm²."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Find the sum of the roots of the quadratic equation: 3x² - 15x + 11 = 0.",
            "options": ["-5", "5", "11/3", "-11/3"],
            "correct_index": 1,
            "explanation": "For ax² + bx + c = 0, sum of roots = -b / a = -(-15) / 3 = 15 / 3 = 5."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the smallest number which when divided by 8, 12, and 16 leaves remainder 3 in each case?",
            "options": ["45", "48", "51", "54"],
            "correct_index": 2,
            "explanation": "LCM(8, 12, 16) = 48. Smallest number = LCM + remainder = 48 + 3 = 51."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A and B can complete a work in 15 days and 10 days respectively. They started the work together, but B left after 2 days. A completed the remaining work. In how many days was the whole work completed?",
            "options": ["10 days", "12 days", "14 days", "15 days"],
            "correct_index": 1,
            "explanation": "Work in first 2 days = 2 × (1/15 + 1/10) = 2 × (5/30) = 2 × (1/6) = 1/3. Remaining work = 1 - 1/3 = 2/3. Time taken by A for 2/3 work = (2/3) × 15 = 10 days. Total days = 2 + 10 = 12 days."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Some servers are nodes. All nodes are clusters. Conclusions: I. All servers being clusters is a possibility. II. Some clusters are definitely servers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Since some servers are nodes and all nodes are clusters, clusters definitely overlap servers (II follows). There is no negative constraint preventing all servers from being clusters, so it is a valid possibility (I follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people A, B, C, D, E, F, G, and H sit in a row facing North. A sits fourth to the right of B. Neither A nor B sits at an extreme end. C sits second to the left of A. D sits to the immediate right of C. How many people sit between B and D?",
            "options": ["1", "2", "3", "4"],
            "correct_index": 0,
            "explanation": "8 seats (1 to 8). Neither A nor B at ends. A is 4th right of B (indices B + 4 = A). Possible pairs: (2, 6) or (3, 7). If B is 2, A is 6. C sits 2nd left of A => C is at 4. D sits immediate right of C => D is at 5. People between B (seat 2) and D (seat 5) are seats 3 and 4 (2 people). Wait, what if B is at 3, A is at 7? Then C is at 5, D is at 6. People between B (3) and D (6) are 4 and 5 (2 people). In both cases, exactly 2 people sit between B and D! Let's set options: ['1', '2', '3', '4'] with correct_index 1."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'CENTRAL' is coded as 'BCMSRZK', how is 'SEMINAR' coded in that cipher?",
            "options": ["RDLLMZQ", "RDLKMZQ", "RDLKLZQ", "RDLLNZQ"],
            "correct_index": 0,
            "explanation": "Alternating pattern or letter shift: C(-1)=B, E(-2)=C, N(-1)=M, T(-1)=S, R(+1)... let's inspect: C->B (-1), E->C (-2), N->M (-1). Let's use simple -1 shift: S(-1)=R, E(-1)=D, M(-1)=L, I(-1)=H, N(-1)=M, A(-1)=Z, R(-1)=Q => RDLHMZQ."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "A man walks 5 km East, turns right and walks 4 km, turns right again and walks 5 km. How far is he from his starting point?",
            "options": ["3 km", "4 km", "5 km", "9 km"],
            "correct_index": 1,
            "explanation": "East 5 km, South 4 km, West 5 km. The horizontal displacements cancel (5 - 5 = 0). The vertical displacement is 4 km South. He is 4 km away."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the mother of B. B is the sister of C. D is the son of C. E is the brother of D. How is A related to E?",
            "options": ["Mother", "Grandmother", "Aunt", "Sister"],
            "correct_index": 1,
            "explanation": "E is the son of C. C is the child of A. Therefore, A is the grandmother of E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the protocol that does not belong with the others in the following networking group: BGP, OSPF, EIGRP, HTTP",
            "options": ["BGP", "OSPF", "EIGRP", "HTTP"],
            "correct_index": 3,
            "explanation": "BGP, OSPF, and EIGRP are dynamic routing protocols operating at the Network layer (Layer 3), whereas HTTP is an application layer protocol (Layer 7)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The government has imposed a 30% tariff on imported semiconductors.' Conclusions: I. Domestic semiconductor fabrication units will see increased commercial demand. II. The cost of consumer electronic devices will rise in the near term.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Tariffs make imported components more expensive, driving buyers toward domestic substitutes (I follows) while simultaneously increasing end-product manufacturing costs in the short run (II follows)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the grammatical error: 'The team lead provided (A) / several valuable advices (B) / regarding system scalability (C) / during the sprint retrospective. (D)'",
            "options": ["(A)", "(B)", "(C)", "(D)"],
            "correct_index": 1,
            "explanation": "'Advice' is an uncountable noun and does not have a plural form 'advices'. The correct phrasing is 'several pieces of valuable advice'. Error is in (B)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'INEFFABLE':",
            "options": ["Indescribable", "Definable", "Eloquent", "Articulate"],
            "correct_index": 0,
            "explanation": "'Ineffable' means too great or extreme to be expressed or described in words."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'PARSIMONIOUS':",
            "options": ["Frugal", "Stingy", "Generous", "Miserly"],
            "correct_index": 2,
            "explanation": "'Parsimonious' means unwilling to spend money or use resources; stingy. Its antonym is 'generous' or 'extravagant'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'Once in a blue moon' mean?",
            "options": [
                "During a lunar eclipse",
                "Extremely rarely",
                "On a recurring monthly cycle",
                "Under difficult atmospheric conditions"
            ],
            "correct_index": 1,
            "explanation": "'Once in a blue moon' is an idiom meaning very rarely or infrequently."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the one-word substitution for: 'A person of wide-ranging knowledge or learning across multiple distinct disciplines'",
            "options": ["Polymath", "Specialist", "Novice", "Pedant"],
            "correct_index": 0,
            "explanation": "A 'Polymath' is a person whose expertise spans a significant number of different subject areas."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Fill in the blank with the appropriate preposition: 'The newly deployed microservice is compatible ______ all legacy v1 REST clients.'",
            "options": ["to", "with", "for", "against"],
            "correct_index": 1,
            "explanation": "The adjective 'compatible' correctly takes the preposition 'with'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company is sunsetting v1 of a core customer REST API in favor of v2. 15% of enterprise customers are still sending traffic to v1 two weeks before scheduled shutdown. What is the proper lifecycle management approach?",
            "options": [
                "Shut down v1 immediately with zero notice to force customers to migrate.",
                "Send proactive targeted notifications to the remaining 15% with tailored migration guides, inject HTTP Sunset headers and deprecation warnings in v1 responses, and offer a short grace period with dedicated integration office hours.",
                "Leave v1 running forever without security patches.",
                "Rewrite the customer's codebase for them."
            ],
            "correct_index": 1,
            "explanation": "Sunset headers, targeted developer outreach, and structured transition support maintain enterprise trust while completing API retirement."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "Following a move to full-time remote work, team sprint velocity drops by 20% and team members complain of feeling isolated. What should the engineering manager do?",
            "options": [
                "Install keystroke tracking software on all laptops.",
                "Establish optional virtual coffee catchups, streamline async documentation, protect focus time with 'no-meeting' blocks, and conduct a blameless retrospective to identify remote collaboration pain points.",
                "Demand everyone return to the office on Saturdays.",
                "Cancel all sprint retrospectives."
            ],
            "correct_index": 1,
            "explanation": "Improving asynchronous collaboration processes, protecting developer focus time, and creating informal connection spaces restores remote productivity."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A bug bounty submission points out that an internal administrative microservice endpoint is accessible without an authentication header when called directly via IP instead of via the API gateway domain. What is the urgent remediation?",
            "options": [
                "Change the server IP address and close the ticket.",
                "Enforce mutual TLS (mTLS) or network security group firewalls so backend services accept requests strictly from the API gateway ingress, validate auth tokens service-side, and award the bounty.",
                "Delete the administrative service.",
                "Tell the researcher that internal IPs do not matter."
            ],
            "correct_index": 1,
            "explanation": "Defense-in-depth requires network firewalls, mTLS, and zero-trust service-level token validation to eliminate direct IP bypass attacks."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "During an unexpected traffic surge, your application pool exhausts all available MySQL database connections, causing cascading 503 errors. What database connection pattern resolves this bottleneck sustainably?",
            "options": [
                "Increase max_connections in MySQL to 1,000,000.",
                "Implement a dedicated connection pooler (e.g., ProxySQL / AWS RDS Proxy) to multiplex short-lived client queries over a persistent pool of server connections.",
                "Restart the database every 10 minutes.",
                "Disable transactions across all queries."
            ],
            "correct_index": 1,
            "explanation": "Connection pool multiplexers multiplex high volumes of concurrent client connections into a manageable pool of database threads, preventing memory exhaustion."
        }
    ]
}

# Fix SET_42 questions 2, 3, 10, 11
SET_42["questions"][1]["question_text"] = "Find the simple interest on ₹12,500 for 3 years at 8% per annum."
SET_42["questions"][1]["options"] = ["₹2,500", "₹3,000", "₹3,200", "₹3,500"]
SET_42["questions"][1]["correct_index"] = 1
SET_42["questions"][1]["explanation"] = "SI = (P × R × T) / 100 = (12,500 × 8 × 3) / 100 = 125 × 24 = ₹3,000."

SET_42["questions"][2]["question_text"] = "Two vessels A and B contain milk and water in the ratios 7 : 5 and 17 : 7 respectively. In what ratio should quantities from A and B be mixed so that the new mixture has milk and water in the ratio 2 : 1?"
SET_42["questions"][2]["options"] = ["1 : 2", "2 : 1", "2 : 3", "3 : 2"]
SET_42["questions"][2]["correct_index"] = 0
SET_42["questions"][2]["explanation"] = "Milk fraction: A = 7/12 = 14/24; B = 17/24. Desired mixture = 2/3 = 16/24. By alligation: (17/24 - 16/24) : (16/24 - 14/24) = 1/24 : 2/24 = 1 : 2."

SET_42["questions"][9]["options"] = ["1", "2", "3", "4"]
SET_42["questions"][9]["correct_index"] = 1

SET_42["questions"][10]["question_text"] = "In a certain code, 'CENTRAL' is coded as 'BDMSQZM' (each letter shifted -1 then +1 alternately: C-1=B, E-1... wait: -1 for all). If each letter is shifted -1: C->B, E->D, N->M, T->S, R->Q, A->Z, L->K. How is 'SEMINAR' coded when each letter is shifted -1?"
SET_42["questions"][10]["options"] = ["RDLHMZQ", "RDLLMZQ", "RDLKMZQ", "RDLHNZQ"]
SET_42["questions"][10]["correct_index"] = 0
SET_42["questions"][10]["explanation"] = "S(-1)=R, E(-1)=D, M(-1)=L, I(-1)=H, N(-1)=M, A(-1)=Z, R(-1)=Q => RDLHMZQ."

SET_43 = {
    "set_number": 43,
    "title": "Soft Skill Assessment - Set 43",
    "slug": "soft-skill-assessment-set-43",
    "description": "Tests work-efficiency wages, modular exponents, misplaced modifier syntax, and data sovereignty compliance.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C are employed to do a piece of work for ₹5,290. A and B together are supposed to do 19/23 of the work, and B and C together 8/23 of the work. What should A be paid?",
            "options": ["₹3,150", "₹3,450", "₹3,600", "₹3,750"] ,
            "correct_index": 1,
            "explanation": "Work done by C = 1 - 19/23 = 4/23. Work done by A = 1 - (work by B and C) = 1 - 8/23 = 15/23. A's share = (15 / 23) × ₹5,290 = 15 × 230 = ₹3,450."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A car travels the first 120 km at 60 km/h and the next 120 km at 40 km/h. What is the average speed of the car for the whole journey?",
            "options": ["48 km/h", "50 km/h", "52 km/h", "54 km/h"],
            "correct_index": 0,
            "explanation": "When distances are equal, average speed = (2 × v1 × v2) / (v1 + v2) = (2 × 60 × 40) / (60 + 40) = 4800 / 100 = 48 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of money amounts to ₹9,800 after 5 years and ₹12,005 after 8 years at the same rate of simple interest. Find the rate of interest per annum.",
            "options": ["10%", "12%", "12.5%", "15%"],
            "correct_index": 1,
            "explanation": "SI for 3 years (8 - 5) = 12,005 - 9,800 = ₹2,205. SI for 1 year = 2,205 / 3 = ₹735. SI for 5 years = 5 × 735 = ₹3,675. Principal P = 9,800 - 3,675 = ₹6,125. Rate r = (735 × 100) / 6125 = 73,500 / 6125 = 12%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the unit digit of (7^95 - 3^58)?",
            "options": ["0", "4", "6", "8"],
            "correct_index": 1,
            "explanation": "7^1=7, 7^2=9, 7^3=3, 7^4=1 (period 4). 95 mod 4 = 3 => unit digit of 7^95 is 3. 3^1=3, 3^2=9, 3^3=7, 3^4=1 (period 4). 58 mod 4 = 2 => unit digit of 3^58 is 9. Unit digit of 7^95 - 3^58 = 13 - 9 = 4."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can a team of 4 software engineers and 2 UI designers be selected from 6 software engineers and 4 UI designers?",
            "options": ["60", "75", "90", "120"],
            "correct_index": 2,
            "explanation": "Ways to choose 4 engineers from 6 = 6C4 = 6C2 = (6 × 5) / 2 = 15. Ways to choose 2 designers from 4 = 4C2 = (4 × 3) / 2 = 6. Total combinations = 15 × 6 = 90."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average score of 30 students in Section A is 65, and of 20 students in Section B is 75. What is the combined average score of both sections?",
            "options": ["68", "69", "70", "71"],
            "correct_index": 1,
            "explanation": "Total score = (30 × 65) + (20 × 75) = 1950 + 1500 = 3450. Total students = 50. Combined average = 3450 / 50 = 69."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A solid metallic sphere of radius 6 cm is melted and recast into small solid spheres of radius 1 cm each. How many such small spheres can be made?",
            "options": ["36", "72", "144", "216"],
            "correct_index": 3,
            "explanation": "Number of spheres = Volume of large sphere / Volume of small sphere = (4/3 pi R^3) / (4/3 pi r^3) = (R / r)^3 = (6 / 1)^3 = 216."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A trader marks his goods at such a price that after allowing a cash discount of 12.5%, he still makes a profit of 20%. If the cost price is ₹1,400, find the marked price.",
            "options": ["₹1,800", "₹1,920", "₹1,960", "₹2,000"],
            "correct_index": 1,
            "explanation": "SP = CP × 1.20 = 1400 × 1.20 = ₹1,680. SP = MP × (1 - 0.125) = 0.875 MP. MP = 1680 / 0.875 = ₹1,920."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people live on 8 floors of an apartment numbered 1 (bottom) to 8 (top). Floor 1 is P. R lives on floor 5. S lives immediately above R. T lives on an even floor below R. Q lives on the topmost floor. Who lives on floor 6?",
            "options": ["P", "R", "S", "T"],
            "correct_index": 2,
            "explanation": "R lives on floor 5. S lives immediately above R, which is floor 5 + 1 = floor 6. Thus S lives on floor 6."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All containers are pods. All pods are services. No service is a process. Conclusions: I. No pod is a process. II. Some services are containers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Pods are inside services which never touch processes, so no pod is a process (I follows). Containers are inside services, so some services are containers (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'CLOUD' is coded as 'DMPVE' (+1 to each letter), how is 'STORM' coded?",
            "options": ["TUPSN", "TUQSN", "TVPSN", "TUPRN"],
            "correct_index": 0,
            "explanation": "S(+1)=T, T(+1)=U, O(+1)=P, R(+1)=S, M(+1)=N => TUPSN."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A person walks 15 km North, turns right and walks 8 km. How far and in what direction is the person from the starting point?",
            "options": ["17 km North-East", "17 km North-West", "23 km North-East", "15 km North"],
            "correct_index": 0,
            "explanation": "North 15 km, East 8 km. Distance = sqrt(15^2 + 8^2) = sqrt(225 + 64) = sqrt(289) = 17 km. Direction is North-East."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the brother of B. B is the daughter of C. D is the father of A. How is C related to D?",
            "options": ["Wife", "Sister", "Mother", "Daughter"],
            "correct_index": 0,
            "explanation": "A and B are siblings. D is their father and C is their mother (since B is daughter of C). Therefore C is the wife of D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 3, 12, 27, 48, 75, ?",
            "options": ["96", "108", "112", "120"],
            "correct_index": 1,
            "explanation": "Pattern is 3 × n^2: 3 × 1^2 = 3; 3 × 2^2 = 12; 3 × 3^2 = 27; 3 × 4^2 = 48; 3 × 5^2 = 75; 3 × 6^2 = 3 × 36 = 108."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should all legacy corporate monoliths be decomposed into microservices?' Arguments: I. Yes, microservices enhance deployment autonomy and scalability. II. No, for many smaller applications, microservices introduce excessive distributed system complexity and network overhead.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 2,
            "explanation": "Both arguments represent well-recognized, valid software engineering principles: microservices deliver agility for complex systems (I), but add unnecessary operational overhead to simple domains (II)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the sentence that correctly resolves the misplaced modifier:",
            "options": [
                "Walking into the server room, the blinking rack indicators were noticed by the engineer.",
                "Walking into the server room, the engineer noticed the blinking rack indicators.",
                "The engineer noticed the blinking rack indicators walking into the server room.",
                "Walking into the server room was noticed by the engineer with blinking rack indicators."
            ],
            "correct_index": 1,
            "explanation": "The modifier 'Walking into the server room' must immediately precede the agent performing the action ('the engineer'). Option B correctly pairs the modifier with the subject."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the word closest in meaning to 'SYCOPHANT':",
            "options": ["Flatterer", "Critic", "Leader", "Rebel"],
            "correct_index": 0,
            "explanation": "A 'Sycophant' is a person who acts obsequiously toward someone important in order to gain advantage; a servile flatterer."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the antonym of 'MUNIFICENT':",
            "options": ["Stingy", "Generous", "Benevolent", "Charitable"],
            "correct_index": 0,
            "explanation": "'Munificent' means larger or more generous than is usual or necessary. Its antonym is 'stingy'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'Piece of cake' mean?",
            "options": [
                "A delicious dessert",
                "Something very easy to accomplish",
                "A small financial reward",
                "A challenging problem"
            ],
            "correct_index": 1,
            "explanation": "'Piece of cake' colloquially signifies something that is exceptionally simple or straightforward."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'Having or showing an extreme greed for wealth or material gain'",
            "options": ["Avaricious", "Benevolent", "Altruistic", "Philanthropic"],
            "correct_index": 0,
            "explanation": "'Avaricious' means having or showing an extreme greed for wealth or material gain."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a standard of judgment or evaluation:",
            "options": ["Criterion", "Criterian", "Critereon", "Creterion"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Criterion'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An EU regulatory audit reveals that your global analytics service is streaming telemetry containing European customer IP addresses to US-based log servers without Standard Contractual Clauses (SCCs). What is the compliance priority?",
            "options": [
                "Ignore the audit and wait for a fine.",
                "Implement geo-fencing in your ingestion pipeline to store EU telemetry within Frankfurt/Dublin regions, apply IP anonymization at the edge, and execute updated SCC data-transfer agreements.",
                "Delete all European customer accounts.",
                "Change company headquarters to international waters."
            ],
            "correct_index": 1,
            "explanation": "Regional data-residency enforcement, edge IP anonymization, and valid SCC legal frameworks guarantee GDPR cross-border data transfer compliance."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A worker node in your Kubernetes production cluster experiences hardware failure. Kubernetes restarts pods on healthy nodes, but several long-running batch jobs lose their state. What pattern prevents this?",
            "options": [
                "Never restart worker nodes.",
                "Implement job checkpointing and state persistence to object storage or Redis so jobs can resume from the last saved checkpoint upon rescheduling.",
                "Assign only 1 job per cluster.",
                "Ban Kubernetes."
            ],
            "correct_index": 1,
            "explanation": "Checkpointing state enables fault-tolerant job resumption on new compute instances following node failures."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an ongoing sprint, three stakeholders ask developers directly in private chats to add 'tiny tweaks'. By mid-sprint, team velocity is halved. How does the Scrum Master intervene?",
            "options": [
                "Ban developers from checking private messages permanently.",
                "Remind stakeholders and developers in the retrospective that all scope changes must flow through the Product Owner and sprint backlog, protecting sprint commitments from informal scope creep.",
                "Add 2 weeks to every sprint.",
                "Quit the project."
            ],
            "correct_index": 1,
            "explanation": "Enforcing formal backlog intake via the Product Owner protects engineering sprint capacity from disruptive informal requests."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your core payment processing microservice has accumulated significant technical debt, with 80% test flakiness and zero modular separation. However, business demands a new BNPL (Buy Now Pay Later) payment provider integration. How should engineering plan this?",
            "options": [
                "Hack the new provider directly into the spaghetti codebase.",
                "Apply the Strangler Fig pattern: abstract the payment interface cleanly, implement the new BNPL integration using the clean interface, and progressively migrate existing payment methods behind the new abstraction.",
                "Halt all company development for 1 year for a complete rewrite.",
                "Refuse to support BNPL."
            ],
            "correct_index": 1,
            "explanation": "The Strangler Fig pattern allows teams to deliver new business capabilities cleanly while systematically replacing legacy monolithic spaghetti code without full-stop rewrites."
        }
    ]
}

SET_44 = {
    "set_number": 44,
    "title": "Soft Skill Assessment - Set 44",
    "slug": "soft-skill-assessment-set-44",
    "description": "Evaluates moving escalator kinetics, alternating syllogism rules, count/mass noun syntax, and frontend bundle leakage prevention.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A man walks down an escalator in 40 seconds. When he runs down at three times his walking speed, he takes 20 seconds. How many seconds would it take him to reach the bottom if the escalator were stationary and he walked down?",
            "options": ["60 seconds", "80 seconds", "100 seconds", "120 seconds"],
            "correct_index": 1,
            "explanation": "Let walking speed be w, running speed = 3w, and escalator speed be e. Total steps S = (w + e) × 40 = (3w + e) × 20. 40w + 40e = 60w + 20e => 20e = 20w => e = w. S = (w + w) × 40 = 80w. Time taken walking down stationary escalator = S / w = 80w / w = 80 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A shopkeeper bought two tables for ₹3,000. He sold one at a loss of 10% and the other at a gain of 10%. Overall, he gained ₹60. What was the cost price of the table sold at a profit?",
            "options": ["₹1,600", "₹1,700", "₹1,800", "₹1,900"],
            "correct_index": 2,
            "explanation": "Let cost of profit table be x and loss table be 3000 - x. Profit/loss = 0.10x - 0.10(3000 - x) = 60 => 0.10x - 300 + 0.10x = 60 => 0.20x = 360 => x = 360 / 0.20 = ₹1,800."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A motorboat takes 2 hours to travel 8 km upstream and 1 hour to travel 8 km downstream. What is the speed of the current?",
            "options": ["1 km/h", "2 km/h", "3 km/h", "4 km/h"],
            "correct_index": 1,
            "explanation": "Upstream speed u = 8 / 2 = 4 km/h. Downstream speed v = 8 / 1 = 8 km/h. Speed of current = (v - u) / 2 = (8 - 4) / 2 = 2 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A and B can do a piece of work in 20 days and 30 days respectively. They started together, but A left 5 days before the completion of the work. In how many total days was the work finished?",
            "options": ["12 days", "14 days", "15 days", "16 days"],
            "correct_index": 2,
            "explanation": "In the last 5 days, only B worked: B did 5 × (1/30) = 5/30 = 1/6 of work. Remaining work done by A and B together = 1 - 1/6 = 5/6. (A+B)'s 1-day work = 1/20 + 1/30 = 5/60 = 1/12. Time taken together = (5/6) / (1/12) = (5/6) × 12 = 10 days. Total days = 10 + 5 = 15 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The population of a town increases by 5% annually. If its present population is 80,000, what will be its population after 2 years?",
            "options": ["88,000", "88,200", "88,400", "89,000"],
            "correct_index": 1,
            "explanation": "Population = 80,000 × (1 + 0.05)^2 = 80,000 × 1.1025 = 88,200."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average temperature for Monday, Tuesday, and Wednesday was 40°C. The average for Tuesday, Wednesday, and Thursday was 41°C. If Thursday's temperature was 42°C, what was Monday's temperature?",
            "options": ["38°C", "39°C", "40°C", "41°C"],
            "correct_index": 1,
            "explanation": "M + T + W = 3 × 40 = 120. T + W + Th = 3 × 41 = 123. Subtracting: Th - M = 123 - 120 = 3. Since Th = 42, 42 - M = 3 => M = 39°C."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In a simultaneous throw of a pair of dice, find the probability of getting a total more than 9.",
            "options": ["1/6", "5/36", "1/4", "7/36"],
            "correct_index": 0,
            "explanation": "Sums more than 9 are 10, 11, 12. Sum 10: (4,6),(5,5),(6,4) -> 3. Sum 11: (5,6),(6,5) -> 2. Sum 12: (6,6) -> 1. Total favorable = 3 + 2 + 1 = 6. Probability = 6 / 36 = 1/6."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 15% of A is equal to 20% of B, what is A : B?",
            "options": ["3 : 4", "4 : 3", "5 : 4", "4 : 5"],
            "correct_index": 1,
            "explanation": "0.15A = 0.20B => A / B = 0.20 / 0.15 = 4 / 3 = 4 : 3."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All gateways are proxies. No proxy is direct. Some directs are tunnels. Conclusions: I. No gateway is direct. II. Some tunnels are not proxies.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Gateways are inside proxies, and proxies never touch direct; thus no gateway is direct (I follows). The tunnels that are direct cannot be proxies, so some tunnels are not proxies (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six people A, B, C, D, E, and F sit in a circle. Three face the center and three face outside. A faces the center. B sits second to the left of A and faces outside. C sits to the immediate right of B. D sits opposite to A and faces outside. Who sits to the immediate left of A?",
            "options": ["C", "E", "F", "B"],
            "correct_index": 0,
            "explanation": "A faces center. Immediate left of A (facing center) is positioned clockwise. If B is second to left of A, C sits between A and B to the immediate right of B. Thus C sits to the immediate left of A."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'RUST' is coded as 'TXUV' (+2 to each letter). How is 'GO' coded?",
            "options": ["IQ", "HQ", "IP", "IR"],
            "correct_index": 0,
            "explanation": "G(+2)=I, O(+2)=Q => IQ."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "P is the father of Q. Q is the brother of R. R is the daughter of S. How is S related to P?",
            "options": ["Wife", "Sister", "Daughter", "Mother"],
            "correct_index": 0,
            "explanation": "Q and R are brother and sister. P is their father. R is daughter of S, meaning S is their mother. Therefore, S is the wife of P."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next number in the series: 2, 6, 12, 20, 30, ?",
            "options": ["36", "40", "42", "44"],
            "correct_index": 2,
            "explanation": "Differences are +4, +6, +8, +10, +12. 30 + 12 = 42 (or n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'A leading telecommunications provider suffered a 4-hour statewide cellular outage due to a corrupted BGP routing table push.' Courses of Action: I. Implement an automated canary validation check on BGP configurations before fleet-wide broadcast. II. Fire the entire network operations team unconditionally.",
            "options": [
                "Only course of action I follows",
                "Only course of action II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Automated canary gates prevent faulty network routing broadcasts from triggering fleet outages (I follows). Mass firings of staff without system improvements do not fix systemic reliability issues (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the odd one out:",
            "options": ["TCP", "UDP", "IP", "SCTP"],
            "correct_index": 2,
            "explanation": "TCP, UDP, and SCTP are Transport Layer (Layer 4) protocols, whereas IP is a Network Layer (Layer 3) protocol."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the correct verb form: 'A number of critical vulnerabilities ______ discovered during the external penetration audit.'",
            "options": ["was", "were", "has been", "is"],
            "correct_index": 1,
            "explanation": "'A number of' takes a plural verb ('were'), whereas 'The number of' takes a singular verb."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the word closest in meaning to 'QUIXOTIC':",
            "options": ["Pragmatic", "Idealistic but impractical", "Rational", "Calculated"],
            "correct_index": 1,
            "explanation": "'Quixotic' means exceedingly idealistic, unrealistic, and impractical."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the antonym of 'ENERVATE':",
            "options": ["Invigorate", "Weaken", "Exhaust", "Fatigue"],
            "correct_index": 0,
            "explanation": "'Enervate' means to cause someone to feel drained of energy. Its antonym is 'invigorate' (give strength or energy to)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To beat around the bush' mean?",
            "options": [
                "To search for something in nature",
                "To avoid addressing the main point directly",
                "To celebrate a victory prematurely",
                "To work late into the evening"
            ],
            "correct_index": 1,
            "explanation": "'To beat around the bush' means to discuss a matter without coming directly to the point, often to avoid uncomfortable topics."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who dislikes, distrusts, or is prejudiced against women'",
            "options": ["Misogynist", "Misanthrope", "Philanthropist", "Monogamist"],
            "correct_index": 0,
            "explanation": "A 'Misogynist' is a person who holds prejudice or contempt toward women."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a false belief or delusion:",
            "options": ["Fallacy", "Falacy", "Fallecy", "Phallacy"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Fallacy'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A developer accidentally builds a production React bundle with a secret AWS admin credential baked into client-side environment variables (`REACT_APP_AWS_SECRET`). The bundle has been live on the CDN for 3 hours. What is the immediate required sequence?",
            "options": [
                "Just publish a new bundle tomorrow and say nothing.",
                "Immediately revoke and rotate the AWS IAM credential in AWS Cloud, invalidate the CDN edge cache across all edge locations, audit CloudTrail logs for unauthorized API activity during the exposure window, and rebuild the bundle with backend proxy endpoints.",
                "Delete the AWS account entirely.",
                "Send an apology email to all customers without rotating keys."
            ],
            "correct_index": 1,
            "explanation": "Rotating exposed credentials immediately, invalidating CDN caches, checking CloudTrail for abuse, and moving secrets to backend proxies eliminates client-bundle leakage risks."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A team member consistently interrupts peers during sprint retrospectives and talks over others. How should the facilitator address this?",
            "options": [
                "Mute their microphone permanently without explanation.",
                "Establish explicit meeting ground rules (e.g., hand-raising, timeboxed speaker turns), politely remind the individual to allow their peer to finish speaking, and hold a private coaching check-in after the session.",
                "Cancel all future retrospectives.",
                "Publicly shame them."
            ],
            "correct_index": 1,
            "explanation": "Enforcing ground rules empathetically in the moment combined with private feedback reinforces an inclusive and psychologically safe team culture."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company decides to introduce an Istio Service Mesh across 50 microservices. Initial staging benchmarks show a 12ms p99 latency overhead on internal RPCs due to sidecar proxy handshakes, which breaks your high-frequency trading API budget. How do you address this?",
            "options": [
                "Abandon the entire project and fire the DevOps architect.",
                "Evaluate ambient mesh architectures (sidecarless eBPF proxies) or selective service mesh bypass for strict latency-sensitive trading pathways while keeping the mesh for administrative services.",
                "Ignore the latency increase and push to production.",
                "Double the server CPU."
            ],
            "correct_index": 1,
            "explanation": "Evaluating sidecarless eBPF mesh modes or selective bypass allows engineering teams to meet tight latency budgets while enjoying security mesh benefits."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A company is experiencing rapid growth, and the quarterly release deadline has engineers working 70 hours a week for the last month. Multiple developers show symptoms of severe burnout. What is the leadership imperative?",
            "options": [
                "Promise bonuses if they work 80 hours next week.",
                "Convene with executive leadership to adjust scope or extend deadlines, enforce mandatory downtime, prioritize core deliverables, and reset realistic sustainable sprint capacity.",
                "Threaten to outsource the engineering department.",
                "Hire more people to start tomorrow with no onboarding."
            ],
            "correct_index": 1,
            "explanation": "Sustainable engineering velocity requires leadership to protect human capacity, descope non-critical items, and reset commitments rather than fostering destructive crunch culture."
        }
    ]
}

SET_45 = {
    "set_number": 45,
    "title": "Soft Skill Assessment - Set 45",
    "slug": "soft-skill-assessment-set-45",
    "description": "Examines convergent kinematics, multi-variable coded inequalities, subjunctive conditional mood, and multi-region disaster recovery.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains start at the same time from stations A and B, 300 km apart, and travel towards each other. The train from A travels at 70 km/h and the train from B at 80 km/h. How far from station A will they meet?",
            "options": ["120 km", "140 km", "150 km", "160 km"],
            "correct_index": 1,
            "explanation": "Relative speed = 70 + 80 = 150 km/h. Time to meet = 300 / 150 = 2 hours. Distance from station A = 70 × 2 = 140 km."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A loan of ₹4,200 is to be paid back in two equal annual installments at 10% compound interest per annum. What is the value of each installment?",
            "options": ["₹2,310", "₹2,420", "₹2,500", "₹2,520"],
            "correct_index": 1,
            "explanation": "P = x / (1 + r/100) + x / (1 + r/100)^2 => 4200 = x / 1.1 + x / 1.21 => 4200 = (1.1x + x) / 1.21 => 4200 = 2.1x / 1.21 => x = (4200 × 1.21) / 2.1 = 2000 × 1.21 = ₹2,420."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the remainder when (67^67 + 67) is divided by 68.",
            "options": ["1", "66", "67", "0"],
            "correct_index": 1,
            "explanation": "67 = -1 (mod 68). 67^67 = (-1)^67 = -1 (mod 68). Therefore, (67^67 + 67) = -1 + 67 = 66 (mod 68). The remainder is 66."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average age of 8 men in a committee increases by 2 years when two men aged 21 and 23 years are replaced by two new women. What is the average age of the two new women?",
            "options": ["28 years", "30 years", "32 years", "34 years"],
            "correct_index": 1,
            "explanation": "Total age increase for 8 men = 8 × 2 = 16 years. Sum of ages of replaced men = 21 + 23 = 44 years. Sum of ages of new women = 44 + 16 = 60 years. Average age of new women = 60 / 2 = 30 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "How many 4-letter words (with or without meaning) containing 2 vowels and 2 consonants can be formed from the letters of the word 'UNIVERSAL'?",
            "options": ["1,080", "1,260", "1,440", "1,680"],
            "correct_index": 2,
            "explanation": "Word UNIVERSAL has 9 distinct letters: 4 vowels (U, I, E, A) and 5 consonants (N, V, R, S, L). Number of ways to choose 2 vowels = 4C2 = 6. Number of ways to choose 2 consonants = 5C2 = 10. Once 4 letters are selected, they can be arranged in 4! = 24 ways. Total words = 6 × 10 × 24 = 1,440."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If the circumference of a circular field is 176 meters, what is its radius (use pi = 22/7)?",
            "options": ["24 meters", "28 meters", "32 meters", "35 meters"],
            "correct_index": 1,
            "explanation": "2 * pi * r = 176 => 2 * (22/7) * r = 176 => (44/7) * r = 176 => r = (176 × 7) / 44 = 4 × 7 = 28 meters."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can do a work in 15 days and B in 20 days. If they work on it together for 4 days, what fraction of the work is left?",
            "options": ["7/15", "8/15", "1/2", "3/5"],
            "correct_index": 1,
            "explanation": "(A+B)'s 1-day work = 1/15 + 1/20 = (4+3)/60 = 7/60. In 4 days, work done = 4 × (7/60) = 7/15. Fraction of work left = 1 - 7/15 = 8/15."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is 20% of 25% of 300?",
            "options": ["12", "15", "18", "20"],
            "correct_index": 1,
            "explanation": "0.20 × 0.25 × 300 = 0.05 × 300 = 15."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people A, B, C, D, E, F, G, and H sit in two parallel rows facing each other: Row 1 faces South (A, B, C, D) and Row 2 faces North (E, F, G, H). A sits opposite G. B sits in the middle. E sits to the immediate left of G. Who sits opposite E?",
            "options": ["A", "B", "C", "Cannot be determined without additional constraints"],
            "correct_index": 3,
            "explanation": "In 4-person parallel rows, middle positions are positions 2 and 3. Without specifying the exact end seat of G or A, the occupant opposite E cannot be determined uniquely."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All pods are instances. Some instances are nodes. All nodes are hosts. Conclusions: I. Some hosts are instances. II. Some pods are nodes.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Instances overlap nodes and all nodes are hosts, meaning hosts definitely overlap instances (I follows). Pods and nodes have no guaranteed overlap (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'DOCKER' is coded as 'EPDLFS' (+1 to each letter). How is 'K8S' conceptually related in letter coding if 'POD' is coded as 'QPE'?",
            "options": ["QPE", "RPE", "QOE", "QPF"],
            "correct_index": 0,
            "explanation": "P(+1)=Q, O(+1)=P, D(+1)=E => QPE."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man in a photograph, a woman says: 'His mother's only son is my husband.' How is the woman related to the man?",
            "options": ["Wife", "Sister", "Mother", "Daughter"],
            "correct_index": 0,
            "explanation": "The man's mother's only son is the man himself. Since he is the woman's husband, the woman is his wife."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: P >= Q = R > S; S >= T. Which of the following is definitively FALSE?",
            "options": ["P > S", "Q > T", "R > T", "S > P"],
            "correct_index": 3,
            "explanation": "Since P >= Q = R > S, P is strictly greater than S (P > S). Therefore, S > P is definitively false."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 1, 4, 9, 16, 25, 36, ?",
            "options": ["42", "48", "49", "54"],
            "correct_index": 2,
            "explanation": "Terms are perfect squares: 1^2, 2^2, 3^2, 4^2, 5^2, 6^2, 7^2 = 49."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'All high-severity security patches must be applied to production clusters within 48 hours of release.' Assumptions: I. 48 hours provides sufficient time for staging validation. II. Zero-day exploits often materialize rapidly after vulnerability disclosure.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 2,
            "explanation": "The strict 48-hour SLA assumes both operational feasibility (I) and an acute threat window necessitating fast patch cadence (II)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence expressing a contrary-to-fact wish:",
            "options": [
                "I wish the system was more resilient to network latency.",
                "I wish the system were more resilient to network latency.",
                "I wish the system is more resilient to network latency.",
                "I wish the system will be more resilient to network latency."
            ],
            "correct_index": 1,
            "explanation": "In formal standard English, contrary-to-fact wishes take the past subjunctive 'were': 'I wish the system were...'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'VERACIOUS':",
            "options": ["Truthful", "Voracious", "Deceitful", "Greedy"],
            "correct_index": 0,
            "explanation": "'Veracious' means speaking or representing the truth; truthful."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'INSIPID':",
            "options": ["Bland", "Dull", "Vibrant", "Tasteless"],
            "correct_index": 2,
            "explanation": "'Insipid' means lacking flavor, vigor, or interest. Its antonym is 'vibrant' or 'flavorful'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To hit the nail on the head' mean?",
            "options": [
                "To do manual carpentry work",
                "To describe exactly what is causing a situation or problem",
                "To injure oneself accidentally",
                "To make a wild guess"
            ],
            "correct_index": 1,
            "explanation": "'To hit the nail on the head' means to state an exact truth or identify a core issue precisely."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Reorder the sentence components into a coherent statement: (P) across multiple availability zones / (Q) automated cross-region replication / (R) guarantees zero data loss / (S) during primary datacenter failure",
            "options": ["Q-R-S-P", "P-Q-R-S", "R-S-Q-P", "Q-P-R-S"],
            "correct_index": 0,
            "explanation": "'Automated cross-region replication (Q) guarantees zero data loss (R) during primary datacenter failure (S) across multiple availability zones (P)' forms a clear, professional technical sentence."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the one-word substitution for: 'A connoisseur or lover of good food and fine drink'",
            "options": ["Epicure", "Ascetic", "Glutton", "Stoic"],
            "correct_index": 0,
            "explanation": "An 'Epicure' is a person who takes particular pleasure in fine food and drink."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A major cloud provider suffers a complete regional blackout in us-east-1. Your secondary standby region in eu-central-1 has hot replicas ready, but DNS failover requires a manual DNS record switch. What is the textbook disaster recovery procedure?",
            "options": [
                "Wait for us-east-1 to come back up eventually.",
                "Execute the documented multi-region failover runbook: promote the secondary database to primary, update global DNS/traffic routing policies, notify users via statuspage, and begin monitoring failover latency.",
                "Delete the eu-central-1 cluster.",
                "Turn off statuspage so users don't see the outage."
            ],
            "correct_index": 1,
            "explanation": "Executing standardized disaster recovery runbooks to promote replicas and route global traffic restores business operations swiftly during regional cloud provider blackouts."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During an outage post-mortem meeting, an engineering manager repeatedly points fingers at an individual junior engineer who pushed the broken config. How should the meeting lead intervene?",
            "options": [
                "Fire the junior engineer immediately.",
                "Pivot the post-mortem to a blameless posture: emphasize that human mistakes are symptoms of insufficient guardrails, and focus on why the automated validation and CI linting pipelines failed to catch the invalid config before deployment.",
                "End the meeting and cancel all future post-mortems.",
                "Let the manager continue yelling."
            ],
            "correct_index": 1,
            "explanation": "Blameless post-mortems focus on systemic improvements and guardrail automation rather than individual blame, cultivating psychological safety and durable reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your organization wants to introduce Zero Trust Network Access (ZTNA) without causing disruption to 5,000 employees working remotely. What is the ideal rollout phase?",
            "options": [
                "Switch everyone overnight without testing.",
                "Pilot ZTNA with an internal IT/engineering cohort, collect telemetry and performance feedback, publish self-service onboarding guides, and migrate business units in phased waves with parallel VPN fallback.",
                "Tell employees they can only work from physical company offices.",
                "Disable all corporate firewalls."
            ],
            "correct_index": 1,
            "explanation": "Phased canary rollouts with internal pilot cohorts and temporary fallback channels ensure smooth enterprise infrastructure transitions."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "An external contractor submits code containing an unverified third-party cryptographic library that is not in the enterprise approved software catalogue. What is the mandatory code review governance step?",
            "options": [
                "Merge it immediately if the unit tests pass.",
                "Block the pull request, submit the cryptographic library to the Security & Legal architecture board for SBOM verification and licensing compliance, and recommend using established corporate crypto primitives.",
                "Change the author name on the commit.",
                "Ignore enterprise security guidelines."
            ],
            "correct_index": 1,
            "explanation": "Software Bill of Materials (SBOM) verification and legal compliance reviews prevent malicious, insecure, or copyleft-infringing dependencies from entering enterprise codebases."
        }
    ]
}

PART_9_SETS = [SET_41, SET_42, SET_43, SET_44, SET_45]
