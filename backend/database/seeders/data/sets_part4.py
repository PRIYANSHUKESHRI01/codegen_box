# Sets 16 to 20 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_16 = {
    "set_number": 16,
    "title": "Soft Skill Assessment - Set 16",
    "slug": "soft-skill-assessment-set-16",
    "description": "Tests quantitative speed-work metrics, spatial reasoning, professional syntax, and blameless engineering culture.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A leak in the bottom of a tank can empty the full tank in 8 hours. An inlet pipe fills water at the rate of 6 litres a minute. When the tank is full, the inlet is opened and due to the leak, the tank is empty in 12 hours. How many litres does the cistern hold?",
            "options": ["7,200 litres", "8,640 litres", "9,600 litres", "10,800 litres"],
            "correct_index": 1,
            "explanation": "Work done by inlet pipe in 1 hour = 1/8 - 1/12 = 1/24. Time taken by inlet pipe alone to fill the tank = 24 hours = 24 × 60 = 1,440 minutes. Capacity of tank = 1,440 × 6 litres = 8,640 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A person buys an article for ₹1,200 and spends ₹200 on its repair. If he sells it for ₹1,680, what is his profit percentage?",
            "options": ["15%", "18%", "20%", "25%"],
            "correct_index": 2,
            "explanation": "Effective Cost Price = 1200 + 200 = ₹1,400. Selling Price = ₹1,680. Profit = 1680 - 1400 = ₹280. Profit % = (280 / 1400) × 100 = 20%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 110 m long travels at 60 km/h. How many seconds does it take to cross a telegraph post?",
            "options": ["5.5 seconds", "6.6 seconds", "7.2 seconds", "8.0 seconds"],
            "correct_index": 1,
            "explanation": "Speed = 60 × (5/18) = 50/3 m/s. Time = Distance / Speed = 110 / (50/3) = (110 × 3) / 50 = 330 / 50 = 6.6 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average of 5 consecutive numbers is 27. What is the product of the smallest and largest numbers?",
            "options": ["700", "720", "725", "735"],
            "correct_index": 2,
            "explanation": "Since average of 5 consecutive numbers is 27, the numbers are 25, 26, 27, 28, 29. Product of smallest and largest = 25 × 29 = 725."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two cards are drawn together from a pack of 52 cards. The probability that one is a spade and one is a heart is:",
            "options": ["3/20", "13/102", "169/1326", "26/102"],
            "correct_index": 1,
            "explanation": "Total ways to choose 2 cards = 52C2 = (52 × 51)/2 = 1326. Ways to choose 1 spade and 1 heart = 13C1 × 13C1 = 13 × 13 = 169. Probability = 169 / 1326 = 13 / 102."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The simple interest on ₹1,800 at 5% per annum for 1 year is:",
            "options": ["₹80", "₹85", "₹90", "₹95"],
            "correct_index": 2,
            "explanation": "SI = (1800 × 5 × 1) / 100 = 18 × 5 = ₹90."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man covers a distance of 14 km in 4 hours partly on foot at 3 km/h and partly on bicycle at 5 km/h. What distance did he cover on foot?",
            "options": ["8 km", "9 km", "10 km", "11 km"],
            "correct_index": 1,
            "explanation": "Let time on foot be t. Distance on foot = 3t. Distance on bicycle = 5(4 - t). 3t + 20 - 5t = 14 => 2t = 6 => t = 3 hours. Distance on foot = 3 × 3 = 9 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the compound interest on ₹10,000 for 2 years at 10% per annum, compounded annually.",
            "options": ["₹2,000", "₹2,100", "₹2,200", "₹2,400"],
            "correct_index": 1,
            "explanation": "Amount = 10,000 × (1.10)² = 10,000 × 1.21 = ₹12,100. CI = 12,100 - 10,000 = ₹2,100."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 4, 7, 12, 19, 28, ?",
            "options": ["37", "39", "41", "43"],
            "correct_index": 1,
            "explanation": "Differences: +3, +5, +7, +9, +11. Next term = 28 + 11 = 39."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'CENTRE' is coded as 'CNRTEE', how is 'SPRING' coded in the same scheme?",
            "options": ["SRPIGN", "SRPING", "SIRPNG", "SPRGNI"],
            "correct_index": 0,
            "explanation": "Swap adjacent pairs: C-E becomes C-N? Let's check positions: C(1), E(2), N(3), T(4), R(5), E(6) -> C(1), N(3), R(5), T(4), E(2), E(6). Or let's make an airtight coding scheme: In a certain code, 'SPRING' is written as 'TQSJOH' (+1 to each letter: S->T, P->Q, R->S, I->J, N->O, G->H). How is 'WINTER' written? W(+1)=X, I(+1)=J, N(+1)=O, T(+1)=U, E(+1)=F, R(+1)=S => XJOUFS."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a man, a woman said, 'His wife is the only daughter of my mother.' How is the woman related to the man?",
            "options": ["Sister", "Wife", "Mother", "Daughter"],
            "correct_index": 1,
            "explanation": "'The only daughter of my mother' is the woman herself. Since his wife is the woman, she is the man's wife."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All chairs are tables. Some tables are desks. No desk is a bench. Conclusions: I. Some tables are chairs. II. No bench is a desk.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all chairs are tables, some tables are chairs (I follows). Since no desk is a bench, no bench is a desk (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "CAR : ROAD :: TRAIN : ?",
            "options": ["Wheels", "Track", "Station", "Engine"],
            "correct_index": 1,
            "explanation": "A car travels on a road; a train travels on a railway track."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 40 m towards North, turns right and walks 50 m, then turns right again and walks 40 m. In which direction and how far is he from his starting point?",
            "options": ["50 m East", "50 m West", "40 m South", "90 m East"],
            "correct_index": 0,
            "explanation": "North 40 m and South 40 m cancel out. He is 50 m East of his starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 27, 64, 125, 216, 256",
            "options": ["64", "125", "216", "256"],
            "correct_index": 3,
            "explanation": "27=3³, 64=4³, 125=5³, 216=6³. 256 is 16² or 4⁴, not a cube of an integer (6³=216, 7³=343)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'METICULOUSNESS':",
            "options": ["Carelessness", "Precision", "Haste", "Indifference"],
            "correct_index": 1,
            "explanation": "'Meticulousness' means extreme care and precision; closest to 'Precision'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'ADVERSITY':",
            "options": ["Misfortune", "Prosperity", "Hardship", "Trouble"],
            "correct_index": 1,
            "explanation": "'Adversity' means difficulties or misfortune. Its direct antonym is 'Prosperity'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence with correct subject-verb agreement:",
            "options": [
                "Ten miles are a long distance to walk in this heat.",
                "Ten miles is a long distance to walk in this heat.",
                "Ten miles were a long distance to walk in this heat.",
                "Ten miles have been a long distance to walk in this heat."
            ],
            "correct_index": 1,
            "explanation": "Periods of time, sums of money, and units of distance are considered as a single collective unit and take a singular verb ('Ten miles is...')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The engineering lead was exempt ___ attending the administrative payroll meeting.",
            "options": ["from", "of", "to", "with"],
            "correct_index": 0,
            "explanation": "'Exempt' is followed by the preposition 'from' (exempt from something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to beat around the bush' mean?",
            "options": [
                "To clear foliage in a garden",
                "To discuss a matter without arriving at the point directly",
                "To search for lost items",
                "To arrive at an immediate conclusion"
            ],
            "correct_index": 1,
            "explanation": "'To beat around the bush' means to avoid addressing the main topic directly."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'The study of ancient human societies through the recovery and analysis of material culture'",
            "options": ["Archaeology", "Anthropology", "Paleontology", "Geology"],
            "correct_index": 0,
            "explanation": "'Archaeology' is the study of human history and prehistory through the excavation of sites and the analysis of artifacts."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You find that a critical background worker queue in production is slowly leaking memory and will crash in approximately 12 hours. What should you do?",
            "options": [
                "Wait for it to crash and reboot it tomorrow.",
                "Capture memory heap dumps immediately for root-cause profiling, prepare a hotfix to patch the leak, and schedule a graceful rolling restart before user impact.",
                "Blame the hardware vendor.",
                "Turn off the background queue completely."
            ],
            "correct_index": 1,
            "explanation": "Proactive diagnosis (heap dumps), patching, and graceful zero-downtime rolling restarts demonstrate disciplined engineering reliability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A non-technical product manager asks why rewriting legacy code takes longer than building a brand new Greenfield service. How should you explain this clearly?",
            "options": [
                "Tell them they don't understand software and refuse to elaborate.",
                "Explain that legacy code contains years of edge cases, bug fixes, and third-party integrations that must be reverse-engineered and verified without breaking existing users.",
                "Agree that it should take one day and promise to ship it tomorrow.",
                "Complain about the original authors."
            ],
            "correct_index": 1,
            "explanation": "Clear, empathetic communication translates technical reality (hidden edge cases, regression risk) into actionable business context."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are invited to an optional company knowledge-sharing talk about distributed caching during your lunch break. What is the most proactive mindset?",
            "options": [
                "Attend with an open mind, take notes, and ask questions about how the insights might solve bottlenecks on your own team's services.",
                "Complain that lunch is ruined.",
                "Ignore all learning opportunities outside your immediate ticket tasks.",
                "Join and distract the speaker with unrelated jokes."
            ],
            "correct_index": 0,
            "explanation": "Continuous cross-pollination of technical knowledge accelerates engineering maturity and team problem-solving capability."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You observe that a teammate is constantly taking on too many voluntary tasks, working late nights, and showing early signs of emotional exhaustion. How should you help?",
            "options": [
                "Give them two more tasks since they never say no.",
                "Have a private, supportive conversation, encourage them to set healthy boundaries, and collaborate with team leadership to redistribute the workload.",
                "Gossip about how they are trying to look like a hero.",
                "Ignore them completely."
            ],
            "correct_index": 1,
            "explanation": "Supportive peer advocacy helps prevent burnout and sustains long-term team performance."
        }
    ]
}

