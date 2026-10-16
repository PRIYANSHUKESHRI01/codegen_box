# Sets 21 to 25 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_21 = {
    "set_number": 21,
    "title": "Soft Skill Assessment - Set 21",
    "slug": "soft-skill-assessment-set-21",
    "description": "Evaluates commercial mathematics, deductive arrangements, contextual business English, and architectural sprint communication.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A dishonest dealer sells goods at a 10% loss on cost price but uses a weight that is 20% less than the true weight. What is his actual profit or loss percentage?",
            "options": ["10% profit", "12.5% profit", "15% profit", "12.5% loss"],
            "correct_index": 1,
            "explanation": "Let true cost of 1000g be ₹1000. Selling price for 1000g nominal = 1000 × 0.90 = ₹900. But he delivers only 800g (20% less). Cost of 800g to dealer = ₹800. Profit = 900 - 800 = ₹100. Profit % = (100 / 800) × 100 = 12.5% profit."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 25% of a number is subtracted from the number itself, the result is 150. What is the number?",
            "options": ["180", "190", "200", "220"],
            "correct_index": 2,
            "explanation": "x - 0.25x = 150 => 0.75x = 150 => x = 150 / 0.75 = 200."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train passes two men walking in the direction opposite to that of the train at speeds of 5 m/s and 10 m/s in 6 seconds and 5 seconds respectively. What is the length of the train?",
            "options": ["120 m", "150 m", "180 m", "200 m"],
            "correct_index": 1,
            "explanation": "Let train speed be v (m/s) and length be L. L = (v + 5) × 6 and L = (v + 10) × 5. 6v + 30 = 5v + 50 => v = 20 m/s. Length L = (20 + 5) × 6 = 25 × 6 = 150 m."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Pipe A can fill an oil cistern in 15 minutes, Pipe B in 20 minutes, and Pipe C can empty it in 30 minutes. If all three pipes are kept open simultaneously in an empty cistern, in how many minutes will it be full?",
            "options": ["10 minutes", "12 minutes", "14 minutes", "15 minutes"],
            "correct_index": 1,
            "explanation": "Net rate per minute = 1/15 + 1/20 - 1/30 = (4 + 3 - 2)/60 = 5/60 = 1/12. It takes 12 minutes to fill the cistern."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the difference between the compound interest and simple interest on ₹15,000 for 2 years at 8% per annum.",
            "options": ["₹84", "₹92", "₹96", "₹104"],
            "correct_index": 2,
            "explanation": "Difference between CI and SI for 2 years = P × (R/100)² = 15,000 × (8/100)² = 15,000 × (64/10,000) = 1.5 × 64 = ₹96."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 8 consecutive even numbers is 43. What is the sum of the smallest and largest of these numbers?",
            "options": ["82", "84", "86", "88"],
            "correct_index": 2,
            "explanation": "In an arithmetic progression, the sum of the first and last term is equal to twice the average: 2 × 43 = 86 (the numbers are 36, 38, 40, 42, 44, 46, 48, 50; 36 + 50 = 86)."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can complete a piece of work in 24 days, and B in 36 days. If they work on alternate days starting with A, in how many days will the work be completed?",
            "options": ["28 days", "28.5 days", "29 days", "29.5 days"],
            "correct_index": 1,
            "explanation": "Total work = LCM(24, 36) = 72 units. A's daily rate = 3 units, B's daily rate = 2 units. In a 2-day cycle, work completed = 3 + 2 = 5 units. In 14 cycles (28 days), work completed = 14 × 5 = 70 units. Remaining work = 72 - 70 = 2 units. On day 29, A does 2 units at rate of 3 units/day, taking 2/3 of a day ≈ wait, 28 + 2/3 days = 28.67 days. Let's make exact: If A=20, B=30 (LCM=60): cycle = 3+2=5. 12 cycles = 24 days. Or if A=12, B=16 (LCM=48, rate 4+3=7). Let's use clean numbers: 'A can do a work in 10 days, B in 15 days. Working on alternate days starting with A, in how many days will it be finished? LCM=30, cycle = 3+2=5. 6 cycles = 12 days.'"
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the units digit of the product (784 × 618 × 917 × 463)?",
            "options": ["2", "4", "6", "8"],
            "correct_index": 0,
            "explanation": "Multiply the units digits: 4 × 8 = 32 (units digit 2). 2 × 7 = 14 (units digit 4). 4 × 3 = 12 (units digit 2). The units digit is 2."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 7, 26, 63, 124, 215, ?",
            "options": ["340", "342", "344", "346"],
            "correct_index": 1,
            "explanation": "Pattern: n³ - 1: 2³-1=7, 3³-1=26, 4³-1=63, 5³-1=124, 6³-1=215, 7³-1 = 343 - 1 = 342."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'ORBIT' is written as 'PQEKW'. How is 'PLANET' written in that scheme?",
            "options": ["QNCPGV", "QNDPGW", "QNCPGW", "QMDOGV"],
            "correct_index": 2,
            "explanation": "Shifts: O(15)+1=P, R(18)-1=Q? Let's check: O(+1)=P, R(-1)=Q? No, R(18) to Q is -1. B(2)+3=E. I(9)+2=K? Let's use systematic shift: O(+1)→P, R(+2)→T? Let's write clear shift: In a certain code, 'ORBIT' is written as 'PSDJU' (each letter shifted +1: O→P, R→S, B→C? wait: B+2=D, I+1=J, T+1=U). Let's use clean standard +2 shift: In a code, 'CLOUD' is written as 'ENQWF'. How is 'RAINY' written? R(18)+2=T, A(1)+2=C, I(9)+2=K, N(14)+2=P, Y(25)+2=A => TCKPA."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a girl said, 'He is the only son of the father of my brother-in-law's wife.' If the brother-in-law has only one brother, how is the man related to the girl's sister?",
            "options": ["Brother", "Uncle", "Father", "Husband"],
            "correct_index": 0,
            "explanation": "My brother-in-law's wife is my sister. The father of my sister is my father. The only son of my father is my brother (and my sister's brother)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: No printer is a scanner. All scanners are photocopiers. Some photocopiers are fax machines. Conclusions: I. Some photocopiers are not printers. II. Some fax machines are scanners.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 0,
            "explanation": "Since all scanners are photocopiers and no scanner is a printer, those photocopiers which are scanners cannot be printers (I follows). Fax machines only have a partial overlap with photocopiers, not necessarily scanners (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "SCULPTURE : CHISEL :: PAINTING : ?",
            "options": ["Brush", "Canvas", "Palette", "Frame"],
            "correct_index": 0,
            "explanation": "A chisel is the primary creating tool used to carve a sculpture; a brush is the primary creating tool used to create a painting."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A drone flies 8 km South, turns West and flies 6 km, then turns North and flies 8 km. How far is the drone from its takeoff pad?",
            "options": ["4 km", "6 km", "8 km", "10 km"],
            "correct_index": 1,
            "explanation": "South 8 km and North 8 km cancel out. The drone is exactly 6 km West of the takeoff pad."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out among the numbers: 28, 42, 56, 70, 85",
            "options": ["42", "56", "70", "85"],
            "correct_index": 3,
            "explanation": "28, 42, 56, and 70 are all divisible by 14; 85 is not."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'ANACHRONISTIC':",
            "options": ["Timeless", "Outdated in time", "Punctual", "Futuristic"],
            "correct_index": 1,
            "explanation": "'Anachronistic' means belonging or appropriate to an earlier period, out of date or chronologically misplaced."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'FASTIDIOUS':",
            "options": ["Meticulous", "Careless", "Punctual", "Demanding"],
            "correct_index": 1,
            "explanation": "'Fastidious' means very attentive to and concerned about accuracy and detail. Its antonym is 'Careless' (or easy-going)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence that correctly employs the subjunctive mood after a verb of recommendation:",
            "options": [
                "The architect recommended that the database cluster is reconfigured.",
                "The architect recommended that the database cluster be reconfigured.",
                "The architect recommended that the database cluster was reconfigured.",
                "The architect recommended that the database cluster should be reconfigured."
            ],
            "correct_index": 1,
            "explanation": "Mandative subjunctive constructions use the base form of the verb ('that the cluster be reconfigured')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The compliance officer was oblivious ___ the architectural security violations in the subsystem.",
            "options": ["of", "to", "for", "with"],
            "correct_index": 1,
            "explanation": "'Oblivious to' is the standard modern English idiom (or 'oblivious of', but 'oblivious to' is the primary modern standard)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to burn the candle at both ends' mean?",
            "options": [
                "To waste lighting resources unnecessarily",
                "To work excessively hard from early morning until late at night",
                "To ignite a dual fire hazard",
                "To divide an engineering task equally"
            ],
            "correct_index": 1,
            "explanation": "'To burn the candle at both ends' means to exhaust oneself by doing too much, especially going to bed late and getting up early."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who acts as a diplomat and promotes goodwill between organizations'",
            "options": ["Ambassador", "Mercenary", "Bureaucrat", "Partisan"],
            "correct_index": 0,
            "explanation": "An 'Ambassador' is an official envoy, diplomat, or promoter of goodwill and institutional collaboration."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During a distributed denial-of-service (DDoS) attack on your core API, the infrastructure auto-scaler costs begin spiking by $5,000 per hour. What should the incident lead do?",
            "options": [
                "Turn off all servers and let customers see an offline error.",
                "Activate Web Application Firewall (WAF) rate limiting and edge DDoS mitigation rules, analyze malicious IP patterns, and filter traffic at the CDN level rather than absorbing bad traffic with expensive compute.",
                "Ignore the cost and hope the attacker gets tired.",
                "Delete the API code."
            ],
            "correct_index": 1,
            "explanation": "Mitigating volumetric attacks at the edge (CDN/WAF) drops malicious traffic before it hits compute, preventing cloud billing runaway."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A client notices that your team's software is logging IP addresses and asks whether this violates GDPR compliance. How should the engineering lead respond?",
            "options": [
                "Deny that IP addresses are ever collected.",
                "Explain the technical necessity (security audit trails, rate limiting), verify data retention windows and encryption, and provide the client with the official Data Processing Addendum (DPA).",
                "Immediately delete all system logs across all servers.",
                "Tell the client that privacy laws don't apply to your product."
            ],
            "correct_index": 1,
            "explanation": "Transparent legal compliance (DPA) and articulating legitimate security auditing interests builds enterprise client trust."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are pair-programming with a teammate who is struggling with a recursion concept. How can you best assist them?",
            "options": [
                "Grab the keyboard and write the entire solution yourself without explaining.",
                "Encourage them to draw out the call stack with a simple base case, ask guiding questions, and let them type the solution while you navigate.",
                "Tell them recursion is too advanced for them.",
                "Leave the pair-programming session."
            ],
            "correct_index": 1,
            "explanation": "Driver-navigator pair programming where the learner types and reasons through the call stack fosters deep conceptual mastery."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company has a policy requiring two peer approvals before merging to production. An executive demands an immediate hotfix push without any review. What should you do?",
            "options": [
                "Push the code immediately without review to please the executive.",
                "Expedite a 5-minute emergency peer review with an on-call senior engineer to satisfy the safety guardrail while maintaining rapid deployment speed.",
                "Refuse to talk to the executive and shut down your computer.",
                "Disable branch protection rules permanently."
            ],
            "correct_index": 1,
            "explanation": "Expediting emergency peer reviews upholds mandatory compliance and safety guardrails without causing unnecessary operational gridlock."
        }
    ]
}

