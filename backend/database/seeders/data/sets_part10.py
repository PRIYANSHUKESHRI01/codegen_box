# Sets 46 to 50 (125 questions total: 25 questions per set)
# Breakdown per set: 8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/English, 4 Situational Judgment

SET_46 = {
    "set_number": 46,
    "title": "Soft Skill Assessment - Set 46",
    "slug": "soft-skill-assessment-set-46",
    "description": "Tests modular cyclicity, multi-variable parallel seating, inverted adverbial concord, and distributed circuit-breaker architecture.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "What is the remainder when 4^96 is divided by 6?",
            "options": ["0", "2", "4", "5"],
            "correct_index": 2,
            "explanation": "Any positive integer power of 4 divided by 6 always yields a remainder of 4: 4^1 = 4 = 6(0) + 4; 4^2 = 16 = 6(2) + 4; 4^3 = 64 = 6(10) + 4. Thus 4^96 mod 6 = 4."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A shopkeeper sells an article for ₹840 and incurs a loss of 4%. At what price should he sell it to gain 12%?",
            "options": ["₹920", "₹960", "₹980", "₹1,000"],
            "correct_index": 2,
            "explanation": "CP = 840 / (1 - 0.04) = 840 / 0.96 = ₹875. To gain 12%: SP = 875 × 1.12 = ₹980."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A boat travels 32 km downstream and 14 km upstream in 6 hours. If the speed of the boat in still water is 6 km/h, what is the speed of the stream?",
            "options": ["1 km/h", "2 km/h", "3 km/h", "4 km/h"],
            "correct_index": 1,
            "explanation": "Let stream speed be s. 32 / (6 + s) + 14 / (6 - s) = 6. Testing s = 2: 32 / 8 + 14 / 4 = 4 + 3.5 = 7.5 (no). Let's test s: if stream speed = 2, 32/8 + 14/4 = 7.5. Wait! If still speed = 9 km/h: 32/(9+s) + 14/(9-s)... Let's check with boat speed in still water = 8 km/h and stream = 2: 32/10 + 14/6 = 3.2 + 2.33 = 5.53. What if distance is 24 km downstream and 16 km upstream in 5 hours with boat in still water = 9 km/h and stream = 3? 24/12 + 16/6 = 2 + 2.67. Let's make an exact integer equation: 36 km downstream and 24 km upstream in 6 hours, still boat speed = 11 km/h: 36/(11+s) + 24/(11-s) = 6. Test s = 1: 36/12 + 24/10 = 3 + 2.4. Test s = 3: 36/14? What if: Boat speed in still water is 10 km/h and stream speed is 2 km/h. Downstream 36 km takes 36/12 = 3 hrs. Upstream 24 km takes 24/8 = 3 hrs. Total time = 6 hours!"
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum of ₹7,500 is borrowed at compound interest at 4% per annum for 2 years, compounded annually. How much interest is accrued?",
            "options": ["₹600", "₹612", "₹624", "₹636"],
            "correct_index": 1,
            "explanation": "Amount = 7500 × (1 + 0.04)^2 = 7500 × 1.0816 = ₹8,112. CI = 8,112 - 7,500 = ₹612."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B can do a job in 12 days. B and C can do it in 16 days. After A has worked on it for 5 days and B for 7 days, C finishes the remaining work in 13 days. In how many days can C alone complete the entire job?",
            "options": ["20 days", "24 days", "28 days", "32 days"],
            "correct_index": 1,
            "explanation": "5 days of A + 7 days of B + 13 days of C = 5(A + B) + 2(B + C) + 11(C) = 1. Work done = 5(1/12) + 2(1/16) + 11(C) = 5/12 + 1/8 + 11(C) = (10 + 3)/24 + 11(C) = 13/24 + 11(C) = 1. 11(C) = 1 - 13/24 = 11/24 => C's 1-day work = 1/24. C alone finishes it in 24 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio of boys to girls in a college cohort of 720 students is 7 : 5. How many more girls must be admitted to make the ratio 1 : 1?",
            "options": ["100", "120", "140", "160"],
            "correct_index": 1,
            "explanation": "Total parts = 7 + 5 = 12. Each part = 720 / 12 = 60. Boys = 7 × 60 = 420. Girls = 5 × 60 = 300. For a 1 : 1 ratio, girls must equal boys (420). Additional girls needed = 420 - 300 = 120."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many different ways can 7 people be seated around a circular conference table such that 2 particular individuals never sit together?",
            "options": ["360", "480", "600", "720"],
            "correct_index": 1,
            "explanation": "Total unrestricted circular arrangements for 7 people = (7 - 1)! = 6! = 720. If the 2 particular individuals sit together, treat them as 1 unit: 6 units arranged in a circle in (6 - 1)! = 5! = 120 ways. The 2 individuals can switch places in 2! = 2 ways. Ways they sit together = 120 × 2 = 240. Ways they NEVER sit together = 720 - 240 = 480."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A wire in the shape of a circle of radius 21 cm is bent into the form of a square. What is the length of the side of the square (use pi = 22/7)?",
            "options": ["30 cm", "33 cm", "36 cm", "42 cm"],
            "correct_index": 1,
            "explanation": "Circumference of circle = 2 * pi * r = 2 * (22/7) * 21 = 2 * 22 * 3 = 132 cm. Perimeter of square = 4s = 132 cm => s = 132 / 4 = 33 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Only a few microservices are scalable. All scalable services are cloud-native. Conclusions: I. Some microservices are cloud-native. II. All microservices can never be cloud-native.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 0,
            "explanation": "The scalable microservices are cloud-native, so some microservices are definitely cloud-native (I follows). 'Only a few microservices are scalable' means some microservices are not scalable, but there is no restriction preventing all microservices from being cloud-native through other paths (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six servers—P, Q, R, S, T, and U—are mounted in a rack from slot 1 (bottom) to slot 6 (top). P is mounted immediately above S. T is mounted in slot 4. Q is in slot 1. U is mounted higher than R. Which server is in slot 3 if P is in slot 6?",
            "options": ["R", "S", "U", "Cannot be determined"],
            "correct_index": 0,
            "explanation": "Slots 1 to 6: Slot 1 is Q, Slot 4 is T. P is in slot 6. P is immediately above S, so S is in slot 5. Slots remaining are 2 and 3 for R and U. U is mounted higher than R, so U is in slot 3 and R is in slot 2? Wait! If U is higher than R, slot 3 is higher than slot 2, so U is in slot 3 and R is in slot 2. Let's make options: [R, S, U, P] with slot 3 being U!"
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "In a coded cipher, 'KUBERNETES' is coded as 'MCDGTPGVGU' (+2 to each letter). How is 'DOCKER' coded using the exact same rule?",
            "options": ["FQEMGT", "FQEMGS", "FQELGT", "FPEMGT"],
            "correct_index": 0,
            "explanation": "Each letter shifted +2: D(+2)=F, O(+2)=Q, C(+2)=E, K(+2)=M, E(+2)=G, R(+2)=T => FQEMGT."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "A drone flies 8 km North, turns right and flies 6 km, then turns right again and flies 8 km. How far is the drone from its initial launch point?",
            "options": ["6 km", "8 km", "10 km", "14 km"],
            "correct_index": 0,
            "explanation": "North 8 km, East 6 km, South 8 km. Vertical displacement cancels (8 - 8 = 0). The drone is 6 km East of the launch point."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a photograph, Deepak said: 'Her mother's only son is my father.' How is the woman in the photograph related to Deepak?",
            "options": ["Mother", "Aunt (Paternal)", "Grandmother", "Sister"],
            "correct_index": 1,
            "explanation": "The woman's mother's only son is the woman's brother. If the woman's brother is Deepak's father, then the woman is Deepak's paternal aunt."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Identify the number that replaces the question mark in the sequence: 4, 9, 25, 49, 121, ?",
            "options": ["144", "169", "196", "225"],
            "correct_index": 1,
            "explanation": "The terms are squares of consecutive prime numbers: 2^2 = 4, 3^2 = 9, 5^2 = 25, 7^2 = 49, 11^2 = 121, 13^2 = 169."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'All high-volume transaction databases should migrate from spinning magnetic disks (HDD) to enterprise NVMe solid-state drives.' Assumptions: I. NVMe drives drastically reduce I/O wait times and query latencies. II. Spinning magnetic disks are incapable of storing database records safely.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 0,
            "explanation": "Assumption I is valid because the primary motivation for NVMe adoption in transactional systems is extreme I/O performance. Assumption II is false; HDDs store records reliably, just at lower throughput."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the sentence that correctly employs negative inversion for rhetorical emphasis:",
            "options": [
                "Not only did the caching layer reduce latency, but it also halved database CPU utilization.",
                "Not only the caching layer reduced latency, but it also halved database CPU utilization.",
                "Not only did the caching layer reduced latency, but it also halved database CPU utilization.",
                "Not only had the caching layer reduce latency, but it also halved database CPU utilization."
            ],
            "correct_index": 0,
            "explanation": "'Not only' followed by 'did' requires the base form of the verb ('reduce'): 'Not only did the caching layer reduce latency...'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Choose the word closest in meaning to 'ESOTERIC':",
            "options": ["Obscure", "Commonplace", "Trivial", "Transparent"],
            "correct_index": 0,
            "explanation": "'Esoteric' means intended for or likely to be understood by only a small number of people with specialized knowledge; obscure."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the antonym of the word 'RECALCITRANT':",
            "options": ["Compliant", "Defiant", "Stubborn", "Obstinate"],
            "correct_index": 0,
            "explanation": "'Recalcitrant' means having an obstinately uncooperative attitude toward authority. Its antonym is 'compliant' or 'amenable'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What is the meaning of the professional idiom 'To hit the ground running'?",
            "options": [
                "To stumble during an athletic event",
                "To start a new project or role immediately with high energy and speed",
                "To evacuate an office building during an emergency",
                "To make a hasty and erroneous conclusion"
            ],
            "correct_index": 1,
            "explanation": "'To hit the ground running' means to begin an activity or job immediately without delay and at full speed."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who hates or distrusts humankind in general'",
            "options": ["Misanthrope", "Philanthropist", "Misogynist", "Altruist"],
            "correct_index": 0,
            "explanation": "A 'Misanthrope' is a person who dislikes humankind and avoids human society."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the correctly spelled word denoting an authoritative command or order:",
            "options": ["Peremptory", "Pre-emptory", "Peremptary", "Peramptory"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Peremptory' (leaving no opportunity for denial or refusal)."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Under high load, an upstream recommendation service becomes unresponsive, causing downstream checkout API threads to hang and cascade into total platform unresponsiveness. What architectural pattern resolves this?",
            "options": [
                "Increase thread pool timeouts to 300 seconds.",
                "Implement a Circuit Breaker pattern with a rapid fallback response to fail fast and protect thread pools when the upstream dependency fails.",
                "Disable all security logging to save memory.",
                "Remove the checkout feature entirely."
            ],
            "correct_index": 1,
            "explanation": "Circuit breakers open when upstream error rates spike, providing instantaneous fallback defaults and preventing thread starvation across downstream services."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A newly hired engineer submits a pull request with 45 unit tests, but none of them test boundary conditions or negative input scenarios. How should the code reviewer guide them?",
            "options": [
                "Reject the pull request and tell them they do not understand software development.",
                "Applaud the test volume, explain the critical importance of edge-case coverage (e.g., null values, empty strings, max integer bounds), and suggest 3 concrete negative test cases to include.",
                "Approve the PR and write the tests yourself silently.",
                "Ask HR to extend their probation."
            ],
            "correct_index": 1,
            "explanation": "Positive reinforcement coupled with concrete guidance on boundary testing builds engineering capability without damaging developer morale."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company discovers that an analytics software library embedded in your iOS app sends device identifiers to an unapproved tracking domain, in direct violation of Apple App Store privacy policies. What is the immediate engineering release protocol?",
            "options": [
                "Wait for Apple to reject the app during the next routine update.",
                "Remove or disable the tracking library immediately via a remote feature flag, strip the SDK from the codebase, issue an expedited emergency app update, and audit all third-party SDK dependencies.",
                "Deny the telemetry transfer on social media.",
                "Switch company development exclusively to Android."
            ],
            "correct_index": 1,
            "explanation": "Immediate feature-flag deactivation, SDK removal, emergency app deployment, and third-party audit ensures compliance with app platform privacy guidelines."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your cloud PostgreSQL database experiences an unanticipated spike in disk write IOPS due to automatic bloat accumulation from high-frequency UPDATE statements without sufficient vacuuming. What is the optimal DBA remediation?",
            "options": [
                "Reboot the database server repeatedly.",
                "Tune autovacuum settings (lower autovacuum_vacuum_scale_factor and increase autovacuum_vacuum_cost_limit) and schedule pg_repack during an off-peak maintenance window to reclaim bloat online.",
                "Delete all historical transaction tables.",
                "Switch database engines overnight without testing."
            ],
            "correct_index": 1,
            "explanation": "Aggressive autovacuum tuning prevents MVCC table bloat accumulation, and online tools like pg_repack reclaim disk space without locking tables."
        }
    ]
}

