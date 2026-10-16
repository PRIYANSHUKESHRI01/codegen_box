# Sets 11 to 15 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_11 = {
    "set_number": 11,
    "title": "Soft Skill Assessment - Set 11",
    "slug": "soft-skill-assessment-set-11",
    "description": "Tests commercial arithmetic, algebraic logic, verbal accuracy, and cross-functional team coordination.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C enter into a partnership. A invests ₹6,500 for 6 months, B invests ₹8,400 for 5 months, and C invests ₹10,000 for 3 months. If the total profit is ₹7,400, what is A's share of profit?",
            "options": ["₹1,900", "₹2,100", "₹2,600", "₹2,800"],
            "correct_index": 2,
            "explanation": "Ratio of investments = (6500 × 6) : (8400 × 5) : (10000 × 3) = 39,000 : 42,000 : 30,000 = 39 : 42 : 30 = 13 : 14 : 10. Total parts = 13 + 14 + 10 = 37. A's share = (13/37) × 7,400 = 13 × 200 = ₹2,600."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 15% of (A + B) = 25% of (A - B), what percentage of B is equal to A?",
            "options": ["250%", "300%", "400%", "500%"],
            "correct_index": 2,
            "explanation": "15(A + B) = 25(A - B) => 3(A + B) = 5(A - B) => 3A + 3B = 5A - 5B => 2A = 8B => A = 4B. A as a percentage of B = (A/B) × 100 = 4 × 100 = 400%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 125 m long passes a man, running at 5 km/h in the same direction in which the train is going, in 10 seconds. What is the speed of the train?",
            "options": ["45 km/h", "50 km/h", "54 km/h", "55 km/h"],
            "correct_index": 1,
            "explanation": "Relative speed = 125 m / 10 s = 12.5 m/s = 12.5 × (18/5) = 45 km/h. Since the man is running in the same direction: Relative speed = Train speed - Man speed => 45 = Train speed - 5 => Train speed = 50 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 6 numbers is 30. If the average of the first 4 is 25 and that of the last 3 is 35, what is the fourth number?",
            "options": ["25", "30", "35", "40"],
            "correct_index": 0,
            "explanation": "Sum of all 6 = 6 × 30 = 180. Sum of first 4 = 4 × 25 = 100. Sum of last 3 = 3 × 35 = 105. Fourth number = (100 + 105) - 180 = 205 - 180 = 25."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes can fill a tank in 15 hours and 20 hours respectively, while a third pipe can empty it in 30 hours. If all three pipes are opened together in an empty tank, in how many hours will the tank be full?",
            "options": ["10 hours", "12 hours", "14 hours", "15 hours"],
            "correct_index": 1,
            "explanation": "Net rate = 1/15 + 1/20 - 1/30 = (4 + 3 - 2)/60 = 5/60 = 1/12 tank/hr. The tank fills in 12 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A card is drawn from a well-shuffled pack of 52 cards. What is the probability of getting a queen of club or a king of heart?",
            "options": ["1/52", "1/26", "1/13", "2/13"],
            "correct_index": 1,
            "explanation": "There is exactly 1 queen of clubs and 1 king of hearts in a standard deck. Total favorable cards = 2. Probability = 2/52 = 1/26."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A shopkeeper gives two successive discounts of 20% and 10% on a jacket marked at ₹2,500. What is the final selling price?",
            "options": ["₹1,750", "₹1,800", "₹1,850", "₹1,900"],
            "correct_index": 1,
            "explanation": "Price after 20% discount = 2,500 × 0.80 = ₹2,000. Price after second 10% discount = 2,000 × 0.90 = ₹1,800."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the HCF of 108, 288, and 360?",
            "options": ["18", "24", "36", "48"],
            "correct_index": 2,
            "explanation": "108 = 36 × 3, 288 = 36 × 8, 360 = 36 × 10. The highest common factor is 36."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 8, 14, 26, 50, 98, ?",
            "options": ["192", "194", "196", "198"],
            "correct_index": 1,
            "explanation": "Pattern: multiply by 2 and subtract 2. 8×2-2=14, 14×2-2=26, 26×2-2=50, 50×2-2=98, 98×2-2=194."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'PALE' is coded as '2134' and 'EARTH' is coded as '41590', how is 'PEARL' coded in that system?",
            "options": ["24153", "25413", "29530", "24135"],
            "correct_index": 0,
            "explanation": "Direct substitution: P=2, E=4, A=1, R=5, L=3. Assembling PEARL yields 24153."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is B's sister. C is B's mother. D is C's father. E is D's mother. How is A related to D?",
            "options": ["Grandmother", "Granddaughter", "Daughter", "Grandfather"],
            "correct_index": 1,
            "explanation": "C is the mother of A and B. D is C's father. Thus, D is the grandfather of A, meaning A is D's granddaughter."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All stars are moons. All moons are planets. No planet is a comet. Conclusions: I. No star is a comet. II. Some planets are stars.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Stars are inside planets, and no planet is a comet, so no star is a comet (I follows). Since all stars are planets, some planets are stars (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "CLOCK : TIME :: ODOMETER : ?",
            "options": ["Speed", "Distance", "Fuel", "Temperature"],
            "correct_index": 1,
            "explanation": "A clock measures time; an odometer measures distance traveled."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Rohan walks 12 km North, then turns West and walks 5 km. How far is he from his starting point?",
            "options": ["13 km", "15 km", "17 km", "19 km"],
            "correct_index": 0,
            "explanation": "Distance = √(12² + 5²) = √(144 + 25) = √169 = 13 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Gold, Platinum, Diamond, Silver",
            "options": ["Gold", "Platinum", "Diamond", "Silver"],
            "correct_index": 2,
            "explanation": "Gold, Platinum, and Silver are metals; Diamond is an allotrope of carbon (non-metal)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'AUGMENT':",
            "options": ["Decrease", "Increase", "Subdivide", "Isolate"],
            "correct_index": 1,
            "explanation": "'Augment' means to make something greater by adding to it; increase."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'LACONIC':",
            "options": ["Terse", "Brief", "Verbose", "Silent"],
            "correct_index": 2,
            "explanation": "'Laconic' means using very few words. Its direct antonym is 'Verbose' (wordy)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the sentence that correctly applies objective pronoun case following a preposition:",
            "options": [
                "Between you and I, the architecture needs substantial refactoring.",
                "Between you and me, the architecture needs substantial refactoring.",
                "Between you and myself, the architecture needs substantial refactoring.",
                "Between he and I, the architecture needs substantial refactoring."
            ],
            "correct_index": 1,
            "explanation": "Prepositions take objective pronouns ('Between you and me', not 'you and I')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The CEO refused to yield ___ investor pressure to compromise platform security.",
            "options": ["to", "for", "with", "at"],
            "correct_index": 0,
            "explanation": "The verb 'yield' when meaning to surrender or give way is paired with 'to' (yield to pressure)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'barking up the wrong tree' mean?",
            "options": [
                "Pursuing a mistaken line of thought or course of action",
                "Training animals outdoors",
                "Making too much unnecessary noise",
                "Working on forestry projects"
            ],
            "correct_index": 0,
            "explanation": "'Barking up the wrong tree' means pursuing a mistaken line of enquiry or looking in the wrong place."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who hates or distrusts humankind'",
            "options": ["Misanthrope", "Philanthropist", "Misogynist", "Cannibal"],
            "correct_index": 0,
            "explanation": "A 'Misanthrope' is a person who dislikes humankind and avoids human society."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A key client reports that a feature released yesterday is causing latency in their internal dashboard. What is the immediate professional step?",
            "options": [
                "Deny that your release had anything to do with it.",
                "Acknowledge the report promptly, review performance telemetry and logs for anomalies, reproduce the issue, and provide the client with an estimated diagnostic timeline.",
                "Tell the client to upgrade their computer hardware.",
                "Revert the entire deployment without checking what happened."
            ],
            "correct_index": 1,
            "explanation": "Prompt acknowledgment, telemetry verification, and clear communication manage client relationships responsibly."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are leading a sprint planning session and the Product Manager insists on adding 50% more story points than the team's historical velocity. How should you handle this?",
            "options": [
                "Accept the plan and force everyone to work 14 hours a day.",
                "Present historical velocity charts, explain the risk of technical debt and burnout, and collaborate to prioritize the must-have stories within realistic capacity.",
                "Walk out of the sprint planning meeting.",
                "Promise everything knowing your team will fail."
            ],
            "correct_index": 1,
            "explanation": "Velocity data allows engineering leads to push back constructively and focus on high-value prioritization."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You notice that a colleague is feeling overwhelmed due to personal family emergencies. What is the kind and professional action?",
            "options": [
                "Report them to the HR manager as uncommitted.",
                "Offer to cover their critical on-call shifts or tasks temporarily and encourage them to communicate their capacity needs to leadership.",
                "Complain that their emergency is slowing down your velocity.",
                "Ignore their situation completely."
            ],
            "correct_index": 1,
            "explanation": "Peer empathy and temporarily rallying to support teammates during personal crises builds high-trust teams."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an internal security review, you notice that a third-party analytics script embedded in your frontend is tracking user passwords. What should you do?",
            "options": [
                "Wait for the next quarterly planning to mention it.",
                "Immediately raise a critical security incident, deactivate the tracking script, sanitize collected logs, and report to the data protection officer.",
                "Only deactivate it for your own user account.",
                "Ignore it because it's a third-party vendor script."
            ],
            "correct_index": 1,
            "explanation": "Leaking credentials to third parties is a critical data breach that requires immediate deactivation and regulatory escalation."
        }
    ]
}

