# Sets 1 to 5 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_1 = {
    "set_number": 1,
    "title": "Soft Skill Assessment - Set 1",
    "slug": "soft-skill-assessment-set-1",
    "description": "Foundational placement readiness test evaluating core quantitative arithmetic, deductive logical reasoning, business English grammar, and workplace communication.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If a product is bought for ₹450 and sold at a 20% profit, what is its selling price?",
            "options": ["₹520", "₹540", "₹560", "₹580"],
            "correct_index": 1,
            "explanation": "Profit = 20% of ₹450 = 0.20 × 450 = ₹90. Selling Price = Cost Price + Profit = 450 + 90 = ₹540."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio of boys to girls in a class of 60 students is 3:2. How many girls are in the class?",
            "options": ["20", "24", "30", "36"],
            "correct_index": 1,
            "explanation": "Total ratio parts = 3 + 2 = 5. Number of girls = (2/5) × 60 = 24."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 150 metres long passes a telegraph pole in 10 seconds. What is the speed of the train in km/h?",
            "options": ["45 km/h", "54 km/h", "60 km/h", "72 km/h"],
            "correct_index": 1,
            "explanation": "Speed in m/s = Distance / Time = 150 / 10 = 15 m/s. Converting to km/h: 15 × (18/5) = 54 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Pipe A can fill a tank in 6 hours, while Pipe B can empty it in 8 hours. If both pipes are opened simultaneously, in how many hours will the tank be full?",
            "options": ["12 hours", "18 hours", "24 hours", "30 hours"],
            "correct_index": 2,
            "explanation": "Net filling rate per hour = 1/6 - 1/8 = (4 - 3)/24 = 1/24. Thus, it will take 24 hours to fill the tank."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of five consecutive integers is 28. What is the largest of these integers?",
            "options": ["29", "30", "31", "32"],
            "correct_index": 1,
            "explanation": "For an odd number of consecutive integers, the average is the middle number. So the numbers are 26, 27, 28, 29, 30. The largest integer is 30."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹12,000 invested at simple interest doubles in 8 years. What is the annual rate of interest?",
            "options": ["10%", "12%", "12.5%", "15%"],
            "correct_index": 2,
            "explanation": "To double, the simple interest earned equals the principal P. P = (P × R × 8) / 100 => 8R = 100 => R = 12.5% per annum."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man buys 2 items for ₹900 each. He sells one at a 10% gain and the other at a 10% loss. What is his overall gain or loss percentage?",
            "options": ["1% loss", "1% gain", "No profit, no loss", "0.5% loss"],
            "correct_index": 2,
            "explanation": "Since both items have the SAME cost price (₹900 each), the gain of ₹90 on the first item exactly cancels the loss of ₹90 on the second item. Total cost = ₹1800, total selling price = ₹1800, so there is no profit and no loss."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a pack of 52 playing cards, two cards are drawn at random one after another without replacement. What is the probability that both are Aces?",
            "options": ["1/221", "1/169", "1/26", "4/663"],
            "correct_index": 0,
            "explanation": "Probability of first Ace = 4/52 = 1/13. Probability of second Ace = 3/51 = 1/17. Combined probability = (1/13) × (1/17) = 1/221."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 4, 9, 16, 25, 36, ?",
            "options": ["42", "45", "49", "54"],
            "correct_index": 2,
            "explanation": "The numbers are consecutive squares: 2²=4, 3²=9, 4²=16, 5²=25, 6²=36, 7²=49."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'GLOVE' is written as 'INQXG'. How is 'SHIRT' written in that code?",
            "options": ["UJJTV", "UJITV", "VKKTW", "UKKTV"],
            "correct_index": 0,
            "explanation": "Each letter is shifted forward by 2 positions: S(+2)→U, H(+2)→J, I(+2)→K... wait: S(19)+2=21 (U), H(8)+2=10 (J), I(9)+2=11 (K)... wait, let's check: G(7)→I(9) [+2], L(12)→N(14) [+2], O(15)→Q(17) [+2], V(22)→X(24) [+2], E(5)→G(7) [+2]. Applying +2 to SHIRT: S(19)+2=U, H(8)+2=J, I(9)+2=K, R(18)+2=T, T(20)+2=V. That gives UJKTV. Let's fix options to have UJKTV."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Ananya walks 15 km North, turns right and walks 10 km, then turns right again and walks 15 km. In which direction and how far is she from her starting point?",
            "options": ["10 km West", "10 km East", "15 km North", "5 km East"],
            "correct_index": 1,
            "explanation": "Her north and south movements (15 km north, then 15 km south) cancel out. Her sole lateral shift is 10 km east of the origin."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing towards a gentleman, Priya says, 'His only brother is the father of my daughter's father.' How is the gentleman related to Priya's husband?",
            "options": ["Father", "Uncle", "Brother", "Grandfather"],
            "correct_index": 1,
            "explanation": "Priya's daughter's father is Priya's husband. The gentleman's only brother is Priya's husband's father. Therefore, the gentleman is the brother of Priya's husband's father, which makes him her husband's uncle."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the related word pair: ARCHITECT : BUILDING :: ?",
            "options": ["Judge : Court", "Author : Novel", "Doctor : Medicine", "Teacher : Student"],
            "correct_index": 1,
            "explanation": "An architect designs and creates a building; an author writes and creates a novel (Creator : Creation)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All laptops are computers. Some computers are tablets. No tablet is a desktop. Conclusions: I. Some laptops are tablets. II. No desktop is a tablet.",
            "options": ["Only conclusion I follows", "Only conclusion II follows", "Both conclusions I and II follow", "Neither conclusion follows"],
            "correct_index": 1,
            "explanation": "Conclusion I cannot be deduced with certainty because laptops and tablets may be disjoint sets within computers. Conclusion II is the direct converse of 'No tablet is a desktop' and is definitely true."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out among the given options: Copper, Bronze, Silver, Gold",
            "options": ["Copper", "Bronze", "Silver", "Gold"],
            "correct_index": 1,
            "explanation": "Copper, Silver, and Gold are pure chemical elements, whereas Bronze is an alloy (copper and tin)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word that is nearest in meaning to 'PRAGMATIC':",
            "options": ["Idealistic", "Theoretical", "Practical", "Careless"],
            "correct_index": 2,
            "explanation": "'Pragmatic' means dealing with things sensibly and realistically based on practical rather than theoretical considerations."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Identify the word that is opposite in meaning to 'EPHEMERAL':",
            "options": ["Fleeting", "Permanent", "Transient", "Short-lived"],
            "correct_index": 1,
            "explanation": "'Ephemeral' means lasting for a very short time. Its direct antonym is 'Permanent'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the correct sentence that observes standard grammatical rules of subject-verb agreement:",
            "options": [
                "Neither the project manager nor the developers was present at the sync.",
                "Neither the project manager nor the developers were present at the sync.",
                "Neither the project manager nor the developers is present at the sync.",
                "Neither the project manager nor the developers has been present at the sync."
            ],
            "correct_index": 1,
            "explanation": "When compound subjects are connected by 'neither... nor', the verb agrees in number with the closer subject ('developers' is plural, so 'were' is correct)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Complete the phrase: The team decided to call ___ the release until all critical bugs were resolved.",
            "options": ["away", "off", "out", "over"],
            "correct_index": 1,
            "explanation": "'Call off' is a phrasal verb meaning to cancel or postpone an event or scheduled activity."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What is the meaning of the idiom 'to burn the midnight oil'?",
            "options": [
                "To waste valuable resources",
                "To work or study late into the night",
                "To cause accidental damage",
                "To ignite a heated controversy"
            ],
            "correct_index": 1,
            "explanation": "'To burn the midnight oil' is an established idiom that means to work or study late into the night."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the correct one-word substitution for: 'One who has an excessive enthusiasm for learning and books'",
            "options": ["Bibliophile", "Philatelist", "Polyglot", "Numismatist"],
            "correct_index": 0,
            "explanation": "A 'Bibliophile' is an individual who loves, seeks, and collects books. Philatelist collects stamps; Numismatist collects coins."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You discover a critical bug in a core production service on Friday afternoon right before release. What is the most responsible action?",
            "options": [
                "Deploy the release anyway and patch it on Monday morning.",
                "Immediately notify the release lead and engineering team, provide steps to reproduce, and recommend halting or hotfixing the release.",
                "Quietly push a fix without testing to avoid missing the deployment window.",
                "Wait until someone else files a ticket to avoid getting blamed."
            ],
            "correct_index": 1,
            "explanation": "Responsible engineering emphasizes transparency, reliability, and team communication over deploying known severe bugs to production."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A senior engineer leaves harsh, dismissive comments on your pull request without technical justification. How should you respond?",
            "options": [
                "Leave retaliatory comments on their recent pull requests.",
                "Politely ask for clarification on the technical tradeoffs and schedule a brief 1-on-1 discussion to understand their concerns.",
                "Complain to senior leadership immediately without talking to them.",
                "Ignore their comments and merge the code directly."
            ],
            "correct_index": 1,
            "explanation": "Professionalism requires de-escalating personal friction by focusing constructively on technical trade-offs and seeking direct clarifying dialogue."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During daily standup, you realize you are blocked by an external API dependency that was promised yesterday. What is the best course of action?",
            "options": [
                "Stay silent and browse tutorials until the dependency arrives.",
                "Clearly report the blocker during standup, identify the impact on sprint goals, and collaborate with your lead to follow up with the partner team.",
                "Start an unrelated personal side project without informing anyone.",
                "Publicly criticize the partner team in an open company channel."
            ],
            "correct_index": 1,
            "explanation": "Standups exist to highlight blockers early so the lead and team can unblock progress or adjust sprint commitments transparently."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You notice that a peer on your sprint team is struggling with a complex architectural module and is falling behind schedule. How should you assist?",
            "options": [
                "Complete their entire task for them without telling them how you did it.",
                "Proactively offer a 30-minute pair-programming session to talk through the architecture and share relevant documentation.",
                "Tell your manager that the peer is incompetent and should be replaced.",
                "Keep working on your own backlog items and ignore their struggle."
            ],
            "correct_index": 1,
            "explanation": "High-performing teams thrive on collaborative pair-programming and mentorship, which builds team capability without disempowering colleagues."
        }
    ]
}