# Fix SET_46 Q3 and Q10
SET_46["questions"][2]["question_text"] = "A boat travels 36 km downstream and 24 km upstream in a total of 6 hours. If the speed of the boat in still water is 10 km/h, what is the speed of the stream?"
SET_46["questions"][2]["options"] = ["1 km/h", "2 km/h", "3 km/h", "4 km/h"]
SET_46["questions"][2]["correct_index"] = 1
SET_46["questions"][2]["explanation"] = "Downstream speed = 10 + 2 = 12 km/h. Downstream time = 36 / 12 = 3 hours. Upstream speed = 10 - 2 = 8 km/h. Upstream time = 24 / 8 = 3 hours. Total time = 3 + 3 = 6 hours. Speed of the stream is 2 km/h."

SET_46["questions"][9]["options"] = ["R", "S", "U", "P"]
SET_46["questions"][9]["correct_index"] = 2
SET_46["questions"][9]["explanation"] = "Slot 1 is Q, Slot 4 is T, Slot 6 is P, Slot 5 is S (immediately below P). That leaves slots 2 and 3 for R and U. Since U is mounted higher than R, U is in slot 3 and R is in slot 2. Server U is in slot 3."

SET_47 = {
    "set_number": 47,
    "title": "Soft Skill Assessment - Set 47",
    "slug": "soft-skill-assessment-set-47",
    "description": "Measures compound interest annuities, coded family matrices, parallel modifier syntax, and graceful Kubernetes pod lifecycle management.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man purchases an electric bike for ₹60,000. Its value depreciates by 10% per annum for the first year and 15% per annum for the second year. What will its value be at the end of 2 years?",
            "options": ["₹45,000", "₹45,900", "₹46,200", "₹48,000"],
            "correct_index": 1,
            "explanation": "Value after 1 year = 60,000 × (1 - 0.10) = ₹54,000. Value after 2 years = 54,000 × (1 - 0.15) = 54,000 × 0.85 = ₹45,900."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If 12 machines can produce 480 silicon chips in 8 hours, how many chips can 18 machines produce in 6 hours at the same production rate?",
            "options": ["480", "520", "540", "600"],
            "correct_index": 2,
            "explanation": "Production rate per machine-hour = 480 / (12 × 8) = 480 / 96 = 5 chips/hr. Total chips for 18 machines in 6 hours = 18 × 6 × 5 = 108 × 5 = 540 chips."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In what ratio must an alloy containing 80% copper be mixed with an alloy containing 50% copper to obtain a new alloy containing 70% copper?",
            "options": ["1 : 2", "2 : 1", "3 : 1", "3 : 2"],
            "correct_index": 1,
            "explanation": "By the rule of alligation: (70 - 50) : (80 - 70) = 20 : 10 = 2 : 1."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains running in opposite directions on parallel tracks cross a stationary pole in 27 seconds and 17 seconds respectively, and they cross each other in 23 seconds. What is the ratio of their speeds?",
            "options": ["2 : 3", "3 : 2", "3 : 4", "4 : 3"],
            "correct_index": 1,
            "explanation": "Let speeds be s1 and s2. Lengths are 27s1 and 17s2. Time to cross each other = (27s1 + 17s2) / (s1 + s2) = 23 => 27s1 + 17s2 = 23s1 + 23s2 => 4s1 = 6s2 => s1 / s2 = 6 / 4 = 3 : 2."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A cistern has two pipes A and B. A can fill it in 20 minutes and B can empty it in 25 minutes. If both are opened alternately for 1 minute each, starting with A, how long will it take to fill the cistern?",
            "options": ["180 minutes", "189 minutes", "191 minutes", "195 minutes"],
            "correct_index": 2,
            "explanation": "Let capacity = 100 units. A's rate = +5 units/min, B's rate = -4 units/min. In 2 minutes, net fill = 5 - 4 = 1 unit. To avoid overflow on A's final fill, consider filling 95 units: 95 × 2 = 190 minutes. In the 191st minute, Pipe A is opened and fills the remaining 5 units to reach 100 units. Total time = 191 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the HCF of 2/3, 8/9, 16/81, and 10/27?",
            "options": ["2/81", "2/27", "16/81", "1/81"],
            "correct_index": 0,
            "explanation": "HCF of fractions = HCF of numerators / LCM of denominators = HCF(2, 8, 16, 10) / LCM(3, 9, 81, 27) = 2 / 81."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A box contains 5 red, 4 blue, and 3 green marbles. If 3 marbles are drawn at random without replacement, what is the probability that exactly 2 are red?",
            "options": ["7/22", "9/22", "15/44", "21/44"],
            "correct_index": 0,
            "explanation": "Total marbles = 5 + 4 + 3 = 12. Total ways to draw 3 = 12C3 = (12 × 11 × 10) / 6 = 220. Favorable ways: 2 red from 5 (5C2 = 10) and 1 non-red from 7 (7C1 = 7). Favorable = 10 × 7 = 70. Probability = 70 / 220 = 7 / 22."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The diagonal of a square is 12*sqrt(2) cm. What is the area of the square?",
            "options": ["120 cm²", "144 cm²", "288 cm²", "576 cm²"],
            "correct_index": 1,
            "explanation": "Diagonal d = s * sqrt(2) => s = 12 cm. Area = s^2 = 12^2 = 144 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All gateways are proxies. No proxy is insecure. Some firewalls are gateways. Conclusions: I. No gateway is insecure. II. Some firewalls are proxies.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Gateways are inside proxies and no proxy is insecure, so no gateway is insecure (I follows). Firewalls overlap gateways which are all proxies, so firewalls definitely overlap proxies (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "In a coded relation: 'P # Q' means P is father of Q; 'P @ Q' means P is mother of Q; 'P & Q' means P is sister of Q. In the expression 'X @ Y & Z # W', how is X related to W?",
            "options": ["Mother", "Paternal Grandmother", "Maternal Grandmother", "Aunt"],
            "correct_index": 1,
            "explanation": "X @ Y: X is mother of Y. Y & Z: Y is sister of Z (X is mother of Z). Z # W: Z is father of W. Since Z is father of W and X is mother of Z, X is the paternal grandmother of W."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "If 'ORACLE' is coded as 'PQBDMD', how is 'SERVER' coded in that same alternating (+1, -1) pattern?",
            "options": ["TFSUDS", "TFSUES", "TFSUFQ", "TESUDS"],
            "correct_index": 0,
            "explanation": "Alternating pattern: O(+1)=P, R(-1)=Q, A(+1)=B, C(+1)? Wait: O(+1)=P, R(-1)=Q, A(+1)=B, C(+1)=D, L(+1)=M, E(-1)=D. For SERVER: S(+1)=T, E(+1)=F, R(+1)=S, V(-1)=U, E(-1)=D, R(+1)=S. Let's make uniform +1 shift: S(+1)=T, E(+1)=F, R(+1)=S, V(+1)=W, E(+1)=F, R(+1)=S => TFSWFS."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "A warehouse logistics robot moves 10 meters South, turns left and moves 15 meters, then turns left again and moves 10 meters. How far is the robot from its starting docking bay?",
            "options": ["10 meters", "15 meters", "20 meters", "25 meters"],
            "correct_index": 1,
            "explanation": "South 10m, Left (East) 15m, Left (North) 10m. The vertical movements cancel (-10 + 10 = 0). The robot is 15 meters East of the starting bay."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven team members—A, B, C, D, E, F, and G—sit in a straight line facing North. D sits in the exact center of the row. A sits at the extreme left end. B sits third to the right of A. F sits adjacent to D. Who sits at the extreme right end if G sits second to the right of D?",
            "options": ["C", "E", "G", "Cannot be determined uniquely"],
            "correct_index": 2,
            "explanation": "7 seats (1 to 7): Extreme left is 1 (A). D is center (seat 4). B is 3rd right of A (seat 4? 1 + 3 = 4, but 4 is D! Let's check: B sits second to the right of A => seat 3). G sits second to right of D (seat 4 + 2 = seat 6). Extreme right is seat 7. Let's refine puzzle layout."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the alphanumeric sequence: 2B, 4D, 8H, 16P, ?",
            "options": ["32X", "32Z", "32W", "32Y"],
            "correct_index": 0,
            "explanation": "Numbers double each time: 2, 4, 8, 16, 32. Letters double in alphabet position: B(2), D(4), H(8), P(16), 16 × 2 = 32? Wait: alphabet has 26 letters! 32 - 26 = 6 (F)? If letters are B(2), D(4), H(8), P(16), 32-26 = F. If options: 32F. Let's use clean alphabet progression: B(2), D(4), F(6), H(8), J(10) -> 32J."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'To curb production configuration drift, all manual SSH access to production web servers should be revoked in favor of automated GitOps deployment pipelines.' Arguments: I. Yes, automated GitOps ensures versioned, auditable, and reproducible infrastructure state. II. No, developers will be unable to debug emergency production issues in real time.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because modern cloud security and compliance mandate eliminating manual SSH changes to preserve auditability and prevent snowflake configurations. Real-time debugging is properly achieved via centralized telemetry, tracing, and ephemeral debugging containers, making Argument II weak."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Identify the part of the sentence containing a grammatical error: 'Neither the system administrator (A) / nor the security auditors (B) / was aware of the misconfigured firewall rule. (C) / No error (D)'",
            "options": ["(A)", "(B)", "(C)", "(D)"],
            "correct_index": 2,
            "explanation": "With 'neither... nor', the verb agrees in number with the closer subject ('security auditors', plural). Therefore 'was aware' should be 'were aware'. Error is in part (C)."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SANCTIMONIOUS':",
            "options": ["Self-righteous", "Humble", "Sincere", "Devout"],
            "correct_index": 0,
            "explanation": "'Sanctimonious' means making a show of being morally superior to other people; self-righteous."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'DELETERIOUS':",
            "options": ["Beneficial", "Harmful", "Destructive", "Toxic"],
            "correct_index": 0,
            "explanation": "'Deleterious' means causing harm or damage. Its antonym is 'beneficial'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the business phrase 'To play devil's advocate' mean?",
            "options": [
                "To argue against an idea simply to test the strength of the reasoning",
                "To promote unethical corporate policies",
                "To sabotage a competitor's product launch",
                "To represent a client in a legal dispute"
            ],
            "correct_index": 0,
            "explanation": "'To play devil's advocate' means to express an opposing point of view to debate validity and uncover hidden flaws."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'An excessive desire or compulsion to steal items without economic need'",
            "options": ["Kleptomania", "Megalomania", "Pyromania", "Dipsomania"],
            "correct_index": 0,
            "explanation": "'Kleptomania' is a recurrent failure to resist urges to steal items that you don't really need."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Fill in the blank with the correct preposition: 'The microservices architecture is immune ______ external denial-of-service volumetric floods.'",
            "options": ["from", "to", "against", "with"],
            "correct_index": 1,
            "explanation": "The adjective 'immune' standardly collocates with the preposition 'to' ('immune to disruption/infection')."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A Kubernetes rolling update to your user authentication pod causes in-flight login requests to abruptly drop with 502 Bad Gateway errors during container shutdown. What configuration must be added to the pod spec?",
            "options": [
                "Remove all CPU limits.",
                "Implement a preStop lifecycle hook with a short sleep to allow endpoints to deregister from the ingress load balancer and handle SIGTERM gracefully.",
                "Set replica count to 1.",
                "Disable rolling updates completely."
            ],
            "correct_index": 1,
            "explanation": "A preStop hook with graceful connection draining ensures ingress controllers update IP tables before the container terminates in-flight connections."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During a sprint demo, an executive asks why a specific database schema refactoring story is taking 5 story points when 'it does not add any visible buttons to the UI'. How should the product owner explain?",
            "options": [
                "Tell the executive that non-engineers should not attend engineering demos.",
                "Explain that the schema refactoring eliminates transactional locks, directly enabling the platform to scale from 1,000 to 50,000 concurrent checkout users without database crashes.",
                "Promise to revert the database change.",
                "Blame the DBA."
            ],
            "correct_index": 1,
            "explanation": "Translating non-functional engineering investments into measurable business capabilities (scalability, concurrency, uptime) builds executive alignment."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A critical software vulnerability scan reveals that your web application framework version contains a High-severity Remote Code Execution (RCE) flaw, but the official vendor patch requires breaking changes to several core routes. What is the proper response?",
            "options": [
                "Ignore the CVE because upgrading is inconvenient.",
                "Deploy temporary virtual patching WAF rules immediately to block exploit payloads, spin up a dedicated emergency branch to refactor breaking route changes, and release the upgraded version within 48 hours.",
                "Shutdown all customer websites for 2 weeks.",
                "Downgrade to an even older framework version."
            ],
            "correct_index": 1,
            "explanation": "Layered defense combines edge WAF virtual patching for instant perimeter defense while engineering prioritizes expedited framework upgrades."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization's primary AWS account root email receives a security notice indicating that an IAM user access key was compromised and utilized to spin up 20 GPU cryptomining EC2 instances in an unused region. What is the first priority?",
            "options": [
                "Email all company employees asking who owns the key.",
                "Deactivate and delete the compromised IAM key immediately, terminate the rogue EC2 instances, review CloudTrail logs to determine the blast radius, and mandate MFA on all administrative users.",
                "Wait until the monthly AWS bill arrives to verify costs.",
                "Delete the entire AWS organization."
            ],
            "correct_index": 1,
            "explanation": "Revoking compromised credentials immediately and shutting down rogue instances halts malicious exploitation, followed by CloudTrail forensic auditing."
        }
    ]
}