SET_12 = {
    "set_number": 12,
    "title": "Soft Skill Assessment - Set 12",
    "slug": "soft-skill-assessment-set-12",
    "description": "Evaluates speed-distance dynamics, seating arrangements, vocabulary mastery, and ethical corporate decision making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A motor car finishes a journey in 10 hours, the first half at 21 km/h and the second half at 24 km/h. What is the total distance covered?",
            "options": ["210 km", "224 km", "240 km", "252 km"],
            "correct_index": 1,
            "explanation": "Let half distance be d. d/21 + d/24 = 10 => (8d + 7d)/168 = 10 => 15d = 1680 => d = 112 km. Total distance = 2d = 224 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A sum of ₹12,500 amounts to ₹15,500 in 4 years at the rate of simple interest. What is the rate of interest per annum?",
            "options": ["5%", "6%", "7%", "8%"],
            "correct_index": 1,
            "explanation": "SI = 15,500 - 12,500 = ₹3,000. R = (SI × 100) / (P × T) = (3000 × 100) / (12500 × 4) = 300,000 / 50,000 = 6%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man buys 10 articles for ₹8 and sells 8 articles for ₹10. What is his gain percentage?",
            "options": ["36.25%", "44.5%", "56.25%", "62.5%"],
            "correct_index": 2,
            "explanation": "CP per article = 8/10 = ₹0.80. SP per article = 10/8 = ₹1.25. Profit per article = 1.25 - 0.80 = ₹0.45. Profit % = (0.45 / 0.80) × 100 = 56.25%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In a 100 m race, A covers the distance in 36 seconds and B in 45 seconds. By what distance does A defeat B?",
            "options": ["15 m", "20 m", "25 m", "30 m"],
            "correct_index": 1,
            "explanation": "Distance covered by B in 36 seconds = (100 / 45) × 36 = (20/9) × 36 = 80 m. A defeats B by 100 - 80 = 20 m."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many different ways can the letters of the word 'CORPORATION' be arranged so that the vowels always come together?",
            "options": ["28,800", "50,400", "57,600", "14,400"],
            "correct_index": 1,
            "explanation": "Vowels in CORPORATION: O, O, A, I, O (5 vowels: 3 O's, 1 A, 1 I). Consonants: C, R, P, R, T, N (6 consonants: 2 R's). Treat the 5 vowels as 1 block. Total units = 6 consonants + 1 block = 7 units. Arranging 7 units with 2 R's = 7! / 2! = 5040 / 2 = 2520 ways. Arranging the 5 vowels with 3 O's = 5! / 3! = 120 / 6 = 20 ways. Total arrangements = 2520 × 20 = 50,400."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio of two numbers is 3:4 and their HCF is 4. What is their LCM?",
            "options": ["36", "42", "48", "60"],
            "correct_index": 2,
            "explanation": "Numbers are 3 × 4 = 12 and 4 × 4 = 16. LCM of 12 and 16 = 48."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A tank is filled in 5 hours by three pipes A, B and C. Pipe C is twice as fast as B and B is twice as fast as A. How many hours would pipe A alone take to fill the tank?",
            "options": ["25 hours", "30 hours", "35 hours", "40 hours"],
            "correct_index": 2,
            "explanation": "Let A's rate = x. Then B's rate = 2x, C's rate = 4x. Total rate = x + 2x + 4x = 7x. In 5 hours, work done = 5 × 7x = 35x. Time taken by A alone = 35x / x = 35 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the average of the first 20 natural numbers?",
            "options": ["10", "10.5", "11", "11.5"],
            "correct_index": 1,
            "explanation": "Average of first n natural numbers = (n + 1) / 2 = (20 + 1) / 2 = 10.5."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 2, 6, 12, 20, 30, 42, ?",
            "options": ["52", "54", "56", "58"],
            "correct_index": 2,
            "explanation": "Pattern: n(n + 1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42, 7×8=56."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'RIPPLE' is written as '613382' and 'LIFE' is written as '8192'. How is 'PILLER' written in that code?",
            "options": ["318826", "318862", "618826", "338816"],
            "correct_index": 0,
            "explanation": "Substitution: P=3, I=1, L=8, E=2, R=6. Assembling PILLER gives 318826."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing towards a person, a man said to a woman, 'His mother is the only daughter of your father.' How is the woman related to that person?",
            "options": ["Daughter", "Sister", "Mother", "Aunt"],
            "correct_index": 2,
            "explanation": "'The only daughter of your father' addressed to the woman is the woman herself. So the person's mother is the woman."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight people A, B, C, D, E, F, G, and H sit in two parallel rows facing each other. If row 1 faces South and row 2 faces North, who sits opposite E if E is in the center of row 1?",
            "options": ["The person in the center of row 2", "The leftmost person in row 2", "The rightmost person in row 2", "Cannot be determined"],
            "correct_index": 0,
            "explanation": "In standard parallel row arrangements with 4 per row, a central position faces the corresponding central position directly opposite."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "BREAD : FLOUR :: BRICK : ?",
            "options": ["Clay", "Cement", "Wall", "Kiln"],
            "correct_index": 0,
            "explanation": "Bread is made from flour; brick is made from clay (Product : Primary raw material)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man leaves for his office and walks 5 km North, turns right and walks 3 km, turns right again and walks 5 km. How far is he from his house?",
            "options": ["3 km", "4 km", "5 km", "8 km"],
            "correct_index": 0,
            "explanation": "The 5 km North and 5 km South cancel out, leaving him 3 km East of his house."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Zinc, Iron, Aluminum, Wood",
            "options": ["Zinc", "Iron", "Aluminum", "Wood"],
            "correct_index": 3,
            "explanation": "Zinc, Iron, and Aluminum are metallic elements; Wood is an organic non-metallic material."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'CANDOR':",
            "options": ["Frankness", "Deception", "Reluctance", "Prejudice"],
            "correct_index": 0,
            "explanation": "'Candor' means the quality of being open and honest in expression; frankness."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'DISPARAGE':",
            "options": ["Criticize", "Praise", "Belittle", "Mock"],
            "correct_index": 1,
            "explanation": "'Disparage' means to regard or represent as being of little worth. Its direct antonym is 'Praise'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the incorrect part of the sentence: 'The team of researchers / have discovered / a novel vaccine candidate / for the virus.'",
            "options": ["The team of researchers", "have discovered", "a novel vaccine candidate", "for the virus"],
            "correct_index": 1,
            "explanation": "The subject is 'The team' (singular collective noun), so it requires 'has discovered' instead of 'have discovered'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The manager was completely absorbed ___ reviewing the customer onboarding metrics.",
            "options": ["with", "in", "at", "on"],
            "correct_index": 1,
            "explanation": "'Absorbed in' is the standard English preposition pairing meaning deeply engrossed."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to jump on the bandwagon' mean?",
            "options": [
                "To join a popular trend or activity to gain advantage",
                "To jump off a moving vehicle",
                "To initiate a musical concert",
                "To oppose the majority viewpoint"
            ],
            "correct_index": 0,
            "explanation": "'To jump on the bandwagon' means to join others in doing something that has become fashionable or popular."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'One who possesses many talents and skills'",
            "options": ["Versatile", "Prodigy", "Maverick", "Veteran"],
            "correct_index": 0,
            "explanation": "A person able to adapt or do many different things with great skill is 'Versatile'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are assigned to work with a teammate known for having a difficult, argumentative personality. How should you approach the collaboration?",
            "options": [
                "Refuse to work with them and complain to leadership.",
                "Maintain professional boundaries, establish clear written task handoffs and acceptance criteria, listen actively, and focus entirely on shared project goals.",
                "Argue back aggressively whenever they speak.",
                "Do all the work in secret and submit it without their knowledge."
            ],
            "correct_index": 1,
            "explanation": "Professionalism involves focusing objectively on shared deliverables, clear documentation, and emotional composure regardless of difficult personalities."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An offshore client sends negative feedback regarding your team's velocity during sprint reviews. What is the most effective approach?",
            "options": [
                "Blame time-zone differences and dismiss their concerns.",
                "Schedule a constructive alignment call, walk through velocity bottlenecks transparently, present concrete workflow improvements, and track metrics together.",
                "Send an angry reply defending the team's perfection.",
                "Cancel all future sprint reviews."
            ],
            "correct_index": 1,
            "explanation": "Transparent stakeholder engagement, sharing root-cause analysis, and aligning on mutual metrics builds long-term client trust."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You notice a security door to the company server room is propped open with a chair. What should you do?",
            "options": [
                "Leave it open because the room might be hot.",
                "Remove the prop to secure the door, and report the physical security breach to the workplace facilities team immediately.",
                "Take a photo and post it on social media.",
                "Walk through to inspect server racks."
            ],
            "correct_index": 1,
            "explanation": "Physical security of data centers is critical; securing the door and alerting security upholds fundamental enterprise compliance."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an interview with a high-profile candidate, the candidate speaks disrespectfully about their current employer and coworkers. How should you evaluate this?",
            "options": [
                "Consider it a sign of high passion and hire them immediately.",
                "Note the lack of professionalism and emotional intelligence as a cultural concern, balance it against technical competence, and share in the debrief.",
                "Argue with the candidate during the interview.",
                "Immediately terminate the interview abruptly."
            ],
            "correct_index": 1,
            "explanation": "A pattern of speaking disrespectfully about colleagues indicates low emotional intelligence and potential toxic culture risk."
        }
    ]
}