# Fix question 7 and 10 of SET_21
SET_21["questions"][6]["question_text"] = "A can do a piece of work in 10 days and B in 15 days. If they work on alternate days starting with A, in how many days will the work be completed?"
SET_21["questions"][6]["options"] = ["10 days", "11 days", "12 days", "13 days"]
SET_21["questions"][6]["correct_index"] = 2
SET_21["questions"][6]["explanation"] = "Total work = LCM(10, 15) = 30 units. A's rate = 3 units/day, B's rate = 2 units/day. In a 2-day cycle, work done = 3 + 2 = 5 units. To complete 30 units: (30 / 5) = 6 cycles = 6 × 2 = 12 days."

SET_21["questions"][9]["question_text"] = "In a certain code, 'CLOUD' is written as 'ENQWF'. How is 'RAINY' written in that same pattern?"
SET_21["questions"][9]["options"] = ["TCKPA", "UCKPA", "TCKPB", "SCKOA"]
SET_21["questions"][9]["correct_index"] = 0
SET_21["questions"][9]["explanation"] = "Each letter is shifted forward by 2: R(18)+2=T, A(1)+2=C, I(9)+2=K, N(14)+2=P, Y(25)+2=A, yielding TCKPA."

SET_22 = {
    "set_number": 22,
    "title": "Soft Skill Assessment - Set 22",
    "slug": "soft-skill-assessment-set-22",
    "description": "Tests alligation ratios, blood relationship networks, structural business English, and high-stakes cross-team coordination.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In what ratio must a merchant mix two varieties of tea costing ₹180 per kg and ₹240 per kg, so that by selling the mixture at ₹231 per kg, he gains 10%?",
            "options": ["1:1", "2:1", "1:2", "3:2"],
            "correct_index": 0,
            "explanation": "Selling price of mixture = ₹231 at 10% gain => Mean cost price = 231 / 1.10 = ₹210 per kg. Using alligation: (240 - 210) : (210 - 180) = 30 : 30 = 1:1."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A student scored 28% marks and failed by 14 marks. Another student scored 36% marks and obtained 18 marks more than the minimum passing marks. What was the maximum marks in the exam?",
            "options": ["350", "400", "450", "500"],
            "correct_index": 1,
            "explanation": "Difference in percentage = 36% - 28% = 8%. Difference in marks = 18 - (-14) = 32 marks. Total maximum marks = (32 / 8) × 100 = 400."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A motorboat whose speed in still water is 15 km/h goes 30 km downstream and comes back in a total of 4 hours 30 minutes. What is the speed of the stream?",
            "options": ["3 km/h", "4 km/h", "5 km/h", "6 km/h"],
            "correct_index": 2,
            "explanation": "Total time = 30/(15 + s) + 30/(15 - s) = 4.5. Testing s = 5: Downstream = 30/20 = 1.5 hr. Upstream = 30/10 = 3 hr. Total = 1.5 + 3 = 4.5 hr. Thus, stream speed = 5 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Three pipes A, B and C can fill a cistern in 6 hours. After working together for 2 hours, C is closed and A and B fill the remaining part in 7 hours. The number of hours taken by C alone to fill the cistern is:",
            "options": ["12 hours", "14 hours", "16 hours", "18 hours"],
            "correct_index": 1,
            "explanation": "Work done in 2 hours = 2/6 = 1/3. Remaining work = 2/3. (A + B) do 2/3 work in 7 hours => (A + B) full time = 7 × (3/2) = 10.5 hr = 21/2 hr. Rate of C = 1/6 - 2/21 = (7 - 4)/42 = 3/42 = 1/14. C takes 14 hours alone."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A committee of 5 members is to be formed from 6 men and 5 women. In how many ways can the committee be chosen if it must have a majority of women?",
            "options": ["186", "222", "236", "252"],
            "correct_index": 1,
            "explanation": "Majority of women in 5 members means either 3 women & 2 men, 4 women & 1 man, or 5 women & 0 men. Ways = (5C3 × 6C2) + (5C4 × 6C1) + (5C5 × 6C0) = (10 × 15) + (5 × 6) + (1 × 1) = 150 + 30 + 1 = 181? Wait: 5C3 = 10, 6C2 = 15 => 150. 5C4 = 5, 6C1 = 6 => 30. 5C5 = 1, 6C0 = 1 => 1. Total = 181! Let's check 6 men and 4 women or 5 men and 5 women? If 5 men and 5 women: (5C3 × 5C2) + (5C4 × 5C1) + (5C5 × 5C0) = (10 × 10) + (5 × 5) + 1 = 126. Let's make options exact: 'A committee of 5 is to be formed from 5 men and 5 women with majority of women: (5C3 × 5C2) + (5C4 × 5C1) + 1 = 100 + 25 + 1 = 126.'"
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The simple interest on a sum of money is 4/9 of the principal and the number of years is equal to the annual rate percent. What is the rate percent?",
            "options": ["5%", "6%", "6.67%", "8%"],
            "correct_index": 2,
            "explanation": "SI = (P × R × T) / 100. Given SI = (4/9)P and T = R => (4/9)P = (P × R²) / 100 => R² = 400/9 => R = 20/3 = 6.67%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average monthly salary of 20 employees in an office is ₹35,000. If the manager's salary is included, the average increases by ₹2,000. What is the manager's monthly salary?",
            "options": ["₹70,000", "₹75,000", "₹77,000", "₹80,000"],
            "correct_index": 2,
            "explanation": "Manager's salary = New average + (Original count × increase) = 37,000 + (20 × 2,000) = 37,000 + 40,000 = ₹77,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the HCF of 144, 216, and 324?",
            "options": ["18", "24", "36", "72"],
            "correct_index": 2,
            "explanation": "144 = 36 × 4, 216 = 36 × 6, 324 = 36 × 9. Highest common factor = 36."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Complete the series: 4, 9, 25, 49, 121, ?",
            "options": ["144", "169", "196", "225"],
            "correct_index": 1,
            "explanation": "Squares of consecutive prime numbers: 2²=4, 3²=9, 5²=25, 7²=49, 11²=121, 13²=169."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'RIVER' is written as '18-9-22-5-18'. How is 'OCEAN' written?",
            "options": ["15-3-5-1-14", "15-3-6-1-14", "14-3-5-1-14", "15-2-5-1-14"],
            "correct_index": 0,
            "explanation": "Direct alphabetical positions: O=15, C=3, E=5, A=1, N=14, giving 15-3-5-1-14."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A's mother is sister of B and has a daughter C. How can A be related to B if A is male?",
            "options": ["Nephew", "Uncle", "Father", "Brother"],
            "correct_index": 0,
            "explanation": "A is the son of B's sister. The son of one's sister is a nephew."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All routers are gateways. Some gateways are bridges. No bridge is a switch. Conclusions: I. Some gateways are routers. II. Some gateways are not switches.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Since all routers are gateways, some gateways are routers (I follows). Since some gateways are bridges and no bridge is a switch, those bridge-gateways cannot be switches (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "COIN : MINT :: WINE : ?",
            "options": ["Vineyard", "Brewery", "Distillery", "Cellar"],
            "correct_index": 0,
            "explanation": "A coin is manufactured in a mint; wine is produced in a winery or vineyard/winery (Vineyard/Winery)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A cyclist rides 12 km West, turns left and rides 9 km. How far is he from his starting point?",
            "options": ["15 km", "16 km", "18 km", "21 km"],
            "correct_index": 0,
            "explanation": "Shortest distance = √(12² + 9²) = √(144 + 81) = √225 = 15 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 125, 216, 343, 484, 512",
            "options": ["216", "343", "484", "512"],
            "correct_index": 2,
            "explanation": "125=5³, 216=6³, 343=7³, 512=8³. 484 is 22² (a square, not a cube)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'GREGARIOUS':",
            "options": ["Sociable", "Introverted", "Aggressive", "Hostile"],
            "correct_index": 0,
            "explanation": "'Gregarious' means fond of company; sociable."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'TACIT':",
            "options": ["Implied", "Explicit", "Silent", "Unstated"],
            "correct_index": 1,
            "explanation": "'Tacit' means understood or implied without being stated. Its direct antonym is 'Explicit'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the sentence that correctly applies the correlative pair 'not only... but also' with parallel predicates:",
            "options": [
                "The patch not only fixed the latency issue but also reduced memory usage.",
                "The patch not only fixed the latency issue but also it reduced memory usage.",
                "The patch fixed not only the latency issue but also reducing memory usage.",
                "Not only the patch fixed the latency issue but also reduced memory usage."
            ],
            "correct_index": 0,
            "explanation": "Both elements after 'not only' and 'but also' must be grammatically parallel past tense verbs ('fixed... reduced')."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The team members were all privy ___ the confidential acquisition discussions.",
            "options": ["of", "to", "with", "at"],
            "correct_index": 1,
            "explanation": "'Privy to' is the standard English idiom meaning sharing in the knowledge of something secret."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to jump the gun' mean?",
            "options": [
                "To engage in track and field athletics",
                "To act prematurely before the proper or permitted time",
                "To avoid a dangerous hazard",
                "To cause unnecessary panic"
            ],
            "correct_index": 1,
            "explanation": "'To jump the gun' means to act or start doing something too early, before the proper time."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who is known for exceptional knowledge and discerning taste in culinary arts or fine wine'",
            "options": ["Connoisseur", "Gourmand", "Philistine", "Ascetic"],
            "correct_index": 0,
            "explanation": "A 'Connoisseur' is an expert judge in matters of taste and fine arts."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your automated CI/CD pipeline triggers an alert indicating that a new database index migration will cause a table lock for 30 minutes on a 50M-row production table. What is the correct engineering response?",
            "options": [
                "Execute the migration during peak traffic anyway.",
                "Cancel the immediate deploy, research non-blocking concurrent index creation syntax (e.g., CREATE INDEX CONCURRENTLY in PostgreSQL), test it in staging, and re-schedule.",
                "Delete half the database rows to make the migration faster.",
                "Disable all indexes permanently."
            ],
            "correct_index": 1,
            "explanation": "High-availability databases require online, non-blocking concurrent DDL statements to prevent prolonged production table locks."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An executive sponsor asks your engineering team to skip writing automated end-to-end regression tests for a new checkout feature to meet an end-of-quarter deadline. How should you respond?",
            "options": [
                "Refuse rudely and file a grievance with HR.",
                "Explain that skipping automated regression tests creates compounding technical debt and high risk of revenue loss, and propose launching a scoped MVP with complete test coverage instead.",
                "Delete all existing tests to prove you are fast.",
                "Agree to write tests after production releases, knowing they will never get done."
            ],
            "correct_index": 1,
            "explanation": "Negotiating scope reduction while maintaining automated test integrity protects customer reliability and prevents production regressions."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You notice that an internal Slack channel contains repeated jokes making light of mental health and neurodiversity. What should you do?",
            "options": [
                "Join in the joking to fit in with the group.",
                "Speak up respectfully in the channel or report the behavior to people operations to uphold an inclusive, safe workplace culture.",
                "Forward the jokes to external social media.",
                "Stay silent and ignore it."
            ],
            "correct_index": 1,
            "explanation": "Upholding an inclusive workplace requires active allyship and setting clear professional boundaries against exclusionary humor."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an interview debrief, a colleague votes against hiring a candidate solely based on the candidate's university background, despite outstanding problem-solving and system design scores. How do you respond?",
            "options": [
                "Agree that only graduates from top colleges should be hired.",
                "Advocate for meritocracy, point to the candidate's concrete rubric scores on algorithms and system design, and redirect the evaluation to documented job competencies.",
                "Accuse your colleague of malice and shout.",
                "Ignore the debrief and leave the room."
            ],
            "correct_index": 1,
            "explanation": "Objective competency-based hiring anchors decisions to demonstrated skills on the evaluation rubric rather than pedigree bias."
        }
    ]
}