# Fix SET_47 Q11, Q13, Q14
SET_47["questions"][10]["question_text"] = "If 'SERVER' is coded as 'TFSWFS' (+1 to each letter), how is 'CLIENT' coded in that exact same pattern?"
SET_47["questions"][10]["options"] = ["DMJFOV", "DMJFNV", "DMJGNU", "DNJFOV"]
SET_47["questions"][10]["correct_index"] = 0
SET_47["questions"][10]["explanation"] = "Each letter shifted +1: C(+1)=D, L(+1)=M, I(+1)=J, E(+1)=F, N(+1)=O, T(+1)=V => DMJFOV."

SET_47["questions"][12]["question_text"] = "Seven colleagues—A, B, C, D, E, F, and G—sit in a straight line facing North. D sits in the center (seat 4). A sits at seat 1. B sits at seat 3. G sits at seat 6. E sits at seat 2. F sits at seat 5. Who is seated at the extreme right end (seat 7)?"
SET_47["questions"][12]["options"] = ["C", "E", "F", "G"]
SET_47["questions"][12]["correct_index"] = 0
SET_47["questions"][12]["explanation"] = "Seats 1 to 7 are filled by: 1: A, 2: E, 3: B, 4: D, 5: F, 6: G. The remaining person is C, who must occupy seat 7 (extreme right end)."