# Fix option for SET_1 reasoning question 2
SET_1["questions"][9]["options"] = ["UJJTV", "UJKTV", "VKKTW", "UKKTV"]
SET_1["questions"][9]["correct_index"] = 1
SET_1["questions"][9]["explanation"] = "Each letter is shifted forward by 2 positions: S(19)+2=U(21), H(8)+2=J(10), I(9)+2=K(11), R(18)+2=T(20), T(20)+2=V(22). The resulting word is UJKTV."

SET_2 = {
    "set_number": 2,
    "title": "Soft Skill Assessment - Set 2",
    "slug": "soft-skill-assessment-set-2",
    "description": "Evaluates commercial mathematical ability, logical relations, vocabulary in context, and professional accountability.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A shopkeeper marks an item 40% above the cost price and then offers a 20% discount. What is his net profit percentage?",
            "options": ["12%", "15%", "18%", "20%"],
            "correct_index": 0,
            "explanation": "Let CP = 100. Marked Price = 140. Selling Price = 140 × (1 - 0.20) = 140 × 0.80 = 112. Profit = 112 - 100 = 12%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B together can do a piece of work in 12 days, while B alone can do it in 30 days. In how many days can A alone complete the work?",
            "options": ["18 days", "20 days", "22 days", "25 days"],
            "correct_index": 1,
            "explanation": "A's daily work rate = (1/12) - (1/30) = (5 - 2)/60 = 3/60 = 1/20. Therefore, A takes 20 days alone."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two numbers are in the ratio 4:7. If 6 is added to each number, the ratio becomes 2:3. What is the smaller number?",
            "options": ["12", "16", "24", "28"],
            "correct_index": 0,
            "explanation": "Let numbers be 4x and 7x. (4x + 6) / (7x + 6) = 2/3 => 3(4x + 6) = 2(7x + 6) => 12x + 18 = 14x + 12 => 2x = 6 => x = 3. Smaller number = 4 × 3 = 12."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat travels 24 km downstream in 2 hours and takes 4 hours to travel the same distance upstream. What is the speed of the current?",
            "options": ["2 km/h", "3 km/h", "4 km/h", "5 km/h"],
            "correct_index": 1,
            "explanation": "Downstream speed = 24 / 2 = 12 km/h. Upstream speed = 24 / 4 = 6 km/h. Current speed = (Downstream - Upstream) / 2 = (12 - 6) / 2 = 3 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the compound interest on ₹8,000 at 5% per annum for 2 years, compounded annually?",
            "options": ["₹800", "₹820", "₹840", "₹850"],
            "correct_index": 1,
            "explanation": "Amount = 8000 × (1.05)² = 8000 × 1.1025 = ₹8,820. Compound Interest = 8820 - 8000 = ₹820."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The price of petrol increased by 25%. By what percentage must a motorist reduce petrol consumption so as not to increase expenditure?",
            "options": ["15%", "20%", "25%", "30%"],
            "correct_index": 1,
            "explanation": "Reduction % = [r / (100 + r)] × 100 = [25 / 125] × 100 = (1/5) × 100 = 20%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many distinct ways can the letters of the word 'LEADER' be arranged?",
            "options": ["180", "360", "720", "120"],
            "correct_index": 1,
            "explanation": "Total letters = 6. The letter 'E' appears 2 times. Total arrangements = 6! / 2! = 720 / 2 = 360."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A jar contains a mixture of milk and water in the ratio 3:1. If 4 litres of water is added, the ratio becomes 3:2. Find the initial quantity of milk in the jar.",
            "options": ["8 litres", "12 litres", "15 litres", "18 litres"],
            "correct_index": 1,
            "explanation": "Let milk = 3x and water = x. After adding 4 litres of water: 3x / (x + 4) = 3/2 => 2(3x) = 3(x + 4) => 6x = 3x + 12 => 3x = 12 => x = 4. Quantity of milk = 3x = 12 litres."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 3, 8, 15, 24, 35, ?",
            "options": ["46", "48", "50", "52"],
            "correct_index": 1,
            "explanation": "Differences between consecutive terms are odd numbers: +5, +7, +9, +11, +13. Next term = 35 + 13 = 48 (also n² - 1: 7² - 1 = 48)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'WATER' is coded as 'XBUFS', how is 'EARTH' coded in the same language?",
            "options": ["FBSUI", "FBSUJ", "FARUI", "FCSVI"],
            "correct_index": 0,
            "explanation": "Each letter is shifted forward by 1: E→F, A→B, R→S, T→U, H→I, giving FBSUI."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Kavita ranks 8th from the top and 27th from the bottom in her college computer science cohort. How many students are in the cohort?",
            "options": ["33", "34", "35", "36"],
            "correct_index": 1,
            "explanation": "Total students = (Rank from top) + (Rank from bottom) - 1 = 8 + 27 - 1 = 34."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 6 km West, turns right and walks 8 km. How far is he from his initial starting point?",
            "options": ["10 km", "12 km", "14 km", "16 km"],
            "correct_index": 0,
            "explanation": "Using Pythagoras theorem: Distance = √(6² + 8²) = √(36 + 64) = √100 = 10 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the related pair: THERMOMETER : TEMPERATURE :: BAROMETER : ?",
            "options": ["Humidity", "Pressure", "Current", "Density"],
            "correct_index": 1,
            "explanation": "A thermometer measures temperature; a barometer measures atmospheric pressure."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "If P + Q means P is the mother of Q; P - Q means P is the sister of Q; P * Q means P is the father of Q. What does 'A * B - C' indicate?",
            "options": ["A is the father of C", "A is the uncle of C", "A is the brother of C", "A is the son of C"],
            "correct_index": 0,
            "explanation": "A * B means A is the father of B. B - C means B is the sister of C. Since B and C are siblings, A is the father of both B and C."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Mercury, Venus, Jupiter, Moon",
            "options": ["Mercury", "Venus", "Jupiter", "Moon"],
            "correct_index": 3,
            "explanation": "Mercury, Venus, and Jupiter are planets; the Moon is a natural satellite."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym for 'CANDID':",
            "options": ["Deceptive", "Frank", "Reserved", "Cautious"],
            "correct_index": 1,
            "explanation": "'Candid' means truthful, straightforward, and frank in speech or expression."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym for 'BENEVOLENT':",
            "options": ["Generous", "Malevolent", "Kind", "Helpful"],
            "correct_index": 1,
            "explanation": "'Benevolent' means well-meaning and kindly. Its direct antonym is 'Malevolent' (wishing evil or harm)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The manager congratulated Sarah ___ her promotion to tech lead.",
            "options": ["for", "on", "at", "about"],
            "correct_index": 1,
            "explanation": "The standard preposition paired with 'congratulate' is 'on' (congratulate someone on something)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence with correct punctuation:",
            "options": [
                "The server crashed because of high traffic, however the backup restored it.",
                "The server crashed because of high traffic; however, the backup restored it.",
                "The server crashed because of high traffic, however, the backup restored it.",
                "The server crashed because of high traffic; however the backup restored it."
            ],
            "correct_index": 1,
            "explanation": "When joining two independent clauses with the conjunctive adverb 'however', use a semicolon before 'however' and a comma after it."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the option that correctly describes the meaning of 'AMBIGUOUS':",
            "options": [
                "Having only one definite meaning",
                "Open to more than one interpretation",
                "Completely impossible to understand",
                "Expressing strong hostility"
            ],
            "correct_index": 1,
            "explanation": "'Ambiguous' refers to language or information that is open to more than one interpretation or lacks clarity."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'bite the bullet' mean?",
            "options": [
                "To engage in a dangerous armed combat",
                "To face a difficult situation with courage and endurance",
                "To make a reckless and impulsive decision",
                "To waste time on trivial arguments"
            ],
            "correct_index": 1,
            "explanation": "'Bite the bullet' means to bravely endure a painful or unavoidable situation."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A client requests a significant new feature during a sprint without updating the project scope or timeline. What should you do?",
            "options": [
                "Work unpaid weekends secretly to build it without informing management.",
                "Politely acknowledge the client's request, explain the change management process, and redirect them to the Product Manager for roadmap estimation.",
                "Rudely tell the client that their request is out of scope and decline to talk further.",
                "Immediately agree to deliver it by tomorrow without assessing feasibility."
            ],
            "correct_index": 1,
            "explanation": "Scope creep must be managed professionally by acknowledging client needs while steering them through proper product estimation and scheduling channels."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You accidentally drop a production database table during an off-hours schema migration. What is the correct immediate step?",
            "options": [
                "Shut down your laptop and hope the morning shift fixes it.",
                "Immediately alert the infrastructure team and engineering lead, explain what happened accurately, and assist in initiating the backup recovery plan.",
                "Try to rebuild the table from memory without notifying anyone.",
                "Blame an automated scheduled cron job."
            ],
            "correct_index": 1,
            "explanation": "Immediate ownership, transparency, and rapid collaboration minimize production downtime and protect user trust."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "In a team brainstorming session, your idea is chosen over an idea suggested by a colleague, and the colleague appears visibly upset. What should you do?",
            "options": [
                "Boast loudly about how superior your technical proposal was.",
                "Approach the colleague privately after the meeting, acknowledge the strengths of their proposal, and explore ways to incorporate their key insights.",
                "Complain to HR that the colleague has an attitude problem.",
                "Ignore them completely and avoid speaking to them in the future."
            ],
            "correct_index": 1,
            "explanation": "Empathetic collaboration and privately validating teammates' ideas builds psychological safety and stronger cross-functional solutions."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are assigned to evaluate two third-party libraries for payment processing. One is built by your close friend's startup, but the other clearly has better security and documentation. Which do you recommend?",
            "options": [
                "Recommend your friend's startup library regardless of technical drawbacks.",
                "Conduct an objective comparative analysis based on security, uptime, latency, and documentation, and recommend the superior library with clear data.",
                "Refuse to do the evaluation to avoid any personal dilemmas.",
                "Secretly modify the benchmark results to favor your friend."
            ],
            "correct_index": 1,
            "explanation": "Engineering integrity requires unbiased, data-backed technical evaluations that prioritize system security and corporate reliability."
        }
    ]
}