# Fix question 5 of SET_22
SET_22["questions"][4]["question_text"] = "A committee of 5 members is to be formed from 5 men and 5 women. In how many ways can the committee be chosen if it must have a majority of women?"
SET_22["questions"][4]["options"] = ["116", "126", "136", "146"]
SET_22["questions"][4]["correct_index"] = 1
SET_22["questions"][4]["explanation"] = "Majority of women in 5 members means either (3 women, 2 men), (4 women, 1 man), or (5 women, 0 men). Ways = (5C3 × 5C2) + (5C4 × 5C1) + (5C5 × 5C0) = (10 × 10) + (5 × 5) + (1 × 1) = 100 + 25 + 1 = 126."

SET_23 = {
    "set_number": 23,
    "title": "Soft Skill Assessment - Set 23",
    "slug": "soft-skill-assessment-set-23",
    "description": "Evaluates speed-distance mechanics, deductive syllogisms, advanced syntax, and crisis incident management.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains start at the same time from stations A and B, 200 km apart, and travel towards each other. They meet after 2 hours. If one train travels 10 km/h faster than the other, what is the speed of the faster train?",
            "options": ["45 km/h", "50 km/h", "55 km/h", "60 km/h"],
            "correct_index": 2,
            "explanation": "Relative speed = Distance / Time = 200 / 2 = 100 km/h. Let speeds be v and (v + 10). v + v + 10 = 100 => 2v = 90 => v = 45 km/h. Faster train speed = 45 + 10 = 55 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 8 men can complete a project in 15 days working 6 hours a day, in how many days can 10 men finish the same project working 8 hours a day?",
            "options": ["8 days", "9 days", "10 days", "12 days"],
            "correct_index": 1,
            "explanation": "M1 × D1 × H1 = M2 × D2 × H2 => 8 × 15 × 6 = 10 × D2 × 8 => 720 = 80 × D2 => D2 = 9 days."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹8,000 invested at compound interest grows to ₹9,261 in 3 years. What is the rate of interest per annum, compounded annually?",
            "options": ["4%", "5%", "6%", "7%"],
            "correct_index": 1,
            "explanation": "A/P = 9261 / 8000 = (21/20)³ = (1 + 1/20)³ = (1 + 5/100)³. Thus, annual interest rate r = 5%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes can fill a cistern in 12 minutes and 15 minutes respectively. An outlet pipe can drain 30 litres per minute. If all three pipes working together fill the empty cistern in 20 minutes, what is the capacity of the cistern?",
            "options": ["300 litres", "360 litres", "400 litres", "450 litres"],
            "correct_index": 0,
            "explanation": "Drain pipe rate = 1/12 + 1/15 - 1/20 = (5 + 4 - 3)/60 = 6/60 = 1/10 cistern/min. The drain pipe takes 10 minutes to empty the full cistern. Capacity = 10 minutes × 30 L/min = 300 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the probability that a leap year selected at random will contain 53 Sundays?",
            "options": ["1/7", "2/7", "3/7", "5/7"],
            "correct_index": 1,
            "explanation": "A leap year has 366 days = 52 weeks + 2 extra days. The 2 extra days can be (Sun,Mon), (Mon,Tue), (Tue,Wed), (Wed,Thu), (Thu,Fri), (Fri,Sat), or (Sat,Sun) [7 possibilities]. Sunday appears in 2 of these pairs: (Sat,Sun) and (Sun,Mon). Probability = 2/7."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The marked price of a tablet is ₹18,000. If the dealer offers a discount of 15%, what is the selling price?",
            "options": ["₹14,800", "₹15,100", "₹15,300", "₹15,500"],
            "correct_index": 2,
            "explanation": "Selling price = 18,000 × (1 - 0.15) = 18,000 × 0.85 = ₹15,300."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average of 25 results is 18. That of the first 12 is 14 and that of the last 12 is 17. What is the value of the 13th result?",
            "options": ["72", "76", "78", "82"],
            "correct_index": 2,
            "explanation": "Total sum = 25 × 18 = 450. Sum of first 12 = 12 × 14 = 168. Sum of last 12 = 12 × 17 = 204. 13th result = 450 - (168 + 204) = 450 - 372 = 78."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the simple interest on ₹6,800 at 12% per annum for 9 months.",
            "options": ["₹580", "₹612", "₹640", "₹680"],
            "correct_index": 1,
            "explanation": "Time = 9/12 = 0.75 years. SI = (6800 × 12 × 0.75) / 100 = 68 × 9 = ₹612."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 2, 12, 36, 80, 150, ?",
            "options": ["240", "252", "264", "280"],
            "correct_index": 1,
            "explanation": "Pattern: n³ + n²: 1³+1²=2, 2³+2²=12, 3³+3²=36, 4³+4²=80, 5³+5²=150, 6³+6² = 216 + 36 = 252."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'EARTH' is coded as 'HDVUK', how is 'VENUS' coded in that same pattern?",
            "options": ["YHQXV", "YHRXV", "YHQVW", "XHQXV"],
            "correct_index": 0,
            "explanation": "Each letter shifted +3: V(22)+3=Y, E(5)+3=H, N(14)+3=Q, U(21)+3=X, S(19)+3=V, yielding YHQXV."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to an old man, Kailash said, 'His son is my son's uncle.' How is the old man related to Kailash?",
            "options": ["Brother", "Father", "Uncle", "Grandfather"],
            "correct_index": 1,
            "explanation": "Kailash's son's uncle is Kailash's brother. If the old man's son is Kailash's brother, the old man is Kailash's father."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All laptops are screens. All screens are displays. Some displays are monitors. Conclusions: I. All laptops are displays. II. Some monitors are laptops.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 0,
            "explanation": "Laptops are inside screens, which are inside displays, so all laptops are displays (I follows). Monitors only intersect displays, not necessarily laptops (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "COURT : JUSTICE :: SCHOOL : ?",
            "options": ["Teacher", "Education", "Student", "Classroom"],
            "correct_index": 1,
            "explanation": "A court is an institution dedicated to administering justice; a school is an institution dedicated to providing education."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A hiker walks 15 km North, turns right and walks 8 km. What is the shortest distance back to his starting point?",
            "options": ["17 km", "19 km", "21 km", "23 km"],
            "correct_index": 0,
            "explanation": "Distance = √(15² + 8²) = √(225 + 64) = √289 = 17 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 19, 23, 29, 37, 45",
            "options": ["23", "29", "37", "45"],
            "correct_index": 3,
            "explanation": "19, 23, 29, and 37 are prime numbers; 45 is a composite number (9 × 5)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'NEFARIOUS':",
            "options": ["Wicked", "Honorable", "Admirable", "Generous"],
            "correct_index": 0,
            "explanation": "'Nefarious' means wicked, villainous, or criminal."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'LOQUACIOUS':",
            "options": ["Talkative", "Reticent", "Garrulous", "Verbose"],
            "correct_index": 1,
            "explanation": "'Loquacious' means tending to talk a great deal. Its direct antonym is 'Reticent' (silent, reserved)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the sentence with correct punctuation and comma usage with introductory clauses:",
            "options": [
                "Although the automated test suite passed the deployment was delayed due to latency spikes.",
                "Although the automated test suite passed, the deployment was delayed due to latency spikes.",
                "Although, the automated test suite passed the deployment was delayed due to latency spikes.",
                "Although the automated test suite passed; the deployment was delayed due to latency spikes."
            ],
            "correct_index": 1,
            "explanation": "An introductory dependent clause starting with 'Although' requires a separating comma before the main independent clause."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The engineering lead was reluctant to part ___ the proprietary machine learning training weights.",
            "options": ["with", "from", "of", "to"],
            "correct_index": 0,
            "explanation": "'Part with' is the correct prepositional collocation when referring to giving up possession of an item."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to leave someone in the lurch' mean?",
            "options": [
                "To leave someone in a difficult situation without help",
                "To give someone an unexpected surprise gift",
                "To guide someone through an unfamiliar maze",
                "To introduce someone to new colleagues"
            ],
            "correct_index": 0,
            "explanation": "'To leave someone in the lurch' means to abandon or desert someone in a difficult or awkward predicament."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'One who walks in their sleep'",
            "options": ["Somnambulist", "Somniloquist", "Altruist", "Insomniac"],
            "correct_index": 0,
            "explanation": "A 'Somnambulist' is a person who sleepwalks."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A developer on your squad repeatedly pushes code directly to the main branch bypassing pull request CI/CD gates. How should the engineering lead address this?",
            "options": [
                "Revoke their entire GitHub access without saying anything.",
                "Configure branch protection rules to programmatically enforce PR reviews, and have a private mentoring session explaining how branch gates protect production stability.",
                "Shout at them in the all-hands meeting.",
                "Ignore the behavior."
            ],
            "correct_index": 1,
            "explanation": "Automating branch protection eliminates human error while private mentoring reinforces the systemic rationale for code review."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's software depends on a third-party SMS vendor that begins dropping 40% of verification codes during peak hours. What should the engineering lead do?",
            "options": [
                "Tell users that SMS verification is impossible.",
                "Implement an automated multi-vendor fallback routing mechanism so failed SMS messages seamlessly retry across a secondary provider like Twilio or AWS SNS.",
                "Turn off two-factor authentication for all accounts.",
                "Wait two weeks for the vendor to fix their servers."
            ],
            "correct_index": 1,
            "explanation": "Enterprise resilience mandates multi-provider redundancy for critical customer verification funnels."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You are assigned to onboard a new software engineer who has never worked with your cloud platform before. What is the most effective approach?",
            "options": [
                "Tell them to read the entire AWS documentation library.",
                "Set up their developer environment together, walk through a 'Good First Issue' pull request, and schedule daily 15-minute syncs during their first sprint.",
                "Assign them a complex distributed systems bug on day one.",
                "Leave them alone until they ask for help."
            ],
            "correct_index": 1,
            "explanation": "Guided walkthroughs of starter tasks and dedicated daily touchpoints accelerate developer onboarding and confidence."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A critical customer discovers that an API endpoint returns slightly stale data due to a Redis cache invalidation lag. How do you communicate this?",
            "options": [
                "Deny that caching exists.",
                "Acknowledge the eventual consistency trade-off transparently, provide documentation on the cache TTL window, and offer an option to bypass cache via an explicit query parameter if real-time consistency is mandatory.",
                "Delete the Redis cache and slow down the entire platform.",
                "Blame the customer for querying too frequently."
            ],
            "correct_index": 1,
            "explanation": "Explaining architectural eventual consistency while providing a synchronous cache-bypass option empowers enterprise customers."
        }
    ]
}

