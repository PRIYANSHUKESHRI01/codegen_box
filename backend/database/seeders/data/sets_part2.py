# Sets 6 to 10 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_6 = {
    "set_number": 6,
    "title": "Soft Skill Assessment - Set 6",
    "slug": "soft-skill-assessment-set-6",
    "description": "Evaluates advanced algorithmic mathematics, deductive reasoning, corporate verbal synthesis, and team sprint velocity management.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man invested ₹50,000 in two mutual funds. One pays 12% annual interest and the other pays 15%. If his total annual return is ₹6,900, how much did he invest at 12%?",
            "options": ["₹18,000", "₹20,000", "₹22,000", "₹25,000"],
            "correct_index": 1,
            "explanation": "Let x be invested at 12%. 0.12x + 0.15(50,000 - x) = 6,900 => 0.12x + 7,500 - 0.15x = 6,900 => -0.03x = -600 => x = ₹20,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If a train traveling at 72 km/h crosses a 200 m long platform in 22 seconds, what is the length of the train?",
            "options": ["220 m", "240 m", "260 m", "280 m"],
            "correct_index": 1,
            "explanation": "Speed = 72 × (5/18) = 20 m/s. Total distance in 22 s = 20 × 22 = 440 m. Train length = 440 - 200 = 240 m."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can do a piece of work in 15 days and B in 20 days. If they work on it together for 4 days, what fraction of the work remains unfinished?",
            "options": ["7/15", "8/15", "1/2", "9/20"],
            "correct_index": 1,
            "explanation": "Work done in 1 day = 1/15 + 1/20 = 7/60. Work done in 4 days = 4 × (7/60) = 28/60 = 7/15. Unfinished fraction = 1 - 7/15 = 8/15."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In a mixture of 60 litres, the ratio of milk and water is 2:1. What quantity of water must be added to make the ratio 1:2?",
            "options": ["40 litres", "50 litres", "60 litres", "70 litres"],
            "correct_index": 2,
            "explanation": "Milk = (2/3) × 60 = 40 litres, Water = 20 litres. To have Milk:Water = 1:2, water needed = 2 × 40 = 80 litres. Additional water = 80 - 20 = 60 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can 5 boys and 4 girls sit in a row so that no two girls are together?",
            "options": ["14,400", "28,800", "43,200", "57,600"],
            "correct_index": 2,
            "explanation": "First seat the 5 boys: 5! = 120 ways. This creates 6 available gaps (__ B1 __ B2 __ B3 __ B4 __ B5 __). Choose 4 gaps for the 4 girls: 6P4 = 6 × 5 × 4 × 3 = 360 ways. Total arrangements = 120 × 360 = 43,200."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The price of sugar drops by 10%. By what percentage can a household increase its sugar consumption without changing expenditure?",
            "options": ["10%", "11.11%", "12.5%", "13.33%"],
            "correct_index": 1,
            "explanation": "Increase % = [r / (100 - r)] × 100 = [10 / 90] × 100 = (1/9) × 100 ≈ 11.11%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Find the compound interest on ₹16,000 for 1.5 years at 10% per annum, compounded half-yearly.",
            "options": ["₹2,422", "₹2,522", "₹2,622", "₹2,722"],
            "correct_index": 1,
            "explanation": "Rate per half year = 5%. Number of half years = 3. Amount = 16,000 × (1.05)³ = 16,000 × 1.157625 = ₹18,522. CI = 18,522 - 16,000 = ₹2,522."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the least number which when divided by 6, 9, 12, and 15 leaves a remainder of 3 in each case?",
            "options": ["177", "180", "183", "186"],
            "correct_index": 2,
            "explanation": "LCM(6, 9, 12, 15) = 180. Required number = LCM + remainder = 180 + 3 = 183."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term: 1, 8, 27, 64, 125, ?",
            "options": ["196", "216", "256", "343"],
            "correct_index": 1,
            "explanation": "Consecutive cubes: 1³=1, 2³=8, 3³=27, 4³=64, 5³=125, 6³=216."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'STABLE' is written as '192012125'. How is 'CABIN' written in that scheme?",
            "options": ["312914", "312915", "311914", "322914"],
            "correct_index": 0,
            "explanation": "Letters are replaced with alphabetical positions: C=3, A=1, B=2, I=9, N=14. The code is 312914."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Deepak is the brother of Ravi. Rekha is the sister of Atul. Ravi is the son of Rekha. How is Deepak related to Rekha?",
            "options": ["Nephew", "Son", "Brother", "Father"],
            "correct_index": 1,
            "explanation": "Since Ravi is Rekha's son, and Deepak is Ravi's brother, Deepak must also be Rekha's son."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six friends A, B, C, D, E, and F sit around a circular table facing the centre. A is opposite to D. B is to the immediate right of A. C is between A and F. Who is opposite to B?",
            "options": ["C", "E", "F", "D"],
            "correct_index": 1,
            "explanation": "Circular order clockwise: A, B, E, D, F, C. A is opposite D. B is opposite E. C is opposite F. Thus, the person opposite B is E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "HORSE : FOAL :: SWAN : ?",
            "options": ["Cub", "Cygnet", "Gosling", "Lamb"],
            "correct_index": 1,
            "explanation": "A young horse is a foal; a young swan is a cygnet."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A boy travels 10 km South, turns left and travels 15 km, turns left again and travels 10 km. How far is he from his starting point?",
            "options": ["10 km", "15 km", "20 km", "25 km"],
            "correct_index": 1,
            "explanation": "The south and north 10 km legs cancel out, leaving him exactly 15 km East of his origin."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Square, Rectangle, Rhombus, Cylinder",
            "options": ["Square", "Rectangle", "Rhombus", "Cylinder"],
            "correct_index": 3,
            "explanation": "Square, Rectangle, and Rhombus are 2D polygons; Cylinder is a 3D geometric solid."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'ARTICULATE':",
            "options": ["Coherent", "Hesitant", "Confusing", "Silent"],
            "correct_index": 0,
            "explanation": "'Articulate' means able to express thoughts and ideas clearly and effectively; closest to 'Coherent'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'RESILIENT':",
            "options": ["Tough", "Fragile", "Flexible", "Hardy"],
            "correct_index": 1,
            "explanation": "'Resilient' means able to recoil or spring back into shape after bending or stretching. Its antonym is 'Fragile'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Which sentence is grammatically correct?",
            "options": [
                "Scarcely had the deployment completed when the alerting system triggered.",
                "Scarcely had the deployment completed than the alerting system triggered.",
                "Scarcely the deployment had completed when the alerting system triggered.",
                "Scarcely did the deployment completed when the alerting system triggered."
            ],
            "correct_index": 0,
            "explanation": "'Scarcely... when' is the correct correlative conjunction pairing with subject-auxiliary inversion (had the deployment completed)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The senior architect did not agree ___ the proposed database sharding strategy.",
            "options": ["to", "with", "on", "for"],
            "correct_index": 1,
            "explanation": "One agrees 'with' a person or viewpoint, and agrees 'to' a formal proposal/demand. Here, agreeing with the proposed strategy represents shared consensus."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to cut corners' mean?",
            "options": [
                "To take a shortcut across an intersection",
                "To do something perfunctorily or cheaply in order to save time or money",
                "To solve a complex problem smartly",
                "To work overtime regularly"
            ],
            "correct_index": 1,
            "explanation": "'To cut corners' means to do something in the easiest, cheapest, or fastest way, often sacrificing quality or safety."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A remedy for all diseases or problems'",
            "options": ["Panacea", "Placebo", "Antibiotic", "Elixir"],
            "correct_index": 0,
            "explanation": "A 'Panacea' is a universal remedy or solution for all diseases or difficulties."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You realize that your team's upcoming feature will store unencrypted user credit card numbers in logs to ease debugging. What should you do?",
            "options": [
                "Ignore it because developer convenience speeds up feature delivery.",
                "Immediately raise a P0 security vulnerability, explain PCI-DSS compliance regulations to the team, and implement log masking before deployment.",
                "Wait until an external auditor catches it next year.",
                "Only log card numbers for non-VIP users."
            ],
            "correct_index": 1,
            "explanation": "Storing unencrypted financial data violates compliance (PCI-DSS) and severely risks customer privacy. Immediate masking and security escalation is non-negotiable."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A teammate repeatedly misses daily standups and fails to reply on Slack during core collaboration hours. How should you address this?",
            "options": [
                "Rant about their absence publicly in the main company watercooler channel.",
                "Check in with them privately in a friendly, supportive manner to see if they are facing personal challenges, while reiterating team communication expectations.",
                "Remove them from the code repository permissions quietly.",
                "Ignore the issue completely until the sprint fails."
            ],
            "correct_index": 1,
            "explanation": "Checking in privately with empathy uncovers root causes while constructively reinforcing team commitments without public humiliation."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are invited to present at a prestigious engineering conference, but the dates conflict with a scheduled sprint release. How should you proceed?",
            "options": [
                "Skip the sprint release without telling anyone.",
                "Discuss the opportunity with your engineering manager in advance, arrange full sprint handoffs, and agree on a plan that safeguards project delivery.",
                "Decline the conference immediately without consulting your manager.",
                "Secretly work remotely from the conference while pretending to be at home."
            ],
            "correct_index": 1,
            "explanation": "Proactive planning and transparent collaboration allow professionals to pursue growth opportunities while ensuring team accountability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During code review, you find an elegant algorithm written by a peer that solves an intractable bottleneck. What is the best way to acknowledge this?",
            "options": [
                "Copy the code into your own file and submit it under your name.",
                "Leave a glowing review praising their creative engineering, approve the PR, and highlight their contribution in the team engineering demo.",
                "Approve silently without giving any positive feedback.",
                "Find minor styling nitpicks to downplay their achievement."
            ],
            "correct_index": 1,
            "explanation": "A strong engineering culture celebrates peer excellence and publicly recognizes outstanding technical achievements."
        }
    ]
}