# Fix question 10 of SET_16
SET_16["questions"][9]["question_text"] = "In a certain code language, 'SPRING' is written as 'TQSJOH'. How is 'WINTER' written in that same pattern?"
SET_16["questions"][9]["options"] = ["XJOUFS", "XJOUES", "XKOVFS", "YJOUFS"]
SET_16["questions"][9]["correct_index"] = 0
SET_16["questions"][9]["explanation"] = "Each letter is shifted forward by 1: W(23)+1=X, I(9)+1=J, N(14)+1=O, T(20)+1=U, E(5)+1=F, R(18)+1=S, producing XJOUFS."

SET_17 = {
    "set_number": 17,
    "title": "Soft Skill Assessment - Set 17",
    "slug": "soft-skill-assessment-set-17",
    "description": "Evaluates proportional commercial math, set-theoretic logic, grammatical elegance, and high-stakes stakeholder negotiation.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A shopkeeper sells two television sets at the same price of ₹9,900 each. On one he makes 10% profit and on the other he loses 10%. What is his overall gain or loss percentage?",
            "options": ["No loss, no gain", "1% gain", "1% loss", "2% loss"],
            "correct_index": 2,
            "explanation": "When two items are sold at the same selling price with one at a gain of x% and the other at a loss of x%, there is always a loss of (x/10)² % = (10/10)² = 1% loss."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 70% of students in a school are boys and the number of girls is 504, how many boys are in the school?",
            "options": ["1,176", "1,200", "1,250", "1,320"],
            "correct_index": 0,
            "explanation": "Girls represent 100% - 70% = 30%. Total students = 504 / 0.30 = 1,680. Number of boys = 1,680 - 504 = 1,176."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat travels 32 km downstream and 14 km upstream in 6 hours. It also covers 40 km downstream and 21 km upstream in 8 hours. What is the speed of the boat in still water?",
            "options": ["6 km/h", "7 km/h", "8 km/h", "9 km/h"],
            "correct_index": 0,
            "explanation": "Let u = downstream speed and v = upstream speed. 32/u + 14/v = 6 and 40/u + 21/v = 8. Testing u = 8 and v = 7? If u = 8, 32/8 = 4. 14/v = 2 => v = 7. Check second eq: 40/8 = 5, 21/7 = 3. 5 + 3 = 8! Both equations hold. Speed in still water = (u + v)/2 = (8 + 7)/2 = ... wait, that is 7.5. Let's check u = 10, v = 5? If u = 8 and v = 4: 32/8=4, 14/4=3.5 (no). Let's use standard numbers: 'A boat travels 24 km downstream in 3 hours and 16 km upstream in 4 hours. Speed of the boat in still water is: Downstream = 8 km/h, Upstream = 4 km/h. Speed in still water = (8 + 4)/2 = 6 km/h.'"
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 5 consecutive odd numbers is 25. What is the smallest of these numbers?",
            "options": ["19", "21", "23", "25"],
            "correct_index": 1,
            "explanation": "The middle number is 25. The numbers are 21, 23, 25, 27, 29. The smallest number is 21."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In a lottery, there are 10 prizes and 25 blanks. A lottery is drawn at random. What is the probability of getting a prize?",
            "options": ["1/10", "2/7", "2/5", "5/7"],
            "correct_index": 1,
            "explanation": "Total tickets = 10 prizes + 25 blanks = 35 tickets. Probability of prize = 10 / 35 = 2/7."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man invested ₹15,000 at 8% per annum simple interest and another sum at 10% per annum. The total annual interest earned was ₹2,400. How much did he invest at 10%?",
            "options": ["₹10,000", "₹12,000", "₹14,000", "₹15,000"],
            "correct_index": 1,
            "explanation": "Interest from first sum = 15,000 × 0.08 = ₹1,200. Interest from second sum = 2,400 - 1,200 = ₹1,200. Second investment = 1,200 / 0.10 = ₹12,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two numbers are in the ratio 3:4. If their LCM is 180, what is the larger number?",
            "options": ["45", "50", "60", "75"],
            "correct_index": 2,
            "explanation": "Let numbers be 3x and 4x. Since 3 and 4 are coprime, LCM = 12x = 180 => x = 15. Larger number = 4x = 4 × 15 = 60."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the area of a right-angled triangle whose base is 14 cm and hypotenuse is 50 cm?",
            "options": ["300 cm²", "336 cm²", "350 cm²", "384 cm²"],
            "correct_index": 1,
            "explanation": "Height = √(50² - 14²) = √(2500 - 196) = √2304 = 48 cm. Area = 0.5 × Base × Height = 0.5 × 14 × 48 = 7 × 48 = 336 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 3, 7, 15, 31, 63, ?",
            "options": ["125", "127", "129", "131"],
            "correct_index": 1,
            "explanation": "Pattern: multiply by 2 and add 1. 3×2+1=7, 7×2+1=15, 15×2+1=31, 31×2+1=63, 63×2+1=127."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'TEACH' is coded as '20-5-1-3-8', how is 'STUDY' coded?",
            "options": ["19-20-21-4-25", "19-20-20-4-25", "18-20-21-4-25", "19-19-21-4-25"],
            "correct_index": 0,
            "explanation": "Letters replaced with alphabetical index: S=19, T=20, U=21, D=4, Y=25. The code is 19-20-21-4-25."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Looking at a portrait, Arun says, 'She is the mother of the father of my daughter.' How is the woman in the portrait related to Arun?",
            "options": ["Mother", "Grandmother", "Aunt", "Sister"],
            "correct_index": 0,
            "explanation": "'The father of my daughter' is Arun himself. 'She is the mother of Arun' means the woman is Arun's mother."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All diamonds are gems. No gem is glass. All glass is brittle. Conclusions: I. No diamond is glass. II. Some brittle things are glass.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since diamonds are gems and no gem is glass, no diamond is glass (I follows). Since all glass is brittle, some brittle things are glass (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "BEES : HIVE :: BIRDS : ?",
            "options": ["Nest", "Sky", "Cage", "Branch"],
            "correct_index": 0,
            "explanation": "Bees live in a hive; birds live in a nest (Organism : Dwelling/Habitation)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Rajiv walked 25 m towards South. Then he turned to his left and walked 20 m. He then turned to his left and walked 25 m. He again turned to his right and walked 15 m. At what distance is he from the starting point and in which direction?",
            "options": ["35 m East", "35 m West", "40 m East", "60 m East"],
            "correct_index": 0,
            "explanation": "South 25 m and North 25 m cancel out. Total East movement = 20 m + 15 m = 35 m East."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 12, 28, 44, 52, 65",
            "options": ["28", "44", "52", "65"],
            "correct_index": 3,
            "explanation": "12, 28, 44, and 52 are all divisible by 4; 65 is not."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'IMPECABLE': (Impeccable)",
            "options": ["Flawless", "Faulty", "Careless", "Imperfect"],
            "correct_index": 0,
            "explanation": "'Impeccable' means in accordance with the highest standards; faultless and flawless."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'DISPARATE':",
            "options": ["Different", "Similar", "Diverse", "Separate"],
            "correct_index": 1,
            "explanation": "'Disparate' means essentially different in kind. Its direct antonym is 'Similar'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence observing correct subject-verb agreement with the intervening phrase 'as well as':",
            "options": [
                "The manager as well as the staff are commended for the launch.",
                "The manager as well as the staff is commended for the launch.",
                "The manager as well as the staff were commended for the launch.",
                "The manager as well as the staff have commended for the launch."
            ],
            "correct_index": 1,
            "explanation": "When a subject is joined with parenthetical phrases like 'as well as', the verb agrees with the primary subject ('The manager' is singular, so 'is commended' is correct)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The security engineer was adept ___ identifying subtle cryptographic timing leaks.",
            "options": ["in", "at", "with", "for"],
            "correct_index": 1,
            "explanation": "'Adept at' is the standard English idiom (adept at doing something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to cut a long story short' mean?",
            "options": [
                "To summarize or get to the point without unnecessary detail",
                "To tear up a paperback book",
                "To tell an unfinished tale",
                "To write a short fiction novel"
            ],
            "correct_index": 0,
            "explanation": "'To cut a long story short' means to skip extraneous details and state the essential outcome."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'An arrangement of events or dates in the order of their occurrence'",
            "options": ["Chronology", "Anachronism", "Etymology", "Genealogy"],
            "correct_index": 0,
            "explanation": "'Chronology' is the science of arranging events in their order of historical occurrence."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an agile retrospective, a teammate claims that your pull request took too long to review, while you were waiting for their requested changes. How should you discuss this?",
            "options": [
                "Shout back that they are incompetent.",
                "Review the pull request timeline timestamps together objectively, identify communication delays, and agree on a team norm for review turnaround times.",
                "Never submit another pull request.",
                "Complain to HR."
            ],
            "correct_index": 1,
            "explanation": "Reviewing concrete timestamps collaboratively removes subjective blame and establishes productive team SLAs."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A customer executive demands to speak with the CEO immediately because an analytics report failed to export. How does account support handle this?",
            "options": [
                "Refuse to talk and hang up.",
                "Calmly empathize with the urgency, explain that you are escalating directly to the senior engineering tier, immediately generate the export manually for them, and provide an incident status ticket.",
                "Give out the CEO's personal home phone number.",
                "Tell them to wait two weeks."
            ],
            "correct_index": 1,
            "explanation": "Delivering an immediate tactical workaround (manual export) while opening a high-priority incident de-escalates panic effectively."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are asked to review a technical design document written by a colleague. How should you phrase your critique?",
            "options": [
                "Write 'This design is completely stupid.'",
                "Highlight positive architectural choices first, frame potential scaling risks as questions ('How will this cache handle 10x traffic spikes?'), and suggest alternatives.",
                "Approve it without reading to be polite.",
                "Reject it without any comments."
            ],
            "correct_index": 1,
            "explanation": "Constructive feedback balances praise, inquires about edge cases thoughtfully, and proposes concrete alternatives."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's automated test coverage has dropped from 85% to 55% over three months due to hurried feature releases. What should you propose?",
            "options": [
                "Delete all tests so coverage doesn't matter.",
                "Introduce an automated PR check that blocks merging code that reduces net coverage, and dedicate 20% of the next sprint to testing critical path user workflows.",
                "Stop building features for six months.",
                "Ignore test coverage completely."
            ],
            "correct_index": 1,
            "explanation": "Automated ratchet checks prevent coverage backsliding while dedicated sprint allocation systematically recovers quality."
        }
    ]
}

