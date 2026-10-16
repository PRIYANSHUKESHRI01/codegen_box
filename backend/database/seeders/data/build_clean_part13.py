# -*- coding: utf-8 -*-
"""
Generator for complete and 100% unique sets_part13.py and sets_part14.py.
"""
import sys, os

def write_part13():
    # Write sets_part13.py
    with open('backend/database/seeders/data/sets_part13.py', 'w', encoding='utf-8') as f:
        f.write('''# -*- coding: utf-8 -*-
"""
Soft Skill Assessment Sets Part 13 (Sets 61 to 65)
25 corporate-placement-level questions per set:
8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/Business English, 4 Workplace Situational Judgment
Explanations included for all questions.
"""

SET_61 = {
    "title": "Soft Skill Assessment - Set 61",
    "description": "Comprehensive corporate assessment covering advanced quantitative aptitude, multi-variable logic, professional business English, and high-stakes workplace decision-making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "status": "published",
    "assessment_type": "general",
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A cyclist travels 30 km at an average speed of 15 km/h and then another 30 km at an average speed of 10 km/h. What is the average speed for the entire 60 km journey?",
            "options": ["12.0 km/h", "12.5 km/h", "13.0 km/h", "13.5 km/h"],
            "correct_index": 0,
            "explanation": "Average speed = Total distance / Total time. Time 1 = 30 / 15 = 2 hours. Time 2 = 30 / 10 = 3 hours. Total time = 2 + 3 = 5 hours. Average speed = 60 / 5 = 12 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A motorboat whose speed in still water is 18 km/h takes 1 hour more to go 24 km upstream than to return downstream to the same spot. What is the speed of the stream?",
            "options": ["4 km/h", "6 km/h", "8 km/h", "10 km/h"],
            "correct_index": 1,
            "explanation": "24/(18 - s) - 24/(18 + s) = 1. 24[ (18 + s) - (18 - s) ] / (324 - s²) = 1 => 48s = 324 - s² => s² + 48s - 324 = 0. (s + 54)(s - 6) = 0 => s = 6 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A shopkeeper sells an article at a discount of 20% on the marked price and still gains 25%. If the cost price of the article is ₹800, what is the marked price?",
            "options": ["₹1,150", "₹1,200", "₹1,250", "₹1,300"],
            "correct_index": 2,
            "explanation": "Cost Price = ₹800. Selling Price at 25% profit = 800 × 1.25 = ₹1,000. Marked Price × 0.80 = 1,000 => Marked Price = 1000 / 0.80 = ₹1,250."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹10,000 is invested at 10% per annum compound interest, compounded annually. What will be the amount at the end of 3 years?",
            "options": ["₹12,500", "₹13,000", "₹13,310", "₹13,500"],
            "correct_index": 2,
            "explanation": "Amount = P(1 + r/100)³ = 10,000 × (1.10)³ = 10,000 × 1.331 = ₹13,310."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In a mixture of 60 litres, the ratio of milk and water is 2 : 1. How many litres of water must be added to make the ratio 1 : 2?",
            "options": ["40 litres", "50 litres", "60 litres", "70 litres"],
            "correct_index": 2,
            "explanation": "Initial Milk = 60 × (2/3) = 40 litres, Water = 20 litres. To make ratio 1 : 2: 40 / (20 + W) = 1/2 => 20 + W = 80 => W = 60 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 8 consecutive even numbers is 43. What is the largest of these numbers?",
            "options": ["46", "48", "50", "52"],
            "correct_index": 2,
            "explanation": "Let the numbers be x, x+2, x+4, x+6, x+8, x+10, x+12, x+14. Average = x + 7 = 43 => x = 36. Largest = 36 + 14 = 50."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "How many 4-digit numbers can be formed using the digits 1, 2, 3, 4, 5, and 6 without repetition such that the number is divisible by 5?",
            "options": ["60", "72", "96", "120"],
            "correct_index": 0,
            "explanation": "To be divisible by 5, the unit digit must be 5 (1 choice). The remaining 3 positions must be filled from the remaining 5 digits without repetition: 5 × 4 × 3 = 60 ways."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the remainder when 3^102 is divided by 7.",
            "options": ["1", "2", "3", "4"],
            "correct_index": 0,
            "explanation": "By Fermat's Little Theorem, 3^6 ≡ 1 (mod 7). 102 = 6 × 17. Thus, 3^102 = (3^6)^17 ≡ 1^17 ≡ 1 (mod 7)."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: No firewalls are proxies. All proxies are bastions. Some bastions are honeypots. Conclusions: I. Some bastions are not firewalls. II. No firewall is a honeypot.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "All proxies are bastions and no proxy is a firewall. Therefore, those bastions which are proxies cannot be firewalls (I follows). There is no given relationship between firewalls and honeypots (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Seven team members—A, B, C, D, E, F, and G—sit in a row facing North. C sits in the exact middle. D sits to the immediate left of C. A sits at the extreme left end. B is to the immediate right of C. If G is to the right of B and E is at the extreme right end, who sits to the immediate left of D?",
            "options": ["A", "F", "E", "Cannot be determined without F's position"],
            "correct_index": 1,
            "explanation": "Positions 1 to 7: Position 1 is A. Middle (Position 4) is C. Position 3 is D (immediate left of C). Position 5 is B. Position 7 is E. G is right of B (Position 6). Position 2 must be F. Immediate left of D (pos 3) is Position 2 (F)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'ORACLE' is coded as 'PSBDMF' (+1 to each letter). How is 'SQL' coded under the same rule?",
            "options": ["TRM", "URM", "TSM", "TRN"],
            "correct_index": 0,
            "explanation": "S(+1)=T, Q(+1)=R, L(+1)=M => TRM."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A field engineer drives 10 km South, turns left and drives 6 km, then turns left again and drives 10 km. How far and in which direction is the engineer from the start?",
            "options": ["6 km East", "6 km West", "10 km East", "16 km South"],
            "correct_index": 0,
            "explanation": "South 10 km, Left (East) 6 km, Left (North) 10 km. Vertical displacement is 0. The engineer is 6 km East of the starting point."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a photograph, a manager said: 'The man in the photo is the son of the only daughter of my father.' How is the manager related to the man in the photo (assuming the manager is male)?",
            "options": ["Maternal Uncle", "Father", "Brother", "Cousin"],
            "correct_index": 0,
            "explanation": "Father's only daughter is the manager's sister. The man in the photo is the son of the manager's sister. Therefore, the manager is his maternal uncle."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number completes the sequence: 4, 9, 25, 49, 121, ?",
            "options": ["144", "169", "196", "225"],
            "correct_index": 1,
            "explanation": "The series consists of squares of prime numbers: 2²=4, 3²=9, 5²=25, 7²=49, 11²=121, 13²=169."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should companies deploy automated static code analysis (SAST) in all developer git pre-commit hooks?' Arguments: I. Yes, catching common security flaws and lint errors at commit time significantly reduces code remediation costs downstream. II. No, developers will find running local checks takes an extra 10 seconds before committing.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both arguments are strong",
                "Neither argument is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because shifting security left saves substantial remediation costs. Argument II is trivial compared to the risk of deploying critical security bugs."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence demonstrating parallel structure:",
            "options": [
                "The engineering manager prefers writing unit tests, reviewing pull requests, and mentoring junior engineers.",
                "The engineering manager prefers writing unit tests, to review pull requests, and mentoring junior engineers.",
                "The engineering manager prefers to write unit tests, reviewing pull requests, and to mentor junior engineers.",
                "The engineering manager prefers writing unit tests, review pull requests, and mentoring junior engineers."
            ],
            "correct_index": 0,
            "explanation": "Parallel structure requires uniform grammatical forms. In option A, all three items in the series are gerunds ('writing...', 'reviewing...', 'mentoring...')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'ABSTRUSE':",
            "options": ["Obscure", "Clear", "Shallow", "Obvious"],
            "correct_index": 0,
            "explanation": "'Abstruse' means difficult to understand; obscure or esoteric."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'DISPARATE':",
            "options": ["Homogeneous", "Diverse", "Different", "Distinct"],
            "correct_index": 0,
            "explanation": "'Disparate' means essentially different in kind. Its antonym is 'homogeneous' or 'similar'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To see eye to eye' mean?",
            "options": [
                "To look directly into someone's pupils",
                "To be in full agreement with someone",
                "To wear optical glasses",
                "To confront an opponent angrily"
            ],
            "correct_index": 1,
            "explanation": "'To see eye to eye' means to agree fully with someone on a matter."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A speech made to oneself, especially by a character in a play'",
            "options": ["Soliloquy", "Dialogue", "Prologue", "Epilogue"],
            "correct_index": 0,
            "explanation": "A 'Soliloquy' is an act of speaking one's thoughts aloud when by oneself or regardless of any hearers."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting complete agreement:",
            "options": ["Consensus", "Concensus", "Consensous", "Conscensus"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Consensus'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A team lead notices that sprint deliverables are consistently delayed because tickets spend an average of 4 days in the 'Code Review' column waiting for reviewers. What process improvement should be introduced?",
            "options": [
                "Abolish code reviews to speed up delivery.",
                "Establish a team Working Agreement with explicit review SLAs (e.g., reviews within 24 hours), dedicate daily pairing review blocks, and keep pull requests small (<250 lines).",
                "Assign all code reviews to an external contractor.",
                "Mandate that engineers work on weekends to clear the review queue."
            ],
            "correct_index": 1,
            "explanation": "Setting explicit team SLAs, capping pull request sizing, and allocating scheduled review time directly solves code review pipeline stagnation."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During an internal tech demo, a senior executive asks an architect a technical question regarding API performance metrics that the architect does not currently have data for. How should the architect respond?",
            "options": [
                "Make up an estimated number on the spot to look knowledgeable.",
                "Acknowledge transparently that they do not have the exact metric at hand, explain the testing methodology underway, and commit to following up with verified benchmark data by end of day.",
                "Change the subject abruptly.",
                "Criticize the executive for asking about metrics."
            ],
            "correct_index": 1,
            "explanation": "Professional credibility relies on intellectual honesty: never guess critical engineering numbers; acknowledge gaps and provide prompt, verified follow-ups."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A security audit discovers that an application endpoint exposes detailed stack traces including database table names in HTTP 500 error responses. What is the immediate production fix?",
            "options": [
                "Do nothing because only developers inspect 500 responses.",
                "Configure a global exception handler to intercept unhandled exceptions, log detailed stack traces securely to internal telemetry, and return generic sanitized error messages with unique correlation IDs to clients.",
                "Disable all error logging in the server.",
                "Shut down the web server."
            ],
            "correct_index": 1,
            "explanation": "Information disclosure vulnerabilities are mitigated by returning sanitized error codes to clients while capturing full traces internally with correlation IDs for debugging."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization is designing an asynchronous order fulfillment system that must handle 50,000 orders per minute during holiday promotions without dropping orders if downstream warehouse inventory APIs become temporarily unresponsive. What architecture is essential?",
            "options": [
                "Synchronous REST HTTP calls with infinite retry loops on frontend servers.",
                "An event-driven architecture using durable message streaming (e.g., Apache Kafka or AWS SQS) with dead-letter queues, backpressure management, and idempotent consumer processing.",
                "A single relational database table polled by cron jobs every second.",
                "Manually queuing orders in spreadsheets."
            ],
            "correct_index": 1,
            "explanation": "Durable distributed message queues with dead-letter buffering and idempotent processing decouple high-volume ingress from transient downstream bottlenecks."
        }
    ]
}

SET_62 = {
    "title": "Soft Skill Assessment - Set 62",
    "description": "Comprehensive corporate assessment covering advanced quantitative aptitude, multi-variable logic, professional business English, and high-stakes workplace decision-making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "status": "published",
    "assessment_type": "general",
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two trains 140 m and 160 m long run at the speeds of 60 km/h and 40 km/h respectively in opposite directions on parallel tracks. How long will they take to cross each other?",
            "options": ["9.6 seconds", "10.8 seconds", "12.0 seconds", "14.4 seconds"],
            "correct_index": 1,
            "explanation": "Total distance = 140 + 160 = 300 m. Relative speed = 60 + 40 = 100 km/h = 100 × (5/18) = 250/9 m/s. Time = 300 / (250/9) = 300 × 9 / 250 = 10.8 seconds."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B together can complete a piece of work in 12 days. B alone can finish it in 30 days. In how many days can A alone finish the work?",
            "options": ["18 days", "20 days", "24 days", "25 days"],
            "correct_index": 1,
            "explanation": "Work rate of A = 1/12 - 1/30 = (5 - 2)/60 = 3/60 = 1/20. Thus, A alone takes 20 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "By selling an article for ₹1,440, a trader loses 10%. At what price should he sell it to gain 15%?",
            "options": ["₹1,720", "₹1,800", "₹1,840", "₹1,920"],
            "correct_index": 2,
            "explanation": "Cost Price = 1,440 / 0.90 = ₹1,600. To gain 15%, Selling Price = 1,600 × 1.15 = ₹1,840."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The difference between simple and compound interest on ₹12,500 for 2 years at r% per annum is ₹125. Find the value of r.",
            "options": ["8%", "10%", "12%", "15%"],
            "correct_index": 1,
            "explanation": "Difference = P × (r/100)² => 125 = 12,500 × (r/100)² => (r/100)² = 125 / 12,500 = 1/100 => r/100 = 1/10 => r = 10%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio of incomes of two persons is 5 : 3 and that of their expenditures is 9 : 5. If each saves ₹2,600, find the income of the first person.",
            "options": ["₹24,000", "₹26,000", "₹28,000", "₹30,000"],
            "correct_index": 1,
            "explanation": "Let incomes be 5x and 3x. (5x - 2600)/(3x - 2600) = 9/5 => 25x - 13,000 = 27x - 23,400 => 2x = 10,400 => x = 5,200. First person's income = 5 × 5,200 = ₹26,000."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 11 results is 50. If the average of the first 6 results is 49 and that of the last 6 results is 52, what is the 6th result?",
            "options": ["52", "54", "56", "58"],
            "correct_index": 2,
            "explanation": "Sum of 11 results = 11 × 50 = 550. Sum of first 6 = 6 × 49 = 294. Sum of last 6 = 6 × 52 = 312. 6th result = (294 + 312) - 550 = 606 - 550 = 56."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "In a lottery, there are 10 prizes and 25 blanks. What is the probability of getting a prize from a single draw?",
            "options": ["1/5", "2/7", "3/10", "1/3"],
            "correct_index": 1,
            "explanation": "Total tickets = 10 + 25 = 35. Favorable tickets = 10. Probability = 10 / 35 = 2/7."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A cylindrical pillar has diameter 50 cm and height 3.5 m. Find the cost of painting its curved surface at ₹12.50 per m² (use pi = 22/7).",
            "options": ["₹62.50", "₹68.75", "₹72.00", "₹75.50"],
            "correct_index": 1,
            "explanation": "r = 0.25 m, h = 3.5 m. Curved Surface Area = 2 × (22/7) × 0.25 × 3.5 = 5.5 m². Cost = 5.5 × ₹12.50 = ₹68.75."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All caches are in-memory. Some in-memory stores are volatile. Conclusions: I. Some caches are volatile. II. Some in-memory stores are caches.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 1,
            "explanation": "Since all caches are in-memory, by conversion some in-memory stores are caches (II follows). Caches and volatile have no definite intersection (I does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six team members—P, Q, R, S, T, and U—are seated around a circular table facing the center. P sits opposite S. Q sits to the immediate right of P. T sits opposite Q. Who sits to the immediate left of P?",
            "options": ["Q", "S", "T", "U"],
            "correct_index": 3,
            "explanation": "With 6 people facing inward, opposite pairs are (P, S) and (Q, T). Immediate right of P is Q. Opposite Q is T. Immediate left of P must be U."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'PYTHON' is coded as 'QZUIPO' (+1 to each letter). How is 'KOTLIN' coded under the same rule?",
            "options": ["LPUMJO", "LPTMJO", "LQUMJO", "LPVNJO"],
            "correct_index": 0,
            "explanation": "K(+1)=L, O(+1)=P, T(+1)=U, L(+1)=M, I(+1)=J, N(+1)=O => LPUMJO."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A delivery robot starts at point O, moves 12 m North, turns right and moves 9 m. What is the straight-line distance from point O?",
            "options": ["15 m", "18 m", "21 m", "25 m"],
            "correct_index": 0,
            "explanation": "Distance = sqrt(12² + 9²) = sqrt(144 + 81) = sqrt(225) = 15 m."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A man said to a woman, 'Your only brother's sister is my mother.' How is the woman related to the man's maternal grandmother?",
            "options": ["Daughter", "Granddaughter", "Mother", "Niece"],
            "correct_index": 0,
            "explanation": "The woman is the brother's sister, meaning she is either the mother or the maternal aunt. Her mother is the man's maternal grandmother. Therefore, the woman is her daughter."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Select the odd one out from the following distributed messaging systems:",
            "options": ["Apache Kafka", "RabbitMQ", "Apache Pulsar", "PostgreSQL"],
            "correct_index": 3,
            "explanation": "PostgreSQL is a relational database management system, whereas Apache Kafka, RabbitMQ, and Apache Pulsar are distributed message streaming/queueing systems."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should organizations adopt Trunk-Based Development over long-lived feature branches?' Arguments: I. Yes, merging small, frequent commits into the main branch minimizes merge conflicts and accelerates feedback loops. II. No, feature branches that live for three months ensure code is never released early.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both I and II are strong",
                "Neither I nor II is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I captures the fundamental DevOps advantage of Trunk-Based Development. Argument II describes an anti-pattern that causes massive merge friction and deployment delays."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the grammatical error: 'Each of the senior microservices engineers (A) / have submitted their peer evaluations (B) / prior to the quarterly deadline. (C) / No error (D)'",
            "options": ["Part (A)", "Part (B)", "Part (C)", "Part (D)"],
            "correct_index": 1,
            "explanation": "'Each' is grammatically singular and requires the singular verb 'has submitted', not 'have submitted'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'GARRULOUS':",
            "options": ["Talkative", "Reticent", "Taciturn", "Laconic"],
            "correct_index": 0,
            "explanation": "'Garrulous' means excessively talkative, especially on trivial matters."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'PUSILLANIMOUS':",
            "options": ["Brave", "Cowardly", "Timid", "Fearful"],
            "correct_index": 0,
            "explanation": "'Pusillanimous' means showing a lack of courage or determination; timid. Its direct antonym is 'brave' or 'courageous'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To take the bull by the horns' mean?",
            "options": [
                "To manage livestock on a ranch",
                "To face a difficult or dangerous situation directly and courageously",
                "To provoke an aggressive argument",
                "To abandon a project due to fear"
            ],
            "correct_index": 1,
            "explanation": "'To take the bull by the horns' means to confront a challenge or problem directly and with fortitude."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who compiles dictionaries'",
            "options": ["Lexicographer", "Cartographer", "Calligrapher", "Bibliophile"],
            "correct_index": 0,
            "explanation": "A 'Lexicographer' is a person who compiles, edits, or writes dictionaries."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting the state of being completely forgotten:",
            "options": ["Oblivion", "Obliveon", "Oblevion", "Oblivyion"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Oblivion'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A database deadlock spike causes API response times to degrade from 50ms to 4,500ms across all tenant endpoints. APM metrics identify two asynchronous billing workers locking the same account rows in opposite order. What is the immediate engineering resolution?",
            "options": [
                "Reboot the database server repeatedly.",
                "Enforce a deterministic locking order (e.g., sort accounts by primary ID before acquiring row locks in transactions) across all worker tasks and add statement timeouts.",
                "Disable customer billing permanently.",
                "Increase database connection pool size to 10,000 connections."
            ],
            "correct_index": 1,
            "explanation": "Acquiring transaction locks in a consistent, deterministic order prevents cyclic wait conditions that cause relational database deadlocks."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During sprint planning, the tech lead observes that three squads are independently building separate authentication and JWT token verification modules with divergent security standards. How should the engineering organization align them?",
            "options": [
                "Allow each squad to deploy whatever auth library they want to encourage freedom.",
                "Charter an internal Platform Engineering / Core Security working group to create a shared, audited, and reusable auth SDK library published to the internal artifact repository.",
                "Cancel authentication entirely across the platform.",
                "Fire the developers of two squads."
            ],
            "correct_index": 1,
            "explanation": "Centralizing core security primitives into a shared, audited platform SDK eliminates duplication, standardizes compliance, and enhances security posture."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An external email delivery SaaS provider experiences an outage, causing transaction confirmation emails in your synchronous checkout flow to timeout after 30 seconds and block user purchases. What is the proper architectural remediation?",
            "options": [
                "Remove email notifications from the product altogether.",
                "Decouple email notifications from the synchronous checkout path by publishing checkout events to an asynchronous message broker (e.g., SQS/Kafka) with automated retry and dead-letter queues.",
                "Double the HTTP timeout to 60 seconds.",
                "Instruct users to call customer support to confirm orders."
            ],
            "correct_index": 1,
            "explanation": "Decoupling non-critical notification side effects into asynchronous message queues protects core transactional checkout flows from upstream third-party failures."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your engineering team discovers that the monthly cloud spend on staging environments has doubled because developers spin up expensive GPU clusters and forget to terminate them over weekends. What policy and tooling should be instituted?",
            "options": [
                "Ban developers from ever using GPU clusters in cloud development.",
                "Implement automated cloud resource scheduling (e.g., AWS Instance Scheduler) to shut down non-production environments outside business hours, paired with budget alerts and automated lifecycle tag policies.",
                "Request an emergency budget increase from the CFO without asking questions.",
                "Turn off all production servers on weekends."
            ],
            "correct_index": 1,
            "explanation": "Automated schedule-based shutdown of non-production cloud environments combined with budget alarms and resource tagging eliminates idle cloud waste."
        }
    ]
}

SET_63 = {
    "title": "Soft Skill Assessment - Set 63",
    "description": "Comprehensive corporate assessment covering advanced quantitative aptitude, multi-variable logic, professional business English, and high-stakes workplace decision-making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "status": "published",
    "assessment_type": "general",
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A man walks at 5 km/h for 6 hours and at 4 km/h for 12 hours. What is his average speed for the entire journey?",
            "options": ["4.22 km/h", "4.33 km/h", "4.50 km/h", "4.67 km/h"],
            "correct_index": 1,
            "explanation": "Total distance = (5 × 6) + (4 × 12) = 30 + 48 = 78 km. Total time = 6 + 12 = 18 hours. Average speed = 78 / 18 = 4.33 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two pipes P and Q can fill an oil storage reservoir in 36 minutes and 45 minutes respectively. A drain pipe R can empty it in 30 minutes. If P and Q are opened simultaneously and after 7 minutes R is also opened, in how many more minutes will the reservoir be completely filled?",
            "options": ["35 minutes", "39 minutes", "42 minutes", "45 minutes"],
            "correct_index": 1,
            "explanation": "Total capacity = LCM(36, 45, 30) = 180 units. Rate of P = 5 u/min, Q = 4 u/min, R = -6 u/min. In the first 7 minutes, P and Q fill: (5 + 4) × 7 = 63 units. Remaining capacity = 180 - 63 = 117 units. When R is opened, net rate = 5 + 4 - 6 = 3 u/min. Additional time = 117 / 3 = 39 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "If selling price is doubled, the profit triples. What is the initial profit percentage?",
            "options": ["50%", "75%", "100%", "120%"],
            "correct_index": 2,
            "explanation": "Let CP = c, SP = s. Initial profit = s - c. New profit = 2s - c = 3(s - c) => 2s - c = 3s - 3c => s = 2c. Profit = 2c - c = c. Profit % = (c/c) × 100 = 100%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of ₹8,000 invested at compound interest doubles in 5 years. How much will it amount to in 20 years at the same rate?",
            "options": ["₹64,000", "₹96,000", "₹128,000", "₹256,000"],
            "correct_index": 2,
            "explanation": "In 5 years: 2×. In 20 years (4 cycles of 5 years): 2⁴ = 16×. Amount = 8,000 × 16 = ₹1,28,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two vessels A and B contain spirit and water in the ratio 5 : 2 and 7 : 6 respectively. In what ratio should these mixtures be blended to obtain a new mixture in which spirit and water are in the ratio 8 : 5?",
            "options": ["7 : 9", "9 : 7", "3 : 5", "5 : 3"],
            "correct_index": 0,
            "explanation": "Spirit in A = 5/7. Spirit in B = 7/13. Desired spirit = 8/13. By alligation: (8/13 - 7/13) : (5/7 - 8/13) = (1/13) : (65 - 56)/91 = (1/13) : (9/91) = (7/91) : (9/91) = 7 : 9."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 5 consecutive even numbers A, B, C, D, and E is 66. What is the product of B and D?",
            "options": ["4,216", "4,352", "4,480", "4,620"],
            "correct_index": 2,
            "explanation": "Since average is 66, the middle number C = 66. The numbers are 62, 64, 66, 68, 70. B = 64, D = 68. Product = 64 × 68 = 4,352... Wait! 64 × 68: 64 × 60 = 3840; 64 × 8 = 512; 3840 + 512 = 4352. Option 1 is 4,352."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "From a group of 7 men and 6 women, 5 persons are to be selected to form a committee so that at least 3 men are there on the committee. In how many ways can this be done?",
            "options": ["564", "645", "735", "756"],
            "correct_index": 3,
            "explanation": "Cases: (3M, 2W) = C(7,3) × C(6,2) = 35 × 15 = 525. (4M, 1W) = C(7,4) × C(6,1) = 35 × 6 = 210. (5M, 0W) = C(7,5) × C(6,0) = 21 × 1 = 21. Total = 525 + 210 + 21 = 756."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the unit digit in the product: (2467)^153 × (341)^72.",
            "options": ["1", "3", "7", "9"],
            "correct_index": 2,
            "explanation": "Unit digit of 2467^153: cyclicity of 7 is 4. 153 mod 4 = 1. 7^1 = 7. Unit digit of 341^72 is always 1. Total unit digit = 7 × 1 = 7."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All pods are ephemeral. Some ephemeral things are stateless. Conclusions: I. Some pods are stateless. II. All stateless things are ephemeral.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 3,
            "explanation": "Pods are inside ephemeral, and stateless intersects ephemeral. There is no guaranteed intersection between pods and stateless (I does not follow). Stateless things are not fully within ephemeral (II does not follow). Neither follows."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Five executives—V, W, X, Y, and Z—board an elevator on floor 1. The elevator stops on floors 2, 3, 4, 5, and 6, with one executive exiting on each floor. V exits immediately before X. W exits after Y. If Z exits on floor 4 and Y exits on floor 2, who exits on floor 6?",
            "options": ["V", "W", "X", "Cannot be determined"],
            "correct_index": 2,
            "explanation": "Floor 2: Y. Floor 4: Z. Available floors: 3, 5, 6. V exits immediately before X, so V must be on floor 5 and X on floor 6. W must exit on floor 3. Therefore, X exits on floor 6."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'RUST' is coded as 'SVTU' (+1 to each letter). How is 'GOLANG' coded under the same rule?",
            "options": ["HPMBOH", "HPMBNH", "IPMCOH", "HQMCOH"],
            "correct_index": 0,
            "explanation": "G(+1)=H, O(+1)=P, L(+1)=M, A(+1)=B, N(+1)=O, G(+1)=H => HPMBOH."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A sales lead travels 25 km South, turns right and travels 15 km, then turns right again and travels 25 km. How far is the sales lead from the regional office?",
            "options": ["15 km West", "15 km East", "25 km South", "50 km North"],
            "correct_index": 0,
            "explanation": "South 25 km, Right (West) 15 km, Right (North) 25 km. Vertical displacements cancel. Position is 15 km West of the regional office."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a man in an auditorium, a speaker said: 'His father is the only son of my grandfather.' How is the speaker related to the man (assuming the speaker is male)?",
            "options": ["Brother", "Uncle", "Father", "Cousin"],
            "correct_index": 0,
            "explanation": "Grandfather's only son is the speaker's father. The man's father is the speaker's father. Therefore, the man is the speaker's brother."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 7, 19, 43, 91, 187, ?",
            "options": ["365", "374", "379", "385"],
            "correct_index": 2,
            "explanation": "The pattern is (2n + 5): 7×2+5=19, 19×2+5=43, 43×2+5=91, 91×2+5=187, 187×2+5=379."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should software companies adopt an open-source first strategy for infrastructure tooling?' Arguments: I. Yes, open-source infrastructure tooling prevents vendor lock-in and benefits from community-driven vulnerability disclosures. II. No, open-source software never comes with commercial enterprise support agreements.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both I and II are strong",
                "Neither I nor II is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong as community governance and multi-cloud portability are proven strengths. Argument II is factually untrue; major open-source infrastructure tools have robust commercial support vendors (e.g., Red Hat, Confluent, HashiCorp)."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the grammatically correct sentence using the correlative conjunction 'no sooner... than':",
            "options": [
                "No sooner had the primary database failed than the automated failover promoted the standby replica.",
                "No sooner had the primary database failed when the automated failover promoted the standby replica.",
                "No sooner the primary database had failed than the automated failover promoted the standby replica.",
                "No sooner did the primary database failed than the automated failover promoted the standby replica."
            ],
            "correct_index": 0,
            "explanation": "'No sooner' requires inversion ('had the primary database failed') and correlates with 'than' (not 'when')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'PERSPICACIOUS':",
            "options": ["Insightful", "Ignorant", "Dull", "Naive"],
            "correct_index": 0,
            "explanation": "'Perspicacious' means having a ready insight into and understanding of things; insightful."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'PROFLIGATE':",
            "options": ["Frugal", "Extravagant", "Wasteful", "Reckless"],
            "correct_index": 0,
            "explanation": "'Profligate' means recklessly extravagant or wasteful in the use of resources. Its antonym is 'frugal' or 'thrifty'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To give someone the cold shoulder' mean?",
            "options": [
                "To offer someone chilled meat",
                "To intentionally ignore or be unfriendly to someone",
                "To provide medical first aid for burns",
                "To dress warmly during winter"
            ],
            "correct_index": 1,
            "explanation": "'To give someone the cold shoulder' means to intentionally display coldness, disregard, or unfriendly indifference toward someone."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who is indifferent to or unaffected by pleasure or pain'",
            "options": ["Stoic", "Epicurean", "Hedonist", "Cynic"],
            "correct_index": 0,
            "explanation": "A 'Stoic' is a person who can endure pain or hardship without showing feelings or complaining."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a mutual relationship or connection:",
            "options": ["Correlation", "Corelation", "Correllation", "Corellation"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Correlation'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During peak holiday sales, your e-commerce checkout database connection pool reaches 100% saturation, rejecting 20% of customer purchases. What immediate architectural change restores checkout availability?",
            "options": [
                "Restart the production database server repeatedly.",
                "Deploy an elastic connection pooler (e.g. AWS RDS Proxy / PgBouncer) to multiplex idle connections, and rate-limit non-essential analytics queries.",
                "Disable all security firewalls.",
                "Take the entire e-commerce store offline until the holiday ends."
            ],
            "correct_index": 1,
            "explanation": "Connection poolers efficiently multiplex thousands of short-lived client requests across a small pool of database connections, preventing thread exhaustion under traffic surges."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A team lead observes that a senior developer dominates all architectural design discussions, interrupting junior engineers whenever they attempt to present ideas. How should the team lead handle this?",
            "options": [
                "Allow the senior developer to continue because they have more experience.",
                "Facilitate design reviews with structured round-robin speaking turns, and speak privately with the senior developer to coach them on active listening and creating psychological safety.",
                "Cancel all future design meetings.",
                "Ban junior developers from attending architecture reviews."
            ],
            "correct_index": 1,
            "explanation": "Facilitating inclusive meeting formats and privately coaching dominant team members fosters collaborative psychological safety and encourages diverse technical input."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A software engineer accidentally triggers a production script that updates all user passwords to a blank string in the customer database. What is the correct disaster recovery protocol?",
            "options": [
                "Ignore it and wait for users to report issues.",
                "Declare an immediate P0 outage, initiate a point-in-time recovery (PITR) restore of the database to the minute prior to the script execution, invalidate all active user sessions, and notify the Security Incident team.",
                "Delete the customer database permanently.",
                "Blame the junior developer on social media."
            ],
            "correct_index": 1,
            "explanation": "Point-in-time recovery (PITR) allows databases to be restored to an exact timestamp before catastrophic data corruption, paired with immediate session revocation."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "Your organization is migrating a legacy monolithic billing system to microservices. The business mandates that customer invoices must never be generated twice, even if multiple payment worker nodes process the event concurrently. What distributed systems pattern is required?",
            "options": [
                "Write invoices to a local text file on each server.",
                "Implement an Idempotent Consumer pattern using a distributed lock and unique invoice idempotency keys in a shared transactional database.",
                "Allow duplicate invoices and manually refund customers at year-end.",
                "Disable parallel worker nodes and process everything on a single CPU core."
            ],
            "correct_index": 1,
            "explanation": "Idempotent consumer processing combined with unique idempotency keys guarantees that repeated messages produce identical, non-duplicate outcomes."
        }
    ]
}

# Fix Set 63 Q6 index
SET_63["questions"][5]["options"] = ["4,216", "4,352", "4,480", "4,620"]
SET_63["questions"][5]["correct_index"] = 1
SET_63["questions"][5]["explanation"] = "Since the average of 5 consecutive even numbers is 66, C = 66. The numbers are 62, 64, 66, 68, 70. B = 64, D = 68. Product = 64 × 68 = 4,352."

SET_64 = {
    "title": "Soft Skill Assessment - Set 64",
    "description": "Comprehensive corporate assessment covering advanced quantitative aptitude, multi-variable logic, professional business English, and high-stakes workplace decision-making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "status": "published",
    "assessment_type": "general",
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A person covers a distance of 150 km in 5 hours, partly by bus at 20 km/h and partly by car at 40 km/h. How much distance did he travel by car?",
            "options": ["80 km", "90 km", "100 km", "110 km"],
            "correct_index": 2,
            "explanation": "Let time by car be t hours. Distance = 40t + 20(5 - t) = 150 => 20t + 100 = 150 => 20t = 50 => t = 2.5 hours. Distance by car = 40 × 2.5 = 100 km."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Two pipes can fill a tank in 20 and 24 minutes respectively and a waste pipe can empty 3 gallons per minute. All the three pipes working together can fill the tank in 15 minutes. What is the capacity of the tank?",
            "options": ["100 gallons", "120 gallons", "150 gallons", "180 gallons"],
            "correct_index": 1,
            "explanation": "Work rate of waste pipe = 1/20 + 1/24 - 1/15 = (6 + 5 - 8)/120 = 3/120 = 1/40 tank per minute. Waste pipe empties the tank in 40 minutes. Capacity = 40 × 3 = 120 gallons."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A trader marks his goods at 40% above the cost price and allows a discount of 25%. What is his profit percentage?",
            "options": ["5%", "8%", "10%", "12%"],
            "correct_index": 0,
            "explanation": "Let CP = 100. Marked Price = 140. Selling Price = 140 × 0.75 = 105. Profit = 105 - 100 = 5%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "What is the difference between compound interest and simple interest on ₹5,000 for 2 years at 12% per annum?",
            "options": ["₹60", "₹72", "₹84", "₹96"],
            "correct_index": 1,
            "explanation": "Difference = P × (r/100)² = 5,000 × (12/100)² = 5,000 × (144 / 10,000) = 5,000 × 0.0144 = ₹72."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A container contains 50 litres of milk. From this, 5 litres of milk is taken out and replaced with water. This process is repeated one more time. How much milk is left in the container?",
            "options": ["40.0 litres", "40.5 litres", "41.5 litres", "42.0 litres"],
            "correct_index": 1,
            "explanation": "Remaining milk = 50 × (1 - 5/50)² = 50 × (0.9)² = 50 × 0.81 = 40.5 litres."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of 30 students in a class is 14 years. If the teacher's age is included, the average age becomes 15 years. What is the teacher's age?",
            "options": ["40 years", "42 years", "45 years", "48 years"],
            "correct_index": 2,
            "explanation": "Initial total age = 30 × 14 = 420. New total age with teacher = 31 × 15 = 465. Teacher's age = 465 - 420 = 45 years."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many ways can 5 boys and 4 girls be seated in a row such that no two girls sit together?",
            "options": ["14,400", "28,800", "43,200", "50,400"],
            "correct_index": 2,
            "explanation": "Seat the 5 boys first: 5! = 120 ways. This creates 6 available spaces (_ B _ B _ B _ B _ B _). Choose 4 spaces for the 4 girls: P(6,4) = 6 × 5 × 4 × 3 = 360. Total arrangements = 120 × 360 = 43,200."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the remainder when 2^256 is divided by 17.",
            "options": ["1", "2", "4", "8"],
            "correct_index": 0,
            "explanation": "2^4 = 16 ≡ -1 (mod 17). 2^256 = (2^4)^64 ≡ (-1)^64 ≡ 1 (mod 17). Remainder is 1."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All gateways are proxies. All proxies are bastions. No bastion is an open relay. Conclusions: I. No gateway is an open relay. II. Some bastions are gateways.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "All gateways are inside bastions, which never touch open relays; thus no gateway is an open relay (I follows). Since all gateways are bastions, by conversion some bastions are gateways (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six servers—S1, S2, S3, S4, S5, and S6—are mounted in a rack from position 1 (top) to 6 (bottom). S3 is immediately below S1. S5 is at position 6. S2 is at position 2. S4 is above S6. If S1 is at position 3, which server is at position 4?",
            "options": ["S3", "S4", "S6", "Cannot be determined"],
            "correct_index": 0,
            "explanation": "S3 is immediately below S1. Since S1 is at position 3, S3 must be at position 4."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'CLOUD' is coded as 'DMPVE' (+1 to each letter). How is 'SERVER' coded using the same rule?",
            "options": ["TFSWFS", "TFSUFS", "TESWES", "TFRWFR"],
            "correct_index": 0,
            "explanation": "S(+1)=T, E(+1)=F, R(+1)=S, V(+1)=W, E(+1)=F, R(+1)=S => TFSWFS."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A network drone flies 16 km East, turns left and flies 12 km. What is the drone's straight-line distance from the launching pad?",
            "options": ["18 km", "20 km", "24 km", "28 km"],
            "correct_index": 1,
            "explanation": "Distance = sqrt(16² + 12²) = sqrt(256 + 144) = sqrt(400) = 20 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "P is the sister of Q. Q is the mother of R. S is the brother of R. How is P related to S?",
            "options": ["Maternal Aunt", "Sister", "Mother", "Grandmother"],
            "correct_index": 0,
            "explanation": "Q is the mother of R and S. P is the sister of Q. Therefore, P is the maternal aunt of S."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number replaces the question mark in the sequence: 5, 11, 23, 47, 95, ?",
            "options": ["181", "191", "201", "211"],
            "correct_index": 1,
            "explanation": "Pattern is (2n + 1): 5×2+1=11, 11×2+1=23, 23×2+1=47, 47×2+1=95, 95×2+1=191."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'All customer-facing web services should enforce strict rate-limiting policies.' Conclusions: I. Rate limiting protects web services from denial-of-service (DoS) and credential stuffing attacks. II. Rate limiting prevents any software bugs from occurring in backend APIs.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I reflects the primary security benefit of API rate limiting. Conclusion II is an absurd claim; rate limiting does not prevent software coding bugs."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence using the inversion pattern with 'Seldom':",
            "options": [
                "Seldom does an architectural redesign achieve both higher velocity and lower complexity.",
                "Seldom an architectural redesign does achieve both higher velocity and lower complexity.",
                "Seldom does achieve an architectural redesign both higher velocity and lower complexity.",
                "Seldom an architectural redesign achieves both higher velocity and lower complexity."
            ],
            "correct_index": 0,
            "explanation": "Negative adverbial openers like 'Seldom' require subject-auxiliary inversion: 'Seldom does [subject] [verb]'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'PUGNACIOUS':",
            "options": ["Combative", "Peaceful", "Timid", "Submissive"],
            "correct_index": 0,
            "explanation": "'Pugnacious' means eager or quick to argue, quarrel, or fight; combative."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'INTRANSIGENT':",
            "options": ["Flexible", "Stubborn", "Uncompromising", "Obstinate"],
            "correct_index": 0,
            "explanation": "'Intransigent' means unwilling or refusing to change one's views. Its antonym is 'flexible' or 'accommodating'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To play devil's advocate' mean?",
            "options": [
                "To support evil causes",
                "To argue against an idea simply to test the strength of the argument",
                "To practice religious witchcraft",
                "To insult a manager publicly"
            ],
            "correct_index": 1,
            "explanation": "'To play devil's advocate' means to take an opposing viewpoint for the sake of exploring all aspects of an issue or testing the resilience of an argument."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A remedy for all diseases, evils, or difficulties'",
            "options": ["Panacea", "Placebo", "Elixir", "Nostrum"],
            "correct_index": 0,
            "explanation": "A 'Panacea' is a solution or remedy for all difficulties or diseases."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting the highest point of attainment:",
            "options": ["Acme", "Akme", "Acmee", "Achme"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Acme'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "During a security vulnerability audit, a pentester demonstrates that appending `' OR 1=1 --` into the search box dumps the entire user credentials table (SQL Injection). What is the immediate engineering remediation standard?",
            "options": [
                "Sanitize strings using custom regex replacement functions in client JavaScript.",
                "Refactor all database queries to use Parameterized Queries (Prepared Statements) or an ORM with parameter binding, completely eliminating string concatenation in SQL.",
                "Turn off SQL logging.",
                "Tell users not to type quotation marks."
            ],
            "correct_index": 1,
            "explanation": "Parameterized queries separate SQL code from user-supplied data, neutralizing SQL injection vulnerabilities at the engine level."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A web platform's Largest Contentful Paint (LCP) metric measures 6.2 seconds on mobile devices, causing high bounce rates. Profiling reveals an unoptimized 8MB promotional hero banner image is being loaded synchronously without dimensions. What are the optimal web performance fixes?",
            "options": [
                "Delete mobile website support.",
                "Convert images to next-gen formats (WebP/AVIF), generate responsive srcset resolutions with explicit width/height dimensions, and add fetchpriority='high' with CDN edge caching.",
                "Hide the image on mobile with display: none in CSS while still downloading it in HTML.",
                "Wait for 6G mobile networks."
            ],
            "correct_index": 1,
            "explanation": "Compressing into modern formats, responsive sizing, and prioritization dramatically lowers LCP and bandwidth consumption."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A monolithic billing application is being decomposed into microservices. The product team requires that user balance updates and order creation succeed atomically without 2-phase distributed locks across microservices. What distributed transaction pattern is recommended?",
            "options": [
                "Write directly to other microservices' underlying database tables.",
                "Implement the Saga Pattern (orchestrated or choreographed) with compensating transactions to guarantee eventual consistency across microservice boundaries.",
                "Keep everything in a single stored procedure on an unbacked database.",
                "Allow order creation without checking balance."
            ],
            "correct_index": 1,
            "explanation": "The Saga Pattern coordinates a series of local transactions with compensating rollbacks, ensuring eventual consistency across microservices without synchronous distributed deadlocks."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A release pipeline frequently fails intermittently with timeout errors because unit tests connect to real third-party external sandbox APIs over the internet. What testing principle solves this problem?",
            "options": [
                "Skip all unit tests during release builds.",
                "Isolate unit and integration tests from external networks using test doubles (mocks/stubs) and containerized local mock servers (e.g. WireMock), ensuring deterministic, hermetic test execution.",
                "Run unit tests only once a year.",
                "Increase test timeouts to 10 hours."
            ],
            "correct_index": 1,
            "explanation": "Hermetic tests isolate testing environments from unvetted network dependencies, eliminating flakiness and ensuring fast, deterministic CI builds."
        }
    ]
}

SET_65 = {
    "title": "Soft Skill Assessment - Set 65",
    "description": "Comprehensive corporate assessment covering advanced quantitative aptitude, multi-variable logic, professional business English, and high-stakes workplace decision-making.",
    "duration_minutes": 45,
    "pass_percentage": 60,
    "status": "published",
    "assessment_type": "general",
    "questions": [
        # Aptitude (8)
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A train running at 54 km/h crosses a 250 m long platform in 30 seconds. What is the length of the train?",
            "options": ["180 m", "200 m", "220 m", "250 m"],
            "correct_index": 1,
            "explanation": "Speed = 54 × (5/18) = 15 m/s. Total distance in 30s = 15 × 30 = 450 m. Train length = 450 - 250 = 200 m."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Pipe A can fill a cistern in 12 hours, and Pipe B in 15 hours. Both are opened together, but after 3 hours Pipe A is closed. How much more time will Pipe B take to fill the remainder?",
            "options": ["7 hours 45 mins", "8 hours 15 mins", "8 hours 45 mins", "9 hours"],
            "correct_index": 1,
            "explanation": "Total work = LCM(12, 15) = 60 units. Pipe A = 5 u/h, Pipe B = 4 u/h. In 3 hours: (5 + 4) × 3 = 27 units. Remaining = 60 - 27 = 33 units. Pipe B takes 33 / 4 = 8.25 hours = 8 hours 15 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A shopkeeper marks an article 30% above the cost price and allows a discount of 15% on the marked price. Find his gain percentage.",
            "options": ["10.5%", "12.0%", "13.5%", "15.0%"],
            "correct_index": 0,
            "explanation": "Let CP = 100. Marked Price = 130. Selling Price = 130 × 0.85 = 110.5. Gain = 110.5 - 100 = 10.5%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of money invested at compound interest doubles itself in 4 years. In how many years will it become 8 times itself at the same rate?",
            "options": ["8 years", "10 years", "12 years", "16 years"],
            "correct_index": 2,
            "explanation": "P becomes 2P in 4 years. 8P = (2³)P, which requires 3 doubling cycles: 4 × 3 = 12 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio of boys to girls in a college of 720 students is 7 : 5. How many more girls must be admitted to make the ratio 1 : 1?",
            "options": ["100", "120", "140", "160"],
            "correct_index": 1,
            "explanation": "Total parts = 7 + 5 = 12. 720 / 12 = 60. Boys = 7 × 60 = 420. Girls = 5 × 60 = 300. To make ratio 1 : 1, number of girls needed = 420 - 300 = 120."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "In how many different ways can the letters of the word 'DESIGN' be arranged so that the vowels are always together?",
            "options": ["120", "180", "240", "360"],
            "correct_index": 2,
            "explanation": "Vowels are E and I (2). Consonants are D, S, G, N (4). Treat (EI) as 1 unit + 4 consonants = 5 units. Arrangements = 5! × 2! = 120 × 2 = 240."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The perimeter of a rectangular field is 160 m and the difference between two adjacent sides is 48 m. Find the length and breadth of the field.",
            "options": ["60 m and 20 m", "64 m and 16 m", "68 m and 12 m", "70 m and 10 m"],
            "correct_index": 1,
            "explanation": "2(L + B) = 160 => L + B = 80. L - B = 48. Adding gives 2L = 128 => L = 64 m. B = 80 - 64 = 16 m."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "Find the smallest number which when divided by 8, 12, 16, and 24 leaves a remainder of 3 in each case.",
            "options": ["45", "51", "99", "101"],
            "correct_index": 1,
            "explanation": "LCM(8, 12, 16, 24) = 48. Smallest number = 48 + 3 = 51."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Some laptops are tablets. All tablets are mobiles. No mobile is a desktop. Conclusions: I. Some mobiles are laptops. II. No tablet is a desktop.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Tablets are inside mobiles which do not touch desktops; thus no tablet is a desktop (II follows). Laptops overlap tablets which are mobiles, so some mobiles are laptops (I follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Five team members A, B, C, D, and E sit in a row facing North. D sits to the immediate left of C. B sits to the immediate right of E. A sits at the extreme left end. If B sits immediately to the left of D, who sits in the exact middle of the row?",
            "options": ["B", "C", "D", "E"],
            "correct_index": 0,
            "explanation": "Positions: 1 is A. 2 is E. 3 is B (immediate right of E). 4 is D (B is immediate left of D). 5 is C (D is immediate left of C). The row is A, E, B, D, C. Middle is B (position 3)."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'GLOBAL' is coded as 'HMPCBM' (+1 to each letter). How is 'NATIVE' coded under the same rule?",
            "options": ["OBUJWF", "OBUKWF", "OBVIWF", "PATJWF"],
            "correct_index": 0,
            "explanation": "N(+1)=O, A(+1)=B, T(+1)=U, I(+1)=J, V(+1)=W, E(+1)=F => OBUJWF."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A courier travels 20 km East, turns right and travels 15 km. What is the straight-line distance from the starting point?",
            "options": ["22 km", "25 km", "28 km", "30 km"],
            "correct_index": 1,
            "explanation": "Distance = sqrt(20² + 15²) = sqrt(400 + 225) = sqrt(625) = 25 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A woman introduces a man as the son of the brother of her mother. How is the man related to the woman?",
            "options": ["Maternal Cousin", "Brother", "Nephew", "Uncle"],
            "correct_index": 0,
            "explanation": "Mother's brother is maternal uncle. Son of maternal uncle is maternal cousin."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number replaces the question mark in the sequence: 3, 7, 15, 31, 63, ?",
            "options": ["115", "121", "127", "131"],
            "correct_index": 2,
            "explanation": "Pattern is (2n + 1): 3×2+1=7, 7×2+1=15, 15×2+1=31, 31×2+1=63, 63×2+1=127."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The company should migrate frontend applications to micro-frontends to allow distinct squads to deploy independently.' Assumptions: I. Independent deployment reduces coordination overhead between large frontend engineering squads. II. Micro-frontends guarantee zero increase in initial bundle download size.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 0,
            "explanation": "Assumption I is the primary rationale for micro-frontend adoption. Assumption II is false; micro-frontends often increase initial bundle download overhead if not carefully optimized."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Choose the grammatically correct sentence using the subjunctive mood following a formal request:",
            "options": [
                "The compliance lead requested that each developer review their IAM security policies before Friday.",
                "The compliance lead requested that each developer reviews their IAM security policies before Friday.",
                "The compliance lead requested that each developer will review their IAM security policies before Friday.",
                "The compliance lead requested that each developer reviewed their IAM security policies before Friday."
            ],
            "correct_index": 0,
            "explanation": "The mandative subjunctive following 'requested that...' requires the bare form of the verb ('review') rather than 3rd-person singular 'reviews'."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'EQUANIMITY':",
            "options": ["Composure", "Anxiety", "Excitement", "Agitation"],
            "correct_index": 0,
            "explanation": "'Equanimity' means mental calmness, composure, and evenness of temper, especially in a difficult situation."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'INCHOATE':",
            "options": ["Developed", "Formless", "Rudimentary", "Immature"],
            "correct_index": 0,
            "explanation": "'Inchoate' means just begun and so not fully formed or developed. Its antonym is 'developed' or 'mature'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To take something with a pinch of salt' mean?",
            "options": [
                "To season food carefully",
                "To view something with skepticism or not accept it as completely true",
                "To preserve meat in brine",
                "To cook together as a team"
            ],
            "correct_index": 1,
            "explanation": "'To take something with a pinch of salt' means to maintain healthy skepticism regarding claims that may be exaggerated or unreliable."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who loves books and enjoys collecting them'",
            "options": ["Bibliophile", "Philologist", "Calligrapher", "Numismatist"],
            "correct_index": 0,
            "explanation": "A 'Bibliophile' is a person who collects or has a great love of books."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an essential condition or requirement:",
            "options": ["Prerequisite", "Prerequsite", "Prerequasite", "Prerequesite"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Prerequisite'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An enterprise web application experiences sudden connection exhaustion on its primary Postgres database during morning peak login hours because each web server process creates 50 direct database connections. What middleware solution should be introduced?",
            "options": [
                "Introduce a database connection pooler like PgBouncer or AWS RDS Proxy between web applications and the database.",
                "Double the number of web servers.",
                "Disable all user passwords.",
                "Restart Postgres every 15 minutes."
            ],
            "correct_index": 0,
            "explanation": "Dedicated connection poolers maintain an optimized persistent pool of database connections, preventing thread exhaustion when application worker processes surge."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A talented senior engineer rejects pull requests from newer developers with dismissive comments like 'This is completely wrong, rewrite it from scratch' without explaining the architectural reasoning or offering suggestions. How should the engineering manager coach them?",
            "options": [
                "Praise them for maintaining high standards through intimidation.",
                "Hold a private 1-on-1 coaching session to guide them on constructive code reviews, emphasizing clear explanations of principles, actionable code suggestions, and mentoring junior engineers.",
                "Fire all the junior engineers.",
                "Ban all code reviews."
            ],
            "correct_index": 1,
            "explanation": "Constructive code review coaching shifts behavior toward mentorship, psychological safety, and clear pedagogical explanations."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A developer accidentally generates an AWS Access Key ID and Secret with AdministratorAccess permissions and commits it to a public GitHub repository. What is the mandatory immediate security response?",
            "options": [
                "Delete the GitHub repo and hope nobody noticed.",
                "Immediately deactivate and delete the compromised IAM access key in the AWS IAM console, audit CloudTrail logs for unauthorized actions during the exposure window, and rotate all corporate credentials.",
                "Change the developer's laptop wallpaper.",
                "Wait for AWS monthly bill."
            ],
            "correct_index": 1,
            "explanation": "Exposed cloud credentials must be revoked immediately at the IAM provider level, accompanied by CloudTrail forensics to detect unauthorized lateral movement."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "An e-commerce platform needs to guarantee that customer payment events are processed exactly once by downstream fulfillment and ledger services, even if network timeouts cause duplicate webhook deliveries. What pattern is essential?",
            "options": [
                "Trust the payment vendor to never send duplicates.",
                "Implement Idempotency Keys stored in an atomic datastore (e.g. Redis/PostgreSQL) so that duplicate webhook deliveries detect the existing transaction ID and return the cached success response without re-processing.",
                "Charge the customer twice.",
                "Turn off webhook verification."
            ],
            "correct_index": 1,
            "explanation": "Idempotency keys ensure that duplicate event deliveries are safely recognized and deduplicated, guaranteeing exactly-once transactional semantics."
        }
    ]
}

PART_13_SETS = [SET_61, SET_62, SET_63, SET_64, SET_65]
''')
    print("Successfully generated sets_part13.py")

if __name__ == '__main__':
    write_part13()