SET_7 = {
    "set_number": 7,
    "title": "Soft Skill Assessment - Set 7",
    "slug": "soft-skill-assessment-set-7",
    "description": "Tests probability, analytical geometry, logical deductions, nuanced business writing, and client escalation protocols.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A box contains 4 black balls and 6 white balls. If two balls are drawn at random without replacement, what is the probability that both are white?",
            "options": ["1/3", "1/5", "3/10", "4/15"],
            "correct_index": 0,
            "explanation": "Probability of first white = 6/10. Probability of second white = 5/9. Combined = (6/10) × (5/9) = 30/90 = 1/3."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The length of a rectangular field is twice its breadth. If the area of the field is 288 m², what is its perimeter?",
            "options": ["64 m", "72 m", "80 m", "84 m"],
            "correct_index": 1,
            "explanation": "Let breadth = b, length = 2b. Area = 2b² = 288 => b² = 144 => b = 12 m. Length = 24 m. Perimeter = 2(24 + 12) = 2 × 36 = 72 m."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A dealer sells a watch for ₹1,440 and loses 10%. At what price should he sell it to gain 15%?",
            "options": ["₹1,760", "₹1,800", "₹1,840", "₹1,900"],
            "correct_index": 2,
            "explanation": "CP = 1440 / 0.90 = ₹1600. Target SP = 1600 × 1.15 = ₹1,840."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A motorboat takes 6 hours to travel 36 km upstream and 3 hours to travel the same distance downstream. Find the speed of the motorboat in still water.",
            "options": ["7 km/h", "8 km/h", "9 km/h", "10 km/h"],
            "correct_index": 2,
            "explanation": "Upstream speed = 36 / 6 = 6 km/h. Downstream speed = 36 / 3 = 12 km/h. Boat speed in still water = (12 + 6) / 2 = 9 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 7 numbers is 18. If one number is excluded, their average becomes 16. What is the excluded number?",
            "options": ["28", "30", "32", "34"],
            "correct_index": 1,
            "explanation": "Sum of 7 = 7 × 18 = 126. Sum of remaining 6 = 6 × 16 = 96. Excluded number = 126 - 96 = 30."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can 6 people be seated around a circular dining table?",
            "options": ["120", "240", "360", "720"],
            "correct_index": 0,
            "explanation": "Number of circular permutations of n items = (n - 1)!. For 6 people: (6 - 1)! = 5! = 120."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A cistern has two pipes. One can fill it with water in 8 hours and other can empty it in 5 hours. In how many hours will the cistern be emptied if both pipes are opened together when 3/4 of the cistern is already full of water?",
            "options": ["10 hours", "12 hours", "13.33 hours", "15 hours"],
            "correct_index": 0,
            "explanation": "Net emptying rate = 1/5 - 1/8 = 3/40 tank/hr. To empty 3/4 of the tank: Time = (3/4) / (3/40) = (3/4) × (40/3) = 10 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the simple interest on ₹4,800 at 7.5% per annum for 4 years.",
            "options": ["₹1,240", "₹1,360", "₹1,440", "₹1,520"],
            "correct_index": 2,
            "explanation": "SI = (4800 × 7.5 × 4) / 100 = 48 × 30 = ₹1,440."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 7, 10, 16, 25, 37, ?",
            "options": ["50", "52", "54", "56"],
            "correct_index": 1,
            "explanation": "Differences: +3, +6, +9, +12, +15. Next term = 37 + 15 = 52."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'TEACHER' is coded as 'VGCEJGT', how is 'CHILDREN' coded in the same pattern?",
            "options": ["EJKNFTGP", "EJKNFTHP", "EJKNGUGP", "EKJNFTGP"],
            "correct_index": 0,
            "explanation": "Each letter shifted +2: C→E, H→J, I→K, L→N, D→F, R→T, E→G, N→P = EJKNFTGP."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A clock shows 6:30. What is the angle between the hour and minute hands?",
            "options": ["0°", "15°", "20°", "25°"],
            "correct_index": 1,
            "explanation": "At 6:30, minute hand is at 6. Hour hand is at 6 + (30/60) hour = 6.5. Separation = 0.5 × 30° = 15°."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All flowers are trees. No tree is a fruit. Some fruits are roots. Conclusions: I. No flower is a fruit. II. Some roots are not trees.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all flowers are trees and no tree is a fruit, no flower can be a fruit (I follows). Since some roots are fruits and no fruit is a tree, those root-fruits cannot be trees (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "PUPIL : EYE :: COCHLEA : ?",
            "options": ["Heart", "Ear", "Nose", "Brain"],
            "correct_index": 1,
            "explanation": "The pupil is an anatomical structure of the eye; the cochlea is an anatomical structure of the inner ear."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a row of trees, one tree is the 7th from either end of the row. How many trees are in the row?",
            "options": ["11", "12", "13", "14"],
            "correct_index": 2,
            "explanation": "Total trees = 7 + 7 - 1 = 13."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 121, 144, 169, 189, 196",
            "options": ["144", "169", "189", "196"],
            "correct_index": 2,
            "explanation": "121=11², 144=12², 169=13², 196=14². 189 is not a perfect square."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'LUCIDITY':",
            "options": ["Confusion", "Clarity", "Vagueness", "Ambiguity"],
            "correct_index": 1,
            "explanation": "'Lucidity' denotes clarity of expression and intelligibility; closest to 'Clarity'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'FERVENT':",
            "options": ["Ardent", "Passionate", "Apathetic", "Zealous"],
            "correct_index": 2,
            "explanation": "'Fervent' means having or displaying passionate intensity. Its direct antonym is 'Apathetic' (indifferent, uncaring)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the sentence that correctly treats the collective noun 'board of directors':",
            "options": [
                "The board of directors have approved the merger.",
                "The board of directors has approved the merger.",
                "The board of directors are approving the merger.",
                "The board of directors were approved the merger."
            ],
            "correct_index": 1,
            "explanation": "'Board of directors' is treated as a collective noun acting as a single unified entity, requiring the singular verb 'has approved'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The startup founders were accused ___ misappropriating grant funding.",
            "options": ["with", "of", "about", "for"],
            "correct_index": 1,
            "explanation": "The standard preposition paired with 'accuse' is 'of' (accused of doing something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to leave no stone unturned' mean?",
            "options": [
                "To engage in landscaping construction",
                "To try every possible course of action in order to achieve something",
                "To abandon an unsolved investigation",
                "To work without any tools"
            ],
            "correct_index": 1,
            "explanation": "'To leave no stone unturned' means to explore every conceivable avenue or opportunity thoroughly."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who speaks two languages fluently'",
            "options": ["Monoglot", "Bilingual", "Polyglot", "Linguist"],
            "correct_index": 1,
            "explanation": "A person who is able to speak two languages fluently is 'Bilingual'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An enterprise client demands a custom feature that directly violates user data security standards. As the tech lead, how do you respond?",
            "options": [
                "Implement it secretly and ask the client not to mention it.",
                "Respectfully decline the insecure implementation, explain the concrete cybersecurity hazards, and offer an alternative compliant architectural pattern that fulfills their business need.",
                "Yell at the client for not caring about privacy.",
                "Quit the company immediately."
            ],
            "correct_index": 1,
            "explanation": "Consultative technical leadership requires holding firm on security while collaboratively providing an alternative compliant solution."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You observe a senior developer taking credit for a sophisticated cache optimization algorithm designed and coded entirely by an associate developer. What should you do?",
            "options": [
                "Stay silent because hierarchy always matters more than fairness.",
                "In the next sprint review or team demo, publicly thank and attribute the associate developer for authoring the optimization algorithm.",
                "Confront the senior developer angrily in the company cafeteria.",
                "Send an anonymous complaint to the CEO."
            ],
            "correct_index": 1,
            "explanation": "Proactively attributing contributions during team demonstrations restores fair credit positively without destructive conflict."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are given access to production analytics data for an investigation and notice salaries of company executives. What should you do?",
            "options": [
                "Share the salary spreadsheet with your colleagues on WhatsApp.",
                "Immediately close the unrelated data, report the over-permissive data leak to the data governance team, and adhere to strict confidentiality.",
                "Use the numbers to demand an immediate raise.",
                "Post the numbers on Glassdoor."
            ],
            "correct_index": 1,
            "explanation": "Confidentiality and reporting over-permissive access to data governance preserves institutional trust and security compliance."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your software patch inadvertently broke the payment gateway for 15 minutes during peak hours. How should the post-incident review be handled?",
            "options": [
                "Identify which specific engineer pushed the button and penalize them.",
                "Conduct a blameless postmortem focusing on why automated CI/CD guardrails failed to catch the regression, and implement automated canaries.",
                "Sweep the incident under the rug since it was only 15 minutes.",
                "Blame the payment gateway vendor."
            ],
            "correct_index": 1,
            "explanation": "World-class tech organizations practice blameless postmortems to harden systemic automation rather than scapegoating individuals."
        }
    ]
}