SET_3 = {
    "set_number": 3,
    "title": "Soft Skill Assessment - Set 3",
    "slug": "soft-skill-assessment-set-3",
    "description": "Tests numerical agility, pattern analysis, verbal clarity, and conflict de-escalation in high-stakes corporate environments.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 240 m long crosses a platform of equal length in 24 seconds. What is the speed of the train in km/h?",
            "options": ["60 km/h", "72 km/h", "80 km/h", "90 km/h"],
            "correct_index": 1,
            "explanation": "Total distance = Train length + Platform length = 240 + 240 = 480 m. Speed = 480 / 24 = 20 m/s. In km/h: 20 × (18/5) = 72 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average age of a committee of 8 members is unchanged when an old member is replaced by a new member who is 24 years younger than the old member. How many years ago was the replacement discussed? (Alternative standard problem: A man replaces an old member aged 50 with a person aged 26. What was the reduction in total age? 24 years, so average dropped by 3 years). Let's use the standard: 'The average age of 8 men increases by 2 years when two women replace two men whose ages are 21 and 23. What is the average age of the two women?'",
            "options": ["24 years", "28 years", "30 years", "32 years"],
            "correct_index": 2,
            "explanation": "Sum of ages of two men replaced = 21 + 23 = 44. Since the average of 8 people increases by 2, total age increases by 8 × 2 = 16. Sum of ages of two women = 44 + 16 = 60. Average age of the two women = 60 / 2 = 30 years."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 15 men can complete a project in 20 days, how many days will 25 men take to complete the same project?",
            "options": ["10 days", "12 days", "14 days", "16 days"],
            "correct_index": 1,
            "explanation": "Total work = 15 men × 20 days = 300 man-days. With 25 men: Time = 300 / 25 = 12 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of money placed at compound interest doubles itself in 4 years. In how many years will it amount to 8 times itself at the same rate?",
            "options": ["8 years", "12 years", "16 years", "24 years"],
            "correct_index": 1,
            "explanation": "Under compound interest, if an amount becomes 2^1 times in 4 years, it becomes 8 = 2^3 times in 3 × 4 = 12 years."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the HCF of 72, 108, and 180.",
            "options": ["18", "24", "36", "54"],
            "correct_index": 2,
            "explanation": "72 = 36 × 2, 108 = 36 × 3, 180 = 36 × 5. The greatest common factor of 72, 108, and 180 is 36."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A bag contains 5 red, 4 green, and 3 blue balls. If 3 balls are drawn at random without replacement, what is the probability that all 3 are of different colors?",
            "options": ["3/11", "4/11", "5/22", "6/11"],
            "correct_index": 0,
            "explanation": "Total balls = 12. Total ways to choose 3 balls = 12C3 = (12 × 11 × 10) / (3 × 2 × 1) = 220. Ways to pick 1 ball of each color = 5C1 × 4C1 × 3C1 = 5 × 4 × 3 = 60. Probability = 60 / 220 = 3/11."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A merchant professes to sell his goods at cost price, but uses a false weight of 950 grams for a kilogram. What is his actual gain percentage?",
            "options": ["5%", "5.26%", "5.5%", "6%"],
            "correct_index": 1,
            "explanation": "Gain % = [Error / (True Value - Error)] × 100 = [50 / 950] × 100 = (5/95) × 100 = (1/19) × 100 ≈ 5.26%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the simple interest on ₹7,500 at 6% per annum for 3 years?",
            "options": ["₹1,250", "₹1,350", "₹1,450", "₹1,500"],
            "correct_index": 1,
            "explanation": "SI = (P × R × T) / 100 = (7500 × 6 × 3) / 100 = 75 × 18 = ₹1,350."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the letter series: Z, X, V, T, R, ?",
            "options": ["O", "P", "Q", "S"],
            "correct_index": 1,
            "explanation": "The series steps backward by 2 letters in the alphabet: Z(26), X(24), V(22), T(20), R(18), P(16)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a coding system, if 'DELHI' is 73541 and 'CALCUTTA' is 82589662, how is 'CALICUT' coded?",
            "options": ["8251896", "8251596", "8254896", "8251869"],
            "correct_index": 0,
            "explanation": "Direct letter substitution: C=8, A=2, L=5, I=1, C=8, U=9, T=6. Assembling CALICUT gives 8251896."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said, 'His mother's only son is my father.' How is the woman related to the man?",
            "options": ["Sister", "Mother", "Daughter", "Aunt"],
            "correct_index": 2,
            "explanation": "'His mother's only son' is the man himself. Since the man is the woman's father, the woman is his daughter."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A clock shows 3:00. What is the angle between the hour hand and the minute hand?",
            "options": ["45°", "60°", "90°", "120°"],
            "correct_index": 2,
            "explanation": "At 3:00, the minute hand points at 12 and the hour hand points at 3. The separation is 3 hour spaces = 3 × 30° = 90°."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All cars are vehicles. No vehicle is an airplane. All airplanes are flying machines. Which conclusions follow? I. No car is an airplane. II. Some flying machines are airplanes.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all cars are vehicles and no vehicle is an airplane, no car can be an airplane (I follows). Since all airplanes are flying machines, some flying machines are airplanes (II follows)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 64, 125, 216, 343, 512, 720",
            "options": ["125", "343", "512", "720"],
            "correct_index": 3,
            "explanation": "64=4³, 125=5³, 216=6³, 343=7³, 512=8³. But 720 is not a perfect cube (9³ = 729)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If South-East becomes North, North-East becomes West, and so on, what will West become?",
            "options": ["North-East", "South-East", "South-West", "North-West"],
            "correct_index": 1,
            "explanation": "South-East (135°) becomes North (0°/360°), which is a 135° rotation anticlockwise. Applying a 135° anticlockwise rotation to West (270°) leads to South-East (135°)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'METICULOUS':",
            "options": ["Hasty", "Careful", "Sloppy", "Aggressive"],
            "correct_index": 1,
            "explanation": "'Meticulous' means showing extreme care and precision in details; closest to 'Careful'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'OBSOLETE':",
            "options": ["Archaic", "Outdated", "Contemporary", "Defunct"],
            "correct_index": 2,
            "explanation": "'Obsolete' means no longer produced or used (out of date). Its direct antonym is 'Contemporary' (modern, current)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Which sentence correctly uses the subjunctive mood?",
            "options": [
                "If I was the engineering director, I would restructure the platform.",
                "If I were the engineering director, I would restructure the platform.",
                "If I am the engineering director, I would restructure the platform.",
                "If I will be the engineering director, I would restructure the platform."
            ],
            "correct_index": 1,
            "explanation": "Hypothetical counterfactual statements require the subjunctive 'were' rather than 'was' (If I were...)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank with the appropriate preposition: She has been working at the company ___ 2021.",
            "options": ["for", "since", "from", "in"],
            "correct_index": 1,
            "explanation": "Use 'since' with a specific point in time (2021) in the present perfect continuous tense."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'the ball is in your court' mean?",
            "options": [
                "It is your turn to take action or make a decision",
                "You have lost the tennis game",
                "You must avoid unnecessary conflicts",
                "The task is completely impossible"
            ],
            "correct_index": 0,
            "explanation": "'The ball is in your court' signifies that it is now someone's responsibility to make the next move."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A speech delivered without any prior preparation'",
            "options": ["Maiden", "Extempore", "Monologue", "Oration"],
            "correct_index": 1,
            "explanation": "'Extempore' refers to a speech or presentation delivered impromptu without advance preparation."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A junior engineer accidentally commits API credentials and database passwords into a public repository. What should you instruct them to do immediately?",
            "options": [
                "Delete the commit message and pretend it didn't happen.",
                "Immediately revoke and rotate the exposed credentials, notify security, and remove the secret from git history using proper tools.",
                "Close the repository to private and do nothing else.",
                "Scold the junior in front of the entire team channel."
            ],
            "correct_index": 1,
            "explanation": "Once credentials touch a public repository, they must be considered compromised. Revoking and rotating them is the only secure immediate response."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You notice that two senior engineers on your squad disagree strongly on an architectural pattern, causing a project standstill. How can you help unblock the team?",
            "options": [
                "Pick a side based on who you like more personally.",
                "Suggest building a timeboxed Proof of Concept (PoC) for both patterns to objectively benchmark latency, maintenance, and developer velocity.",
                "Tell both engineers to stop arguing and let the product manager write the code.",
                "Escalate to HR for disciplinary action."
            ],
            "correct_index": 1,
            "explanation": "Empirical data from a timeboxed Proof of Concept transforms opinion-based debates into factual, criteria-based technical decisions."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You realize you have committed to two simultaneous customer-facing presentation meetings tomorrow morning. What is the most professional response?",
            "options": [
                "Attend one and quietly miss the other without saying anything.",
                "Proactively notify both organizers immediately, explain the scheduling conflict honestly, and arrange a qualified delegate or reschedule well in advance.",
                "Cancel both meetings at the last minute.",
                "Log into both calls on mute and alternate speaking randomly."
            ],
            "correct_index": 1,
            "explanation": "Early, proactive communication and organizing backup coverage demonstrates professional respect for clients' time."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an interview for a promotion, you are asked about a project failure where your team missed a key deadline. What is the most impressive way to answer?",
            "options": [
                "Blame external vendors and junior teammates for the delay.",
                "Explain the context transparently, own your personal role in the outcome, describe the retrospective root-cause analysis, and highlight systemic improvements implemented since.",
                "Claim that the project actually succeeded and denial is best.",
                "Say you have never failed at anything in your professional career."
            ],
            "correct_index": 1,
            "explanation": "Executive maturity is shown through accountability, post-mortem retrospectives, and demonstrating systemic growth from setbacks."
        }
    ]
}

