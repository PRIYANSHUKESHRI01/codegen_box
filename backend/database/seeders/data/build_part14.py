# -*- coding: utf-8 -*-
"""
Builder for sets_part14.py (Sets 66 to 70)
25 questions per set = 125 corporate placement-grade questions.
"""

def write_part14():
    with open('backend/database/seeders/data/sets_part14.py', 'w', encoding='utf-8') as f:
        f.write('''# -*- coding: utf-8 -*-
"""
Soft Skill Assessment Sets Part 14 (Sets 66 to 70)
25 corporate-placement-level questions per set:
8 Quantitative Aptitude, 7 Logical Reasoning, 6 Verbal/Business English, 4 Workplace Situational Judgment
Explanations included for all questions.
"""

SET_66 = {
    "title": "Soft Skill Assessment - Set 66",
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
            "question_text": "A man can row 9 km/h in still water and it takes him twice as long to row up as to row down the river. What is the speed of the stream?",
            "options": ["2.5 km/h", "3.0 km/h", "3.5 km/h", "4.0 km/h"],
            "correct_index": 1,
            "explanation": "Downstream speed = 9 + s. Upstream speed = 9 - s. Given: 9 + s = 2(9 - s) => 9 + s = 18 - 2s => 3s = 9 => s = 3 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "12 men can complete a software deployment in 16 days. How many men are required to complete the exact same deployment in 24 days?",
            "options": ["6 men", "8 men", "10 men", "14 men"],
            "correct_index": 1,
            "explanation": "M1 × D1 = M2 × D2 => 12 × 16 = M2 × 24 => M2 = (12 × 16) / 24 = 8 men."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A dealer sold two servers for ₹24,000 each. On one he gained 20% and on the other he lost 20%. What was his net gain or loss percentage on the entire transaction?",
            "options": ["No profit, no loss", "2% loss", "4% loss", "4% profit"],
            "correct_index": 2,
            "explanation": "When two items are sold at the same price with x% gain and x% loss, there is always a net loss of (x/10)²% = (20/10)²% = 4% loss."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum invested at compound interest amounts to ₹4,500 at the end of 1 year and to ₹6,750 at the end of 2 years. What was the original principal sum?",
            "options": ["₹2,800", "₹3,000", "₹3,200", "₹3,500"],
            "correct_index": 1,
            "explanation": "Multiplier = 6,750 / 4,500 = 1.5. Principal P = 4,500 / 1.5 = ₹3,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A and B invest in a startup in the ratio 3 : 5. After 6 months, C joins with an investment equal to B's. What is the ratio of their profits at the end of 1 year?",
            "options": ["3 : 5 : 2", "6 : 10 : 5", "5 : 6 : 10", "6 : 8 : 5"],
            "correct_index": 1,
            "explanation": "A's share = 3 × 12 = 36. B's share = 5 × 12 = 60. C's share = 5 × 6 = 30. Profit ratio = 36 : 60 : 30 = 6 : 10 : 5."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average score of a batsman in 20 matches is 35 runs. If his highest and lowest scores are excluded, the average of the remaining 18 matches becomes 33 runs. If the difference between his highest and lowest scores is 80 runs, find his highest score.",
            "options": ["88 runs", "93 runs", "98 runs", "103 runs"],
            "correct_index": 1,
            "explanation": "Total in 20 = 20 × 35 = 700. Total in 18 = 18 × 33 = 594. H + L = 700 - 594 = 106. H - L = 80. Adding gives 2H = 186 => H = 93 runs."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "If the 6-digit number 738A6A is completely divisible by 11, what is the single digit value of A?",
            "options": ["6", "7", "8", "9"],
            "correct_index": 3,
            "explanation": "Sum of odd-position digits = A + A + 3 = 2A + 3. Sum of even-position digits = 6 + 8 + 7 = 21. Difference = 21 - (2A + 3) = 18 - 2A. For divisibility by 11, 18 - 2A must be 0 or a multiple of 11. Setting 18 - 2A = 0 => 2A = 18 => A = 9."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A copper wire bent in the form of a circle has a radius of 42 cm. If it is straightened and bent into the shape of a square, what is the length of each side of the square (use pi = 22/7)?",
            "options": ["60 cm", "66 cm", "72 cm", "78 cm"],
            "correct_index": 1,
            "explanation": "Perimeter = 2 × (22/7) × 42 = 2 × 22 × 6 = 264 cm. Side of the square = 264 / 4 = 66 cm."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All commits are revisions. No revision is an anomaly. Some anomalies are vulnerabilities. Conclusions: I. No commit is an anomaly. II. Some vulnerabilities are not revisions.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Commits are inside revisions which never intersect anomalies, so no commit is an anomaly (I follows). Vulnerabilities that are anomalies cannot be revisions, so some vulnerabilities are not revisions (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six microservices—A, B, C, D, E, and F—are deployed sequentially. Service D executes first. Service A executes third. Service B executes immediately after C. Service F executes last. Which service executes second?",
            "options": ["B", "C", "E", "Cannot be determined"],
            "correct_index": 1,
            "explanation": "D is pos 1. A is pos 3. F is pos 6. B is immediately after C. The only adjacent slots available are (pos 4, pos 5) or (pos 1, pos 2). But pos 1 is D! Wait: if B is after C, then C could be 4 and B 5, with E at 2; or C at 1 (not possible, D is 1). Let's specify: Service C executes second, so B is immediately after C (pos 3)? But A is pos 3! Let's clarify: D is first, C is second, E is fourth, B is fifth, F is sixth."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'KERNEL' is coded as 'LFSOFM' (+1 to each letter). How is 'THREAD' coded under the same rule?",
            "options": ["UISFBE", "UIRFBE", "TISFBE", "UJSFBE"],
            "correct_index": 0,
            "explanation": "T(+1)=U, H(+1)=I, R(+1)=S, E(+1)=F, A(+1)=B, D(+1)=E => UISFBE."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A drone flies 15 km West, turns left and flies 8 km. What is the shortest straight-line distance back to its docking station?",
            "options": ["16 km", "17 km", "19 km", "23 km"],
            "correct_index": 1,
            "explanation": "Distance = sqrt(15² + 8²) = sqrt(225 + 64) = sqrt(289) = 17 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Looking at a portrait, Alex said: 'His mother's husband is my sister's father.' How is the person in the portrait related to Alex (assuming Alex is male and has no other brothers)?",
            "options": ["Alex himself", "Uncle", "Father", "Cousin"],
            "correct_index": 0,
            "explanation": "Alex's sister's father is Alex's father. Mother's husband is father. The person's father is Alex's father. Since Alex is male and has no other brothers, the portrait is of Alex himself."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing term in the sequence: 13, 27, 56, 115, ?",
            "options": ["228", "230", "234", "238"],
            "correct_index": 2,
            "explanation": "Pattern: 13×2+1=27, 27×2+2=56, 56×2+3=115, 115×2+4=234."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Companies adopting automated CI/CD pipelines experience 46% fewer deployment failures than those using manual deployment scripts.' Conclusions: I. Automated validation and repeatable scripts mitigate human configuration errors. II. Manual deployments are legally prohibited in corporate software engineering.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I logically explains the statistical reduction in release failure rates. Conclusion II is an unsupported and false claim regarding legal prohibitions."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the sentence that correctly employs the subjunctive mood following 'wish':",
            "options": [
                "The team lead wishes that the staging database were as fast as production.",
                "The team lead wishes that the staging database was as fast as production.",
                "The team lead wishes that the staging database is as fast as production.",
                "The team lead wishes that the staging database will be as fast as production."
            ],
            "correct_index": 0,
            "explanation": "In hypothetical or counterfactual wishes, the subjunctive form 'were' is grammatically required regardless of singular subject."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'PELLUCID':",
            "options": ["Translucently clear", "Murky", "Turbid", "Obscure"],
            "correct_index": 0,
            "explanation": "'Pellucid' means translucently clear; easily understood."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'RECALCITRANT':",
            "options": ["Compliant", "Disobedient", "Defiant", "Obstinate"],
            "correct_index": 0,
            "explanation": "'Recalcitrant' means having an obstinately uncooperative attitude toward authority. Its antonym is 'compliant' or 'tractable'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To hold one's horses' mean?",
            "options": [
                "To manage a stable",
                "To wait a moment or slow down",
                "To purchase livestock",
                "To rush forward enthusiastically"
            ],
            "correct_index": 1,
            "explanation": "'To hold one's horses' means to wait a moment, be patient, or hesitate before acting."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'An official count or survey, especially of a population'",
            "options": ["Census", "Audit", "Inventory", "Poll"],
            "correct_index": 0,
            "explanation": "A 'Census' is an official periodic count or survey of a population."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a state of equilibrium or equal balance:",
            "options": ["Equilibrium", "Equelibrium", "Equilibream", "Equillibrium"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Equilibrium'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A critical zero-day remote code execution (RCE) vulnerability is disclosed in an open-source logging framework used by your company's core API gateways. What is the immediate engineering response?",
            "options": [
                "Wait until the next scheduled quarterly release to patch dependencies.",
                "Declare a P0 security incident, activate emergency patching protocols to update the library to the patched version across all microservices, apply WAF virtual patching rules, and audit logs for exploitation attempts.",
                "Shut down the entire internet connection.",
                "Deny that the company uses the library."
            ],
            "correct_index": 1,
            "explanation": "Zero-day RCE threats require emergency P0 prioritization: deploy WAF mitigations, push updated dependencies across all microservices, and conduct log forensics."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A product manager constantly pushes back against refactoring a brittle core payment service, prioritizing new visual features instead, which has caused 3 production incidents this month. How should the engineering lead address this?",
            "options": [
                "Refactor the code in secret on weekends without telling anyone.",
                "Present a data-driven business case linking the brittle service to lost transaction revenue, SLA breaches, and engineer turnover, and negotiate allocating 20% of every sprint to paying down critical technical debt.",
                "Quit the company immediately without notice.",
                "Publicly insult the product manager in Slack."
            ],
            "correct_index": 1,
            "explanation": "Translating technical debt into business metrics (lost revenue, SLA risk) builds alignment with product leadership to fund architectural stabilization."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An employee accidentally loses their corporate laptop containing local cached credentials. What is the mandatory immediate security action?",
            "options": [
                "Tell the employee to buy a new laptop from an electronics store.",
                "Immediately revoke all active SSO sessions, rotate all associated credentials/tokens, trigger a remote device wipe via MDM (Mobile Device Management), and file a data loss report with Security.",
                "Wait a week to see if someone returns the laptop.",
                "Delete the employee's user account permanently."
            ],
            "correct_index": 1,
            "explanation": "Prompt credential rotation and remote MDM device wiping neutralize data compromise risks from lost enterprise hardware."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A microservice experiences random container terminations with exit code 137 (OOMKilled) under sudden bursts of network traffic. How should the platform engineer troubleshoot and remediate?",
            "options": [
                "Set memory limits to unlimited across all clusters.",
                "Analyze container heap dumps and memory utilization metrics in APM, fix internal memory leaks or unbounded caching, and appropriately right-size Kubernetes pod memory requests and limits with horizontal pod autoscaling.",
                "Disable all autoscaling.",
                "Reboot Kubernetes master nodes every morning."
            ],
            "correct_index": 1,
            "explanation": "OOMKilled errors (exit code 137) require profiling heap allocations, capping in-memory queues/caches, and tuning Kubernetes pod memory requests/limits alongside HPA."
        }
    ]
}

# Fix Set 66 Q10 wording
SET_66["questions"][9]["question_text"] = "Six microservices—A, B, C, D, E, and F—are deployed sequentially in an orchestration pipeline. Service D executes first. Service A executes third. Service B executes immediately after C. Service F executes last. Which service executes second?"
SET_66["questions"][9]["options"] = ["B", "C", "E", "Cannot be determined"]
SET_66["questions"][9]["correct_index"] = 1
SET_66["questions"][9]["explanation"] = "Positions: 1 is D. 2 is C. 3 is A? Wait, if B executes immediately after C, then C and B must be adjacent! Positions: 1: D, 2: E, 3: A, 4: C, 5: B, 6: F. Then service E executes second."
SET_66["questions"][9]["options"] = ["B", "C", "E", "F"]
SET_66["questions"][9]["correct_index"] = 2
SET_66["questions"][9]["explanation"] = "Positions: Pos 1 is D. Pos 3 is A. Pos 6 is F. Since B executes immediately after C, C and B must occupy adjacent positions (pos 4 and pos 5). The remaining position (pos 2) must be Service E."

SET_67 = {
    "title": "Soft Skill Assessment - Set 67",
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
            "question_text": "A car travels the first one-third of a distance at 10 km/h, the second one-third at 20 km/h, and the final one-third at 60 km/h. What is the average speed of the car for the entire journey?",
            "options": ["15 km/h", "18 km/h", "20 km/h", "24 km/h"],
            "correct_index": 1,
            "explanation": "Average speed = 3 / (1/10 + 1/20 + 1/60) = 3 / ((6 + 3 + 1)/60) = 3 / (10/60) = 3 × 6 = 18 km/h."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A can do a piece of work in 80 days. He works at it for 10 days and then B alone finishes the remaining work in 42 days. In how many days could A and B together finish the work?",
            "options": ["24 days", "28 days", "30 days", "32 days"],
            "correct_index": 2,
            "explanation": "Work done by A in 10 days = 10/80 = 1/8. Remaining work = 7/8. B does 7/8 work in 42 days => B does entire work in 42 × (8/7) = 48 days. Together: 1/80 + 1/48 = (3 + 5)/240 = 8/240 = 1/30. They finish in 30 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A fruit vendor buys lemons at 2 for a rupee and sells them at 5 for three rupees. What is his profit percentage?",
            "options": ["15%", "20%", "25%", "30%"],
            "correct_index": 1,
            "explanation": "Cost price of 1 lemon = ₹1/2 = ₹0.50. Selling price of 1 lemon = ₹3/5 = ₹0.60. Profit = 0.60 - 0.50 = ₹0.10. Profit % = (0.10 / 0.50) × 100 = 20%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A sum of money invested at compound interest amounts to thrice itself in 3 years. In how many years will it become 9 times itself at the same rate?",
            "options": ["6 years", "8 years", "9 years", "12 years"],
            "correct_index": 0,
            "explanation": "P becomes 3P in 3 years. 9P = (3²)P requires 2 tripling cycles: 3 × 2 = 6 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two numbers are in the ratio 3 : 5. If 9 is subtracted from each, the ratio of the new numbers becomes 12 : 23. What is the smaller number?",
            "options": ["27", "33", "36", "45"],
            "correct_index": 1,
            "explanation": "(3x - 9)/(5x - 9) = 12/23 => 23(3x - 9) = 12(5x - 9) => 69x - 207 = 60x - 108 => 9x = 99 => x = 11. Smaller number = 3 × 11 = 33."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 50 numbers is 38. If two numbers, namely 45 and 55, are discarded, what is the average of the remaining numbers?",
            "options": ["36.5", "37.0", "37.5", "38.0"],
            "correct_index": 2,
            "explanation": "Initial total sum = 50 × 38 = 1,900. Discarded sum = 45 + 55 = 100. Remaining sum = 1,900 - 100 = 1,800. Remaining count = 48. New average = 1,800 / 48 = 37.5."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A card is drawn from a well-shuffled pack of 52 playing cards. What is the probability of drawing a queen of clubs or a king of hearts?",
            "options": ["1/52", "1/26", "1/13", "2/13"],
            "correct_index": 1,
            "explanation": "There is exactly 1 queen of clubs and 1 king of hearts in a standard deck. Favorable outcomes = 1 + 1 = 2. Probability = 2 / 52 = 1/26."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "If the radius of a circular disk is increased by 50%, by what percentage does its surface area increase?",
            "options": ["75%", "100%", "125%", "150%"],
            "correct_index": 2,
            "explanation": "Area is proportional to r². New area = (1.5)² = 2.25 times the initial area. Percentage increase = (2.25 - 1) × 100 = 125%."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Some clusters are managed. All managed entities are secure. No secure entity is vulnerable. Conclusions: I. Some managed entities are not vulnerable. II. No cluster is vulnerable.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Managed entities are inside secure which never touch vulnerable, so all managed entities are not vulnerable (thus some are not vulnerable, I follows). Clusters only partially overlap managed; unmanaged clusters might be vulnerable (II does not follow)."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Eight colleagues sit around a circular conference table facing inward. Position 1 is A. B sits opposite A. C sits to the immediate right of A. D sits opposite C. If E sits between A and D, who sits to the immediate left of A?",
            "options": ["B", "C", "D", "E"],
            "correct_index": 3,
            "explanation": "With 8 positions clockwise: Pos 1 is A. Immediate right (pos 2) is C. Opposite C is pos 6 (D). Opposite A is pos 5 (B). E sits between A (pos 1) and D (pos 8/6). Immediate left of A (pos 8) is E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'SPRING' is coded as 'UQTIPI' (+2 to each letter). How is 'SUMMER' coded under the same rule?",
            "options": ["UWOOGT", "UWOOHT", "TWOOGT", "UWOPGT"],
            "correct_index": 0,
            "explanation": "S(+2)=U, U(+2)=W, M(+2)=O, M(+2)=O, E(+2)=G, R(+2)=T => UWOOGT."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A technician walks 14 m South, turns right and walks 14 m, turns left and walks 10 m, then turns left again and walks 14 m. How far is the technician from the starting point?",
            "options": ["14 m", "20 m", "24 m", "28 m"],
            "correct_index": 2,
            "explanation": "South 14, West 14, South 10, East 14. East and West cancel (14 - 14 = 0). Total South displacement = 14 + 10 = 24 m."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a young man, a woman said: 'His mother is the only daughter of my mother.' How is the woman related to the young man?",
            "options": ["Mother", "Aunt", "Sister", "Grandmother"],
            "correct_index": 0,
            "explanation": "The woman's mother's only daughter is the woman herself. Therefore, the woman is his mother."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number completes the sequence: 2, 12, 36, 80, 150, ?",
            "options": ["216", "232", "252", "264"],
            "correct_index": 2,
            "explanation": "Pattern is (n³ + n²): 1³+1²=2, 2³+2²=12, 3³+3²=36, 4³+4²=80, 5³+5²=150, 6³+6²=216+36=252."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should high-traffic web applications mandate Content Delivery Networks (CDNs) for static asset distribution?' Arguments: I. Yes, CDNs cache static assets at edge servers close to users, cutting latency and reducing origin server bandwidth costs. II. No, origin servers already have high-bandwidth network interfaces.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both I and II are strong",
                "Neither I nor II is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I accurately highlights edge caching performance and infrastructure cost benefits. Argument II ignores geographic latency bottlenecks and packet round-trip times."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Identify the grammatically correct sentence involving correlative conjunctions:",
            "options": [
                "Either the frontend lead or the backend architects are responsible for coordinating the API contract.",
                "Either the frontend lead or the backend architects is responsible for coordinating the API contract.",
                "Either the frontend lead nor the backend architects are responsible for coordinating the API contract.",
                "Either the frontend lead and the backend architects are responsible for coordinating the API contract."
            ],
            "correct_index": 0,
            "explanation": "In 'either... or' constructions, the verb agrees in number with the nearest subject ('the backend architects' is plural, requiring 'are')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'INELUCTABLE':",
            "options": ["Inevitable", "Avoidable", "Preventable", "Doubtful"],
            "correct_index": 0,
            "explanation": "'Ineluctable' means unable to be resisted or avoided; inescapable or inevitable."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'DESULTORY':",
            "options": ["Methodical", "Random", "Aimless", "Erratic"],
            "correct_index": 0,
            "explanation": "'Desultory' means lacking a plan, purpose, or enthusiasm. Its antonym is 'methodical' or 'systematic'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To turn a blind eye' mean?",
            "options": [
                "To lose vision temporarily",
                "To pretend not to notice something deliberately",
                "To look through an optical lens",
                "To examine something thoroughly"
            ],
            "correct_index": 1,
            "explanation": "'To turn a blind eye' means to knowingly overlook or pretend not to see something objectionable."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who talks in their sleep'",
            "options": ["Somniloquist", "Somnambulist", "Ventriloquist", "Monologist"],
            "correct_index": 0,
            "explanation": "A 'Somniloquist' is someone who talks while asleep."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting the act of making amends or compensation for a wrong:",
            "options": ["Reparation", "Repiration", "Reperation", "Reparasion"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Reparation'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A database index corruption on a production customer table causes queries on primary key lookups to return duplicate records or fail with B-tree integrity errors. What is the production mitigation?",
            "options": [
                "Delete all customer data.",
                "Execute an online non-blocking index rebuild (e.g. REINDEX CONCURRENTLY) to regenerate clean B-tree structures without locking table reads or writes.",
                "Tell customers to re-register.",
                "Shut down the database for 3 weeks."
            ],
            "correct_index": 1,
            "explanation": "Concurrent online index rebuilds rebuild corrupted B-tree structures in the background without acquiring exclusive table write locks."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A developer proposes adopting a bleeding-edge, unreleased beta framework for the company's core payment gateway because of interesting new syntax. How should the architecture committee evaluate this?",
            "options": [
                "Approve it immediately to be trendy.",
                "Decline adoption for mission-critical core payment flows until the framework achieves stable LTS maturity, proven reliability benchmarks, and security audit vetting.",
                "Fire the developer.",
                "Rewrite the entire company platform in beta software."
            ],
            "correct_index": 1,
            "explanation": "Mission-critical enterprise services require battle-tested LTS stability, security verifications, and broad ecosystem support over unproven experimental syntax."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A penetration test uncovers that API endpoints accept user-supplied JWT tokens with the algorithm header set to 'none', allowing signature verification bypass. What is the mandatory security patch?",
            "options": [
                "Ignore the finding because JWTs are base64 encoded.",
                "Explicitly reject all JWT tokens where 'alg' is 'none' or doesn't match the strictly expected cryptographic algorithm (e.g., RS256/ES256) in the server JWT validation library.",
                "Disable all token authentication entirely.",
                "Tell users not to tamper with tokens."
            ],
            "correct_index": 1,
            "explanation": "Strictly enforcing expected cryptographic signature algorithms and disallowing the 'none' algorithm eliminates critical JWT authentication bypass vulnerabilities."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "An engineering department runs 200 idle development EC2/RDS instances overnight, resulting in ₹15,00,000 monthly unnecessary spend. What automation framework resolves this sustainably?",
            "options": [
                "Manually email all engineers every Friday night.",
                "Implement automated scheduled shutdown and startup policies (e.g. via AWS Lambda/EventBridge or AWS Instance Scheduler) based on environment tags, paired with Slack notifications and auto-expiry tags.",
                "Permanently delete all non-production environments.",
                "Cut developer salaries to pay cloud bills."
            ],
            "correct_index": 1,
            "explanation": "Automated schedule-based shutdown of non-production cloud environments combined with budget alarms and resource tagging eliminates idle cloud waste."
        }
    ]
}

SET_68 = {
    "title": "Soft Skill Assessment - Set 68",
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
            "question_text": "Walking at 3/4 of his usual speed, a developer reaches the office 20 minutes late. What is his usual time to reach the office?",
            "options": ["45 minutes", "50 minutes", "60 minutes", "75 minutes"],
            "correct_index": 2,
            "explanation": "Speed ratio = 3/4 => Time ratio = 4/3. Time increase = 4/3 t - t = 1/3 t. 1/3 t = 20 minutes => t = 60 minutes."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A can complete a sprint backlog in 15 days and B in 20 days. If they work on it together for 4 days, what fraction of the total work is left?",
            "options": ["7/15", "8/15", "9/20", "11/20"],
            "correct_index": 1,
            "explanation": "Work rate = 1/15 + 1/20 = (4 + 3)/60 = 7/60. In 4 days, work completed = 4 × (7/60) = 28/60 = 7/15. Fraction of work remaining = 1 - 7/15 = 8/15."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A dishonest trader professes to sell his goods at cost price but uses a weight of 960 grams for a 1 kg weight. What is his gain percentage?",
            "options": ["4.00%", "4.17%", "4.50%", "5.00%"],
            "correct_index": 1,
            "explanation": "Gain % = [Error / (True Value - Error)] × 100 = [40 / 960] × 100 = (1/24) × 100 = 4.167% = 4.17%."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A sum of ₹12,000 borrowed at compound interest is repaid in two equal annual installments of ₹7,260 each. What is the annual interest rate?",
            "options": ["8%", "10%", "12%", "15%"],
            "correct_index": 1,
            "explanation": "12,000 = 7,260/(1 + r) + 7,260/(1 + r)². Testing r = 10% (1.1): 7,260/1.1 + 7,260/1.21 = 6,600 + 6,000 = 12,000. Interest rate is 10%."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C enter into partnership. A invests 3 times as much as B, and B invests two-thirds of what C invests. Find the ratio of their capital investments.",
            "options": ["3 : 2 : 3", "6 : 2 : 3", "6 : 3 : 2", "9 : 3 : 2"],
            "correct_index": 1,
            "explanation": "Let C's investment = 3 units. B's investment = (2/3) × 3 = 2 units. A's investment = 3 × 2 = 6 units. Capital ratio = 6 : 2 : 3."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average age of husband and wife was 23 years when they were married 5 years ago. The average age of the family consisting of husband, wife, and a 1-year-old child born during the period is now:",
            "options": ["18 years", "19 years", "20 years", "21 years"],
            "correct_index": 1,
            "explanation": "Sum of husband and wife's age 5 years ago = 23 × 2 = 46. Present sum of husband and wife = 46 + (5 × 2) = 56. Present sum including the 1-year-old child = 56 + 1 = 57. Average for 3 persons = 57 / 3 = 19 years."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The sum of two numbers is 40 and their difference is 4. What is the ratio of the two numbers?",
            "options": ["9 : 11", "10 : 9", "11 : 9", "12 : 7"],
            "correct_index": 2,
            "explanation": "x + y = 40, x - y = 4. Adding gives 2x = 44 => x = 22. y = 40 - 22 = 18. Ratio = 22 : 18 = 11 : 9."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The diagonal of a rectangle is 17 cm and its perimeter is 46 cm. What is the area of the rectangle?",
            "options": ["110 cm²", "120 cm²", "130 cm²", "140 cm²"],
            "correct_index": 1,
            "explanation": "2(L + B) = 46 => L + B = 23. L² + B² = 17² = 289. (L + B)² = L² + B² + 2LB => 23² = 289 + 2LB => 529 - 289 = 2LB => 2LB = 240 => LB = 120 cm²."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All firewalls are filters. No filter is an open port. All open ports are listeners. Conclusions: I. No firewall is an open port. II. Some listeners are not filters.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 2,
            "explanation": "Firewalls are inside filters which do not touch open ports; thus no firewall is an open port (I follows). Open ports are listeners and cannot be filters; thus some listeners are not filters (II follows). Both follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six team members—U, V, W, X, Y, and Z—sit in a row facing North. V sits at the extreme left end. U sits second to the right of V. X sits third to the right of V. Who sits at position 3 (third from the left)?",
            "options": ["U", "W", "X", "Y"],
            "correct_index": 0,
            "explanation": "Positions: 1 is V. Second to the right of V is position 3 (U). Third to right of V is position 4 (X). Position 3 is U."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'DOCKER' is coded as 'FMEUGT' (+2 to each letter). How is 'PYTHON' coded using the same rule?",
            "options": ["RAVJQP", "RAVKQP", "QAVIQP", "RAWJQP"],
            "correct_index": 0,
            "explanation": "P(+2)=R, Y(+2)=A, T(+2)=V, H(+2)=J, O(+2)=Q, N(+2)=P => RAVJQP."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A vehicle drives 25 km North, turns right and drives 20 km, turns right and drives 25 km, then turns left and drives 10 km. How far is the vehicle from the starting point?",
            "options": ["20 km", "25 km", "30 km", "35 km"],
            "correct_index": 2,
            "explanation": "North 25 km, East 20 km, South 25 km, East 10 km. North and South cancel (25 - 25 = 0). Total East displacement = 20 + 10 = 30 km."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A is the father of C, and D is the son of B. E is the brother of A. If C is the sister of D, how is B related to E?",
            "options": ["Sister-in-law", "Sister", "Mother", "Wife"],
            "correct_index": 0,
            "explanation": "A is the father of C and D. Since D is the son of B, B must be the mother of C and D, making B the wife of A. E is the brother of A. Therefore, B is the sister-in-law of E."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the next term in the sequence: 3, 10, 29, 66, 127, ?",
            "options": ["198", "216", "218", "225"],
            "correct_index": 2,
            "explanation": "Pattern is (n³ + 2): 1³+2=3, 2³+2=10, 3³+2=29, 4³+2=66, 5³+2=127, 6³+2=216+2=218."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'The company should mandate multi-factor authentication (MFA) for all employee corporate email access.' Assumptions: I. Passwords alone are vulnerable to credential stuffing and phishing attacks. II. MFA provides an additional defense-in-depth verification factor that blocks unauthorized logins.",
            "options": [
                "Only assumption I is implicit",
                "Only assumption II is implicit",
                "Both I and II are implicit",
                "Neither I nor II is implicit"
            ],
            "correct_index": 2,
            "explanation": "Both assumptions underpin the security justification for mandatory multi-factor authentication adoption."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the sentence that correctly resolves subject-verb agreement with collective nouns acting as a single unit:",
            "options": [
                "The incident response committee has published its post-mortem findings.",
                "The incident response committee have published its post-mortem findings.",
                "The incident response committee have published their post-mortem findings.",
                "The incident response committee are publishing its post-mortem findings."
            ],
            "correct_index": 0,
            "explanation": "When a collective noun acts as a unified singular entity, it takes a singular verb ('has published') and singular pronoun ('its')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SANGUINE':",
            "options": ["Optimistic", "Pessimistic", "Melancholy", "Cynical"],
            "correct_index": 0,
            "explanation": "'Sanguine' means optimistic or positive, especially in an apparently bad or difficult situation."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'TRACTABLE':",
            "options": ["Refractory", "Manageable", "Amenable", "Docile"],
            "correct_index": 0,
            "explanation": "'Tractable' means easy to control or influence. Its antonym is 'refractory' or 'intractable' (stubborn or unmanageable)."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To throw caution to the wind' mean?",
            "options": [
                "To check weather forecasts carefully",
                "To take a great risk without worrying about dangers or consequences",
                "To secure loose objects in a storm",
                "To avoid responsibility"
            ],
            "correct_index": 1,
            "explanation": "'To throw caution to the wind' means to act rashly or take bold risks without heed for consequences."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who is skilled in the art of beautiful penmanship or decorative handwriting'",
            "options": ["Calligrapher", "Cartographer", "Choreographer", "Bibliographer"],
            "correct_index": 0,
            "explanation": "A 'Calligrapher' is a specialist skilled in the art of calligraphy and fine handwriting."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting a state of temporary suspension or inactivity:",
            "options": ["Abeyance", "Abeyence", "Abayance", "Abaiance"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Abeyance'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A downstream database replica experiences high replication delay (lag > 2 hours) during an end-of-quarter analytics export, causing customer-facing reporting dashboards to display out-of-date data. What is the immediate engineering mitigation?",
            "options": [
                "Direct reporting queries to a dedicated read-only analytical replica or data lake, isolating live transactional replicas from batch queries.",
                "Turn off customer reporting permanently.",
                "Reboot the production database server repeatedly.",
                "Delete half the customer records to reduce database size."
            ],
            "correct_index": 0,
            "explanation": "Isolating heavy analytical queries onto dedicated analytical replicas or data warehouses prevents replication stream blockages on operational replicas."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "Two senior developers on an agile squad strongly disagree on whether to use GraphQL or gRPC for an internal microservice-to-microservice communication protocol. How should the team lead resolve the deadlock?",
            "options": [
                "Pick whichever tool the team lead personally likes best.",
                "Define clear objective technical evaluation criteria—such as serialization latency, schema typing, streaming needs, and payload overhead—and build a proof-of-concept benchmark.",
                "Tell them to argue until one gives up.",
                "Ban internal communication between services."
            ],
            "correct_index": 1,
            "explanation": "Objective technical criteria and empirical proof-of-concept benchmarking depersonalize architectural disputes and lead to data-driven engineering decisions."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A third-party SaaS integration vendor with delegated AWS IAM role access requests the addition of wildcard AdministratorAccess permissions to their cross-account role. What is the proper security response?",
            "options": [
                "Grant AdministratorAccess immediately because the vendor asked nicely.",
                "Reject the broad wildcard request and apply the Principle of Least Privilege, granting only the specific scoped IAM actions and resource ARNs required for the integration.",
                "Give them root credentials to the cloud account.",
                "Ignore the vendor's emails permanently."
            ],
            "correct_index": 1,
            "explanation": "The Principle of Least Privilege mandates granting third-party integrations only the bare minimum IAM permissions strictly necessary to perform their functional role."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A web platform experiences sudden latency spikes when processing concurrent image uploads because image resizing is performed synchronously in the web request thread. How should this be refactored?",
            "options": [
                "Disallow users from uploading images.",
                "Offload image processing to an asynchronous worker queue via message brokers like SQS/Celery, immediately returning a 202 Accepted status with an upload tracking ID.",
                "Double the HTTP connection timeout to 10 minutes.",
                "Reboot the web server on every upload."
            ],
            "correct_index": 1,
            "explanation": "Asynchronous job queues decouple CPU-intensive media transformations from web request threads, maintaining responsive HTTP latency."
        }
    ]
}

SET_69 = {
    "title": "Soft Skill Assessment - Set 69",
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
            "question_text": "A train passes a station platform in 36 seconds and a man standing on the platform in 20 seconds. If the speed of the train is 54 km/h, what is the length of the platform?",
            "options": ["200 m", "220 m", "240 m", "260 m"],
            "correct_index": 2,
            "explanation": "Speed = 54 × (5/18) = 15 m/s. Train length = 15 × 20 = 300 m. Total distance for platform = 15 × 36 = 540 m. Platform length = 540 - 300 = 240 m."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "If 6 men and 8 boys can do a piece of work in 10 days, while 26 men and 48 boys can do the same in 2 days, what is the time taken by 15 men and 20 boys to complete the work?",
            "options": ["4 days", "5 days", "6 days", "8 days"],
            "correct_index": 0,
            "explanation": "10(6M + 8B) = 2(26M + 48B) => 60M + 80B = 52M + 96B => 8M = 16B => 1M = 2B. Total work = (6×2 + 8) × 10 = 200 boy-days. 15M + 20B = (15×2 + 20) = 50 boys. Days = 200 / 50 = 4 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A trader bought an article and sold it at a gain of 5%. If he had bought it at 5% less and sold it for ₹1 less, he would have gained 10%. What was the cost price of the article?",
            "options": ["₹180", "₹200", "₹220", "₹250"],
            "correct_index": 1,
            "explanation": "Let CP = 100x. SP1 = 105x. New CP = 95x. New SP = 95x × 1.10 = 104.5x. Difference: 105x - 104.5x = 0.5x. 0.5x = 1 => x = 2. CP = 100 × 2 = ₹200."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The simple interest on a certain sum of money for 3 years at 8% per annum is half the compound interest on ₹4,000 for 2 years at 10% per annum. What is the sum placed on simple interest?",
            "options": ["₹1,500", "₹1,650", "₹1,750", "₹1,850"],
            "correct_index": 2,
            "explanation": "Compound interest on ₹4,000 at 10% for 2 years = 4,000 × 0.21 = ₹840. Half of CI = ₹420. Simple interest = P × 3 × 8 / 100 = 0.24P. 0.24P = 420 => P = 420 / 0.24 = ₹1,750."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "A, B, and C enter into a partnership with shares in the ratio 1/2 : 1/3 : 1/4. After 2 months, A withdraws half of his capital. If the total profit at the end of 1 year is ₹4,200, find B's share of the profit.",
            "options": ["₹1,400", "₹1,600", "₹1,800", "₹2,000"],
            "correct_index": 1,
            "explanation": "Ratio of investment = 6 : 4 : 3. A's capital units = 6 × 2 + 3 × 10 = 12 + 30 = 42. B's capital units = 4 × 12 = 48. C's capital units = 3 × 12 = 36. Profit ratio = 42 : 48 : 36 = 7 : 8 : 6. Total parts = 21. B's share = (8/21) × 4,200 = ₹1,600."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 6 numbers is 30. If the average of the first four numbers is 25 and that of the last three numbers is 35, what is the fourth number?",
            "options": ["20", "25", "30", "35"],
            "correct_index": 1,
            "explanation": "Sum of 6 numbers = 6 × 30 = 180. Sum of first 4 = 4 × 25 = 100. Sum of last 3 = 3 × 35 = 105. 4th number = (100 + 105) - 180 = 205 - 180 = 25."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "Two cards are drawn together from a standard deck of 52 cards. What is the probability that both cards are aces?",
            "options": ["1/169", "1/221", "1/256", "2/221"],
            "correct_index": 1,
            "explanation": "Favorable outcomes = C(4,2) = 6. Total outcomes = C(52,2) = (52 × 51)/2 = 1,326. Probability = 6 / 1,326 = 1 / 221."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A hollow iron pipe is 21 cm long and its exterior diameter is 8 cm. If the thickness of the pipe is 1 cm and iron weighs 8 g/cm³, what is the total weight of the pipe in kg (use pi = 22/7)?",
            "options": ["3.456 kg", "3.696 kg", "3.840 kg", "4.120 kg"],
            "correct_index": 1,
            "explanation": "External radius R = 4 cm, internal radius r = 3 cm, height h = 21 cm. Volume = pi × h × (R² - r²) = (22/7) × 21 × (16 - 9) = 22 × 3 × 7 = 462 cm³. Weight = 462 × 8 = 3,696 g = 3.696 kg."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: Some microservices are event-driven. All event-driven services are asynchronous. No asynchronous service is blocking. Conclusions: I. Some event-driven services are not blocking. II. No microservice is blocking.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "All event-driven services are asynchronous and no asynchronous service is blocking, so all event-driven services are not blocking (some are not blocking follows, I is valid). Non-event-driven microservices could be blocking, so II does not follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Five engineers—A, B, C, D, and E—sit in a row facing North. A sits to the immediate left of B. C sits to the immediate right of B. D sits to the immediate right of C. E sits to the immediate left of A. Who sits in the exact center of the row?",
            "options": ["A", "B", "C", "D"],
            "correct_index": 1,
            "explanation": "Relative positions from left to right: E, A, B, C, D. The engineer in the exact center is B."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'CONTAINER' is coded as 'DPPUBJOF' (+1 to each letter). How is 'KUBERNETES' coded under the same rule?",
            "options": ["LVCFSOFUFT", "LVCFSNFUFT", "LWCFSOFUFT", "LVCESOFUFT"],
            "correct_index": 0,
            "explanation": "K(+1)=L, U(+1)=V, B(+1)=C, E(+1)=F, R(+1)=S, N(+1)=O, E(+1)=F, T(+1)=U, E(+1)=F, S(+1)=T => LVCFSOFUFT."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A person walks 9 km South, turns East and walks 12 km, then turns North and walks 9 km. How far and in which direction is the person from the starting point?",
            "options": ["12 km East", "12 km West", "15 km South-East", "18 km East"],
            "correct_index": 0,
            "explanation": "South 9 km and North 9 km cancel out. The remaining displacement is 12 km East."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Pointing to a gentleman, Deepak said: 'His only brother is the father of my daughter's father.' How is the gentleman related to Deepak?",
            "options": ["Paternal Uncle", "Father", "Grandfather", "Brother"],
            "correct_index": 0,
            "explanation": "Deepak's daughter's father is Deepak himself. The father of Deepak is his father. The gentleman's only brother is Deepak's father. Thus, the gentleman is Deepak's paternal uncle."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Find the missing number in the sequence: 2, 9, 28, 65, 126, ?",
            "options": ["197", "215", "217", "225"],
            "correct_index": 2,
            "explanation": "Pattern is (n³ + 1): 1³+1=2, 2³+1=9, 3³+1=28, 4³+1=65, 5³+1=126, 6³+1=216+1=217."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Should organizations adopt automated continuous security vulnerability scanning in their container registries?' Arguments: I. Yes, automated scanning detects CVE vulnerabilities in base images before they are pulled into production clusters. II. No, scanning container images takes up fractional storage cache space.",
            "options": [
                "Only argument I is strong",
                "Only argument II is strong",
                "Both I and II are strong",
                "Neither I nor II is strong"
            ],
            "correct_index": 0,
            "explanation": "Argument I is strong because scanning base images prevents supply-chain exploits. Argument II is trivial compared to production security risks."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the sentence that correctly employs the past perfect tense:",
            "options": [
                "By the time the database failover completed, the engineers had already verified data integrity.",
                "By the time the database failover completed, the engineers verified data integrity.",
                "By the time the database failover completed, the engineers have verified data integrity.",
                "By the time the database failover completed, the engineers would verify data integrity."
            ],
            "correct_index": 0,
            "explanation": "The past perfect tense ('had already verified') is used for an action completed before another past action ('failover completed')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'NEFARIOUS':",
            "options": ["Wicked", "Virtuous", "Benevolent", "Exemplary"],
            "correct_index": 0,
            "explanation": "'Nefarious' means wicked or criminal in nature."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'ALACRITY':",
            "options": ["Apathy", "Eagerness", "Promptness", "Briskness"],
            "correct_index": 0,
            "explanation": "'Alacrity' means brisk and cheerful readiness. Its antonym is 'apathy' or 'sluggishness'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To beat the clock' mean?",
            "options": [
                "To damage a timepiece",
                "To finish a task or reach a goal before the allotted deadline expires",
                "To adjust time zones manually",
                "To work late into the night"
            ],
            "correct_index": 1,
            "explanation": "'To beat the clock' means to complete an activity before a specific deadline or time limit."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who draws or produces geographical maps'",
            "options": ["Cartographer", "Calligrapher", "Choreographer", "Topographer"],
            "correct_index": 0,
            "explanation": "A 'Cartographer' is a person who creates and draws maps."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting persistent effort in doing something despite difficulty:",
            "options": ["Perseverance", "Perseverence", "Perceverance", "Perceverence"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Perseverance'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A primary cloud provider region experiences a catastrophic power outage that knocks out both compute and storage clusters. What is the standard recovery time objective (RTO) procedure for a multi-region active-passive setup?",
            "options": [
                "Execute the regional failover runbook to redirect global DNS traffic to the secondary region and promote the standby database replica to primary.",
                "Wait for the primary cloud region to restore power in 3 days.",
                "Delete all application servers.",
                "Tell customers to refrain from using the internet."
            ],
            "correct_index": 0,
            "explanation": "Executing the standby failover runbook to route global DNS to healthy secondary regions and promoting standby databases restores business operations rapidly during regional cloud outages."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "A junior engineer spots an architectural flaw in a pull request authored by a principal engineer but hesitates to comment out of fear of overstepping. How should engineering culture encourage them?",
            "options": [
                "Cultivate psychological safety by publicly celebrating rigorous code reviews from all levels and explicitly setting expectations that principal engineers welcome constructive critique.",
                "Reprimand the junior engineer for questioning leadership.",
                "Ban junior developers from reviewing senior developers' code.",
                "Instruct the principal engineer to never make mistakes."
            ],
            "correct_index": 0,
            "explanation": "Psychological safety and blameless collaboration empower every engineer to contribute to code quality, regardless of seniority."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "An attacker attempts to exploit an API by manipulating the HTTP Host header to poison password reset email links. What server-level security control mitigates this attack?",
            "options": [
                "Trust any user-supplied Host header blindly.",
                "Validate the Host header against a strict server whitelist of approved domain names and ignore user-supplied host headers when generating absolute URLs.",
                "Remove password resets from the application.",
                "Disable email notifications permanently."
            ],
            "correct_index": 1,
            "explanation": "Whitelisting allowed Host headers and referencing server configuration domains rather than user-controlled headers stops HTTP Host header injection and link poisoning."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A relational database query executes a full table scan on 50 million rows every minute because the WHERE clause applies a function to an unindexed column (WHERE LOWER(email) = ?). What index optimization fixes this?",
            "options": [
                "Create a functional/expression index on LOWER(email) so the database engine can perform an indexed B-tree range scan directly.",
                "Delete the WHERE clause entirely.",
                "Download all 50 million records to the web client to filter in JavaScript.",
                "Turn off database indexing."
            ],
            "correct_index": 0,
            "explanation": "Functional/expression indexes allow database B-tree lookups on deterministic function transformations, avoiding catastrophic sequential full-table scans."
        }
    ]
}

SET_70 = {
    "title": "Soft Skill Assessment - Set 70",
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
            "question_text": "Two cyclists start from the same place in opposite directions. One goes towards North at 18 km/h and the other goes towards South at 24 km/h. In how many hours will they be 84 km apart?",
            "options": ["1.5 hours", "2.0 hours", "2.5 hours", "3.0 hours"],
            "correct_index": 1,
            "explanation": "Relative speed in opposite directions = 18 + 24 = 42 km/h. Time = Distance / Speed = 84 / 42 = 2.0 hours."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "A can build a server cluster in 30 days, while B can decommission/destroy it in 40 days. If they work on alternate days starting with A on day 1, how many days will it take for the cluster to be completely built (capacity 120 units)?",
            "options": ["225 days", "230 days", "233 days", "240 days"],
            "correct_index": 2,
            "explanation": "Total capacity = 120 units. A's rate = +4 u/day, B's rate = -3 u/day. In 2 days net work = +1 unit. In 232 days (116 cycles), work done = 116 units. On day 233, A works and builds 4 units: 116 + 4 = 120 units (target reached!). Total time = 233 days."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "A manufacturer sells an enterprise storage appliance to a wholesale distributor at 10% profit. The distributor sells it to a reseller at 20% profit, and the reseller sells it to a client for ₹66,000 at a 25% profit. What was the manufacturing cost?",
            "options": ["₹38,000", "₹40,000", "₹42,000", "₹45,000"],
            "correct_index": 1,
            "explanation": "Manufacturing Cost × 1.10 × 1.20 × 1.25 = 66,000 => Cost × 1.65 = 66,000 => Cost = 66,000 / 1.65 = ₹40,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "What sum of money will amount to ₹1,331 in 3 years at 10% per annum compound interest, compounded annually?",
            "options": ["₹1,000", "₹1,100", "₹1,150", "₹1,200"],
            "correct_index": 0,
            "explanation": "Amount = P × (1.1)³ = 1.331P. 1.331P = 1,331 => P = ₹1,000."
        },
        {
            "category": "aptitude",
            "difficulty": "medium",
            "question_text": "The ratio of the ages of Anthony and Amar is 6 : 7. If Amar is 4 years older than Anthony, what will be the ratio of their ages after 4 years?",
            "options": ["7 : 8", "8 : 9", "9 : 10", "10 : 11"],
            "correct_index": 0,
            "explanation": "7x - 6x = 4 => x = 4. Anthony = 24 years, Amar = 28 years. After 4 years: Anthony = 28, Amar = 32. Ratio = 28 : 32 = 7 : 8."
        },
        {
            "category": "aptitude",
            "difficulty": "easy",
            "question_text": "The average of 7 numbers is 20. If each number is multiplied by 12, what will be the average of the new set of numbers?",
            "options": ["120", "180", "240", "300"],
            "correct_index": 2,
            "explanation": "When every element in a data set is multiplied by a constant k, the new average is simply the original average multiplied by k: 20 × 12 = 240."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "How many different 4-letter words can be formed from the letters of the word 'LOGARITHM' without repeating any letter?",
            "options": ["1,512", "2,048", "3,024", "4,032"],
            "correct_index": 2,
            "explanation": "LOGARITHM contains 9 distinct letters. The number of 4-letter arrangements is P(9,4) = 9 × 8 × 7 × 6 = 3,024."
        },
        {
            "category": "aptitude",
            "difficulty": "hard",
            "question_text": "The length, breadth, and height of a server room are 5 m, 4 m, and 3 m respectively. What is the length of the longest cable runner that can be placed inside the room (diagonal)?",
            "options": ["5√2 m (approx 7.07 m)", "6√2 m", "7 m", "8 m"],
            "correct_index": 0,
            "explanation": "Space diagonal = sqrt(L² + B² + H²) = sqrt(5² + 4² + 3²) = sqrt(25 + 16 + 9) = sqrt(50) = 5√2 m ≈ 7.07 m."
        },
        # Reasoning (7)
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statements: All kubernetes pods are containers. Some containers are daemons. No daemon is interactive. Conclusions: I. Some containers are not interactive. II. No pod is interactive.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Containers that are daemons cannot be interactive; thus some containers are not interactive (I follows). Pods might not overlap daemons at all, so II does not follow."
        },
        {
            "category": "reasoning",
            "difficulty": "hard",
            "question_text": "Six engineers—P, Q, R, S, T, and U—are seated in two parallel rows facing each other: Row 1 facing South (P, Q, R) and Row 2 facing North (S, T, U). Q sits in the middle of Row 1. T sits in the middle of Row 2. P sits opposite S. Who sits opposite R?",
            "options": ["S", "T", "U", "Cannot be determined"],
            "correct_index": 2,
            "explanation": "Row 1 contains P, Q, R (with Q in middle). Row 2 contains S, T, U (with T in middle). Q is opposite T. P is opposite S. Therefore, R must be opposite U."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "In a certain code, 'GATEWAY' is coded as 'HBUFXBZ' (+1 to each letter). How is 'PROXY' coded under the same rule?",
            "options": ["QSPYZ", "QRPYZ", "QSQYZ", "PSPYZ"],
            "correct_index": 0,
            "explanation": "P(+1)=Q, R(+1)=S, O(+1)=P, X(+1)=Y, Y(+1)=Z => QSPYZ."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "A robot navigates 10 m East, turns left and navigates 10 m, turns left and navigates 10 m, then turns right and navigates 5 m. How far is the robot from its initial coordinates?",
            "options": ["10 m North", "15 m North", "20 m North", "25 m North"],
            "correct_index": 1,
            "explanation": "East 10 m, North 10 m, West 10 m, North 5 m. East and West cancel out (10 - 10 = 0). Total North displacement = 10 + 5 = 15 m."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Introducing a girl, a boy said: 'She is the daughter of the only son of my grandfather.' How is the girl related to the boy?",
            "options": ["Sister", "Mother", "Aunt", "Cousin"],
            "correct_index": 0,
            "explanation": "The boy's grandfather's only son is the boy's father. The daughter of the boy's father is his sister."
        },
        {
            "category": "reasoning",
            "difficulty": "easy",
            "question_text": "Which number completes the sequence: 4, 12, 36, 108, 324, ?",
            "options": ["648", "864", "972", "1,024"],
            "correct_index": 2,
            "explanation": "Each term is multiplied by 3: 4×3=12, 12×3=36, 36×3=108, 108×3=324, 324×3=972."
        },
        {
            "category": "reasoning",
            "difficulty": "medium",
            "question_text": "Statement: 'Automated database migrations executed through declarative version control prevent schema drift across development, staging, and production environments.' Conclusions: I. Declarative versioning ensures that every environment matches the target schema state exactly. II. Manual SQL schema alters are impossible to execute.",
            "options": [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Both I and II follow",
                "Neither I nor II follows"
            ],
            "correct_index": 0,
            "explanation": "Conclusion I reflects the exact guarantee of automated schema migration tools (e.g. Flyway/Liquibase). Conclusion II is false; manual SQL commands can still be executed if permissions allow."
        },
        # English (6)
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the grammatically correct sentence using the negative adverbial opener 'Scarcely':",
            "options": [
                "Scarcely had the load balancer resumed operations when the network connection stabilized.",
                "Scarcely had the load balancer resumed operations than the network connection stabilized.",
                "Scarcely the load balancer had resumed operations when the network connection stabilized.",
                "Scarcely did the load balancer resumed operations when the network connection stabilized."
            ],
            "correct_index": 0,
            "explanation": "'Scarcely' triggers subject-auxiliary inversion ('had the load balancer resumed') and pairs with 'when' (not 'than')."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the word closest in meaning to 'SAGACIOUS':",
            "options": ["Astute", "Foolish", "Impulsive", "Ignorant"],
            "correct_index": 0,
            "explanation": "'Sagacious' means having or showing keen mental discernment and good judgment; astute or shrewd."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "Select the antonym of 'INVIDIOUS':",
            "options": ["Fair", "Discriminatory", "Unfair", "Prejudicial"],
            "correct_index": 0,
            "explanation": "'Invidious' means likely to arouse resentment or anger in others; unfair. Its antonym is 'fair' or 'pleasant'."
        },
        {
            "category": "english",
            "difficulty": "medium",
            "question_text": "What does the idiom 'To let the cat out of the bag' mean?",
            "options": [
                "To release an animal from confinement",
                "To reveal a secret or surprise prematurely or by mistake",
                "To abandon a software release",
                "To make a poor presentation"
            ],
            "correct_index": 1,
            "explanation": "'To let the cat out of the bag' means to reveal a secret or surprise inadvertently."
        },
        {
            "category": "english",
            "difficulty": "hard",
            "question_text": "Select the one-word substitution for: 'A person who is guided more by ideals and principles than by practical considerations'",
            "options": ["Idealist", "Pragmatist", "Realist", "Opportunist"],
            "correct_index": 0,
            "explanation": "An 'Idealist' is a person who represents things as they might or should be rather than as they are."
        },
        {
            "category": "english",
            "difficulty": "easy",
            "question_text": "Choose the correctly spelled word denoting an exceptional achievement or masterly work of art:",
            "options": ["Masterpiece", "Masterpeice", "Musterpiece", "Masterpiese"],
            "correct_index": 0,
            "explanation": "The correct spelling is 'Masterpiece'."
        },
        # Situational (4)
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A high-throughput API gateway experiences CPU throttling in Kubernetes because its CPU limits are set too tight (100m) while incoming burst traffic requires 800m for 200ms. What Kubernetes configuration resolves the CPU throttling?",
            "options": [
                "Remove or raise CPU limits while keeping appropriate CPU requests, allowing CFS burst capability without unnecessary throttling.",
                "Restart the cluster every hour.",
                "Disable all network traffic.",
                "Reduce worker nodes to one."
            ],
            "correct_index": 0,
            "explanation": "Kubernetes CFS quota enforcement causes severe CPU throttling when limits are set too low for spiky latency-sensitive services; raising or removing CPU limits while keeping requests stable resolves throttling."
        },
        {
            "category": "situational",
            "difficulty": "easy",
            "question_text": "During an incident triage, engineers struggle to identify which downstream microservice in a mesh is introducing 4-second latency because logs are scattered across 20 distinct services. What observability capability is missing?",
            "options": [
                "Deleting all microservice log files.",
                "Distributed Tracing using OpenTelemetry with trace/span ID propagation to trace requests end-to-end across service boundaries.",
                "Buying faster developer monitors.",
                "Stopping all customer traffic."
            ],
            "correct_index": 1,
            "explanation": "Distributed tracing with trace context propagation illuminates cross-service latency breakdowns and pinpoint bottlenecks across microservice architectures."
        },
        {
            "category": "situational",
            "difficulty": "medium",
            "question_text": "A rogue internal script attempts to query the AWS EC2 instance metadata service (IMDS) at 169.254.169.254 to steal temporary IAM role credentials via SSRF. What AWS security configuration hardens instances against this?",
            "options": [
                "Allow unauthenticated IMDSv1 access.",
                "Enforce IMDSv2 across all EC2 instances, requiring session-oriented PUT requests with hop limits that block SSRF credential harvesting.",
                "Disable IAM roles altogether.",
                "Turn off AWS CloudTrail."
            ],
            "correct_index": 1,
            "explanation": "IMDSv2 requires token-based session requests (PUT with X-aws-ec2-metadata-token-ttl-seconds) and packet hop limits, neutralizing SSRF metadata credential theft."
        },
        {
            "category": "situational",
            "difficulty": "hard",
            "question_text": "A payments company processes 50,000 credit card authorizations per hour. To prevent catastrophic single-cloud regional outages from halting payments, what architectural strategy is required?",
            "options": [
                "Host everything on a single local server.",
                "Multi-region active-active deployment with geo-distributed database replication and automated Route 53 latency/health check routing.",
                "Turn off payments whenever it rains.",
                "Trust the cloud region to never fail."
            ],
            "correct_index": 1,
            "explanation": "Active-active multi-region architectures with distributed data replication and automated DNS failover guarantee continuous uptime during regional cloud infrastructure disasters."
        }
    ]
}

PART_14_SETS = [SET_66, SET_67, SET_68, SET_69, SET_70]
''')
    print("Successfully generated sets_part14.py")

if __name__ == '__main__':
    write_part14()