SET_8 = {
    "set_number": 8,
    "title": "Soft Skill Assessment - Set 8",
    "slug": "soft-skill-assessment-set-8",
    "description": "Assesses compound growth mathematics, logical analogies, concise professional writing, and agile team diplomacy.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹25,000 invested at compound interest grows to ₹29,160 in 2 years. What is the annual rate of interest?",
            "options": ["6%", "7%", "8%", "9%"],
            "correct_index": 2,
            "explanation": "A = P(1 + r/100)² => 29,160 / 25,000 = (1 + r/100)² => 1.1664 = (1 + r/100)² => 1 + r/100 = 1.08 => r = 8%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 12 copies of a book cost ₹1,800, how much will 28 copies of the same book cost?",
            "options": ["₹3,800", "₹4,000", "₹4,200", "₹4,500"],
            "correct_index": 2,
            "explanation": "Cost per copy = 1,800 / 12 = ₹150. Cost of 28 copies = 28 × 150 = ₹4,200."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains of lengths 140 m and 160 m run on parallel tracks in opposite directions at 40 km/h and 50 km/h respectively. In how many seconds will they completely cross each other?",
            "options": ["10 seconds", "12 seconds", "14 seconds", "16 seconds"],
            "correct_index": 1,
            "explanation": "Total distance = 140 + 160 = 300 m. Relative speed = 40 + 50 = 90 km/h = 90 × (5/18) = 25 m/s. Time = 300 / 25 = 12 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A contractor undertakes to build a road in 40 days and employs 25 men. After 24 days, he finds that only 1/3 of the road is completed. How many extra men must he employ to complete the work on schedule?",
            "options": ["35", "45", "50", "60"],
            "correct_index": 2,
            "explanation": "Total work = 1. Work done in 24 days by 25 men = 1/3 => (25 × 24) / (1/3) = 1800. Remaining work = 2/3. Remaining time = 40 - 24 = 16 days. Let total men be M. (M × 16) / (2/3) = 1800 => 24M = 1800 => M = 75 men. Extra men needed = 75 - 25 = 50 men."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A number when divided by 899 gives a remainder of 63. What will be the remainder when the same number is divided by 29?",
            "options": ["2", "3", "5", "7"],
            "correct_index": 2,
            "explanation": "Since 899 is exactly divisible by 29 (899 = 29 × 31), the remainder when dividing by 29 is simply 63 mod 29 = 5."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Three dice are thrown simultaneously. What is the probability of obtaining a total sum of 16?",
            "options": ["1/36", "5/108", "1/18", "7/216"],
            "correct_index": 0,
            "explanation": "Total outcomes = 6³ = 216. Triplet sums to 16: (6,6,4) with 3 permutations, (6,5,5) with 3 permutations. Total favorable outcomes = 3 + 3 = 6. Probability = 6 / 216 = 1/36."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio between the present ages of A and B is 4:5. Six years hence, their ages will be in the ratio 5:6. What is the present age of B?",
            "options": ["24 years", "28 years", "30 years", "36 years"],
            "correct_index": 2,
            "explanation": "Let ages be 4x and 5x. (4x + 6) / (5x + 6) = 5/6 => 24x + 36 = 25x + 30 => x = 6. B's present age = 5x = 30 years."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A trader marks his goods at 25% above cost and allows a discount of 10% on the marked price. What is his net profit percentage?",
            "options": ["10%", "12.5%", "15%", "17.5%"],
            "correct_index": 1,
            "explanation": "CP = 100. MP = 125. SP = 125 × 0.90 = 112.5. Profit % = 12.5%."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term: 10, 18, 28, 40, 54, 70, ?",
            "options": ["84", "86", "88", "90"],
            "correct_index": 2,
            "explanation": "Differences: +8, +10, +12, +14, +16, +18. Next number = 70 + 18 = 88."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'MONEY' is coded as 'PRQHB', how is 'CREDIT' coded?",
            "options": ["FUHGLL", "FUHGKW", "FUHGJW", "FUIGLW"],
            "correct_index": 1,
            "explanation": "Pattern: M(+3)→P, O(+3)→R, N(+3)→Q, E(+3)→H, Y(+3)→B. Shift each letter in CREDIT by +3: C(3)+3=F(6), R(18)+3=U(21), E(5)+3=H(8), D(4)+3=G(7), I(9)+3=L(12)... wait: C(+3)=F, R(+3)=U, E(+3)=H, D(+3)=G, I(+3)=L, T(+3)=W. Result = FUHGLW. Let's fix option to FUHGLW."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a photograph, a woman says, 'He is the son of the only daughter of the father of my brother.' How is the man in the photograph related to the woman?",
            "options": ["Brother", "Son", "Nephew", "Uncle"],
            "correct_index": 1,
            "explanation": "Father of my brother = my father. The only daughter of my father = myself (the woman). The son of myself = my son."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All buildings are houses. No house is an apartment. All apartments are flats. Which conclusion follows? I. No building is an apartment. II. Some flats are not houses.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all buildings are houses and no house is an apartment, no building can be an apartment (I follows). Since all apartments are flats and no apartment is a house, the flats that are apartments cannot be houses (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "GRAIN : SILO :: WATER : ?",
            "options": ["River", "Reservoir", "Cloud", "Tap"],
            "correct_index": 1,
            "explanation": "Grain is stored in a silo; water is stored in a reservoir."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Starting from point X, a cyclist rides 8 km North, turns left and rides 6 km, then turns left again and rides 8 km. How far and in what direction is he from point X?",
            "options": ["6 km West", "6 km East", "8 km South", "10 km West"],
            "correct_index": 0,
            "explanation": "The North and South legs cancel out. He is 6 km West of point X."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 24, 35, 48, 63, 80",
            "options": ["24", "35", "48", "63"],
            "correct_index": 0,
            "explanation": "35=6²-1, 48=7²-1, 63=8²-1, 80=9²-1. But 24 = 5²-1 is also square-1! Let's check: 24=5²-1, 35=6²-1, 48=7²-1, 63=8²-1, 80=9²-1. All of them are n²-1! Let's replace with: 'Find the odd one out: Paris, Berlin, Madrid, Sydney' where Sydney is not a capital of a country (Canberra is Australia's capital)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'INDOLENT':",
            "options": ["Active", "Lazy", "Energetic", "Skillful"],
            "correct_index": 1,
            "explanation": "'Indolent' means wanting to avoid activity or exertion; lazy."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'AFFLUENT':",
            "options": ["Wealthy", "Poor", "Prosperous", "Abundant"],
            "correct_index": 1,
            "explanation": "'Affluent' means possessing great wealth. Its direct antonym is 'Poor' (or destitute)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank with the correct conditional form: If the team ___ earlier, they would have caught the regression before deployment.",
            "options": ["tested", "had tested", "would test", "would have tested"],
            "correct_index": 1,
            "explanation": "Third conditional (past counterfactual): 'If + past perfect (had tested), ... would have + past participle'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the correct idiom meaning 'to deal with a problem directly and boldly':",
            "options": [
                "Take the bull by the horns",
                "Let sleeping dogs lie",
                "Beat around the bush",
                "Cry over spilled milk"
            ],
            "correct_index": 0,
            "explanation": "'Take the bull by the horns' means to confront a difficult situation directly and decisively."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the word that correctly replaces the phrase: 'The practice of appointing relatives and friends to positions of power regardless of qualifications'",
            "options": ["Autocracy", "Nepotism", "Bureaucracy", "Oligarchy"],
            "correct_index": 1,
            "explanation": "'Nepotism' is the practice among those with power or influence of favoring relatives or friends, especially by giving them jobs."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word:",
            "options": ["Maintenance", "Maintainance", "Maintanence", "Maintenence"],
            "correct_index": 0,
            "explanation": "'Maintenance' is spelled with 'ten' in the middle, not 'tain'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A high-priority client sends an aggressive message on a weekend threatening contract cancellation due to a minor UI styling bug. What is the most appropriate action?",
            "options": [
                "Ignore them until Monday morning.",
                "Send a prompt, courteous acknowledgment assuring them that their message is received, log the issue in the defect tracker, and notify the on-call engineer to review severity.",
                "Reply angrily that weekends are protected personal time.",
                "Issue a full contract refund without management approval."
            ],
            "correct_index": 1,
            "explanation": "Professional client de-escalation balances reassurance and prompt acknowledgment while funneling the defect through official on-call triage."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your direct manager asks you to manipulate test benchmark figures in an executive board presentation to paint an overly optimistic roadmap picture. How do you respond?",
            "options": [
                "Falsify the data as requested without questioning.",
                "Politely decline to misrepresent metrics, provide the authentic data alongside a constructive remediation narrative, and uphold institutional integrity.",
                "Leak the slides to the press.",
                "Delete all the slides and resign."
            ],
            "correct_index": 1,
            "explanation": "Ethical professionals maintain data veracity while offering constructive solutions to bridge gaps rather than compromising integrity."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A new teammate joins your team remotely and feels isolated because most team members already know each other well. What can you do?",
            "options": [
                "Wait for the annual company offsite to talk to them.",
                "Schedule a casual 15-minute virtual coffee chat, introduce them to key cross-functional contacts, and invite them into team discussions.",
                "Tell them to read the documentation quietly.",
                "Assign them all your backlog bugs."
            ],
            "correct_index": 1,
            "explanation": "Proactive remote onboarding and informal social touchpoints accelerate team integration and psychological safety."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Two backend engineers cannot agree on whether to use GraphQL or REST for a new service, resulting in three days of unproductive debate. As tech lead, how do you resolve this?",
            "options": [
                "Flip a coin in front of the team.",
                "Define an objective decision matrix covering client query patterns, caching needs, team familiarity, and delivery timeline, and make an empirical decision.",
                "Cancel the project altogether.",
                "Tell them to write both implementations from scratch."
            ],
            "correct_index": 1,
            "explanation": "An objective weighted decision matrix grounded in concrete technical criteria breaks emotional deadlocks and unblocks project delivery."
        }
    ]
}