SET_4 = {
    "set_number": 4,
    "title": "Soft Skill Assessment - Set 4",
    "slug": "soft-skill-assessment-set-4",
    "description": "Comprehensive evaluation covering speed mathematics, spatial and alphanumeric logic, grammatical precision, and stakeholder communication.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 20% of a number is 80, what is 35% of that same number?",
            "options": ["120", "140", "160", "180"],
            "correct_index": 1,
            "explanation": "Let number = x. 0.20x = 80 => x = 400. 35% of 400 = 0.35 × 400 = 140."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A car covers a distance of 450 km at a certain uniform speed. If its speed had been 15 km/h more, it would have taken 1.5 hours less. What was its original speed?",
            "options": ["50 km/h", "60 km/h", "65 km/h", "75 km/h"],
            "correct_index": 1,
            "explanation": "Let original speed be v. 450/v - 450/(v + 15) = 1.5. Testing v = 60: 450/60 = 7.5 hours. 450/75 = 6 hours. Difference = 7.5 - 6 = 1.5 hours. Thus, original speed = 60 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In what ratio should coffee powder costing ₹180/kg be mixed with coffee powder costing ₹260/kg so that the resulting mixture is worth ₹210/kg?",
            "options": ["5:3", "3:2", "4:3", "2:1"],
            "correct_index": 0,
            "explanation": "Using alligation: Cheaper (180), Dearer (260), Mean (210). (260 - 210) : (210 - 180) = 50 : 30 = 5:3."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A vendor buys lemons at 6 for ₹10 and sells them at 4 for ₹10. What is his profit percentage?",
            "options": ["25%", "40%", "50%", "60%"],
            "correct_index": 2,
            "explanation": "Cost of 12 lemons (LCM of 6 and 4) = 2 × 10 = ₹20. Selling price of 12 lemons = 3 × 10 = ₹30. Profit = ₹10 on ₹20 = 50%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The simple interest on a certain sum for 2 years at 10% per annum is ₹500. What would be the compound interest on the same sum at the same rate and for the same time?",
            "options": ["₹515", "₹525", "₹535", "₹550"],
            "correct_index": 1,
            "explanation": "SI for 2 years = ₹500, so SI per year = ₹250. Principal = (250 × 100) / 10 = ₹2500. For CI: First year interest = ₹250. Second year interest = 250 + (10% of 250) = 250 + 25 = ₹275. Total CI = 250 + 275 = ₹525."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The perimeter of a square is 48 cm. What is the area of the square?",
            "options": ["120 cm²", "144 cm²", "169 cm²", "196 cm²"],
            "correct_index": 1,
            "explanation": "Side of square = 48 / 4 = 12 cm. Area = side² = 12 × 12 = 144 cm²."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In a group of 6 men and 4 women, a committee of 4 persons is to be formed. In how many ways can this be done such that at least one woman is included?",
            "options": ["180", "195", "205", "210"],
            "correct_index": 1,
            "explanation": "Total ways to choose 4 from 10 = 10C4 = (10 × 9 × 8 × 7) / (4 × 3 × 2 × 1) = 210. Ways with NO women (all 4 are men) = 6C4 = 15. Ways with at least one woman = 210 - 15 = 195."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes can fill a cistern in 14 hours and 16 hours respectively. The pipes are opened simultaneously and it is found that due to leakage in the bottom, it took 32 minutes more to fill the cistern. When the cistern is full, in how much time will the leak empty it?",
            "options": ["112 hours", "100 hours", "96 hours", "84 hours"],
            "correct_index": 0,
            "explanation": "Combined fill rate = 1/14 + 1/16 = 15/112 tank/hr. Normal time = 112/15 hr = 7 hr 28 min. With leak, time = 7 hr 28 min + 32 min = 8 hours. Net rate with leak = 1/8. Leak emptying rate = 15/112 - 1/8 = 15/112 - 14/112 = 1/112. The leak will empty the full cistern in 112 hours."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next number in the pattern: 2, 5, 10, 17, 26, ?",
            "options": ["35", "36", "37", "38"],
            "correct_index": 2,
            "explanation": "Pattern is n² + 1: 1²+1=2, 2²+1=5, 3²+1=10, 4²+1=17, 5²+1=26, 6²+1=37."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'SYSTEM' is coded as 'SYSMET' and 'NEARER' is coded as 'AENRER', how is 'FRACTION' coded?",
            "options": ["CARFNOIT", "ARFCNOIT", "CARFTION", "NOITCARF"],
            "correct_index": 1,
            "explanation": "Divide the 8-letter word into two halves of 4 letters: FRAC and TION. Reverse the first half (CARF) or check NEARER: NEA -> AEN, RER -> RER. For FRACTION: First 4 letters 'FRAC' reversed = 'CARF', second 4 letters 'TION' reversed = 'NOIT', giving CARFNOIT. Looking at option 0: CARFNOIT. Let's fix option 0 to be the correct answer."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a boy, a girl said, 'He is the son of the daughter of the father of my uncle.' How is the boy related to the girl?",
            "options": ["Brother", "Uncle", "Father", "Nephew"],
            "correct_index": 0,
            "explanation": "Father of my uncle = my grandfather. Daughter of my grandfather = my mother (or aunt). Son of my mother = my brother."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "LIGHT : DARKNESS :: KNOWLEDGE : ?",
            "options": ["Wisdom", "Ignorance", "Books", "School"],
            "correct_index": 1,
            "explanation": "Light is the direct opposite of Darkness; Knowledge is the direct opposite of Ignorance."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Five executives P, Q, R, S, and T sit in a row facing North. S sits between T and Q. Q is to the immediate left of R. P is to the immediate left of T. Who sits in the middle?",
            "options": ["P", "T", "S", "Q"],
            "correct_index": 2,
            "explanation": "Arrangement from left to right: P, T, S, Q, R. S is exactly in the center position."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man starts from point A and walks 4 km South, then turns left and walks 3 km to point B. What is the shortest distance between point A and point B?",
            "options": ["5 km", "6 km", "7 km", "8 km"],
            "correct_index": 0,
            "explanation": "Shortest distance = √(4² + 3²) = √(16 + 9) = √25 = 5 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Inch, Foot, Yard, Acre",
            "options": ["Inch", "Foot", "Yard", "Acre"],
            "correct_index": 3,
            "explanation": "Inch, Foot, and Yard are linear units of length, whereas Acre is a unit of area."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'LUCID':",
            "options": ["Murky", "Vague", "Clear", "Complicated"],
            "correct_index": 2,
            "explanation": "'Lucid' means expressed clearly and easy to understand; closest to 'Clear'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'AUSTERE':",
            "options": ["Harsh", "Luxurious", "Strict", "Severe"],
            "correct_index": 1,
            "explanation": "'Austere' means plain, severe, and strict without comfort. Its antonym is 'Luxurious'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Spot the error in the following sentence: 'Each of the candidates have submitted their portfolio on time.'",
            "options": ["Each of the candidates", "have submitted", "their portfolio", "on time"],
            "correct_index": 1,
            "explanation": "'Each' is an indefinite pronoun that takes a singular verb: 'has submitted', not 'have submitted'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The team had to abstain ___ making public statements until the audit was complete.",
            "options": ["of", "from", "with", "against"],
            "correct_index": 1,
            "explanation": "The verb 'abstain' is properly followed by the preposition 'from' (abstain from something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'hit the nail on the head' mean?",
            "options": [
                "To do physical carpentry work",
                "To state or describe something with exact precision",
                "To cause unnecessary controversy",
                "To fail miserably at an exam"
            ],
            "correct_index": 1,
            "explanation": "'Hit the nail on the head' means to accurately identify or describe the exact cause or truth of a situation."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the correct one-word substitution: 'A person who regards the whole world as their country'",
            "options": ["Cosmopolitan", "Nationalist", "Chauvinist", "Immigrant"],
            "correct_index": 0,
            "explanation": "A 'Cosmopolitan' person is familiar with and at home in many different countries and cultures."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team leader is consistently allocating all high-visibility architectural tasks to one preferred team member, leaving repetitive bugs to others. What is the most mature response?",
            "options": [
                "Publicly accuse the team leader of favoritism during an all-hands meeting.",
                "Schedule a 1-on-1 with your team leader to discuss your career growth goals, express your interest in architectural work, and propose taking on a sub-module.",
                "Quietly stop fixing bugs to sabotage team metrics.",
                "Gossip with other departments about your leader."
            ],
            "correct_index": 1,
            "explanation": "Direct 1-on-1 professional communication focused on your personal aspirations and offering concrete ways to contribute is constructive and effective."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are leading a customer demo and the live staging server suddenly throws an unhandled 500 error on the main dashboard. How should you react?",
            "options": [
                "Panic and abruptly end the video call.",
                "Remain calm, acknowledge the glitch honestly, explain the scenario professionally, transition to backup demo slides or recorded flows, and have the team investigate.",
                "Blame your junior QA engineer by name on the call.",
                "Pretend the error is an intended security feature."
            ],
            "correct_index": 1,
            "explanation": "Composure under pressure, transparent communication, and having a ready fallback plan demonstrate poise and senior leadership presence."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A teammate sends an urgent email asking for your assistance while you are heads-down finishing a critical deploy before a hard deadline in 30 minutes. What should you do?",
            "options": [
                "Ignore their message completely for the rest of the day.",
                "Send a brief, polite acknowledgment stating you are completing a high-priority deploy right now and will assist them right after in 30 minutes.",
                "Reply angrily telling them never to disturb you.",
                "Drop your deploy immediately and let the deployment fail."
            ],
            "correct_index": 1,
            "explanation": "Timely acknowledgment with realistic boundary setting informs the teammate without derailing urgent delivery commitments."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During user interviews, several enterprise users strongly criticize an interface component you spent two months designing. How should you receive this feedback?",
            "options": [
                "Take it personally and argue that the users don't understand modern design.",
                "View the feedback objectively as vital user research data, ask clarifying questions about their pain points, and synthesize the insights to iterate.",
                "Ignore the users and keep the interface unchanged.",
                "Resign from the team out of frustration."
            ],
            "correct_index": 1,
            "explanation": "User feedback is essential data for product improvement; receiving it objectively without defensiveness leads to world-class software."
        }
    ]
}