SET_13 = {
    "set_number": 13,
    "title": "Soft Skill Assessment - Set 13",
    "slug": "soft-skill-assessment-set-13",
    "description": "Tests interest calculations, deductive syllogisms, precision business communication, and cross-team negotiation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹20,000 is lent at 12% per annum simple interest. How much interest is accrued in 2 years and 6 months?",
            "options": ["₹5,000", "₹5,500", "₹6,000", "₹6,500"],
            "correct_index": 2,
            "explanation": "Time = 2.5 years. SI = (20,000 × 12 × 2.5) / 100 = 200 × 30 = ₹6,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The price of an article is first increased by 20% and then decreased by 20%. What is the net change in price?",
            "options": ["No change", "2% decrease", "4% decrease", "4% increase"],
            "correct_index": 2,
            "explanation": "Net change = +20 - 20 - (20 × 20)/100 = -400/100 = -4% (a 4% decrease)."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man takes 5 hours 45 minutes in walking to a certain place and riding back. He would have gained 2 hours by riding both ways. The time he would take to walk both ways is:",
            "options": ["7 hours 45 min", "8 hours 15 min", "8 hours 45 min", "9 hours"],
            "correct_index": 0,
            "explanation": "W + R = 5 hr 45 min. 2R = 5 hr 45 min - 2 hr = 3 hr 45 min. Multiplying first equation by 2: 2W + 2R = 11 hr 30 min. 2W = 11 hr 30 min - 3 hr 45 min = 7 hr 45 min."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio between the length and perimeter of a rectangular plot is 1:3. What is the ratio between the length and breadth of the plot?",
            "options": ["1:2", "2:1", "3:2", "2:3"],
            "correct_index": 1,
            "explanation": "Length / Perimeter = L / 2(L + B) = 1/3 => 3L = 2L + 2B => L = 2B => L/B = 2/1 (2:1)."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A box contains 20 tickets numbered 1 to 20. If a ticket is drawn at random, what is the probability that its number is a multiple of 3 or 5?",
            "options": ["2/5", "9/20", "1/2", "11/20"],
            "correct_index": 1,
            "explanation": "Multiples of 3 in 1..20: {3, 6, 9, 12, 15, 18} (6 numbers). Multiples of 5: {5, 10, 15, 20} (4 numbers). Multiple of both (15): 1 number. Total unique numbers = 6 + 4 - 1 = 9. Probability = 9/20."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 9 engines consume 24 metric tonnes of coal when each is running 8 hours a day, how many tonnes will 8 engines consume if each runs 13 hours a day?",
            "options": ["24 tonnes", "26 tonnes", "28 tonnes", "30 tonnes"],
            "correct_index": 1,
            "explanation": "Rate per engine-hour = 24 / (9 × 8) = 24 / 72 = 1/3 tonne. Consumption of 8 engines running 13 hours = 8 × 13 × (1/3) = 104 / 3 = ... wait, let's check: (E1 × H1)/C1 = (E2 × H2)/C2 => (9 × 8)/24 = (8 × 13)/C2 => 72/24 = 104/C2 => 3 = 104/C2 => C2 = 34.66. Let's make the numbers cleaner: If 6 engines consume 30 tonnes running 10 hours a day, consumption per engine-hour = 30/(60) = 0.5 tonnes. Then 8 engines running 8 hours consume 8 × 8 × 0.5 = 32 tonnes."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two numbers are in the ratio 3:5. If their LCM is 75, what is their sum?",
            "options": ["30", "40", "50", "60"],
            "correct_index": 1,
            "explanation": "Let numbers be 3x and 5x. Since 3 and 5 are coprime, LCM = 15x = 75 => x = 5. The numbers are 15 and 25. Their sum = 15 + 25 = 40."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the simple interest on ₹6,000 for 9 months at 8% per annum.",
            "options": ["₹340", "₹360", "₹380", "₹400"],
            "correct_index": 1,
            "explanation": "Time = 9/12 = 3/4 year. SI = (6000 × 8 × 3) / (100 × 4) = 60 × 6 = ₹360."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term: 15, 20, 30, 45, 65, ?",
            "options": ["85", "90", "95", "100"],
            "correct_index": 1,
            "explanation": "Differences: +5, +10, +15, +20, +25. Next number = 65 + 25 = 90."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'DELHI' is coded as 'EDMGI', how is 'MUMBAI' coded?",
            "options": ["NVNCBI", "NVNCBJ", "NTMCBJ", "NVLCBJ"],
            "correct_index": 1,
            "explanation": "Pattern: +1, -1, +1, -1, +1, -1... M(+1)→N, U(-1)→T, M(+1)→N, B(-1)→A, A(+1)→B, I(-1)→H. Wait, let's examine D(+1)=E, E(-1)=D, L(+1)=M, H(-1)=G, I(+1)=J. For MUMBAI with +1/-1 alternating: M(+1)=N, U(-1)=T, M(+1)=N, B(-1)=A, A(+1)=B, I(-1)=H => NTNABH. Let's make coding standard: In a certain code, 'ROAD' is written as 'URDG' (+3 each). How is 'SWAN' written? S(19)+3=V, W(23)+3=Z, A(1)+3=D, N(14)+3=Q => VZDQ."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the mother of B. C is the son of A. D is the brother of E. E is the daughter of B. How is D related to B?",
            "options": ["Son", "Daughter", "Brother", "Father"],
            "correct_index": 0,
            "explanation": "E is the daughter of B. D is the brother of E. Therefore, D is the son of B."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All apples are fruits. No fruit is vegetable. All vegetables are green. Conclusions: I. No apple is vegetable. II. Some green are vegetables.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Apples are inside fruits, and no fruit is vegetable, so no apple is vegetable (I follows). All vegetables are green, so some green are vegetables (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "SURGEON : SCALPEL :: SCULPTOR : ?",
            "options": ["Chisel", "Brush", "Canvas", "Palette"],
            "correct_index": 0,
            "explanation": "A surgeon uses a scalpel; a sculptor uses a chisel (Professional : Primary carving/cutting tool)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Facing North, Varun walks 20 m. He turns left and walks 40 m. He turns left again and walks 20 m. How far is he from his original position?",
            "options": ["20 m", "30 m", "40 m", "50 m"],
            "correct_index": 2,
            "explanation": "North 20 m and South 20 m cancel out. He is 40 m West of his starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 64, 81, 100, 121, 132",
            "options": ["81", "100", "121", "132"],
            "correct_index": 3,
            "explanation": "64=8², 81=9², 100=10², 121=11². 132 is not a perfect square."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'PRUDENT':",
            "options": ["Wise", "Reckless", "Foolish", "Impulsive"],
            "correct_index": 0,
            "explanation": "'Prudent' means acting with or showing care and thought for the future; wise."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'COMPLACENT':",
            "options": ["Content", "Unsatisfied", "Smug", "Pleased"],
            "correct_index": 1,
            "explanation": "'Complacent' means showing smug or uncritical satisfaction with oneself. Its direct antonym is 'Unsatisfied' (or ambitious)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the sentence that properly uses a possessive pronoun before a gerund:",
            "options": [
                "He insisted on me attending the meeting.",
                "He insisted on my attending the meeting.",
                "He insisted at my attending the meeting.",
                "He insisted for me to attend the meeting."
            ],
            "correct_index": 1,
            "explanation": "Gerunds ('attending') are preceded by possessive pronouns ('my attending')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The team was surprised to find that the new policy was detrimental ___ developer productivity.",
            "options": ["to", "for", "against", "with"],
            "correct_index": 0,
            "explanation": "'Detrimental to' is the standard prepositional idiom."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to burn bridges' mean?",
            "options": [
                "To demolish civil infrastructure",
                "To destroy relationships or options permanently so that one cannot return",
                "To celebrate an engineering milestone",
                "To avoid crossing a river"
            ],
            "correct_index": 1,
            "explanation": "'To burn bridges' means to take action that permanently severs relationships or prevents returning to a previous state."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'An excessive fear of enclosed or confined spaces'",
            "options": ["Claustrophobia", "Agoraphobia", "Acrophobia", "Hydrophobia"],
            "correct_index": 0,
            "explanation": "'Claustrophobia' is the extreme or irrational fear of confined places."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You notice that an open-source tool recently approved by your team has switched its license to a restrictive commercial terms-of-service model. What should you do?",
            "options": [
                "Continue using it and hope legal never finds out.",
                "Immediately alert the engineering manager and legal team, audit current usage, and plan an orderly migration to a fully permissive open-source alternative.",
                "Delete all company code repositories.",
                "Ignore licensing because code is just code."
            ],
            "correct_index": 1,
            "explanation": "Open-source license compliance protects the company from severe intellectual property litigation and requires proactive legal audit."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A team member consistently interrupts others during technical discussions. How can the meeting facilitator best handle this?",
            "options": [
                "Mute them abruptly and refuse to let them speak again.",
                "Intervene calmly: 'Thanks for sharing, let's make sure we hear the rest of Maya's thought before we move to your point.'",
                "Shout at them to be quiet.",
                "End the meeting immediately."
            ],
            "correct_index": 1,
            "explanation": "A gentle, firm verbal steering restores conversational equity without unnecessary friction or embarrassment."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are asked to deliver a project status update to senior leadership in 5 minutes. How should you structure your update?",
            "options": [
                "Read through every line of code committed this week.",
                "Start with the bottom line (on-track/delayed), highlight major customer milestones achieved, state current blockers requiring executive help, and outline next week's focus.",
                "Complain about junior engineers.",
                "Speak for 30 minutes anyway."
            ],
            "correct_index": 1,
            "explanation": "Executive communication demands high-level clarity: bottom-line status, achieved outcomes, blockers, and next steps."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated continuous deployment pipeline fails due to an environmental configuration drift in the staging cluster. How do you resolve this?",
            "options": [
                "Manually SSH into staging and tweak configuration ad-hoc without committing.",
                "Identify the configuration drift, codify the infrastructure changes in Git (Infrastructure as Code), and redeploy through the automated pipeline.",
                "Disable all configuration checks in CI.",
                "Blame the cloud provider."
            ],
            "correct_index": 1,
            "explanation": "Modern DevOps reliability relies on Infrastructure as Code (IaC) to eliminate manual ad-hoc drifts."
        }
    ]
}