SET_47["questions"][13]["question_text"] = "Find the next term in the sequence: 2B, 4D, 8F, 16H, ?"
SET_47["questions"][13]["options"] = ["32J", "32K", "32L", "32I"]
SET_47["questions"][13]["correct_index"] = 0
SET_47["questions"][13]["explanation"] = "Numbers double: 2, 4, 8, 16, 32. Letters increase by 2: B(2), D(4), F(6), H(8), J(10). The next term is 32J."

SET_48 = {
    "set_number": 48,
    "title": "Soft Skill Assessment - Set 48",
    "slug": "soft-skill-assessment-set-48",
    "description": "Explores mixture replacements, multi-tier ranking deductions, correlative concord, and secrets management in CI/CD pipelines.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can do a piece of work in 24 days and B in 36 days. If they work on it together for 6 days, what fraction of the total work remains to be done?",
            "options": ["5/12", "7/12", "1/2", "5/8"],
            "correct_index": 1,
            "explanation": "Work in 1 day = 1/24 + 1/36 = (3 + 2)/72 = 5/72. Work in 6 days = 6 × (5/72) = 5/12. Remaining work = 1 - 5/12 = 7/12."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A merchant marks an item at ₹1,500 and allows a 20% discount. If he still makes a 25% profit on cost price, what was the cost price of the item?",
            "options": ["₹900", "₹960", "₹1,000", "₹1,050"],
            "correct_index": 1,
            "explanation": "SP = 1500 × (1 - 0.20) = ₹1,200. Profit = 25%, so CP = 1200 / 1.25 = ₹960."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A cask contains 60 litres of pure alcohol. 12 litres are withdrawn and replaced with water. 12 litres of the mixture are again withdrawn and replaced with water. What is the final volume of pure alcohol remaining in the cask?",
            "options": ["36.4 litres", "38.4 litres", "40.0 litres", "42.2 litres"],
            "correct_index": 1,
            "explanation": "Remaining pure liquid = Initial × (1 - y/Total)^n = 60 × (1 - 12/60)^2 = 60 × (1 - 0.20)^2 = 60 × 0.64 = 38.4 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains 200 m and 150 m long run on parallel rails. When running in the same direction, the faster train passes the slower one in 35 seconds. When running in opposite directions, they pass each other in 7 seconds. What is the speed of the faster train?",
            "options": ["25 m/s", "30 m/s", "35 m/s", "40 m/s"],
            "correct_index": 1,
            "explanation": "Total distance = 200 + 150 = 350 m. Relative speed same direction = s1 - s2 = 350 / 35 = 10 m/s. Relative speed opposite direction = s1 + s2 = 350 / 7 = 50 m/s. Adding equations: 2s1 = 60 => s1 = 30 m/s."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The average of 8 numbers is 14. If each number is multiplied by 3, what will be the new average of the numbers?",
            "options": ["14", "28", "42", "56"],
            "correct_index": 2,
            "explanation": "If every value in a dataset is multiplied by a constant k, the average is also multiplied by k. New average = 14 × 3 = 42."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "What is the total number of two-digit numbers that are divisible by both 3 and 4?",
            "options": ["6", "7", "8", "9"],
            "correct_index": 2,
            "explanation": "Divisible by both 3 and 4 means divisible by LCM(3, 4) = 12. Two-digit multiples of 12 are: 12, 24, 36, 48, 60, 72, 84, 96. Total = 8 numbers."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a standard deck of 52 cards, two cards are drawn at random. What is the probability that both cards are hearts?",
            "options": ["1/17", "1/19", "1/22", "3/51"],
            "correct_index": 0,
            "explanation": "Number of hearts = 13. P(both hearts) = (13/52) × (12/51) = (1/4) × (4/17) = 1 / 17."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The length, breadth, and height of a rectangular room are in the ratio 3 : 2 : 1. If its total surface area is 352 m², what is the height of the room?",
            "options": ["4 m", "6 m", "8 m", "12 m"],
            "correct_index": 0,
            "explanation": "Let dimensions be 3x, 2x, x. Total surface area = 2(lb + bh + hl) = 2(6x^2 + 2x^2 + 3x^2) = 2(11x^2) = 22x^2. 22x^2 = 352 => x^2 = 352 / 22 = 16 => x = 4. Height = x = 4 m."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All caches are volatile. No volatile is persistent. Some memories are caches. Conclusions: I. Some memories are not persistent. II. No cache is persistent.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Caches are inside volatile which never touches persistent, so no cache is persistent (II follows). The memories that are caches cannot be persistent, so some memories are not persistent (I follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six developers—U, V, W, X, Y, and Z—are ranked from 1 (highest velocity) to 6 (lowest velocity). V is ranked higher than W. X is ranked immediately below U. Z is ranked lowest (rank 6). Y is ranked higher than U. If V is ranked 1, who is ranked 2?",
            "options": ["Y", "U", "X", "W"],
            "correct_index": 0,
            "explanation": "Ranks 1 to 6: 1 is V, 6 is Z. Y is higher than U, and X is immediately below U (order: Y, U, X). To fit in ranks 2, 3, 4, 5 along with W: Y must be rank 2, U rank 3, X rank 4, and W rank 5 (which satisfies V higher than W). Rank 2 is occupied by Y."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'RED' is coded as '27' (18 + 5 + 4 = 27), what is the code for 'BLUE' under the exact same letter position sum rule?",
            "options": ["36", "38", "40", "42"],
            "correct_index": 2,
            "explanation": "B(2) + L(12) + U(21) + E(5) = 2 + 12 + 21 + 5 = 40."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A delivery van drives 12 km East, turns right and drives 9 km. How far is the van from its starting fulfillment center?",
            "options": ["13 km", "15 km", "17 km", "21 km"],
            "correct_index": 1,
            "explanation": "Straight line distance = sqrt(12^2 + 9^2) = sqrt(144 + 81) = sqrt(225) = 15 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the mother of B. B is the sister of C. C is the father of D. How is A related to D?",
            "options": ["Mother", "Paternal Grandmother", "Maternal Grandmother", "Aunt"],
            "correct_index": 1,
            "explanation": "C is the father of D. A is the mother of C (since A is mother of B and B is sister of C). Therefore, A is the paternal grandmother of D."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the odd one out among the following programming languages:",
            "options": ["Python", "JavaScript", "Rust", "HTML"],
            "correct_index": 3,
            "explanation": "Python, JavaScript, and Rust are Turing-complete programming languages, whereas HTML is a declarative markup language."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The company should enforce mandatory multi-factor authentication (MFA) across all employee email accounts.' Conclusions: I. Password-only authentication is vulnerable to phishing and brute-force credential stuffing. II. MFA completely eliminates all software bugs in the email platform.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I reflects the primary security rationale for MFA. Conclusion II is an absurd exaggeration; MFA secures access authentication, not code-level application bugs."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the correct option to fill in the blank: 'Not only the lead engineer but also the product managers ______ in agreement regarding the sprint release scope.'",
            "options": ["was", "were", "is", "has been"],
            "correct_index": 1,
            "explanation": "When subjects are joined by 'not only... but also', the verb agrees with the closer subject ('product managers', plural), requiring 'were'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'TRENCHANT':",
            "options": ["Incisive", "Vague", "Dull", "Superficial"],
            "correct_index": 0,
            "explanation": "'Trenchant' means vigorous or incisive in expression or style; keenly perceptive."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'SANGUINE':",
            "options": ["Optimistic", "Pessimistic", "Cheerful", "Confident"],
            "correct_index": 1,
            "explanation": "'Sanguine' means optimistic or positive, especially in an apparently bad or difficult situation. Its antonym is 'pessimistic'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What is the meaning of the idiom 'To hear through the grapevine'?",
            "options": [
                "To learn information via informal rumors or word of mouth",
                "To conduct botanical agriculture research",
                "To receive official communication from executive leadership",
                "To eavesdrop on encrypted phone calls"
            ],
            "correct_index": 0,
            "explanation": "'To hear through the grapevine' means to receive information through informal rumors or gossip."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who abandons their political party or cause in favor of an opposing one'",
            "options": ["Renegade", "Loyalist", "Partisan", "Martyr"],
            "correct_index": 0,
            "explanation": "A 'Renegade' is a person who deserts and betrays an organization, country, or set of principles."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an essential condition or prerequisite:",
            "options": ["Sine qua non", "Sine qua nun", "Sina qua non", "Syne qua non"],
            "correct_index": 0,
            "explanation": "The correct Latin loan phrase is 'Sine qua non', meaning an indispensable condition or essential qualification."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an automated CI/CD pipeline run, a developer embeds an unmasked third-party payment API secret into a bash echo command, causing the secret to be printed in plain text within Jenkins build logs. What is the immediate required action?",
            "options": [
                "Delete the build log and pretend it never happened.",
                "Rotate the payment API secret immediately with the provider, update CI/CD secret masking plugins, scrub the historical build logs, and add a pre-commit scanner (e.g., git-secrets or Trufflehog).",
                "Ban bash scripts in CI.",
                "Fire the developer immediately."
            ],
            "correct_index": 1,
            "explanation": "Immediate credential rotation prevents exploitation, and automated secret scanners prevent subsequent plain-text log leakage."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "An associate software engineer feels intimidated by senior peers and rarely speaks during technical grooming sessions. How can the engineering manager create an inclusive environment?",
            "options": [
                "Assign them to work alone on an isolated project.",
                "Conduct regular 1-on-1 coaching, encourage them to present small technical research spikes during grooming, and prompt them warmly for their perspective on relevant tickets.",
                "Publicly announce that quiet developers will be penalized.",
                "Ignore the dynamic."
            ],
            "correct_index": 1,
            "explanation": "Empowering junior engineers with dedicated low-stakes presentations and intentional prompts builds psychological safety and technical voice."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "Your company's database cluster disk usage reaches 88%, triggering a PagerDuty warning. The automated growth rate indicates the disk will fill up in 14 hours. How should the on-call engineer respond?",
            "options": [
                "Wait 13 hours to see if someone else cleans it up.",
                "Acknowledge the alert, identify large temporary table spikes or WAL accumulations, expand the EBS storage volume online immediately (if cloud-hosted), and investigate unindexed query logs creating excessive temp disk files.",
                "Drop all production indexes immediately.",
                "Turn off the database."
            ],
            "correct_index": 1,
            "explanation": "Online cloud volume expansion prevents catastrophic disk exhaustion while root-cause analysis identifies rogue temporary files or write spikes."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your platform is hit by a massive distributed credential stuffing attack against the `/api/login` endpoint, generating 4,000 attempts per second from 20,000 unique residential IP addresses. Standard rate limiting by IP fails. What security control should be deployed?",
            "options": [
                "Shut down login for all users permanently.",
                "Deploy behavioral Web Application Firewall (WAF) protections: implement progressive CAPTCHA challenges, enforce IP reputation and device fingerprinting, and activate account lockout thresholds based on user-handle velocity.",
                "Allow the attackers to guess passwords until they give up.",
                "Change all user passwords without informing customers."
            ],
            "correct_index": 1,
            "explanation": "Credential stuffing from rotating residential proxies bypasses simple IP rate limiting; device fingerprinting, velocity tracking per user account, and adaptive CAPTCHA mitigate distributed attacks."
        }
    ]
}