SET_24 = {
    "set_number": 24,
    "title": "Soft Skill Assessment - Set 24",
    "slug": "soft-skill-assessment-set-24",
    "description": "Tests proportional work kinetics, logical seating arrangements, verbal precision, and executive risk governance.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A work can be completed by 12 men in 18 days. Six days after they started working, 4 more men joined them. How many days will all of them take to complete the remaining work?",
            "options": ["8 days", "9 days", "10 days", "12 days"],
            "correct_index": 1,
            "explanation": "Remaining work for 12 men = 18 - 6 = 12 days of work. Total man-days remaining = 12 × 12 = 144 man-days. New number of men = 12 + 4 = 16 men. Time = 144 / 16 = 9 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio of milk and water in 55 litres of mixture is 7:4. How much water must be added to make the ratio 7:6?",
            "options": ["8 litres", "10 litres", "12 litres", "14 litres"],
            "correct_index": 1,
            "explanation": "Milk = (7/11) × 55 = 35 litres. Water = (4/11) × 55 = 20 litres. To have Milk:Water = 7:6 with 35 litres of milk: Water needed = (6/7) × 35 = 30 litres. Additional water = 30 - 20 = 10 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 180 m long moving at 72 km/h overtakes another train 120 m long moving in the same direction at 54 km/h. In how many seconds does the faster train completely pass the slower one?",
            "options": ["50 seconds", "60 seconds", "72 seconds", "80 seconds"],
            "correct_index": 1,
            "explanation": "Total distance = 180 + 120 = 300 m. Relative speed = 72 - 54 = 18 km/h = 18 × (5/18) = 5 m/s. Time = 300 / 5 = 60 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹10,000 is divided into two parts such that simple interest on the first part for 4 years at 8% per annum is equal to simple interest on the second part for 2 years at 10% per annum. What is the first part?",
            "options": ["₹3,846", "₹4,000", "₹4,500", "₹5,000"],
            "correct_index": 0,
            "explanation": "P1 × 4 × 8 = P2 × 2 × 10 => 32 P1 = 20 P2 => P1/P2 = 20/32 = 5/8. P1 = (5/13) × 10,000 ≈ ₹3,846.15."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can 7 different books be distributed among 3 students such that each student gets at least one book?",
            "options": ["1,806", "1,890", "2,100", "2,187"],
            "correct_index": 0,
            "explanation": "Using Stirling numbers of second kind or inclusion-exclusion: 3^7 - 3C1 × 2^7 + 3C2 × 1^7 = 2187 - 3(128) + 3(1) = 2187 - 384 + 3 = 1,806 ways."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of 30 students in a class is 14 years. When the teacher's age is included, the average increases by 1 year. What is the teacher's age?",
            "options": ["42 years", "44 years", "45 years", "48 years"],
            "correct_index": 2,
            "explanation": "Teacher's age = New average + (Original count × increase) = 15 + (30 × 1) = 15 + 30 = 45 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man covers half his journey at 30 km/h and the remaining half at 60 km/h. If his total travel time was 9 hours, what was the total distance of the journey?",
            "options": ["320 km", "360 km", "400 km", "420 km"],
            "correct_index": 1,
            "explanation": "Average speed for equal halves = (2 × 30 × 60) / (30 + 60) = 3600 / 90 = 40 km/h. Total distance = Average speed × Time = 40 × 9 = 360 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A shopkeeper buys an article for ₹500 and sells it for ₹625. What is his profit percentage?",
            "options": ["20%", "22.5%", "25%", "30%"],
            "correct_index": 2,
            "explanation": "Profit = 625 - 500 = ₹125. Profit % = (125 / 500) × 100 = 25%."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 5, 10, 26, 50, 122, ?",
            "options": ["144", "168", "170", "196"],
            "correct_index": 2,
            "explanation": "Squares of consecutive prime numbers + 1: 2²+1=5, 3²+1=10, 5²+1=26, 7²+1=50, 11²+1=122, 13²+1 = 169 + 1 = 170."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'ZEBRA' is written as '26-5-2-18-1'. How is 'TIGER' written?",
            "options": ["20-9-7-5-18", "20-9-8-5-18", "19-9-7-5-18", "20-10-7-5-18"],
            "correct_index": 0,
            "explanation": "Direct alphabetical positions: T=20, I=9, G=7, E=5, R=18, giving 20-9-7-5-18."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a woman, a man said, 'Her mother's husband's sister is my aunt.' How is the woman related to the man?",
            "options": ["Sister", "Cousin", "Mother", "Aunt"],
            "correct_index": 0,
            "explanation": "Her mother's husband is her father. Her father's sister is her aunt. If her aunt is also my aunt, she and I are siblings (or cousins). Here 'Sister' is the primary relation."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All cars are engines. No engine is an electric motor. All electric motors are batteries. Conclusions: I. No car is an electric motor. II. Some batteries are electric motors.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Cars are inside engines, and no engine is an electric motor, so no car is an electric motor (I follows). Since all electric motors are batteries, some batteries are electric motors (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "LIBRARY : BOOKS :: VAULT : ?",
            "options": ["Key", "Valuables", "Steel", "Door"],
            "correct_index": 1,
            "explanation": "A library is a secure repository for books; a vault is a secure repository for valuables/money."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man walks 7 km East, turns right and walks 24 km. How far is he from his starting point?",
            "options": ["25 km", "26 km", "28 km", "31 km"],
            "correct_index": 0,
            "explanation": "Distance = √(7² + 24²) = √(49 + 576) = √625 = 25 km."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 16, 25, 36, 48, 64",
            "options": ["25", "36", "48", "64"],
            "correct_index": 2,
            "explanation": "16=4², 25=5², 36=6², 64=8². 48 is not a perfect square."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'MUNIFICENT':",
            "options": ["Generous", "Stingy", "Cruel", "Timid"],
            "correct_index": 0,
            "explanation": "'Munificent' means characterized by or displaying great generosity."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'VENERATE':",
            "options": ["Respect", "Revere", "Despise", "Honor"],
            "correct_index": 2,
            "explanation": "'Venerate' means to regard with great respect or reverence. Its direct antonym is 'Despise'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the sentence that correctly avoids a misplaced modifier:",
            "options": [
                "Walking into the server room, the freezing temperature shocked the engineer.",
                "Walking into the server room, the engineer was shocked by the freezing temperature.",
                "The freezing temperature shocked walking into the server room the engineer.",
                "Shocked by the freezing temperature, the server room was walked into by the engineer."
            ],
            "correct_index": 1,
            "explanation": "The modifier 'Walking into the server room' must logically modify 'the engineer', who is performing the action of walking."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The software release was contingent ___ passing all end-to-end security audits.",
            "options": ["on", "with", "at", "for"],
            "correct_index": 0,
            "explanation": "'Contingent on' (or 'contingent upon') is the standard prepositional phrase."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to take the bull by the horns' mean?",
            "options": [
                "To engage in rodeo bullfighting",
                "To face a difficult challenge directly and courageously",
                "To avoid responsibility",
                "To make a hasty retreat"
            ],
            "correct_index": 1,
            "explanation": "'To take the bull by the horns' means to confront a dangerous or difficult problem head-on."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'An excessive desire to acquire and possess wealth'",
            "options": ["Avarice", "Altruism", "Philanthropy", "Benevolence"],
            "correct_index": 0,
            "explanation": "'Avarice' is extreme greed for wealth or material gain."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team is integrating with an external vendor API whose SLA guarantees 99.9% uptime, but during the trial period it drops to 96%. What should you advise product leadership?",
            "options": [
                "Proceed to production and hope the vendor improves.",
                "Present the uptime telemetry data, delay launch until the vendor remediation is proven, or implement an automated circuit-breaker pattern with fallback degradation.",
                "Cancel all external integrations forever.",
                "Secretly fake the uptime report."
            ],
            "correct_index": 1,
            "explanation": "Circuit breaker patterns and data-backed vendor accountability protect the customer experience from external service degradations."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A junior engineer's pull request contains working code, but the code lacks any inline comments, has cryptic single-letter variable names, and is 1,200 lines long. How do you review it?",
            "options": [
                "Reject it with the comment 'Unreadable junk.'",
                "Schedule a 20-minute code review session to explain maintainability standards, praise their working algorithm, and guide them in breaking the PR into smaller, well-named modules.",
                "Approve it anyway to save time.",
                "Rewrite the entire 1,200 lines yourself."
            ],
            "correct_index": 1,
            "explanation": "Coaching junior engineers on modularity, naming conventions, and manageable PR sizes builds long-term engineering capacity."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "You notice that your company's SSL/TLS certificate for the customer portal expires in 48 hours and auto-renewal has failed. What is the proper response?",
            "options": [
                "Wait for it to expire and see if customers notice.",
                "Immediately raise an emergency P1 ticket to the DevOps/Infra on-call, verify DNS challenge validation, and ensure manual certificate renewal before expiration.",
                "Tell customers to ignore browser security warnings.",
                "Delete the portal."
            ],
            "correct_index": 1,
            "explanation": "Expired TLS certificates cause severe browser security blocks and customer trust loss; immediate operational escalation is critical."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During salary review discussions, an engineer learns that their peer with equal tenure makes 10% more and feels demotivated. As their manager, how do you handle this?",
            "options": [
                "Disclose everyone's private salary details in a team email.",
                "Acknowledge their feelings, explain the company's objective compensation framework and market benchmarking bands, and co-create an explicit performance roadmap for their next promotion cycle.",
                "Reprimand the engineer for discussing compensation.",
                "Tell them to find another company."
            ],
            "correct_index": 1,
            "explanation": "Transparently explaining compensation band frameworks and establishing clear development roadmaps builds institutional trust and motivation."
        }
    ]
}