# Fix question 3 of SET_17
SET_17["questions"][2]["question_text"] = "A boat travels 24 km downstream in 3 hours and 16 km upstream in 4 hours. What is the speed of the boat in still water?"
SET_17["questions"][2]["options"] = ["5 km/h", "6 km/h", "7 km/h", "8 km/h"]
SET_17["questions"][2]["correct_index"] = 1
SET_17["questions"][2]["explanation"] = "Downstream speed = 24 / 3 = 8 km/h. Upstream speed = 16 / 4 = 4 km/h. Speed of boat in still water = (Downstream + Upstream) / 2 = (8 + 4) / 2 = 6 km/h."

SET_18 = {
    "set_number": 18,
    "title": "Soft Skill Assessment - Set 18",
    "slug": "soft-skill-assessment-set-18",
    "description": "Evaluates advanced proportion metrics, direction deduction, contextual business vocabulary, and engineering diplomacy.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man can row at 5 km/h in still water. If the velocity of current is 1 km/h and it takes him 1 hour to row to a place and come back, how far is the place?",
            "options": ["2.2 km", "2.4 km", "2.5 km", "3.0 km"],
            "correct_index": 1,
            "explanation": "Downstream speed = 5 + 1 = 6 km/h. Upstream speed = 5 - 1 = 4 km/h. Time = d/6 + d/4 = 1 => 5d/12 = 1 => d = 12/5 = 2.4 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 20% of an electricity bill is deducted, ₹100 is still to be paid. How much was the original bill?",
            "options": ["₹110", "₹120", "₹125", "₹140"],
            "correct_index": 2,
            "explanation": "Remaining percentage = 80%. Let total bill = x. 0.80x = 100 => x = 100 / 0.80 = ₹125."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B can do a job together in 7 days. A is 1(3/4) times as efficient as B. The same job can be done by A alone in:",
            "options": ["9(1/3) days", "11 days", "12(1/4) days", "16(1/3) days"],
            "correct_index": 1,
            "explanation": "A's efficiency / B's efficiency = 7/4. Let daily work of A be 7 units and B be 4 units. Total daily work = 11 units. In 7 days, total work = 7 × 11 = 77 units. Time taken by A alone = 77 / 7 = 11 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A rectangular park 60 m long and 40 m wide has two concrete crossroads running in the middle of the park and rest of the park has been used as a lawn. If the area of the lawn is 2,109 m², what is the width of the road?",
            "options": ["2 m", "3 m", "4 m", "5 m"],
            "correct_index": 1,
            "explanation": "Total area = 60 × 40 = 2,400 m². Area of roads = 2400 - 2109 = 291 m². If width is w: 60w + 40w - w² = 291 => w² - 100w + 291 = 0 => (w - 3)(w - 97) = 0. Width of road = 3 m."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A bag contains 6 black and 8 white balls. One ball is drawn at random. What is the probability that the ball drawn is white?",
            "options": ["3/7", "4/7", "1/8", "3/4"],
            "correct_index": 1,
            "explanation": "Total balls = 6 + 8 = 14. Probability of white = 8 / 14 = 4/7."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the simple interest on ₹5,400 at 9% per annum for 2 years?",
            "options": ["₹920", "₹950", "₹972", "₹980"],
            "correct_index": 2,
            "explanation": "SI = (5400 × 9 × 2) / 100 = 54 × 18 = ₹972."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The salaries of A, B, and C are in the ratio 2:3:5. If the increments of 15%, 10%, and 20% are allowed respectively in their salaries, then what will be the new ratio of their salaries?",
            "options": ["3:3:10", "10:11:20", "23:33:60", "35:40:50"],
            "correct_index": 2,
            "explanation": "Let salaries be 20, 30, 50. New salaries: A = 20 × 1.15 = 23; B = 30 × 1.10 = 33; C = 50 × 1.20 = 60. New ratio = 23:33:60."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the average of all prime numbers between 30 and 50.",
            "options": ["38.8", "39.8", "40.5", "41.2"],
            "correct_index": 1,
            "explanation": "Prime numbers between 30 and 50 are: 31, 37, 41, 43, 47 (5 primes). Sum = 31 + 37 + 41 + 43 + 47 = 199. Average = 199 / 5 = 39.8."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 1, 4, 27, 16, 125, 36, ?",
            "options": ["49", "64", "216", "343"],
            "correct_index": 3,
            "explanation": "Alternating powers: 1³=1, 2²=4, 3³=27, 4²=16, 5³=125, 6²=36, 7³=343."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'FRIEND' is coded as 'HUMJTK', how is 'CANDLE' coded?",
            "options": ["EDRIRL", "ESJFME", "DCQHQK", "EDRIRJ"],
            "correct_index": 0,
            "explanation": "Pattern: F(+2)→H, R(+3)→U, I(+4)→M, E(+5)→J, N(+6)→T, D(+7)→K. Apply +2, +3, +4, +5, +6, +7 to CANDLE: C(+2)=E, A(+3)=D, N(+4)=R, D(+5)=I, L(+6)=R, E(+7)=L => EDRIRL."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a photograph of a boy, Suresh said, 'He is the son of the only son of my mother.' How is Suresh related to that boy?",
            "options": ["Brother", "Uncle", "Father", "Grandfather"],
            "correct_index": 2,
            "explanation": "Suresh's mother's only son is Suresh himself. Therefore, the boy is Suresh's son, making Suresh his father."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: Some actors are singers. All singers are dancers. Conclusions: I. Some actors are dancers. II. No singer is an actor.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 0,
            "explanation": "Since some actors are singers and all singers are dancers, those actor-singers are dancers (I follows). Since some actors are singers, statement II is clearly false. Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "ISLAND : WATER :: OASIS : ?",
            "options": ["Sand", "Forest", "Mountain", "Sea"],
            "correct_index": 0,
            "explanation": "An island is a body of land surrounded by water; an oasis is a fertile spot in a desert surrounded by sand."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Suresh starts walking towards South. After walking 15 m, he turns left and walks 15 m. He again turns left and walks 15 m. How far and in what direction is he from his starting point?",
            "options": ["15 m East", "15 m West", "30 m East", "15 m South"],
            "correct_index": 0,
            "explanation": "South 15 m and North 15 m cancel out. He is 15 m East of his starting position."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: Platinum, Silver, Gold, Steel",
            "options": ["Platinum", "Silver", "Gold", "Steel"],
            "correct_index": 3,
            "explanation": "Platinum, Silver, and Gold are pure precious elemental metals; Steel is an iron-carbon alloy."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'UBIQUITOUS':",
            "options": ["Omnipresent", "Rare", "Unique", "Invisible"],
            "correct_index": 0,
            "explanation": "'Ubiquitous' means present, appearing, or found everywhere; omnipresent."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'EPITOME':",
            "options": ["Embodiment", "Archetype", "Antithesis", "Paragon"],
            "correct_index": 2,
            "explanation": "'Epitome' refers to a perfect example of a quality. Its antonym is 'Antithesis' (the direct opposite)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the sentence that correctly applies the correlative pair 'hardly... when' with inversion:",
            "options": [
                "Hardly had the meeting started when the fire alarm sounded.",
                "Hardly had the meeting started than the fire alarm sounded.",
                "Hardly the meeting had started when the fire alarm sounded.",
                "Hardly did the meeting started when the fire alarm sounded."
            ],
            "correct_index": 0,
            "explanation": "'Hardly... when' is the correct correlative conjunction pairing with inverted past perfect."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The new compliance regulations are applicable ___ all distributed software components.",
            "options": ["to", "for", "with", "on"],
            "correct_index": 0,
            "explanation": "'Applicable to' is the correct prepositional usage."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to let the cat out of the bag' mean?",
            "options": [
                "To release an animal into the wild",
                "To disclose a secret carelessly or by mistake",
                "To complete an untidy task",
                "To purchase groceries"
            ],
            "correct_index": 1,
            "explanation": "'To let the cat out of the bag' means to reveal a secret, usually inadvertently."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who travels on foot'",
            "options": ["Pedestrian", "Equestrian", "Chauffeur", "Aviator"],
            "correct_index": 0,
            "explanation": "A person walking rather than traveling in a vehicle is a 'Pedestrian'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You notice that an automated script created by a teammate runs unnecessary queries that spike cloud database costs by $10,000 monthly. What is the most constructive response?",
            "options": [
                "Publicly shame them for wasting company money.",
                "Reach out privately with the cost analytics and query profile, and help them add batching and index caching to reduce unnecessary reads.",
                "Silently kill the database script without explanation.",
                "Ignore it because the company is funded."
            ],
            "correct_index": 1,
            "explanation": "Constructive private mentoring backed by telemetry solves the financial leak while developing teammate engineering skills."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company decides to deprecate a feature that 5% of active users love, generating strong backlash on user forums. How should engineering support customer success?",
            "options": [
                "Delete the customer forum threads.",
                "Provide clear technical migration documentation, explain the architectural sustainability rationale, and offer export tools to preserve user data.",
                "Argue with angry customers in comments.",
                "Secretly un-deprecate the feature without management knowledge."
            ],
            "correct_index": 1,
            "explanation": "Providing self-service export tools, migration pathways, and transparent technical rationales honors customer trust during deprecation."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During an all-hands Q&A, you notice an opportunity to ask the executive team a question. Which type of question is most appropriate?",
            "options": [
                "A personal complaint about cafeteria snacks.",
                "A strategic question about company product direction, market positioning, and how engineering priorities support that vision.",
                "An aggressive personal accusation against a peer.",
                "A question about a colleague's salary."
            ],
            "correct_index": 1,
            "explanation": "All-hands forums are designed for strategic alignment, market direction, and organizational vision."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are assigned to conduct an exit interview with an engineer who is leaving for a competitor. What is the primary objective of this conversation?",
            "options": [
                "Pressure them into staying by offering counter-offers.",
                "Listen objectively to understand their genuine feedback on team culture, engineering friction, and growth opportunities to improve the organization.",
                "Accuse them of betrayal.",
                "Refuse to conduct the conversation."
            ],
            "correct_index": 1,
            "explanation": "Exit interviews provide vital, candid feedback regarding structural and cultural friction points to help companies improve retention."
        }
    ]
}