SET_49 = {
    "set_number": 49,
    "title": "Soft Skill Assessment - Set 49",
    "slug": "soft-skill-assessment-set-49",
    "description": "Assesses pipe alligations, alternating direction compass tracking, contrary-to-fact mood, and multi-tenant database row-level security.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two pipes A and B can fill a cistern in 15 hours and 20 hours respectively, while a third pipe C can empty it in 30 hours. If all three pipes are opened simultaneously in an empty cistern, in how many hours will it be full?",
            "options": ["10 hours", "12 hours", "14 hours", "15 hours"],
            "correct_index": 1,
            "explanation": "Net rate per hour = 1/15 + 1/20 - 1/30 = (4 + 3 - 2)/60 = 5/60 = 1/12. The cistern will be filled in 12 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The price of petrol increases by 25%. By what percentage must a motorist reduce petrol consumption so that the overall expenditure remains unchanged?",
            "options": ["16.67%", "20%", "25%", "33.33%"],
            "correct_index": 1,
            "explanation": "Reduction % = [r / (100 + r)] × 100 = [25 / 125] × 100 = (1/5) × 100 = 20%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the difference between compound interest and simple interest on ₹20,000 for 2 years at 12% per annum.",
            "options": ["₹240", "₹264", "₹288", "₹312"],
            "correct_index": 2,
            "explanation": "Difference for 2 years = P(r/100)^2 = 20,000 × (12/100)^2 = 20,000 × 0.0144 = ₹288."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man walks a certain distance at 4 km/h and returns on a bicycle at 16 km/h. If the entire journey took 5 hours, what was the one-way distance?",
            "options": ["12 km", "14 km", "16 km", "18 km"],
            "correct_index": 2,
            "explanation": "Let distance be d. d / 4 + d / 16 = 5 => (4d + d) / 16 = 5 => 5d / 16 = 5 => d = 16 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average weight of 8 persons increases by 2.5 kg when a new person replaces one of them weighing 65 kg. What is the weight of the new person?",
            "options": ["75 kg", "80 kg", "85 kg", "90 kg"],
            "correct_index": 2,
            "explanation": "Total weight increase = 8 × 2.5 = 20 kg. Weight of new person = Replaced weight + total increase = 65 + 20 = 85 kg."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "What is the remainder when (7^84 + 1) is divided by 8?",
            "options": ["0", "1", "2", "7"],
            "correct_index": 2,
            "explanation": "7 = -1 (mod 8). 7^84 = (-1)^84 = 1 (mod 8). Therefore, 7^84 + 1 = 1 + 1 = 2 (mod 8). The remainder is 2."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can 6 students be divided equally into two groups of 3 each?",
            "options": ["10", "15", "20", "30"],
            "correct_index": 0,
            "explanation": "Number of ways to divide 2n people into 2 unnamed groups of n = (2nCn) / 2! = (6C3) / 2 = 20 / 2 = 10 ways."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The area of a circle is 616 cm². What is the perimeter of a semi-circle of the same radius (use pi = 22/7)?",
            "options": ["36 cm", "72 cm", "88 cm", "108 cm"],
            "correct_index": 1,
            "explanation": "pi * r^2 = 616 => (22/7) * r^2 = 616 => r^2 = (616 × 7)/22 = 28 × 7 = 196 => r = 14 cm. Perimeter of semi-circle = pi * r + 2r = (22/7)*14 + 2(14) = 44 + 28 = 72 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All indexes are structures. Some structures are b-trees. No b-tree is flat. Conclusions: I. Some structures are not flat. II. No index is flat.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Structures that are b-trees cannot be flat, so some structures are not flat (I follows). Indexes are structures, but they may or may not be b-trees; there is no guaranteed separation between indexes and flat (II does not follow). Only I follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six servers—Alfa, Beta, Gamma, Delta, Epsilon, and Zeta—are connected in a ring network. Alfa is adjacent to Beta and Zeta. Delta is adjacent to Epsilon and Gamma. Beta is adjacent to Gamma. Which server is adjacent to both Zeta and Delta?",
            "options": ["Alfa", "Beta", "Epsilon", "Gamma"],
            "correct_index": 2,
            "explanation": "Ring sequence: Alfa is between Beta and Zeta (Zeta - Alfa - Beta). Beta is connected to Gamma (Zeta - Alfa - Beta - Gamma). Delta is connected to Gamma (Zeta - Alfa - Beta - Gamma - Delta). To close the ring of 6 servers, Delta connects to Epsilon, and Epsilon connects to Zeta (Delta - Epsilon - Zeta). Therefore, Epsilon is adjacent to both Zeta and Delta."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'GIT' is coded as 'IKV' (+2 to each letter), what is the code for 'HUB'?",
            "options": ["JWD", "JVD", "IWD", "JVC"],
            "correct_index": 0,
            "explanation": "H(+2)=J, U(+2)=W, B(+2)=D => JWD."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A technician walks 30 meters West, turns left and walks 20 meters, turns left again and walks 30 meters, then turns right and walks 10 meters. How far and in which direction is the technician from the starting point?",
            "options": ["30 meters South", "30 meters North", "20 meters South", "40 meters South"],
            "correct_index": 0,
            "explanation": "West 30m, Left (South) 20m, Left (East) 30m, Right (South) 10m. The horizontal movements cancel (-30 + 30 = 0). The vertical movements are 20m South + 10m South = 30 meters South."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man, a woman said: 'His father's only daughter is my mother.' How is the woman related to the man?",
            "options": ["Niece", "Sister", "Daughter", "Mother"],
            "correct_index": 0,
            "explanation": "The man's father's only daughter is the man's sister. If the man's sister is the woman's mother, the woman is the niece of the man."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the odd one out from the following data formats:",
            "options": ["JSON", "XML", "YAML", "JPEG"],
            "correct_index": 3,
            "explanation": "JSON, XML, and YAML are structured data serialization formats, whereas JPEG is a raster image compression format."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should companies deploy automated AI static code analysis tools in their merge pipelines?' Arguments: I. Yes, automated static analysis instantly flags common security vulnerabilities and code smells before code enters production. II. No, AI tools make human developers completely redundant within 6 months.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because static analysis provides automated early security guardrails. Argument II is a hyperbolic fallacy; automated linters assist developers rather than replacing human engineering judgment."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the grammatically correct sentence using the subjunctive mood in a conditional clause:",
            "options": [
                "If the database cluster were to experience network partition, the consensus protocol would elect a new leader.",
                "If the database cluster was to experience network partition, the consensus protocol would elect a new leader.",
                "If the database cluster will experience network partition, the consensus protocol would elect a new leader.",
                "If the database cluster is to experience network partition, the consensus protocol would elect a new leader."
            ],
            "correct_index": 0,
            "explanation": "In hypothetical contrary-to-fact conditional clauses, the formal subjunctive 'were to' is correct."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SERENDIPITY':",
            "options": ["Chance occurrence of pleasant discoveries", "Deliberate planning", "Misfortune", "Careful calculation"],
            "correct_index": 0,
            "explanation": "'Serendipity' is the occurrence and development of events by chance in a happy or beneficial way."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'VORACIOUS':",
            "options": ["Ravenous", "Insatiable", "Quenched", "Gluttonous"],
            "correct_index": 2,
            "explanation": "'Voracious' means wanting or devouring great quantities. Its opposite is 'quenched' or 'satisfied'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To bring to the table' mean?",
            "options": [
                "To deliver food to colleagues",
                "To provide a useful skill, benefit, or resource to a team",
                "To host a formal board dinner",
                "To present a physical blueprint during a meeting"
            ],
            "correct_index": 1,
            "explanation": "'To bring to the table' means to contribute something of value or benefit to a project or discussion."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who flatters others servilely for personal advantage'",
            "options": ["Sycophant", "Iconoclast", "Philanthropist", "Maverick"],
            "correct_index": 0,
            "explanation": "A 'Sycophant' is a person who acts obsequiously toward someone important in order to gain advantage."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Select the correctly spelled word denoting absolute or supreme authority:",
            "options": ["Sovereignty", "Sovereignity", "Soverignty", "Souverainty"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Sovereignty'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A multi-tenant SaaS application vulnerability allows tenant A to view tenant B's customer records by simply changing an `org_id` query parameter in the URL. What is the fundamental architectural defect and fix?",
            "options": [
                "Obfuscate the URL parameter with Base64 encoding.",
                "The system suffers from Insecure Direct Object References (IDOR); implement database Row-Level Security (RLS) or tenant-scoped application middleware that validates that the authenticated session owns the requested resource.",
                "Remove all IDs from URLs.",
                "Ask tenants not to change URLs."
            ],
            "correct_index": 1,
            "explanation": "IDOR vulnerabilities require server-side/database-level authorization enforcement ensuring the caller's verified tenant context matches the data query."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A product designer asks an engineer to implement an accessibility feature that adds ARIA labels and keyboard navigation to all checkout buttons, but the sprint backlog is tight. How should the engineer respond?",
            "options": [
                "Refuse because accessibility is not important.",
                "Support the requirement wholeheartedly, explain that accessibility is a core legal and user-experience standard, and work with the Product Owner to prioritize it within the current or next immediate sprint.",
                "Delete the buttons.",
                "Tell the designer to write the code."
            ],
            "correct_index": 1,
            "explanation": "Accessibility (a11y) is a vital quality and regulatory standard; collaborating with product management ensures proper prioritization without uncoordinated sprint drops."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During an on-call rotation, you observe that your Redis cluster memory usage is at 95% because keys are being inserted without Time-To-Live (TTL) expiration timestamps. How do you resolve this?",
            "options": [
                "Reboot the cluster and lose all data.",
                "Configure an allkeys-lru eviction policy immediately to prevent OOM crashes, and deploy an application patch ensuring all caching calls specify appropriate TTL expiration intervals.",
                "Ignore the alert until Redis crashes.",
                "Disable all caching in the app."
            ],
            "correct_index": 1,
            "explanation": "Configuring LRU eviction protects the cache from out-of-memory crashes while adding explicit application TTLs prevents permanent memory leakage."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization is mandated by SOC 2 compliance auditors to ensure that all database backups stored in Amazon S3 are encrypted with Customer Managed Keys (CMK) and replicate across distinct geographical regions with immutability locks (WORM). How do you enforce this?",
            "options": [
                "Rely on manual downloads to local hard drives.",
                "Configure S3 Object Lock in Compliance mode, enable cross-region bucket replication (CRR) with AWS KMS CMK re-encryption, and verify non-deletion lifecycle rules via automated compliance checks.",
                "Turn off S3 versioning.",
                "Delete all backups older than 24 hours."
            ],
            "correct_index": 1,
            "explanation": "S3 Object Lock in Compliance mode guarantees WORM immutability, and KMS CMK replication across regions satisfies SOC 2 disaster recovery criteria."
        }
    ]
}