SET_25 = {
    "set_number": 25,
    "title": "Soft Skill Assessment - Set 25",
    "slug": "soft-skill-assessment-set-25",
    "description": "Quarterly benchmark assessment testing complex interest formulas, logical deductions, concise business English, and architectural governance.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Find the difference between the compound interest and simple interest on ₹20,000 for 3 years at 10% per annum.",
            "options": ["₹580", "₹600", "₹620", "₹640"],
            "correct_index": 2,
            "explanation": "Difference between CI and SI for 3 years = P × (R/100)² × (3 + R/100) = 20,000 × (10/100)² × (3 + 10/100) = 20,000 × (1/100) × 3.1 = 200 × 3.1 = ₹620."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If A is 25% more than B, by what percentage is B less than A?",
            "options": ["16.67%", "20%", "25%", "33.33%"],
            "correct_index": 1,
            "explanation": "Percentage less = [r / (100 + r)] × 100 = [25 / 125] × 100 = 20%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train covers a distance of 1,080 km in 18 hours. What is its speed in metres per second?",
            "options": ["15 m/s", "16.67 m/s", "18 m/s", "20 m/s"],
            "correct_index": 1,
            "explanation": "Speed in km/h = 1080 / 18 = 60 km/h. In m/s: 60 × (5/18) = 300 / 18 = 16.67 m/s (50/3 m/s)."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A cistern has two taps which fill it in 12 minutes and 15 minutes respectively. There is also a waste pipe in the cistern. When all the three are opened, the empty cistern is filled in 20 minutes. How long will the waste pipe take to empty the full cistern?",
            "options": ["8 minutes", "10 minutes", "12 minutes", "15 minutes"],
            "correct_index": 1,
            "explanation": "Waste pipe rate = 1/12 + 1/15 - 1/20 = (5 + 4 - 3)/60 = 6/60 = 1/10. The waste pipe empties the full cistern in 10 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a pack of 52 cards, two cards are drawn at random. What is the probability that both are kings?",
            "options": ["1/169", "1/221", "2/221", "1/13"],
            "correct_index": 1,
            "explanation": "Total ways = 52C2 = 1326. Ways to choose 2 kings from 4 = 4C2 = 6. Probability = 6 / 1326 = 1 / 221."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The price of an article marked at ₹800 is sold for ₹680. What is the discount percentage?",
            "options": ["12%", "15%", "18%", "20%"],
            "correct_index": 1,
            "explanation": "Discount = 800 - 680 = ₹120. Discount % = (120 / 800) × 100 = 15%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average weight of a group of 8 persons increases by 2.5 kg when a new person comes in place of one of them weighing 65 kg. What is the weight of the new person?",
            "options": ["75 kg", "80 kg", "85 kg", "90 kg"],
            "correct_index": 2,
            "explanation": "Total increase in weight = 8 × 2.5 = 20 kg. Weight of the new person = 65 + 20 = 85 kg."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "Find the compound interest on ₹5,000 for 1 year at 8% per annum, compounded half-yearly.",
            "options": ["₹400", "₹408", "₹416", "₹424"],
            "correct_index": 1,
            "explanation": "Half-yearly rate = 4%. Periods = 2. Amount = 5,000 × (1.04)² = 5,000 × 1.0816 = ₹5,408. CI = 5408 - 5000 = ₹408."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 6, 13, 28, 59, 122, ?",
            "options": ["245", "247", "249", "251"],
            "correct_index": 2,
            "explanation": "Pattern: multiply by 2 and add increasing numbers (+1, +2, +3, +4, +5): 6×2+1=13, 13×2+2=28, 28×2+3=59, 59×2+4=122, 122×2+5 = 244 + 5 = 249."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a certain code, 'RHYTHM' is written as 'QGXSGL'. How is 'POETRY' written?",
            "options": ["ONDSQX", "ONDSQZ", "OMDSQX", "ONERQX"],
            "correct_index": 0,
            "explanation": "Each letter shifted -1: P(-1)=O, O(-1)=N, E(-1)=D, T(-1)=S, R(-1)=Q, Y(-1)=X, yielding ONDSQX."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is B's daughter, B is C's mother, D is C's brother. How is D related to A?",
            "options": ["Father", "Brother", "Son", "Uncle"],
            "correct_index": 1,
            "explanation": "B is the mother of A, C, and D. Therefore, D is the brother of A."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Statements: All compilers are translators. No translator is an interpreter. All interpreters are programs. Conclusions: I. No compiler is an interpreter. II. Some programs are interpreters.",
            "options": ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
            "correct_index": 2,
            "explanation": "Compilers are inside translators, and no translator is an interpreter, so no compiler is an interpreter (I follows). Since all interpreters are programs, some programs are interpreters (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "GLOVE : HAND :: SHOE : ?",
            "options": ["Sock", "Foot", "Lace", "Leg"],
            "correct_index": 1,
            "explanation": "A glove covers the hand; a shoe covers the foot (Garment : Body part)."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A cyclist travels 10 km South, turns right and travels 15 km, turns right again and travels 10 km. How far is he from his starting point?",
            "options": ["10 km", "15 km", "20 km", "25 km"],
            "correct_index": 1,
            "explanation": "South 10 km and North 10 km cancel out. He is 15 km West of his starting position."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out: 13, 23, 33, 43, 53",
            "options": ["23", "33", "43", "53"],
            "correct_index": 1,
            "explanation": "13, 23, 43, and 53 are prime numbers; 33 is a composite number (3 × 11)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the synonym of 'TRENCHANT':",
            "options": ["Incisive", "Vague", "Dull", "Gentle"],
            "correct_index": 0,
            "explanation": "'Trenchant' means vigorous or incisive in expression, style, or analysis."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the antonym of 'QUERULOUS':",
            "options": ["Complaining", "Contented", "Petulant", "Peevish"],
            "correct_index": 1,
            "explanation": "'Querulous' means complaining in a petulant or whining manner. Its antonym is 'Contented'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the sentence that correctly structures the correlative pair 'either... or':",
            "options": [
                "Either you must submit the migration plan today or tomorrow.",
                "You must submit the migration plan either today or tomorrow.",
                "Either submit the migration plan today or you must submit tomorrow.",
                "You must either submit the migration plan today or tomorrow."
            ],
            "correct_index": 1,
            "explanation": "Correlative conjunctions require strict parallel placement: 'either today or tomorrow' links two parallel adverbs of time."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Fill in the blank: The team lead was proficient ___ orchestrating multi-region Kubernetes deployments.",
            "options": ["in", "at", "with", "for"],
            "correct_index": 0,
            "explanation": "'Proficient in' is the standard English preposition pairing for a field, skill, or discipline."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "What does the idiom 'to read between the lines' mean?",
            "options": [
                "To inspect printing errors in a book",
                "To understand a hidden or implied meaning that is not explicitly stated",
                "To skip paragraphs while reading fast",
                "To recite poetry line by line"
            ],
            "correct_index": 1,
            "explanation": "'To read between the lines' means to discern a significance or meaning that is not explicitly expressed."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the one-word substitution for: 'A person who loves books and collects them avidly'",
            "options": ["Bibliophile", "Philatelist", "Polyglot", "Numismatist"],
            "correct_index": 0,
            "explanation": "A 'Bibliophile' is an enthusiast or collector of books."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A key database server running customer workloads reaches 95% disk utilization on a holiday weekend. What is the immediate priority for the on-call engineer?",
            "options": [
                "Ignore it until the next business day.",
                "Immediately expand storage capacity through cloud volume resizing, clean up verified expired temp logs, and investigate runaway query log bloat.",
                "Delete all customer data tables to free space.",
                "Turn off the database."
            ],
            "correct_index": 1,
            "explanation": "Rapid online cloud volume expansion and cleaning transient logs prevents imminent catastrophic database crashes due to full disk."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "You are leading an API migration and need to deprecate v1 endpoints used by 50 external enterprise partners. How do you execute this without customer churn?",
            "options": [
                "Turn off v1 immediately without warning.",
                "Publish a comprehensive migration guide with code samples, provide a 6-month deprecation sunset timeline, reach out to high-volume partners directly, and provide weekly migration telemetry.",
                "Change the endpoint URLs secretly.",
                "Charge partners an extra fee to keep using v1."
            ],
            "correct_index": 1,
            "explanation": "Professional enterprise API management involves generous deprecation horizons, clear code migration samples, and proactive outreach."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A colleague asks you to share your administrator login credentials so they can test a feature quickly. How do you respond?",
            "options": [
                "Send your password over plaintext Slack.",
                "Politely refuse, cite company security policy on credential sharing, and help them request their own scoped testing role through the internal IAM portal.",
                "Write your password on a sticky note and hand it over.",
                "Report them to the police."
            ],
            "correct_index": 1,
            "explanation": "Credential sharing violates basic security compliance (SOC2/ISO27001); guiding them to request proper scoped IAM roles is the correct path."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your team's software release fails on staging due to an environment dependency mismatch between local Docker and cloud staging Kubernetes. What should you recommend?",
            "options": [
                "Tell everyone to develop directly on production.",
                "Standardize local development environments using dev containers or mirroring staging Kubernetes manifests with tools like Helm or Tilt to ensure local-staging parity.",
                "Stop testing on staging.",
                "Blame Docker."
            ],
            "correct_index": 1,
            "explanation": "Dev-prod parity (as defined in Twelve-Factor App methodology) eliminates 'works on my machine' defects."
        }
    ]
}

# Fix duplicate question in SET_25 Q20 (Bibliophile was used in Set 1)
SET_25["questions"][20]["question_text"] = "Select the one-word substitution for: 'A person who is fluent in multiple distinct foreign languages'"
SET_25["questions"][20]["options"] = ["Polyglot", "Linguist", "Polymath", "Omniscient"]
SET_25["questions"][20]["correct_index"] = 0
SET_25["questions"][20]["explanation"] = "A 'Polyglot' is someone who knows and speaks several languages fluently."

PART_5_SETS = [SET_21, SET_22, SET_23, SET_24, SET_25]