SET_19 = {
    "set_number": 19,
    "title": "Soft Skill Assessment - Set 19",
    "slug": "soft-skill-assessment-set-19",
    "description": "Evaluates speed arithmetic, logical syllogisms, executive business vocabulary, and architectural trade-off leadership.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A cistern is normally filled in 8 hours but takes 2 hours longer to fill because of a leak in its bottom. If the cistern is full, in how many hours will the leak empty it?",
            "options": ["30 hours", "35 hours", "40 hours", "45 hours"],
            "correct_index": 2,
            "explanation": "Work done by leak in 1 hour = 1/8 - 1/10 = (5 - 4)/40 = 1/40. The leak will empty the full cistern in 40 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 15% of an integer is 45, what is 40% of the same integer?",
            "options": ["100", "110", "120", "130"],
            "correct_index": 2,
            "explanation": "The integer = 45 / 0.15 = 300. 40% of 300 = 0.40 × 300 = 120."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains running in opposite directions cross a man standing on the platform in 27 seconds and 17 seconds respectively and they cross each other in 23 seconds. The ratio of their speeds is:",
            "options": ["1:3", "3:2", "3:4", "2:3"],
            "correct_index": 1,
            "explanation": "Let speeds be x and y. Lengths are 27x and 17y. (27x + 17y)/(x + y) = 23 => 27x + 17y = 23x + 23y => 4x = 6y => x/y = 6/4 = 3/2."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A father is twice as old as his son. Twenty years ago, the age of the father was 12 times the age of the son. The present age of the father is:",
            "options": ["40 years", "44 years", "48 years", "52 years"],
            "correct_index": 1,
            "explanation": "Let son's age = x, father = 2x. (2x - 20) = 12(x - 20) => 2x - 20 = 12x - 240 => 10x = 220 => x = 22. Father's present age = 2x = 44 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A box contains 5 red, 8 green, and 7 white balls. One ball is drawn at random from the box. What is the probability that the ball drawn is neither red nor green?",
            "options": ["1/4", "7/20", "13/20", "3/5"],
            "correct_index": 1,
            "explanation": "Total balls = 5 + 8 + 7 = 20. Neither red nor green means white. White balls = 7. Probability = 7/20."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the compound interest on ₹8,000 for 9 months at 20% per annum, compounded quarterly.",
            "options": ["₹1,200", "₹1,261", "₹1,320", "₹1,400"],
            "correct_index": 1,
            "explanation": "Quarterly rate = 20%/4 = 5%. Quarters = 3. Amount = 8000 × (1.05)³ = 8000 × 1.157625 = ₹9,261. CI = 9261 - 8000 = ₹1,261."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A trader mixes 26 kg of rice at ₹20 per kg with 30 kg of rice of other variety at ₹36 per kg and sells the mixture at ₹30 per kg. His profit percent is:",
            "options": ["No profit, no loss", "5%", "8%", "10%"],
            "correct_index": 1,
            "explanation": "Cost of 56 kg = (26 × 20) + (30 × 36) = 520 + 1080 = ₹1,600. SP of 56 kg = 56 × 30 = ₹1,680. Profit = ₹80. Profit % = (80 / 1600) × 100 = 5%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 5 results is 46 and that of the first four is 45. The fifth result is:",
            "options": ["48", "50", "52", "55"],
            "correct_index": 1,
            "explanation": "Fifth result = (5 × 46) - (4 × 45) = 230 - 180 = 50."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 3, 5, 9, 17, 33, ?",
            "options": ["63", "65", "67", "69"],
            "correct_index": 1,
            "explanation": "Pattern: differences double each step (+2, +4, +8, +16, +32). Next term = 33 + 32 = 65 (or 2n - 1)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'CENTURY' is coded as 'DGPXAXF', how is 'KNOWLEDGE' coded?",
            "options": ["LPPANHGHF", "LPZBNHGHF", "LPPAMHGHF", "MPPAMHGHF"],
            "correct_index": 0,
            "explanation": "Let's check shifts: C(3)→D(4) [+1], E(5)→G(7) [+2], N(14)→P(16) [+2]... Let's use clean increasing shift +1, +2, +3: K(11)+1=L, N(14)+2=P, O(15)+3=R, W(23)+4=A, L(12)+5=Q... Let's make an airtight standard code: In a certain code, 'LIGHT' is written as 'MJHIU'. How is 'SOUND' written? S(+1)=T, O=O? Let's use: Each letter shifted +1: S(+1)=T, O(+1)=P, U(+1)=V, N(+1)=O, D(+1)=E => TPVRE... T P V O E."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is B's brother, C is A's mother, D is C's father, B is D's granddaughter. How is B related to F who is A's son?",
            "options": ["Aunt", "Sister", "Mother", "Niece"],
            "correct_index": 0,
            "explanation": "B is the sister of A. F is A's son. Therefore, B is F's father's sister, which makes B his aunt."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All keys are locks. All locks are doors. Some doors are windows. Conclusions: I. All keys are doors. II. Some windows are locks.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 0,
            "explanation": "Since keys are inside locks and locks are inside doors, all keys are doors (I follows). Windows only overlap with doors, not necessarily locks (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "THERMOMETER : HEAT :: BAROMETER : ?",
            "options": ["Air", "Atmospheric Pressure", "Moisture", "Altitude"],
            "correct_index": 1,
            "explanation": "A thermometer measures heat/temperature; a barometer measures atmospheric pressure."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A person walks 10 km North, turns left and walks 4 km, then turns left again and walks 10 km. How far is he from his start?",
            "options": ["4 km", "6 km", "8 km", "10 km"],
            "correct_index": 0,
            "explanation": "North 10 km and South 10 km cancel out. He is 4 km West of his starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 15, 21, 27, 31, 39",
            "options": ["21", "27", "31", "39"],
            "correct_index": 2,
            "explanation": "15, 21, 27, and 39 are all divisible by 3; 31 is a prime number."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'SAGACITY':",
            "options": ["Wisdom", "Ignorance", "Folly", "Stubbornness"],
            "correct_index": 0,
            "explanation": "'Sagacity' means the quality of being discerning, sound in judgment, and wise."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'STRINGENT':",
            "options": ["Strict", "Lenient", "Rigid", "Severe"],
            "correct_index": 1,
            "explanation": "'Stringent' means strict, precise, and exacting. Its direct antonym is 'Lenient'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the sentence with correct verb agreement for the indefinite pronoun 'one of the servers':",
            "options": [
                "One of the servers in the cluster have crashed.",
                "One of the servers in the cluster has crashed.",
                "One of the servers in the cluster are crashed.",
                "One of the servers in the cluster were crashed."
            ],
            "correct_index": 1,
            "explanation": "The subject is 'One' (singular), requiring the singular verb 'has crashed'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The architecture team was averse ___ taking on unmanaged vendor dependencies.",
            "options": ["to", "from", "with", "against"],
            "correct_index": 0,
            "explanation": "'Averse to' is the standard prepositional phrase (averse to doing something)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to give someone the benefit of the doubt' mean?",
            "options": [
                "To lend money to a doubtful person",
                "To trust what someone says without demanding proof",
                "To prove someone is mistaken",
                "To doubt someone's integrity"
            ],
            "correct_index": 1,
            "explanation": "'To give someone the benefit of the doubt' means to accept someone's words or actions favorably when evidence is inconclusive."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'The practice of claiming to have moral standards or beliefs to which one's own behavior does not conform'",
            "options": ["Hypocrisy", "Chauvinism", "Altruism", "Pessimism"],
            "correct_index": 0,
            "explanation": "'Hypocrisy' is the pretense of having beliefs or virtues that one does not actually possess."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A junior engineer suggests rewriting your entire mobile app from native Swift/Kotlin into a trendy cross-platform framework that neither of you have used. How should you evaluate this?",
            "options": [
                "Approve it immediately because using new tech is always exciting.",
                "Acknowledge the enthusiasm, discuss the real migration costs (retraining, native bridge latency, rewrite timeline), and propose evaluating the framework in a small internal hackathon pilot first.",
                "Mock the junior engineer for being naive.",
                "Ban all discussion of new frameworks."
            ],
            "correct_index": 1,
            "explanation": "Channels team innovation constructively by anchoring decisions to architectural realities and low-risk prototyping."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's software release has met all functional acceptance criteria, but automated load testing reveals a 15% increase in API response times under high concurrency. What is the recommended decision?",
            "options": [
                "Ignore latency since the functionality works.",
                "Block deployment to production, profile database queries and concurrency bottlenecks in staging, and resolve the latency regression before releasing.",
                "Turn off load testing.",
                "Blame AWS for having slow instances."
            ],
            "correct_index": 1,
            "explanation": "High-scale enterprise software mandates treating non-functional regressions (latency, throughput) as release-blocking criteria."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You receive a phishing email appearing to come from your CEO requesting an urgent wire transfer of company funds. What should you do?",
            "options": [
                "Reply asking for account numbers.",
                "Do not click any links, immediately forward the email to the IT Security phishing reporting channel, and alert the finance controller.",
                "Delete the email and do nothing.",
                "Forward the email to all employees."
            ],
            "correct_index": 1,
            "explanation": "Reporting phishing attempts immediately to IT Security protects the organization from credential harvesting and financial fraud."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During performance reviews, an engineer is unhappy with their peer feedback and argues that their reviewers are biased against them. As their manager, how do you handle this?",
            "options": [
                "Dismiss their complaints and tell them to accept it.",
                "Review the feedback objectively together, ground the evaluation in concrete artifact examples and deliverables, and build an actionable development roadmap together.",
                "Agree with them and delete the peer reviews.",
                "Lower their rating further for arguing."
            ],
            "correct_index": 1,
            "explanation": "Grounding reviews in concrete objective work artifacts removes personal defensiveness and aligns on professional growth."
        }
    ]
}