# Fix option for SET_8 reasoning question 2 and 7
SET_8["questions"][9]["options"] = ["FUHGLW", "FUHGKW", "FUHGJW", "FUIGLW"]
SET_8["questions"][9]["correct_index"] = 0
SET_8["questions"][9]["explanation"] = "Each letter is shifted forward by 3: C(3)+3=F, R(18)+3=U, E(5)+3=H, D(4)+3=G, I(9)+3=L, T(20)+3=W, yielding FUHGLW."

SET_8["questions"][14]["question_text"] = "Find the odd one out among the following cities: Paris, Berlin, Madrid, Sydney"
SET_8["questions"][14]["options"] = ["Paris", "Berlin", "Madrid", "Sydney"]
SET_8["questions"][14]["correct_index"] = 3
SET_8["questions"][14]["explanation"] = "Paris (France), Berlin (Germany), and Madrid (Spain) are national capital cities; Sydney is not the capital of Australia (Canberra is)."

SET_9 = {
    "set_number": 9,
    "title": "Soft Skill Assessment - Set 9",
    "slug": "soft-skill-assessment-set-9",
    "description": "Evaluates speed-work metrics, syllogistic logic, business vocabulary, and customer-first crisis decision making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can finish a work in 18 days and B can do the same work in half the time taken by A. Then, working together, what part of the same work can they finish in a day?",
            "options": ["1/6", "1/9", "2/9", "1/4"],
            "correct_index": 0,
            "explanation": "A takes 18 days (rate = 1/18). B takes 9 days (rate = 1/9). Combined daily work = 1/18 + 1/9 = 3/18 = 1/6 of the work."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is 35% of 400 plus 45% of 240?",
            "options": ["244", "248", "252", "256"],
            "correct_index": 1,
            "explanation": "35% of 400 = 0.35 × 400 = 140. 45% of 240 = 0.45 × 240 = 108. Total = 140 + 108 = 248."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A wheel makes 1000 revolutions in covering a distance of 88 km. What is the diameter of the wheel?",
            "options": ["14 m", "28 m", "35 m", "56 m"],
            "correct_index": 1,
            "explanation": "Distance per revolution = Circumference = 88,000 m / 1,000 = 88 m. Circumference = π × d => (22/7) × d = 88 => d = (88 × 7) / 22 = 28 m."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes A and B can fill a tank in 20 minutes and 30 minutes respectively. If both pipes are opened together, the time taken to fill the tank is:",
            "options": ["10 min", "12 min", "15 min", "25 min"],
            "correct_index": 1,
            "explanation": "Combined fill rate = 1/20 + 1/30 = 5/60 = 1/12 tank/min. Time = 12 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the angle between the two hands of a clock at 4:20?",
            "options": ["0°", "10°", "15°", "20°"],
            "correct_index": 1,
            "explanation": "Angle = |30H - 5.5M| = |30(4) - 5.5(20)| = |120 - 110| = 10°."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A car covers 300 km in 5 hours. How much distance will it cover in 8 hours at the same speed?",
            "options": ["420 km", "450 km", "480 km", "500 km"],
            "correct_index": 2,
            "explanation": "Speed = 300 / 5 = 60 km/h. Distance in 8 hours = 60 × 8 = 480 km."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "If the radius of a circle is increased by 20%, by what percentage does its area increase?",
            "options": ["40%", "42%", "44%", "48%"],
            "correct_index": 2,
            "explanation": "Area % change = 2r + (r²/100) = 2(20) + (400/100) = 40 + 4 = 44%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the LCM of 24, 36, and 40.",
            "options": ["240", "320", "360", "420"],
            "correct_index": 2,
            "explanation": "24 = 2³ × 3, 36 = 2² × 3², 40 = 2³ × 5. LCM = 2³ × 3² × 5 = 8 × 9 × 5 = 360."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the sequence: 5, 11, 23, 47, 95, ?",
            "options": ["189", "191", "193", "195"],
            "correct_index": 1,
            "explanation": "Pattern: multiply by 2 and add 1. 5×2+1=11, 11×2+1=23, 23×2+1=47, 47×2+1=95, 95×2+1=191."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'MOUSE' is written as 'KPSTC', how is 'LIGHT' written in that code?",
            "options": ["JJEFV", "JGEFR", "JIEFR", "KJEFV"],
            "correct_index": 1,
            "explanation": "Pattern: -2, +1, -2, +1, -2. M(-2)→K, O(+1)→P, U(-2)→S, S(+1)→T, E(-2)→C. Apply to LIGHT: L(-2)→J, I(+1)→J... wait: L(12)-2=J(10), I(9)+1=J(10), G(7)-2=E(5), H(8)+1=I(9)... wait, let's check: JJEIR. Let's make the pattern clean: Each letter shifted -2: L(12)-2=J, I(9)-2=G, G(7)-2=E, H(8)-2=F, T(20)-2=R => JGEFR."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Ravi's mother is the only daughter of Sunita's father. How is Sunita's husband related to Ravi?",
            "options": ["Father", "Uncle", "Brother", "Grandfather"],
            "correct_index": 0,
            "explanation": "The only daughter of Sunita's father is Sunita herself. Therefore, Ravi's mother is Sunita, and Sunita's husband is Ravi's father."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All kings are warriors. Some warriors are soldiers. All soldiers are brave. Conclusions: I. Some brave persons are warriors. II. Some kings are soldiers.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 0,
            "explanation": "Some warriors are soldiers and all soldiers are brave, so those soldier-warriors are brave (I follows). But kings and soldiers have no guaranteed overlap (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "CHEF : RESTAURANT :: ACTOR : ?",
            "options": ["Script", "Stage", "Camera", "Director"],
            "correct_index": 1,
            "explanation": "A chef works in a restaurant; an actor performs on a stage (Profession : Work venue)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 30 m East, turns right and walks 40 m, then turns left and walks 30 m. In which direction is he now from his starting point?",
            "options": ["North-East", "South-East", "North-West", "South-West"],
            "correct_index": 1,
            "explanation": "Horizontal position = 30 East + 30 East = 60 m East. Vertical position = 40 m South. He is South-East of origin."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Radish, Carrot, Potato, Tomato",
            "options": ["Radish", "Carrot", "Potato", "Tomato"],
            "correct_index": 3,
            "explanation": "Radish, Carrot, and Potato grow underground (roots/tubers), while Tomato grows above ground (fruit)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'DILIGENT':",
            "options": ["Hardworking", "Careless", "Lazy", "Slow"],
            "correct_index": 0,
            "explanation": "'Diligent' means showing steady, earnest, and energetic effort; hardworking."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'VIGILANT':",
            "options": ["Watchful", "Careful", "Oblivious", "Alert"],
            "correct_index": 2,
            "explanation": "'Vigilant' means keeping careful watch for possible danger. Its direct antonym is 'Oblivious' (or inattentive)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence with correct parallel structure:",
            "options": [
                "The engineer likes coding, debugging, and to deploy applications.",
                "The engineer likes coding, debugging, and deploying applications.",
                "The engineer likes to code, debugging, and deploying applications.",
                "The engineer likes coding, to debug, and deployment of applications."
            ],
            "correct_index": 1,
            "explanation": "Parallel construction requires grammatically matching forms: all three gerunds ('coding, debugging, and deploying')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The company is committed ___ maintaining zero carbon emissions across data centres.",
            "options": ["for", "to", "at", "in"],
            "correct_index": 1,
            "explanation": "'Committed to' is the standard idiomatic collocation, followed by a gerund ('maintaining')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'once in a blue moon' mean?",
            "options": [
                "Occurring very rarely",
                "Happening every month",
                "Appearing only during astronomical events",
                "Happening on a predictable daily cycle"
            ],
            "correct_index": 0,
            "explanation": "'Once in a blue moon' describes an occurrence that happens very infrequently."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'An official pardon for people who have been convicted of political offenses'",
            "options": ["Amnesty", "Emancipation", "Exemption", "Absolution"],
            "correct_index": 0,
            "explanation": "'Amnesty' is an official pardon granted to individuals, often for political infractions."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You discover that a senior salesperson promised a prospective client an impossible feature delivery within two weeks without consulting engineering. What should you do?",
            "options": [
                "Stay silent and let the deployment fail on the promised date.",
                "Organize an urgent alignment sync between Sales leadership and Engineering, present the realistic architectural timeline, and define an honest, phased delivery plan.",
                "Angrily email the client that the salesperson lied to them.",
                "Work 100 hours a week to try to deliver it regardless of code quality."
            ],
            "correct_index": 1,
            "explanation": "Rapid cross-departmental alignment prevents client trust breakdowns and aligns commercial promises with engineering capacity."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated test suite has 15 flaky tests that fail intermittently without real bugs, slowing down team pull request merges. What is the best engineering course of action?",
            "options": [
                "Delete the tests so they stop bothering the team.",
                "Quarantine the flaky tests, open an urgent tech-debt ticket to investigate concurrency or timing race conditions, and fix them systematically.",
                "Tell developers to just re-run the CI pipeline until it passes by luck.",
                "Disable CI completely."
            ],
            "correct_index": 1,
            "explanation": "Quarantining and fixing flaky tests restores developer confidence in CI while maintaining rigorous test coverage."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "In a client meeting, a client executive asks a direct technical question about database latency that you do not know the answer to. How should you respond?",
            "options": [
                "Make up an impressive sounding statistic.",
                "Transparently state that you do not have the exact metric at hand, but will verify with the infrastructure team and follow up in writing by end of day.",
                "Look down at your phone and pretend not to hear.",
                "Blame your teammate for not preparing the slide."
            ],
            "correct_index": 1,
            "explanation": "Intellectual honesty and committing to a prompt, accurate follow-up commands far greater respect than fabricated answers."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During code review, you notice a teammate has introduced a security antipattern that could allow SQL injection. How do you communicate this?",
            "options": [
                "Publicly mock their code on Twitter.",
                "Leave a clear, supportive comment explaining the vulnerability vector, cite the OWASP guideline, and provide a parameterized query code snippet as a concrete fix.",
                "Approve the PR and wait for a hacker to exploit it.",
                "Complain to the CTO that the developer should be fired."
            ],
            "correct_index": 1,
            "explanation": "Constructive code reviews cite established security standards (like OWASP) and provide clear, secure code examples."
        }
    ]
}