# Fix question 6 and 10 of SET_13
SET_13["questions"][5]["question_text"] = "If 6 engines consume 30 metric tonnes of coal running 10 hours a day, how many tonnes will 8 engines consume running 8 hours a day?"
SET_13["questions"][5]["options"] = ["28 tonnes", "30 tonnes", "32 tonnes", "36 tonnes"]
SET_13["questions"][5]["correct_index"] = 2
SET_13["questions"][5]["explanation"] = "Consumption per engine-hour = 30 / (6 × 10) = 30 / 60 = 0.5 tonnes. For 8 engines running 8 hours: 8 × 8 × 0.5 = 32 tonnes."

SET_13["questions"][9]["question_text"] = "In a certain code, 'ROAD' is written as 'URDG'. How is 'SWAN' written in that same pattern?"
SET_13["questions"][9]["options"] = ["VZDQ", "VYDQ", "VZDR", "UZDQ"]
SET_13["questions"][9]["correct_index"] = 0
SET_13["questions"][9]["explanation"] = "Each letter is shifted forward by 3: S(19)+3=V, W(23)+3=Z, A(1)+3=D, N(14)+3=Q, giving VZDQ."

SET_14 = {
    "set_number": 14,
    "title": "Soft Skill Assessment - Set 14",
    "slug": "soft-skill-assessment-set-14",
    "description": "Evaluates proportional geometry, analytical direction logic, formal business English, and cross-cultural workplace agility.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The diagonal of a rectangle is 25 cm and its length is 24 cm. What is the area of the rectangle?",
            "options": ["144 cm²", "168 cm²", "180 cm²", "200 cm²"],
            "correct_index": 1,
            "explanation": "Breadth = √(25² - 24²) = √(625 - 576) = √49 = 7 cm. Area = Length × Breadth = 24 × 7 = 168 cm²."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 12 men can do a piece of work in 20 days, how many men will be required to do the same work in 15 days?",
            "options": ["14", "15", "16", "18"],
            "correct_index": 2,
            "explanation": "Total work = 12 × 20 = 240 man-days. Men required for 15 days = 240 / 15 = 16 men."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man covers 60 km at 40 km/h and the next 60 km at 60 km/h. What is his average speed for the entire journey?",
            "options": ["48 km/h", "50 km/h", "52 km/h", "54 km/h"],
            "correct_index": 0,
            "explanation": "For equal distances: Average speed = (2 × 40 × 60) / (40 + 60) = 4800 / 100 = 48 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A milkman mixes 20 litres of water with 80 litres of milk. After selling one-fourth of this mixture, he adds 10 litres of water. What is the current ratio of milk to water?",
            "options": ["2:1", "3:1", "4:1", "5:2"],
            "correct_index": 0,
            "explanation": "Initial: 80 milk, 20 water (total 100). One-fourth (25 L) sold: 20 milk and 5 water removed. Remaining: 60 milk, 15 water. Add 10 water => 60 milk, 25 water... wait: 60:25 = 12:5. Let's adjust numbers: 10 litres of water added to 50 litres of milk. Or let's see: 60 milk and 15 water. If he adds 15 L of water => 60 milk and 30 water => 60:30 = 2:1! Let's say: he adds 15 litres of water."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a group of 7 men and 6 women, 5 persons are to be selected to form a committee so that at least 3 men are there on the committee. In how many ways can it be done?",
            "options": ["656", "720", "756", "812"],
            "correct_index": 2,
            "explanation": "Possibilities: (3 Men, 2 Women) + (4 Men, 1 Woman) + (5 Men, 0 Women). (7C3 × 6C2) + (7C4 × 6C1) + (7C5 × 6C0) = (35 × 15) + (35 × 6) + (21 × 1) = 525 + 210 + 21 = 756 ways."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the cost price of an article which is sold for ₹1,360 at a loss of 15%?",
            "options": ["₹1,500", "₹1,550", "₹1,600", "₹1,650"],
            "correct_index": 2,
            "explanation": "SP = CP × (1 - 0.15) => 1360 = 0.85 × CP => CP = 1360 / 0.85 = ₹1,600."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The sum of ages of 5 children born at intervals of 3 years each is 50 years. What is the age of the youngest child?",
            "options": ["4 years", "6 years", "8 years", "10 years"],
            "correct_index": 0,
            "explanation": "Let ages be x, x+3, x+6, x+9, x+12. Sum = 5x + 30 = 50 => 5x = 20 => x = 4 years."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the simple interest on ₹8,400 at 5% per annum for 3 years.",
            "options": ["₹1,180", "₹1,240", "₹1,260", "₹1,320"],
            "correct_index": 2,
            "explanation": "SI = (8400 × 5 × 3) / 100 = 84 × 15 = ₹1,260."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next letter in the series: A, C, F, J, O, ?",
            "options": ["T", "U", "V", "W"],
            "correct_index": 1,
            "explanation": "Letter jumps: A(+2)→C, C(+3)→F, F(+4)→J, J(+5)→O, O(+6)→U (alphabetical index 15 + 6 = 21, which is U)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'BEAT' is written as 'YVZG', how is 'MILD' written in the same code?",
            "options": ["NROW", "NOWR", "ONWR", "NRWO"],
            "correct_index": 0,
            "explanation": "Opposite letters in the alphabet (pairs sum to 27): B(2)↔Y(25), E(5)↔V(22), A(1)↔Z(26), T(20)↔G(7). For MILD: M↔N, I↔R, L↔O, D↔W, yielding NROW."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If X is the brother of the son of Y's son, how is X related to Y?",
            "options": ["Son", "Brother", "Grandson", "Cousin"],
            "correct_index": 2,
            "explanation": "Y's son's son is Y's grandson. The brother of Y's grandson is also Y's grandson."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six persons P, Q, R, S, T, and U sit in two rows of three each. Q is second to the left of U. P is neighbor of R and is sitting diagonally opposite to T. Who sits opposite to Q?",
            "options": ["P", "R", "S", "T"],
            "correct_index": 0,
            "explanation": "In standard six-person dual-row configurations, P sits directly opposite to Q."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "TAILOR : NEEDLE :: CARPENTER : ?",
            "options": ["Saw", "Paint", "Cloth", "Hammer"],
            "correct_index": 0,
            "explanation": "A tailor cuts and stitches with a needle; a carpenter cuts with a saw."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 1 km to East, then 5 km to South, then 2 km to East, and finally 9 km to North. How far is he from the starting point?",
            "options": ["4 km", "5 km", "6 km", "7 km"],
            "correct_index": 1,
            "explanation": "Total East = 1 + 2 = 3 km. Net North = 9 - 5 = 4 km. Distance = √(3² + 4²) = √(9 + 16) = √25 = 5 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 14, 28, 42, 56, 72",
            "options": ["28", "42", "56", "72"],
            "correct_index": 3,
            "explanation": "14, 28, 42, and 56 are all multiples of 14; 72 is not (72 is not divisible by 14)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'SAGACIOUS':",
            "options": ["Foolish", "Wise", "Ignorant", "Timid"],
            "correct_index": 1,
            "explanation": "'Sagacious' means having or showing keen mental discernment and good judgment; wise."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'AMELIORATE':",
            "options": ["Improve", "Worsen", "Sustain", "Praise"],
            "correct_index": 1,
            "explanation": "'Ameliorate' means to make something bad or unsatisfactory better. Its antonym is 'Worsen'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the sentence demonstrating proper agreement when subjects of differing numbers are joined by 'neither... nor':",
            "options": [
                "Neither he nor his colleagues is attending the seminar.",
                "Neither he nor his colleagues are attending the seminar.",
                "Neither he or his colleagues are attending the seminar.",
                "Neither he nor his colleagues was attending the seminar."
            ],
            "correct_index": 1,
            "explanation": "When compound subjects are connected by 'neither... nor', the verb agrees with the nearer subject ('colleagues' is plural, requiring 'are attending')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The audit team insisted ___ inspecting all financial transaction logs.",
            "options": ["on", "in", "at", "for"],
            "correct_index": 0,
            "explanation": "The verb 'insist' is always followed by the preposition 'on' (insisted on doing something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to play devil's advocate' mean?",
            "options": [
                "To argue an opposing viewpoint for the sake of thorough debate",
                "To engage in malicious behavior",
                "To practice black magic",
                "To support an evil cause"
            ],
            "correct_index": 0,
            "explanation": "'Playing devil's advocate' means presenting a counterargument to test the validity of a proposal or encourage critical thinking."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who renounces a religious or political belief or principle'",
            "options": ["Apostate", "Atheist", "Ascetic", "Agnostic"],
            "correct_index": 0,
            "explanation": "An 'Apostate' is an individual who renounces their religious or political beliefs."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You notice that an AI feature your company is developing produces demonstrably biased output against certain demographics. What is your ethical responsibility?",
            "options": [
                "Deploy it anyway because bias is impossible to eliminate.",
                "Document the bias with concrete evaluation metrics, flag it to the AI governance and product teams, and delay deployment until debiasing benchmarks are met.",
                "Delete the test cases so the model passes evaluation.",
                "Quietly ignore it."
            ],
            "correct_index": 1,
            "explanation": "Responsible AI engineering mandates detecting and mitigating demographic bias before deploying models to production."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A remote team member from another country has poor internet connectivity during a sprint planning call and struggles to hear. How should the team adapt?",
            "options": [
                "Kick them out of the meeting to save time.",
                "Switch to a collaborative shared document (e.g., Notion or Google Docs) to type ideas in real-time, allowing them to participate fully asynchronously.",
                "Cancel sprint planning for everyone.",
                "Make all decisions without their input."
            ],
            "correct_index": 1,
            "explanation": "Inclusive remote teams utilize collaborative text-based documentation to ensure equal participation regardless of connectivity."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "Your company laptop with source code is stolen from your car while traveling. What is the very first step?",
            "options": [
                "Wait a week to see if police find it.",
                "Immediately contact the corporate IT Security Incident Response team to remotely wipe the device and revoke all active tokens.",
                "Buy a new laptop yourself and pretend nothing happened.",
                "Post on social media asking for help."
            ],
            "correct_index": 1,
            "explanation": "Immediate reporting enables security teams to initiate remote device lock/wipe and token revocation to protect corporate assets."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Two teams are engaged in a heated dispute over which service owns user profile authentication. As an architect, how do you resolve this?",
            "options": [
                "Assign ownership to whichever manager shouts the loudest.",
                "Map domain boundaries according to Domain-Driven Design (Bounded Contexts), assess operational blast radius, and document single-source ownership clearly.",
                "Let both teams build competing authentication services.",
                "Tell both teams to stop caring about architecture."
            ],
            "correct_index": 1,
            "explanation": "Domain-Driven Design and clear bounded context mapping resolves architectural ownership disputes objectively."
        }
    ]
}