# Fix option for SET_4 reasoning question 2
SET_4["questions"][9]["options"] = ["CARFNOIT", "ARFCNOIT", "CARFTION", "NOITCARF"]
SET_4["questions"][9]["correct_index"] = 0
SET_4["questions"][9]["explanation"] = "Split FRACTION into two 4-letter segments: 'FRAC' and 'TION'. Reverse each segment: 'FRAC' becomes 'CARF' and 'TION' becomes 'NOIT', yielding CARFNOIT."

SET_5 = {
    "set_number": 5,
    "title": "Soft Skill Assessment - Set 5",
    "slug": "soft-skill-assessment-set-5",
    "description": "Comprehensive corporate mock assessment testing proportional reasoning, blood relationships, syntax mastery, and cross-team ethics.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹10,000 is invested partly at 8% and partly at 10% per annum simple interest. If the total annual interest is ₹920, how much money was invested at 8%?",
            "options": ["₹3,500", "₹4,000", "₹4,500", "₹6,000"],
            "correct_index": 1,
            "explanation": "Let x be invested at 8% and (10000 - x) at 10%. 0.08x + 0.10(10000 - x) = 920 => 0.08x + 1000 - 0.10x = 920 => -0.02x = -80 => x = ₹4,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average weight of 24 students in a class is 45 kg. If the weight of the teacher is included, the average increases by 1 kg. What is the weight of the teacher?",
            "options": ["65 kg", "68 kg", "70 kg", "72 kg"],
            "correct_index": 2,
            "explanation": "Teacher's weight = New average + (Original count × increase) = 46 + (24 × 1) = 46 + 24 = 70 kg."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A tap can fill a tank in 20 minutes, while another tap can fill it in 30 minutes. If both taps are opened together, how long will it take to fill the tank?",
            "options": ["10 minutes", "12 minutes", "15 minutes", "18 minutes"],
            "correct_index": 1,
            "explanation": "Combined rate = 1/20 + 1/30 = (3 + 2)/60 = 5/60 = 1/12 tank/min. Time taken = 12 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The population of a city is 160,000. If it increases at the rate of 5% per annum, what will be its population after 2 years?",
            "options": ["172,400", "176,400", "180,000", "182,400"],
            "correct_index": 1,
            "explanation": "Population = 160,000 × (1 + 0.05)² = 160,000 × 1.1025 = 176,400."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Two numbers are in the ratio 5:8. If their difference is 48, what is the sum of the two numbers?",
            "options": ["192", "208", "216", "224"],
            "correct_index": 1,
            "explanation": "Let numbers be 5x and 8x. Difference = 8x - 5x = 3x = 48 => x = 16. Sum = 5x + 8x = 13x = 13 × 16 = 208."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A man can row 9 km/h in still water. If the river runs at 3 km/h, it takes him 3 hours to row to a place and row back. How far is the place?",
            "options": ["9 km", "12 km", "15 km", "18 km"],
            "correct_index": 1,
            "explanation": "Downstream speed = 9 + 3 = 12 km/h. Upstream speed = 9 - 3 = 6 km/h. Time = d/12 + d/6 = 3 => (d + 2d)/12 = 3 => 3d = 36 => d = 12 km."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "What is the remainder when 7^84 is divided by 342?",
            "options": ["1", "7", "49", "341"],
            "correct_index": 0,
            "explanation": "7³ = 343 = 342 + 1. So 7^84 = (7³)^28 = (342 + 1)^28. By the binomial theorem, every term except 1^28 is a multiple of 342. Remainder = 1."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "By selling a bicycle for ₹2,850, a dealer gains 14%. What was the cost price of the bicycle?",
            "options": ["₹2,400", "₹2,500", "₹2,600", "₹2,700"],
            "correct_index": 1,
            "explanation": "SP = CP × 1.14 => 2850 = 1.14 × CP => CP = 2850 / 1.14 = ₹2,500."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number: 6, 11, 21, 36, 56, ?",
            "options": ["78", "81", "84", "86"],
            "correct_index": 1,
            "explanation": "Differences: +5, +10, +15, +20, +25. Next number = 56 + 25 = 81."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'ORANGE' is coded as 'PSBOHF', how is 'BANANA' coded in the same scheme?",
            "options": ["CBOBOB", "CBPOPB", "CBOPBO", "CCPOPB"],
            "correct_index": 0,
            "explanation": "Each letter is shifted forward by 1: B→C, A→B, N→O, A→B, N→O, A→B, producing CBOBOB."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Looking at a family portrait, Rohan says, 'Her mother is the only daughter of my wife's mother.' How is Rohan related to the girl in the portrait?",
            "options": ["Brother", "Father", "Uncle", "Grandfather"],
            "correct_index": 1,
            "explanation": "The only daughter of Rohan's wife's mother is Rohan's wife herself. So the girl's mother is Rohan's wife, which makes Rohan the girl's father."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Rakesh walks 20 m North, then turns right and walks 30 m, then turns right and walks 35 m, then turns left and walks 15 m. In which direction is he from his starting position?",
            "options": ["North-East", "South-East", "North-West", "South-West"],
            "correct_index": 1,
            "explanation": "Vertical shift: +20 m North - 35 m South = -15 m (South). Horizontal shift: +30 m East + 15 m East = +45 m (East). He is South-East of his start."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the related pair: CALENDAR : DATES :: DICTIONARY : ?",
            "options": ["Sentences", "Words", "Chapters", "Alphabet"],
            "correct_index": 1,
            "explanation": "A calendar is an indexed reference of dates; a dictionary is an indexed reference of words."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: Some phones are watches. All watches are calculators. Conclusions: I. Some calculators are phones. II. Some calculators are watches.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since some phones are watches and all watches are calculators, those phones are calculators (I follows). Since all watches are calculators, some calculators must be watches (II follows). Both conclusions follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 13, 17, 23, 27, 31",
            "options": ["17", "23", "27", "31"],
            "correct_index": 2,
            "explanation": "13, 17, 23, and 31 are prime numbers, whereas 27 is a composite number (3³)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'TENACIOUS':",
            "options": ["Weak", "Persistent", "Indifferent", "Yielding"],
            "correct_index": 1,
            "explanation": "'Tenacious' means holding fast, persistent, and determined; closest to 'Persistent'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'CONCISE':",
            "options": ["Brief", "Succinct", "Wordy", "Short"],
            "correct_index": 2,
            "explanation": "'Concise' means brief and comprehensive. Its direct antonym is 'Wordy' (or verbose)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the correctly spelled word:",
            "options": ["Accomodate", "Accommodate", "Acommodate", "Accomadate"],
            "correct_index": 1,
            "explanation": "'Accommodate' has two 'c's and two 'm's."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The team was not only efficient ___ remarkably creative in their problem solving.",
            "options": ["also", "and also", "but also", "as well as"],
            "correct_index": 2,
            "explanation": "The correlative conjunction 'not only' must be paired with 'but also'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What is the meaning of the idiom 'to spill the beans'?",
            "options": [
                "To drop groceries accidentally",
                "To disclose a secret prematurely",
                "To prepare a home meal",
                "To celebrate an unexpected victory"
            ],
            "correct_index": 1,
            "explanation": "'To spill the beans' means to reveal secret information, often unintentionally."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who is indifferent to pleasure or pain'",
            "options": ["Stoic", "Epicurean", "Hedonist", "Cynic"],
            "correct_index": 0,
            "explanation": "A 'Stoic' is an individual who can endure pain or hardship without showing feelings or complaining."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You discover that a competitor has accidentally exposed confidential client roadmaps on an open web bucket. What is the ethical course of action?",
            "options": [
                "Download all files and share them with your marketing team to poach clients.",
                "Notify your internal security and legal team, and practice ethical vulnerability disclosure to alert the competitor's security point of contact without exploiting the data.",
                "Post the data anonymously on public forums.",
                "Blackmail the competitor for money."
            ],
            "correct_index": 1,
            "explanation": "High-integrity enterprise ethics mandate responsible disclosure and strict compliance without illegal exploitation of leaked competitor data."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A new product manager frequently alters user stories mid-sprint without team consensus, causing team burnout and missed commitments. What is the most constructive response?",
            "options": [
                "Refuse to talk to the product manager entirely.",
                "Raise the pattern objectively in the sprint retrospective, present data on sprint velocity disruption, and agree on sprint freeze guidelines for new requirements.",
                "Submit low quality code to meet the deadlines anyway.",
                "Complain to clients about internal friction."
            ],
            "correct_index": 1,
            "explanation": "The sprint retrospective is the designated agile forum to discuss process bottlenecks constructively with factual velocity data."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are asked to mentor an intern for two months. How should you structure your mentoring time to ensure their success?",
            "options": [
                "Give them manual documentation tasks and tell them not to disturb you.",
                "Set clear weekly learning milestones, schedule a recurring 20-minute daily check-in, provide prompt feedback, and guide them toward self-sufficiency.",
                "Do all of their assigned tasks yourself so the team looks good.",
                "Ask them to fetch coffee and lunches."
            ],
            "correct_index": 1,
            "explanation": "Effective mentorship requires structured learning milestones, regular supportive check-ins, and constructive feedback."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's software release fails quality benchmarks on staging the night before an executive board demonstration. The VP asks if you can bypass the test suite to present. What should you recommend?",
            "options": [
                "Bypass all tests immediately and hide the failures from the board.",
                "Advise against bypassing safety checks due to high risk of catastrophic failure during the demo; instead, propose presenting the stable tested baseline modules with transparent disclosures.",
                "Turn off your phone and refuse to answer the VP.",
                "Falsify test reports to show 100% green."
            ],
            "correct_index": 1,
            "explanation": "Protecting platform integrity and providing transparent executive risk counsel is the hallmark of trustworthy engineering leadership."
        }
    ]
}

PART_1_SETS = [SET_1, SET_2, SET_3, SET_4, SET_5]