# Fix question 10 of SET_19
SET_19["questions"][9]["question_text"] = "In a certain code, 'SOUND' is written as 'TPVOE'. How is 'MUSIC' written in that same scheme?"
SET_19["questions"][9]["options"] = ["NVTJD", "NVTJE", "NWTJD", "NUTJD"]
SET_19["questions"][9]["correct_index"] = 0
SET_19["questions"][9]["explanation"] = "Each letter is shifted forward by 1: M(13)+1=N, U(21)+1=V, S(19)+1=T, I(9)+1=J, C(3)+1=D, yielding NVTJD."

SET_20 = {
    "set_number": 20,
    "title": "Soft Skill Assessment - Set 20",
    "slug": "soft-skill-assessment-set-20",
    "description": "Grand Master Evaluation: Advanced comprehensive simulation combining complex arithmetic, multi-variable logic, executive vocabulary, and senior organizational ethics.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹12,000 invested at compound interest amounts to ₹14,520 in 2 years, compounded annually. What is the annual rate of interest?",
            "options": ["8%", "9%", "10%", "12%"],
            "correct_index": 2,
            "explanation": "A/P = 14,520 / 12,000 = 1.21. (1 + r/100)² = 1.21 = (1.1)². Therefore, 1 + r/100 = 1.1 => r = 10%."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 12 men or 18 women can reap a field in 14 days, then in how many days can 8 men and 16 women reap the same field?",
            "options": ["8 days", "9 days", "10 days", "12 days"],
            "correct_index": 1,
            "explanation": "12 men = 18 women => 1 man = 1.5 women. 8 men + 16 women = (8 × 1.5) + 16 = 12 + 16 = 28 women. Time = (18 women × 14 days) / 28 women = 252 / 28 = 9 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man crosses a river at 8 km/h in a direction perpendicular to the bank. If the current flows at 6 km/h, what is his resultant speed?",
            "options": ["9 km/h", "10 km/h", "11 km/h", "12 km/h"],
            "correct_index": 1,
            "explanation": "Resultant speed = √(8² + 6²) = √(64 + 36) = √100 = 10 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The price of petrol increases by 20%. By what percentage must a motorist reduce his consumption so that expenditure on petrol remains unchanged?",
            "options": ["14.28%", "16.67%", "18.5%", "20%"],
            "correct_index": 1,
            "explanation": "Reduction % = [r / (100 + r)] × 100 = [20 / 120] × 100 = (1/6) × 100 ≈ 16.67%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the probability of choosing a random prime number from the set of integers from 1 to 30 inclusive?",
            "options": ["1/3", "3/10", "1/5", "7/30"],
            "correct_index": 0,
            "explanation": "Primes between 1 and 30: {2, 3, 5, 7, 11, 13, 17, 19, 23, 29} (10 prime numbers). Probability = 10 / 30 = 1/3."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the simple interest on ₹15,000 at 8% per annum for 3.5 years?",
            "options": ["₹3,800", "₹4,000", "₹4,200", "₹4,500"],
            "correct_index": 2,
            "explanation": "SI = (15,000 × 8 × 3.5) / 100 = 150 × 28 = ₹4,200."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio between the circumference and diameter of a circle is represented by which mathematical constant?",
            "options": ["e", "φ (Golden Ratio)", "π (Pi)", "Euler's constant"],
            "correct_index": 2,
            "explanation": "By definition, the ratio of a circle's circumference to its diameter is π (Pi ≈ 3.14159)."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the average of first 5 multiples of 7.",
            "options": ["18", "21", "24", "28"],
            "correct_index": 1,
            "explanation": "The first 5 multiples of 7 are 7, 14, 21, 28, 35. Average is the middle term = 21."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the alphanumeric series: A2Z, B4Y, C8X, D16W, ?",
            "options": ["E24V", "E32V", "E32U", "F32V"],
            "correct_index": 1,
            "explanation": "Letters forward: A, B, C, D, E. Numbers double: 2, 4, 8, 16, 32. Letters backward: Z, Y, X, W, V. Result = E32V."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'DIAMOND' is coded as 'VJQYMKL', how is 'FEMALE' coded in that system? (Standard: If 'LEMON' is coded as 'PWQSR', how is 'APPLE' coded?) Let's use clean reverse shift: In a certain code, 'KING' is coded as 'PRMT' (reverse alphabetical pairs). How is 'QUEEN' coded in that same system?",
            "options": ["JFHHM", "JFVVM", "JFVVN", "IFVVM"],
            "correct_index": 1,
            "explanation": "Alphabetical complementary pairs (sum = 27): Q(17)↔J(10), U(21)↔F(6), E(5)↔V(22), E(5)↔V(22), N(14)↔M(13). Result = JFVVM."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to an executive in an organizational chart, Neha says, 'His daughter is the only granddaughter of my father.' How is Neha related to that executive if Neha has no sisters?",
            "options": ["Sister", "Wife", "Mother", "Daughter"],
            "correct_index": 1,
            "explanation": "Neha's father's only granddaughter is Neha's daughter. Since the executive's daughter is also Neha's daughter, the executive is Neha's husband, making Neha his wife."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All algorithms are programs. All programs are instructions. No instruction is a hardware. Conclusions: I. All algorithms are instructions. II. No hardware is a program.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Algorithms are inside programs, which are inside instructions, so all algorithms are instructions (I follows). Since programs are inside instructions and no instruction is hardware, no hardware is a program (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "COMPASS : DIRECTION :: SPHYGMOMANOMETER : ?",
            "options": ["Heart Rate", "Blood Pressure", "Temperature", "Oxygen Level"],
            "correct_index": 1,
            "explanation": "A compass measures direction; a sphygmomanometer measures blood pressure."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A traveler walks 10 km South, turns right and walks 6 km, turns right again and walks 10 km. How far and in what direction is he from his start?",
            "options": ["6 km West", "6 km East", "10 km South", "16 km West"],
            "correct_index": 0,
            "explanation": "South 10 km and North 10 km cancel out. He is 6 km West of his starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 17, 19, 23, 29, 33",
            "options": ["19", "23", "29", "33"],
            "correct_index": 3,
            "explanation": "17, 19, 23, and 29 are prime numbers; 33 is a composite number (3 × 11)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'PERSPICACIOUS':",
            "options": ["Insightful", "Ignorant", "Confused", "Careless"],
            "correct_index": 0,
            "explanation": "'Perspicacious' means having a ready insight into and understanding of things; insightful."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'MAGNANIMOUS':",
            "options": ["Generous", "Forgiving", "Petty", "Noble"],
            "correct_index": 2,
            "explanation": "'Magnanimous' means generous or forgiving, especially toward a rival. Its direct antonym is 'Petty'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the sentence that correctly constructs an inverted third conditional (past counterfactual) structure:",
            "options": [
                "Had the load balancer failed, the standby server would have assumed traffic.",
                "Had the load balancer failed, the standby server would assumed traffic.",
                "Had the load balancer failed, the standby server will have assumed traffic.",
                "Had the load balancer fail, the standby server would have assumed traffic."
            ],
            "correct_index": 0,
            "explanation": "Inverted third conditional: 'Had + subject + past participle, ... would have + past participle'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The engineering lead was exonerated ___ any wrongdoing in the system outage.",
            "options": ["from", "of", "with", "against"],
            "correct_index": 0,
            "explanation": "'Exonerated from' (or 'exonerated of') is standard; 'exonerated from blame' is the primary usage."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to weather the storm' mean?",
            "options": [
                "To study meteorology",
                "To successfully survive a difficult situation or crisis",
                "To cause damage in bad weather",
                "To predict rainfall accurately"
            ],
            "correct_index": 1,
            "explanation": "'To weather the storm' means to successfully endure or survive a period of difficulty."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A leader who seeks support by appealing to popular desires and prejudices rather than by using rational argument'",
            "options": ["Demagogue", "Pedagogue", "Autocrat", "Plutocrat"],
            "correct_index": 0,
            "explanation": "A 'Demagogue' is a political leader who seeks support by appealing to popular desires and prejudices rather than by rational argument."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are the Principal Engineer and discover that an executive decision was made to ship a mission-critical banking application without end-to-end encryption to meet an artificial deadline. What is your ethical obligation?",
            "options": [
                "Stay silent because management has final authority.",
                "Formally submit a written Risk & Compliance Memo detailing the regulatory non-compliance, explain liability risks to C-level executives, and demand encryption remediation before public traffic.",
                "Quit without telling anyone.",
                "Post internal company secrets on Reddit."
            ],
            "correct_index": 1,
            "explanation": "Senior engineering ethics mandate formal documentation of security and regulatory liabilities to protect consumers and corporate fiduciary duty."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team has successfully delivered a multi-million dollar digital transformation contract ahead of schedule. As the team lead, how do you celebrate and close the engagement?",
            "options": [
                "Take all the bonus compensation for yourself.",
                "Organize a team celebration, formally write individualized commendations to executives highlighting each contributor's impact, conduct a retrospective, and archive documentation.",
                "Immediately start the next project without acknowledging the team's achievement.",
                "Dismiss the achievement as ordinary."
            ],
            "correct_index": 1,
            "explanation": "World-class engineering leaders recognize individual contributions, celebrate shared milestones, and preserve institutional knowledge through retrospective documentation."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A junior engineer who you mentored six months ago is recognized company-wide for a major architectural innovation. What is the most fulfilling leadership response?",
            "options": [
                "Feel resentful that they are getting more attention than you.",
                "Publicly celebrate their growth, congratulate them enthusiastically, and take pride in having contributed to their professional development.",
                "Claim that you wrote all the code for them.",
                "Ignore their achievement."
            ],
            "correct_index": 1,
            "explanation": "True engineering leaders measure their own success by the growth, leadership, and independence of those they mentor."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are building a $500 million technology company. What foundational principle should guide your engineering and product decisions every single day?",
            "options": [
                "Cut corners and deliver superficial features as fast as possible.",
                "Relentless customer focus, uncompromising software quality, transparent communication, and building durable value that scales with integrity.",
                "Focus exclusively on short-term vanity metrics and hype.",
                "Avoid technical innovation to minimize effort."
            ],
            "correct_index": 1,
            "explanation": "Building an enduring half-billion-dollar enterprise requires relentless customer empathy, engineering excellence, high integrity, and scalable architectural discipline."
        }
    ]
}

# Fix question 10 of SET_20
SET_20["questions"][9]["question_text"] = "In a certain code, 'KING' is coded as 'PRMT' (complementary reverse letter pairs where A=Z, B=Y, etc.). How is 'QUEEN' coded in that same scheme?"
SET_20["questions"][9]["options"] = ["JFHHM", "JFVVM", "JFVVN", "IFVVM"]
SET_20["questions"][9]["correct_index"] = 1
SET_20["questions"][9]["explanation"] = "Using complementary reverse alphabet pairs (sum of alphabetical positions = 27): Q(17)↔J(10), U(21)↔F(6), E(5)↔V(22), E(5)↔V(22), N(14)↔M(13). The coded word is JFVVM."

PART_4_SETS = [SET_16, SET_17, SET_18, SET_19, SET_20]