# Fix option for SET_9 reasoning question 2
SET_9["questions"][9]["question_text"] = "If 'CLOCK' is coded as 'BMNBL' with each letter shifted -1: C(3)-1=B, L(12)-1=K... Let's use standard shift: In a certain code, 'SMART' is coded as 'UOC TV' (+2 for each letter: S->U, M->O, A->C, R->T, T->V). How is 'GREAT' coded in that same pattern?"
SET_9["questions"][9]["options"] = ["ITGCV", "ITGDV", "ITGCW", "JTGCV"]
SET_9["questions"][9]["correct_index"] = 0
SET_9["questions"][9]["explanation"] = "Each letter is shifted forward by 2: G(7)+2=I, R(18)+2=T, E(5)+2=G, A(1)+2=C, T(20)+2=V, producing ITGCV."

SET_10 = {
    "set_number": 10,
    "title": "Soft Skill Assessment - Set 10",
    "slug": "soft-skill-assessment-set-10",
    "description": "Milestone assessment evaluating multi-step quantitative analytics, abstract reasoning, executive English, and strategic technical leadership.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹15,000 earns ₹4,965 as compound interest in 3 years at a certain rate of interest per annum, compounded annually. What is the rate of interest?",
            "options": ["8%", "10%", "12%", "15%"],
            "correct_index": 1,
            "explanation": "Amount = 15,000 + 4,965 = ₹19,965. A/P = 19,965 / 15,000 = 1.331. (1 + r/100)³ = 1.331 = (1.1)³. Thus, 1 + r/100 = 1.1 => r = 10%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 8 men can reap 80 hectares of land in 24 days, how many hectares can 36 men reap in 30 days?",
            "options": ["400", "450", "500", "550"],
            "correct_index": 1,
            "explanation": "(M1 × D1) / W1 = (M2 × D2) / W2 => (8 × 24) / 80 = (36 × 30) / W2 => 192 / 80 = 1080 / W2 => 2.4 = 1080 / W2 => W2 = 1080 / 2.4 = 450 hectares."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 300 m long traveling at 90 km/h crosses another train 200 m long traveling in the opposite direction at 54 km/h. How many seconds do they take to cross each other completely?",
            "options": ["10 seconds", "12.5 seconds", "15 seconds", "18 seconds"],
            "correct_index": 1,
            "explanation": "Total distance = 300 + 200 = 500 m. Relative speed = 90 + 54 = 144 km/h = 144 × (5/18) = 40 m/s. Time = 500 / 40 = 12.5 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A vessel contains 80 litres of milk. 8 litres of milk was taken out and replaced by water. This process was repeated further two times. How much milk is now contained by the vessel?",
            "options": ["56.42 litres", "58.32 litres", "60.24 litres", "62.16 litres"],
            "correct_index": 1,
            "explanation": "Remaining milk = Initial × [1 - (x/C)]^n = 80 × [1 - (8/80)]³ = 80 × (0.9)³ = 80 × 0.729 = 58.32 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the probability of getting at least one 6 when two standard dice are rolled together?",
            "options": ["11/36", "1/6", "5/18", "7/36"],
            "correct_index": 0,
            "explanation": "P(no 6 on either die) = (5/6) × (5/6) = 25/36. P(at least one 6) = 1 - 25/36 = 11/36."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The difference between cost price and selling price of an article is ₹240. If the profit is 20%, what is the selling price?",
            "options": ["₹1,200", "₹1,400", "₹1,440", "₹1,500"],
            "correct_index": 2,
            "explanation": "Profit = 20% of CP = 240 => CP = 240 / 0.20 = ₹1,200. SP = CP + Profit = 1200 + 240 = ₹1,440."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average of 5 consecutive odd numbers is 61. What is the difference between the highest and lowest numbers?",
            "options": ["4", "6", "8", "10"],
            "correct_index": 2,
            "explanation": "Five consecutive odd numbers are x, x+2, x+4, x+6, x+8. Difference between highest and lowest is always (x + 8) - x = 8."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A person crosses a 600 m long street in 5 minutes. What is his speed in km/h?",
            "options": ["6.4 km/h", "7.2 km/h", "8.0 km/h", "8.4 km/h"],
            "correct_index": 1,
            "explanation": "Speed in m/s = 600 / (5 × 60) = 600 / 300 = 2 m/s. In km/h: 2 × (18/5) = 36/5 = 7.2 km/h."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 3, 12, 27, 48, 75, 108, ?",
            "options": ["135", "144", "147", "152"],
            "correct_index": 2,
            "explanation": "Pattern is 3 × n²: 3×1²=3, 3×2²=12, 3×3²=27, 3×4²=48, 3×5²=75, 3×6²=108, 3×7²=3×49=147."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'COMPUTER' is written as 'RFUVQNPC'. How is 'MEDICINE' written in that code?",
            "options": ["EOJDJEFM", "EOJDEJFM", "MFEJDJOE", "EOJDJEFN"],
            "correct_index": 0,
            "explanation": "The word's letters are reversed and each letter is shifted forward by 1, except first and last letters are swapped. Or look at MEDICINE: reverse to ENICIDEM, shift interior letters: E -> E, N(+1)=O, I(+1)=J, C(+1)=D, I(+1)=J, D(+1)=E, E(+1)=F, M -> M, giving EOJDJEFM."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a woman, a man said, 'Her father is the only son of my father.' How is the man related to the woman?",
            "options": ["Brother", "Father", "Uncle", "Grandfather"],
            "correct_index": 1,
            "explanation": "'The only son of my father' is the man himself. Since he is her father, the man is her father."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All pens are books. All books are journals. All journals are papers. Which conclusion follows? I. All pens are papers. II. Some papers are pens.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since pens are a subset of books, which are a subset of journals, which are a subset of papers, all pens are papers (I follows). Consequently, some papers are pens (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "NEEDLE : THREAD :: PEN : ?",
            "options": ["Paper", "Ink", "Cap", "Eraser"],
            "correct_index": 1,
            "explanation": "A needle requires thread to function; a pen requires ink to function."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In an exam, Rahul scored higher than Mohan but lower than Sohan. Rohan scored higher than Sohan. Who among them scored the highest?",
            "options": ["Rahul", "Mohan", "Sohan", "Rohan"],
            "correct_index": 3,
            "explanation": "Order: Rohan > Sohan > Rahul > Mohan. Rohan scored the highest."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 35, 49, 63, 77, 85",
            "options": ["49", "63", "77", "85"],
            "correct_index": 3,
            "explanation": "35, 49, 63, and 77 are all divisible by 7; 85 is not."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'TACITURN':",
            "options": ["Talkative", "Reserved", "Friendly", "Lively"],
            "correct_index": 1,
            "explanation": "'Taciturn' means reserved or uncommunicative in speech; saying little."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'PROFICIENT':",
            "options": ["Competent", "Adept", "Incompetent", "Skilled"],
            "correct_index": 2,
            "explanation": "'Proficient' means competent or skilled in doing or using something. Its antonym is 'Incompetent'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence that conforms to standard modern usage of 'data' as a mass noun:",
            "options": [
                "The data shows that user engagement has increased.",
                "The data show that user engagement has increased.",
                "The data are showing that user engagement have increased.",
                "The data were showing that user engagement has increase."
            ],
            "correct_index": 0,
            "explanation": "In standard modern business English, 'data' is widely accepted and used as a mass singular noun taking singular verbs (The data shows...)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Complete the idiom: 'To throw in the ___' means to admit defeat.",
            "options": ["blanket", "towel", "sponge", "curtain"],
            "correct_index": 1,
            "explanation": "'To throw in the towel' is an idiom derived from boxing meaning to surrender or admit defeat."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who is excessively conceited and self-absorbed'",
            "options": ["Narcissist", "Philanthropist", "Altruist", "Polyglot"],
            "correct_index": 0,
            "explanation": "A 'Narcissist' is a person who has an excessive interest in or admiration of themselves."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Fill in the blank: She was surprised ___ the high throughput of the distributed message queue.",
            "options": ["at", "by", "for", "with"],
            "correct_index": 0,
            "explanation": "The standard preposition pairing is 'surprised at' (or 'surprised by'). In formal entrance tests, 'surprised at' is the benchmark answer."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A major production outage is ongoing, and multiple stakeholders are flooding the engineer on-call with panic messages in several Slack channels. What should the engineering lead do?",
            "options": [
                "Tell everyone to leave the company Slack.",
                "Designate an Incident Commander to focus purely on the technical fix, appoint a Communications Lead to post single-source updates every 15 minutes, and protect the responder from distractions.",
                "Shut down the chat server.",
                "Ignore all stakeholders until tomorrow."
            ],
            "correct_index": 1,
            "explanation": "Standard incident management protocols (like PagerDuty/SRE best practices) decouple technical triage from executive stakeholder communications."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You discover that an open-source library used by your application has a severe zero-day security vulnerability. What is the proper sequence of steps?",
            "options": [
                "Ignore it until a security researcher emails you.",
                "Assess exposure, verify if an official patched version exists, test the update in a sandbox staging environment, deploy to production, and monitor.",
                "Rewrite the entire open-source library from scratch overnight.",
                "Uninstall the library and leave the feature broken."
            ],
            "correct_index": 1,
            "explanation": "Systematic vulnerability response involves exposure assessment, controlled sandbox testing of vendor patches, and safe deployment."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A new developer joins your team and asks questions that you consider basic. How do you respond?",
            "options": [
                "Tell them they should know this before getting hired.",
                "Answer patiently, point them toward internal onboarding wiki documentation, and encourage them to continue asking questions as they ramp up.",
                "Forward their questions to management to prove they are unqualified.",
                "Ignore their messages."
            ],
            "correct_index": 1,
            "explanation": "Patient onboarding with reference to documentation builds developer autonomy and fosters psychological safety."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company is shifting from a monolith to microservices, and several senior engineers resist the change due to comfort with legacy tooling. How do you lead through this transition?",
            "options": [
                "Fire all resisting engineers immediately.",
                "Host technical architecture workshops, demonstrate tangible benefits (independent deploys, failure isolation), provide training, and pilot the transition with one non-critical service.",
                "Force the transition silently overnight without documentation.",
                "Abandon the architectural upgrade completely."
            ],
            "correct_index": 1,
            "explanation": "Effective technical leadership drives organizational change through collaborative architecture reviews, hands-on upskilling, and low-risk pilots."
        }
    ]
}

PART_2_SETS = [SET_6, SET_7, SET_8, SET_9, SET_10]