# Fix question 4 of SET_14
SET_14["questions"][3]["question_text"] = "A milkman mixes 20 litres of water with 80 litres of milk. After selling one-fourth of this mixture, he adds 15 litres of water. What is the current ratio of milk to water?"
SET_14["questions"][3]["options"] = ["2:1", "3:1", "4:1", "5:2"]
SET_14["questions"][3]["correct_index"] = 0
SET_14["questions"][3]["explanation"] = "Initial mixture: 80 L milk, 20 L water (total 100 L). One-fourth (25 L) sold: removes 20 L milk and 5 L water, leaving 60 L milk and 15 L water. Adding 15 L water yields 60 L milk and 30 L water. Ratio of milk to water = 60:30 = 2:1."

SET_15 = {
    "set_number": 15,
    "title": "Soft Skill Assessment - Set 15",
    "slug": "soft-skill-assessment-set-15",
    "description": "Comprehensive placement readiness examination evaluating compound arithmetic, deductive reasoning, advanced syntax, and architectural diplomacy.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹16,000 invested at compound interest doubles in 5 years. In how many years will it become ₹64,000 at the same rate?",
            "options": ["10 years", "12 years", "15 years", "20 years"],
            "correct_index": 2,
            "explanation": "₹64,000 is 4 times (2²) ₹16,000. Under compound interest, if an amount doubles in 5 years, it quadruples in 2 × 5 = 10 years? Wait: 16,000 × 4 = 64,000! So 2 × 5 = 10 years! If it is 10 years, let's check: 16k -> 32k (5 yrs) -> 64k (10 yrs). If 8 times (128k), it would be 15 yrs. So for ₹64,000 it is 10 years."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If A:B = 2:3, B:C = 4:5, and C:D = 6:7, find the ratio A:D.",
            "options": ["12:35", "16:35", "18:35", "20:35"],
            "correct_index": 1,
            "explanation": "A/D = (A/B) × (B/C) × (C/D) = (2/3) × (4/5) × (6/7) = (2 × 4 × 2) / (1 × 5 × 7) = 16/35."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat goes 40 km upstream in 8 hours and 36 km downstream in 6 hours. What is the speed of the boat in still water?",
            "options": ["5 km/h", "5.5 km/h", "6 km/h", "6.5 km/h"],
            "correct_index": 1,
            "explanation": "Upstream speed = 40/8 = 5 km/h. Downstream speed = 36/6 = 6 km/h. Speed in still water = (6 + 5)/2 = 5.5 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B can do a piece of work in 12 days; B and C in 15 days; C and A in 20 days. How long would A take alone to finish the work?",
            "options": ["24 days", "30 days", "36 days", "40 days"],
            "correct_index": 1,
            "explanation": "2(A + B + C) = 1/12 + 1/15 + 1/20 = (5 + 4 + 3)/60 = 12/60 = 1/5 => A + B + C = 1/10. A alone = (A + B + C) - (B + C) = 1/10 - 1/15 = (3 - 2)/30 = 1/30. A alone takes 30 days."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can a cricket eleven be chosen out of 14 players if a particular bowler must always be included?",
            "options": ["286", "364", "455", "715"],
            "correct_index": 0,
            "explanation": "Since 1 player is fixed, we need to choose 10 players from the remaining 13 players: 13C10 = 13C3 = (13 × 12 × 11) / (3 × 2 × 1) = 13 × 2 × 11 = 286."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the simple interest on ₹9,600 at 6.25% per annum for 4 years.",
            "options": ["₹2,200", "₹2,400", "₹2,600", "₹2,800"],
            "correct_index": 1,
            "explanation": "6.25% = 1/16. SI = 9600 × (1/16) × 4 = 9600 / 4 = ₹2,400."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two numbers are in the ratio 7:11. If 7 is added to each of the numbers, the ratio becomes 2:3. What is the smaller number?",
            "options": ["35", "42", "49", "56"],
            "correct_index": 2,
            "explanation": "Let numbers be 7x and 11x. (7x + 7) / (11x + 7) = 2/3 => 3(7x + 7) = 2(11x + 7) => 21x + 21 = 22x + 14 => x = 7. Smaller number = 7 × 7 = 49."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the perimeter of a semi-circle of radius 14 cm? (Take π = 22/7)",
            "options": ["44 cm", "58 cm", "72 cm", "88 cm"],
            "correct_index": 2,
            "explanation": "Perimeter of semi-circle = πr + 2r = (22/7 × 14) + (2 × 14) = 44 + 28 = 72 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number: 1, 2, 6, 24, 120, ?",
            "options": ["600", "720", "840", "960"],
            "correct_index": 1,
            "explanation": "Consecutive factorials: 1!=1, 2!=2, 3!=6, 4!=24, 5!=120, 6!=720."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'GOLD' is written as 'HOME' and 'COME' is written as 'DONE'. How is 'SONS' written in that code?",
            "options": ["TOOT", "TONT", "TOOT", "TOOS"],
            "correct_index": 1,
            "explanation": "First letter shifted +1, vowels and letters preserved: S(+1)=T, O->O, N(+1)... wait: G(+1)=H, O=O, L(+1)=M, D(+1)=E. C(+1)=D, O=O, M(+1)=N, E=E. Pattern: First letter +1, second letter stays, third +1, fourth +1. For SONS: S(+1)=T, O stays O, N(+1)=O, S(+1)=T => TOOT. Option 0 = TOOT."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man says to a lady, 'Your father's wife's sister is my aunt.' How is the lady related to the man?",
            "options": ["Sister", "Cousin", "Mother", "Daughter"],
            "correct_index": 1,
            "explanation": "Lady's father's wife = lady's mother. Lady's mother's sister = lady's aunt. If she is also the man's aunt, the lady and the man are cousins (or siblings, but cousin is the standard relation)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All bags are pockets. No pocket is a pouch. Some pouches are cases. Conclusions: I. No bag is a pouch. II. Some cases are pouches.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all bags are pockets and no pocket is a pouch, no bag is a pouch (I follows). Since some pouches are cases, some cases are pouches (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "TREE : FOREST :: SOLDIER : ?",
            "options": ["Gun", "Army", "Battle", "Uniform"],
            "correct_index": 1,
            "explanation": "A tree is a constituent member of a forest; a soldier is a constituent member of an army."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Sunil walks 15 km towards South, then turns right and walks 10 km, then turns right and walks 15 km. In which direction and how far is he from his start?",
            "options": ["10 km West", "10 km East", "15 km North", "5 km South"],
            "correct_index": 0,
            "explanation": "South 15 km and North 15 km cancel out. He is 10 km West of his starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 25, 36, 49, 64, 75",
            "options": ["36", "49", "64", "75"],
            "correct_index": 3,
            "explanation": "25=5², 36=6², 49=7², 64=8². 75 is not a perfect square."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'CEREBRAL':",
            "options": ["Emotional", "Intellectual", "Physical", "Superficial"],
            "correct_index": 1,
            "explanation": "'Cerebral' means relating to the intellect rather than emotions or physical senses; intellectual."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'EPHEMERAL':",
            "options": ["Transient", "Fleeting", "Enduring", "Temporary"],
            "correct_index": 2,
            "explanation": "'Ephemeral' means lasting a very short time. Its direct antonym is 'Enduring' (permanent, lasting)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence that correctly recognizes the grammatical number of the plural noun 'criteria':",
            "options": [
                "The criteria for hiring was strictly enforced.",
                "The criteria for hiring were strictly enforced.",
                "The criterion for hiring were strictly enforced.",
                "The criterias for hiring were strictly enforced."
            ],
            "correct_index": 1,
            "explanation": "'Criteria' is the plural form of 'criterion', requiring the plural verb 'were strictly enforced'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The new compliance guidelines are compliant ___ international standards.",
            "options": ["with", "to", "for", "in"],
            "correct_index": 0,
            "explanation": "The adjective 'compliant' takes the preposition 'with' (compliant with standards)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to take with a grain of salt' mean?",
            "options": [
                "To season food before eating",
                "To accept something with skepticism or reservation",
                "To become extremely angry",
                "To celebrate a victory"
            ],
            "correct_index": 1,
            "explanation": "'To take with a grain of salt' means to maintain skepticism about the complete truth of a statement."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who collects or studies coins, tokens, and paper money'",
            "options": ["Numismatist", "Philatelist", "Cartographer", "Anthropologist"],
            "correct_index": 0,
            "explanation": "A 'Numismatist' is a specialist who collects or studies coins, paper currency, and medals."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A client insists on launching a marketing feature with known performance regressions that could destabilize the core checkout funnel. What should the engineering lead do?",
            "options": [
                "Launch it immediately without protest.",
                "Provide executive leadership with quantified risk telemetry, explain the probable checkout revenue loss, and recommend placing the marketing feature behind a feature flag with traffic throttles.",
                "Delete the marketing code secretly.",
                "Threaten to resign."
            ],
            "correct_index": 1,
            "explanation": "Quantifying business impact and providing a throttled feature flag mitigation reconciles business goals with system reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An engineering colleague privately shares that they feel burned out from three consecutive weeks of on-call fire drills. How can you best support them?",
            "options": [
                "Tell them to toughen up because tech is stressful.",
                "Validate their experience, offer to take over their remaining on-call shift, and partner with the team manager to review automated alert noise reduction.",
                "Post their message in the team Slack channel.",
                "Tell them to quit the job."
            ],
            "correct_index": 1,
            "explanation": "Offering immediate practical shift relief and addressing root causes (alert noise) protects team mental health and platform stability."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are presenting a new architecture to executives and notice they look confused by complex technical jargon. How do you pivot?",
            "options": [
                "Talk faster and use more complex abbreviations.",
                "Pause, apologize for the technical jargon, and reframe the architecture in terms of business impact, cost savings, and customer reliability using intuitive analogies.",
                "Criticize the executives for not understanding technology.",
                "Walk out of the presentation room."
            ],
            "correct_index": 1,
            "explanation": "Exceptional executive presence requires translating complex technical abstractions into clear business value and user outcomes."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated build system randomly fails once every ten runs due to an unknown race condition. How should the team treat this?",
            "options": [
                "Accept that 90% pass rate is good enough.",
                "Treat non-deterministic CI failures as high-priority bugs, isolate the test environment, reproduce the concurrency race, and fix it to maintain CI trust.",
                "Disable all assertions in the build.",
                "Blame GitHub Actions."
            ],
            "correct_index": 1,
            "explanation": "Non-deterministic CI builds erode team confidence; treating race conditions as serious bugs preserves engineering velocity."
        }
    ]
}

# Fix question 1 and 10 of SET_15
SET_15["questions"][0]["options"] = ["8 years", "10 years", "12 years", "15 years"]
SET_15["questions"][0]["correct_index"] = 1
SET_15["questions"][0]["explanation"] = "Under compound interest, the principal doubles in 5 years (2¹ = 2x in 5 yrs). To become ₹64,000, it must become 4 times (2² = 4x) the principal of ₹16,000. Time = 2 × 5 = 10 years."

SET_15["questions"][9]["options"] = ["TOOT", "TONT", "TOOS", "TOUT"]
SET_15["questions"][9]["correct_index"] = 0
SET_15["questions"][9]["explanation"] = "In the pattern: first letter +1 (S→T), second letter preserved (O), third letter +1 (N→O), fourth letter +1 (S→T), resulting in TOOT."

PART_3_SETS = [SET_11, SET_12, SET_13, SET_14, SET_15]