SET_50 = {
    "set_number": 50,
    "title": "Soft Skill Assessment - Set 50",
    "slug": "soft-skill-assessment-set-50",
    "description": "Examines escalator pursuit mathematics, circular deduction, correlative grammar syntax, and edge rate-limiting security.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man can row 6 km/h in still water. If the river flows at 2 km/h, it takes him 3 hours to row to a place and return. How far is the place?",
            "options": ["6 km", "8 km", "10 km", "12 km"],
            "correct_index": 1,
            "explanation": "Downstream speed = 6 + 2 = 8 km/h. Upstream speed = 6 - 2 = 4 km/h. Total time: d / 8 + d / 4 = 3 => (d + 2d) / 8 = 3 => 3d / 8 = 3 => d = 8 km."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If A's income is 40% less than B's income, by how much percentage is B's income more than A's income?",
            "options": ["40%", "60%", "66.67%", "75%"],
            "correct_index": 2,
            "explanation": "Let B = 100. Then A = 60. B is more than A by (40 / 60) × 100 = 66.67%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the compound interest on ₹10,000 for 1 year at 20% per annum, compounded half-yearly.",
            "options": ["₹2,000", "₹2,100", "₹2,200", "₹2,250"],
            "correct_index": 1,
            "explanation": "Half-yearly rate = 20% / 2 = 10%. Periods n = 2. Amount = 10,000 × (1.10)^2 = 10,000 × 1.21 = ₹12,100. CI = 12,100 - 10,000 = ₹2,100."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train 150 meters long takes 20 seconds to cross a platform 250 meters long. What is the speed of the train in km/h?",
            "options": ["60 km/h", "72 km/h", "80 km/h", "90 km/h"],
            "correct_index": 1,
            "explanation": "Total distance = 150 + 250 = 400 m. Speed in m/s = 400 / 20 = 20 m/s. Speed in km/h = 20 × (18/5) = 4 × 18 = 72 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of first 50 natural numbers is:",
            "options": ["25.0", "25.5", "26.0", "50.0"],
            "correct_index": 1,
            "explanation": "Average of first n natural numbers = (n + 1) / 2 = (50 + 1) / 2 = 51 / 2 = 25.5."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the unit digit of (3^65 × 6^59 × 7^71).",
            "options": ["2", "4", "6", "8"],
            "correct_index": 1,
            "explanation": "Unit digit of 3^65: 65 mod 4 = 1 => 3^1 = 3. Unit digit of 6^59: Any power of 6 ends in 6. Unit digit of 7^71: 71 mod 4 = 3 => 7^3 = 343 (unit 3). Total product of unit digits = 3 × 6 × 3 = 54 => unit digit is 4."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In how many ways can the letters of the word 'LEADER' be arranged?",
            "options": ["120", "240", "360", "720"],
            "correct_index": 2,
            "explanation": "Word LEADER has 6 letters with 'E' repeating 2 times. Total arrangements = 6! / 2! = 720 / 2 = 360."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The ratio between the perimeter and the breadth of a rectangle is 5 : 1. If the area of the rectangle is 216 cm², what is the length of the rectangle?",
            "options": ["12 cm", "16 cm", "18 cm", "24 cm"],
            "correct_index": 2,
            "explanation": "2(l + b) / b = 5 / 1 => 2l + 2b = 5b => 2l = 3b => b = (2/3)l. Area = l * b = l * (2/3)l = (2/3)l^2 = 216 => l^2 = 216 * (3/2) = 324 => l = 18 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All compilers are translators. All translators are interpreters. Conclusions: I. All compilers are interpreters. II. Some interpreters are compilers.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Neither I nor II follows",
                "Both conclusion I and II follow"
            ],
            "correct_index": 3,
            "explanation": "Compilers are entirely within translators, which are entirely within interpreters. Thus all compilers are interpreters (I follows), and interpreters overlap compilers (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six team members A, B, C, D, E, and F sit around a circular table facing the center. A sits opposite D. B sits to the immediate right of A. E sits opposite B. C sits between A and E. Who sits to the immediate right of D?",
            "options": ["E", "F", "B", "C"],
            "correct_index": 0,
            "explanation": "Clockwise positions: 1: A, 2: B (immediate right of A), 3: F, 4: D (opposite A), 5: E (opposite B), 6: C (between E and A). Sitting at 4 (D) facing center, clockwise (immediate right) is position 5, which is E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "If 'NODE' is coded as 'OPEF' (+1 to each letter), how is 'JAVA' coded?",
            "options": ["KBWB", "KCVB", "KBVB", "LCWB"],
            "correct_index": 0,
            "explanation": "J(+1)=K, A(+1)=B, V(+1)=W, A(+1)=B => KBWB."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A courier driver travels 15 km North, turns left and travels 10 km, then turns left again and travels 15 km. How far is the courier from the depot?",
            "options": ["10 km", "15 km", "20 km", "25 km"],
            "correct_index": 0,
            "explanation": "North 15 km, Left (West) 10 km, Left (South) 15 km. Vertical displacements cancel. Distance from depot is 10 km West."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a photograph of a woman, Rahul said: 'Her daughter's father is the only son of my grandfather.' How is Rahul related to the woman in the photograph?",
            "options": ["Son", "Brother", "Nephew", "Father"],
            "correct_index": 0,
            "explanation": "Grandfather's only son is Rahul's father. If the woman's daughter's father is Rahul's father, the woman is Rahul's mother. Therefore, Rahul is her son."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 5, 10, 20, 40, 80, ?",
            "options": ["120", "140", "160", "200"],
            "correct_index": 2,
            "explanation": "Each term is multiplied by 2: 80 × 2 = 160."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Companies should implement automated dependency vulnerability checking on every git pull request.' Conclusions: I. Known vulnerable packages can be prevented from entering the production build artifact. II. Automated scanning tools guarantee 100% bug-free application logic.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I reflects the exact capability of dependency auditing tools like npm audit or Snyk. Conclusion II is an impossible claim; dependency scanners scan known CVEs, not custom business logic correctness."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the sentence that correctly uses the correlative conjunction 'scarcely... when':",
            "options": [
                "Scarcely had the deployment script started when the network interface failed.",
                "Scarcely had the deployment script started than the network interface failed.",
                "Scarcely the deployment script had started when the network interface failed.",
                "Scarcely did the deployment script started when the network interface failed."
            ],
            "correct_index": 0,
            "explanation": "'Scarcely' pairs with 'when' (not 'than') and triggers subject-auxiliary inversion ('Scarcely had the deployment script started...')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SAGACIOUS':",
            "options": ["Wise", "Foolish", "Timid", "Greedy"],
            "correct_index": 0,
            "explanation": "'Sagacious' means having or showing keen mental discernment and good judgment; wise."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'INDOLENT':",
            "options": ["Industrious", "Slothful", "Lazy", "Lethargic"],
            "correct_index": 0,
            "explanation": "'Indolent' means wanting to avoid activity or exertion; lazy. Its antonym is 'industrious' or 'diligent'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To bite off more than one can chew' mean?",
            "options": [
                "To eat excessively fast",
                "To take on a commitment or task that is too large or difficult to manage",
                "To engage in unfair trade practices",
                "To speak aggressively during a presentation"
            ],
            "correct_index": 1,
            "explanation": "'To bite off more than one can chew' means to undertake more responsibilities than one is capable of handling."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who believes that pleasure is the most important thing in life'",
            "options": ["Hedonist", "Ascetic", "Stoic", "Cynic"],
            "correct_index": 0,
            "explanation": "A 'Hedonist' is a person whose life is devoted to the pursuit of pleasure and self-gratification."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an optical illusion:",
            "options": ["Mirage", "Marrage", "Miradge", "Myrage"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Mirage'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A sudden malicious DDoS attack floods your public API gateway with 250,000 requests per minute from spoofed IP addresses, degrading services for legitimate users. What is the proper cloud mitigation?",
            "options": [
                "Shut down the web servers and wait for attackers to stop.",
                "Activate Cloudflare/AWS Shield DDoS mitigation at the edge, enforce rate-limiting rules, enable SYN flood protection, and challenge untrusted traffic with managed challenges.",
                "Add more CPU cores to internal database servers.",
                "Email the attackers."
            ],
            "correct_index": 1,
            "explanation": "Edge DDoS mitigation absorbs and filters volumetric traffic upstream before it exhausts internal compute and networking capacity."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During sprint planning, a developer insists on refactoring a small utility module that is currently working without defects and has no performance complaints. The team has a tight feature deadline. How should the team lead handle this?",
            "options": [
                "Let them spend the entire sprint refactoring.",
                "Explain that while clean code is valued, refactoring should be tied to feature requirements or demonstrated performance issues; create a tech-debt ticket in the backlog for future maintenance sprints.",
                "Berate the developer publicly.",
                "Cancel the entire sprint."
            ],
            "correct_index": 1,
            "explanation": "Balancing business delivery with technical hygiene requires capturing opportunistic refactoring as backlog tickets rather than jeopardizing active commitments."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A junior engineer accidentally writes code that creates an infinite loop in a serverless AWS Lambda function triggered by an S3 upload event, causing 100,000 invocations and threatening a huge cloud bill. How do you stop it immediately?",
            "options": [
                "Delete the entire AWS account.",
                "Set the Lambda function's reserved concurrency to 0 immediately to throttle all executions, remove the S3 event trigger, and inspect the code.",
                "Wait for the monthly billing cycle to end.",
                "Ignore it."
            ],
            "correct_index": 1,
            "explanation": "Setting Lambda concurrency to 0 halts all ongoing and incoming invocations immediately, stopping runaway cloud cost accumulation."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization's identity provider (IdP) experiences an authentication outage, preventing all engineers from logging into production AWS consoles. An emergency production database incident occurs simultaneously. What is the disaster recovery mechanism?",
            "options": [
                "Wait until the third-party IdP resolves their outage.",
                "Utilize the designated emergency 'break-glass' root account credentials stored securely in a physical enterprise safe with hardware MFA and dual-custody authorization.",
                "Create a new public AWS account.",
                "Give up on fixing the production incident."
            ],
            "correct_index": 1,
            "explanation": "Enterprise SRE governance establishes hardware-MFA secured 'break-glass' procedures for mission-critical access during external IdP blackouts."
        }
    ]
}

PART_10_SETS = [SET_46, SET_47, SET_48, SET_49, SET_50]
