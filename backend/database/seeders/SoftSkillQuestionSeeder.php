<?php

namespace Database\Seeders;

use App\Models\SoftSkillQuestion;
use Illuminate\Database\Seeder;

/**
 * Launch content for Soft Skills — 75 real, hand-written questions (not
 * placeholders), in the style of real campus-placement aptitude tests
 * (AMCAT/CoCubes/TCS NQT): 25 Quantitative Aptitude, 20 Logical Reasoning,
 * 20 Verbal/English Ability, 10 Workplace Situational Judgment (the
 * "soft skills" part a pure aptitude test doesn't cover — see the
 * feature's plan doc). Idempotent via updateOrCreate by question_text.
 */
class SoftSkillQuestionSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->questions() as $q) {
            SoftSkillQuestion::updateOrCreate(
                ['question_text' => $q['question_text']],
                [
                    'category' => $q['category'],
                    'difficulty' => $q['difficulty'],
                    'options' => $q['options'],
                    'correct_index' => $q['correct_index'],
                    'explanation' => $q['explanation'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function questions(): array
    {
        return [...$this->aptitude(), ...$this->reasoning(), ...$this->english(), ...$this->situational()];
    }

    private function aptitude(): array
    {
        $c = SoftSkillQuestion::CATEGORY_APTITUDE;

        return [
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'What is 15% of 240?', 'options' => ['30', '36', '40', '45'], 'correct_index' => 1, 'explanation' => '15% of 240 = 0.15 × 240 = 36.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A shopkeeper buys a book for ₹200 and sells it for ₹250. What is his profit percentage?', 'options' => ['20%', '25%', '30%', '50%'], 'correct_index' => 1, 'explanation' => 'Profit = ₹50. Profit% = (50/200) × 100 = 25%.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'The average of 5 numbers is 20. If one number is removed, the average of the remaining 4 becomes 18. What was the removed number?', 'options' => ['24', '26', '28', '30'], 'correct_index' => 2, 'explanation' => 'Sum of 5 = 100, sum of remaining 4 = 72, so the removed number = 100 − 72 = 28.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Two numbers are in the ratio 3:5. If their sum is 96, find the larger number.', 'options' => ['36', '48', '60', '64'], 'correct_index' => 2, 'explanation' => 'The larger share = (5/8) × 96 = 60.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A car travels 180 km in 3 hours. What is its speed in km/h?', 'options' => ['50', '60', '65', '70'], 'correct_index' => 1, 'explanation' => 'Speed = Distance/Time = 180/3 = 60 km/h.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A can complete a work in 10 days and B in 15 days. Working together, how many days will they take?', 'options' => ['5', '6', '7', '8'], 'correct_index' => 1, 'explanation' => 'Combined rate = 1/10 + 1/15 = 1/6 of the work per day, so together they take 6 days.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the simple interest on ₹5000 at 8% per annum for 2 years.', 'options' => ['₹700', '₹750', '₹800', '₹850'], 'correct_index' => 2, 'explanation' => 'SI = (P × R × T)/100 = (5000 × 8 × 2)/100 = ₹800.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'What is the compound interest on ₹2000 at 10% per annum for 2 years?', 'options' => ['₹400', '₹410', '₹420', '₹440'], 'correct_index' => 2, 'explanation' => 'Amount = 2000 × 1.1² = ₹2420, so CI = 2420 − 2000 = ₹420.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Find the next number in the series: 2, 6, 12, 20, 30, ?', 'options' => ['36', '40', '42', '44'], 'correct_index' => 2, 'explanation' => 'Each term is n(n+1): 1×2, 2×3, 3×4, 4×5, 5×6, 6×7 = 42.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the missing number: 3, 9, 27, 81, ?', 'options' => ['162', '243', '324', '405'], 'correct_index' => 1, 'explanation' => 'Each term is multiplied by 3: 81 × 3 = 243.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "In how many ways can the letters of the word 'CAT' be arranged?", 'options' => ['3', '6', '9', '12'], 'correct_index' => 1, 'explanation' => 'All 3 letters are distinct, so 3! = 6 arrangements.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A die is rolled once. What is the probability of getting an even number?', 'options' => ['1/6', '1/3', '1/2', '2/3'], 'correct_index' => 2, 'explanation' => 'Even numbers on a die: 2, 4, 6 — that\'s 3 out of 6 outcomes, i.e. 1/2.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => "The sum of a father's and son's ages is 60 years. Six years ago, the father's age was 5 times the son's age. What is the father's current age?", 'options' => ['42', '44', '46', '48'], 'correct_index' => 2, 'explanation' => 'Let son = s, father = 60−s. (60−s−6) = 5(s−6) → 54−s = 5s−30 → s=14, father = 46.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'In what ratio must water be mixed with milk to gain 20% on selling the mixture at the cost price of milk?', 'options' => ['1:4', '1:5', '1:6', '2:5'], 'correct_index' => 1, 'explanation' => 'To gain 20% by dilution, the ratio of water to milk must be 1:5.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'The price of an item increased from ₹80 to ₹100. What is the percentage increase?', 'options' => ['20%', '25%', '30%', '40%'], 'correct_index' => 1, 'explanation' => 'Increase = ₹20. Percentage increase = (20/80) × 100 = 25%.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A shirt marked at ₹1000 is sold at a 20% discount. What is the selling price?', 'options' => ['₹750', '₹800', '₹850', '₹900'], 'correct_index' => 1, 'explanation' => 'Discount = ₹200, so selling price = 1000 − 200 = ₹800.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'What is the HCF of 24 and 36?', 'options' => ['6', '8', '12', '18'], 'correct_index' => 2, 'explanation' => '24 = 2³×3, 36 = 2²×3². The HCF is 2²×3 = 12.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Two trains start from the same station in opposite directions at 40 km/h and 60 km/h. After how many hours will they be 300 km apart?', 'options' => ['2', '2.5', '3', '3.5'], 'correct_index' => 2, 'explanation' => 'Relative speed = 40+60 = 100 km/h. Time = 300/100 = 3 hours.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A person travels half the distance at 40 km/h and the other half at 60 km/h. What is the average speed for the whole journey?', 'options' => ['45', '48', '50', '52'], 'correct_index' => 1, 'explanation' => 'Average speed for equal distances = (2 × 40 × 60)/(40+60) = 4800/100 = 48 km/h.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Find the odd one out: 8, 27, 64, 100, 125', 'options' => ['27', '64', '100', '125'], 'correct_index' => 2, 'explanation' => '8, 27, 64 and 125 are perfect cubes (2³, 3³, 4³, 5³); 100 is not.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'In an exam, a student scored 450 out of 600 marks. What percentage did the student score?', 'options' => ['70%', '72%', '75%', '80%'], 'correct_index' => 2, 'explanation' => '(450/600) × 100 = 75%.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'A population of 10,000 grows at 10% per year. What will it be after 2 years?', 'options' => ['11,000', '12,000', '12,100', '12,200'], 'correct_index' => 2, 'explanation' => '10000 × 1.1 × 1.1 = 12,100.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "A and B invest ₹4000 and ₹6000 respectively in a business. If the profit is ₹5000, what is A's share?", 'options' => ['₹1500', '₹2000', '₹2500', '₹3000'], 'correct_index' => 1, 'explanation' => "Investment ratio A:B = 4000:6000 = 2:3. A's share = (2/5) × 5000 = ₹2000."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Convert 72 km/h into m/s.', 'options' => ['15', '18', '20', '22'], 'correct_index' => 2, 'explanation' => '72 × (5/18) = 20 m/s.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'If 6 workers can build a wall in 12 days, how many days will 8 workers take to build the same wall?', 'options' => ['8', '9', '10', '12'], 'correct_index' => 1, 'explanation' => 'Total work = 6 × 12 = 72 worker-days. With 8 workers: 72/8 = 9 days.'],
        ];
    }

    private function reasoning(): array
    {
        $c = SoftSkillQuestion::CATEGORY_REASONING;

        return [
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the next letter in the series: B, D, F, H, ?', 'options' => ['I', 'J', 'K', 'L'], 'correct_index' => 1, 'explanation' => 'The series skips one letter each time: B, D, F, H, J.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "If CAT is coded as DBU, how is DOG coded in the same language?", 'options' => ['EPH', 'EPG', 'DPH', 'EQH'], 'correct_index' => 0, 'explanation' => 'Each letter is shifted forward by 1: D→E, O→P, G→H, giving EPH.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Pointing to a photograph, a man says, 'She is the daughter of my grandfather's only son.' How is the woman related to the man?", 'options' => ['Mother', 'Sister', 'Aunt', 'Daughter'], 'correct_index' => 1, 'explanation' => "The grandfather's only son is the man's father, so the woman (his daughter) is the man's sister."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A man walks 5 km north, then turns right and walks 3 km, then turns right again and walks 5 km. How far is he from his starting point?', 'options' => ['3 km', '4 km', '5 km', '8 km'], 'correct_index' => 0, 'explanation' => 'Plotting the path: he ends up 3 km east of the starting point (the two 5 km north/south legs cancel out).'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'All cats are animals. All animals are living beings. Therefore:', 'options' => ['All cats are living beings', 'All living beings are cats', 'Some animals are not cats', 'No cats are living beings'], 'correct_index' => 0, 'explanation' => 'This follows directly by transitivity of the two given statements.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Doctor is to Hospital as Teacher is to ?', 'options' => ['Student', 'School', 'Book', 'Classroom'], 'correct_index' => 1, 'explanation' => 'A doctor works at a hospital; a teacher works at a school — matching the workplace relationship.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the odd one out: Apple, Banana, Carrot, Mango', 'options' => ['Apple', 'Banana', 'Carrot', 'Mango'], 'correct_index' => 2, 'explanation' => 'Apple, Banana and Mango are fruits; Carrot is a vegetable.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the missing number: 1, 4, 9, 16, 25, ?', 'options' => ['30', '32', '36', '49'], 'correct_index' => 2, 'explanation' => 'These are perfect squares (1², 2², 3², 4², 5²); the next is 6² = 36.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'In a certain code, MONKEY is written as NPOLFZ. How is TIGER written in the same code?', 'options' => ['UJHFS', 'UJHFR', 'UIHFS', 'VJHFS'], 'correct_index' => 0, 'explanation' => 'Every letter is shifted forward by 1: T→U, I→J, G→H, E→F, R→S, giving UJHFS.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "A is B's brother. C is B's mother. D is C's father. How is A related to D?", 'options' => ['Son', 'Grandson', 'Father', 'Nephew'], 'correct_index' => 1, 'explanation' => 'C is the mother of A and B, and D is C\'s father — so D is the grandfather of A, meaning A is his grandson.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Ravi walks 10m south, then 10m west, then 10m north. In which direction is he now from his starting point?', 'options' => ['North', 'South', 'East', 'West'], 'correct_index' => 3, 'explanation' => 'The south and north legs cancel out, leaving him 10m west of the starting point.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the next term in the series: 5, 10, 20, 40, ?', 'options' => ['60', '70', '80', '90'], 'correct_index' => 2, 'explanation' => 'Each term doubles the previous one: 40 × 2 = 80.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Pen is to Write as Knife is to ?', 'options' => ['Sharp', 'Cut', 'Kitchen', 'Blade'], 'correct_index' => 1, 'explanation' => 'A pen is used to write; a knife is used to cut — matching function.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'In a row of children, Raj is 7th from the left and 12th from the right. How many children are in the row?', 'options' => ['17', '18', '19', '20'], 'correct_index' => 1, 'explanation' => 'Total = (position from left) + (position from right) − 1 = 7 + 12 − 1 = 18.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'Some pens are books. All books are papers. Therefore:', 'options' => ['Some pens are papers', 'All pens are papers', 'No pens are papers', 'All papers are pens'], 'correct_index' => 0, 'explanation' => 'Since some pens are books and all books are papers, at least some pens must be papers.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the odd one out: Triangle, Square, Circle, Cube', 'options' => ['Triangle', 'Square', 'Circle', 'Cube'], 'correct_index' => 3, 'explanation' => 'Triangle, Square and Circle are 2D shapes; a Cube is a 3D shape.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => "In a code language, 'ROAD' is written as 'URDG'. How is 'SEAT' written in the same code?", 'options' => ['VHDW', 'VHDX', 'VGDW', 'WHDW'], 'correct_index' => 0, 'explanation' => 'Each letter is shifted forward by 3 (R→U, O→R, A→D, D→G); applying this to SEAT gives VHDW.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Find the missing number: 7, 14, 28, 56, ?', 'options' => ['98', '104', '112', '120'], 'correct_index' => 2, 'explanation' => 'Each term doubles the previous one: 56 × 2 = 112.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => "Pointing to a man, a woman says, 'His mother is the only daughter of my mother.' How is the woman related to the man?", 'options' => ['Sister', 'Mother', 'Aunt', 'Grandmother'], 'correct_index' => 1, 'explanation' => "The only daughter of the woman's mother is the woman herself, so the man's mother is the woman — she is his mother."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Fish is to Water as Bird is to ?', 'options' => ['Nest', 'Sky', 'Wings', 'Tree'], 'correct_index' => 1, 'explanation' => 'A fish lives/moves in water; a bird lives/moves in the sky — matching habitat/element.'],
        ];
    }

    private function english(): array
    {
        $c = SoftSkillQuestion::CATEGORY_ENGLISH;

        return [
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "Choose the synonym of 'Abundant':", 'options' => ['Scarce', 'Plentiful', 'Empty', 'Limited'], 'correct_index' => 1, 'explanation' => "'Abundant' means existing in large quantities — 'Plentiful' is the closest synonym."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "Choose the antonym of 'Optimistic':", 'options' => ['Hopeful', 'Cheerful', 'Pessimistic', 'Positive'], 'correct_index' => 2, 'explanation' => "'Pessimistic' (expecting the worst) is the direct opposite of 'Optimistic'."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A person who speaks many languages is called:', 'options' => ['Linguist', 'Polyglot', 'Translator', 'Orator'], 'correct_index' => 1, 'explanation' => "A 'Polyglot' is someone who knows and speaks several languages."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Which sentence uses correct subject-verb agreement with 'neither'?", 'options' => ['Neither of the boys were present.', 'Neither of the boys was present.', 'Neither of the boys are present.', 'Neither of the boys have been present.'], 'correct_index' => 1, 'explanation' => "'Neither' takes a singular verb, so 'was' is correct."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Choose the synonym of 'Meticulous':", 'options' => ['Careless', 'Careful', 'Quick', 'Lazy'], 'correct_index' => 1, 'explanation' => "'Meticulous' means showing great attention to detail — closest to 'Careful'."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Choose the antonym of 'Genuine':", 'options' => ['Authentic', 'Real', 'Fake', 'True'], 'correct_index' => 2, 'explanation' => "'Fake' is the direct opposite of 'Genuine' (authentic/real)."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A place where birds are kept is called:', 'options' => ['Aquarium', 'Aviary', 'Zoo', 'Sanctuary'], 'correct_index' => 1, 'explanation' => "An 'Aviary' is a large enclosure specifically for keeping birds."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Choose the correctly punctuated sentence:', 'options' => ["Its a beautiful day.", "It's a beautiful day.", "Its' a beautiful day.", "It is' a beautiful day."], 'correct_index' => 1, 'explanation' => "\"It's\" is the correct contraction of \"it is\"."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "The manager's ___ approach helped the team meet the deadline efficiently.", 'options' => ['chaotic', 'methodical', 'careless', 'indifferent'], 'correct_index' => 1, 'explanation' => "'Methodical' (systematic and orderly) best fits an approach that helps meet deadlines efficiently."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Choose the synonym of 'Candid':", 'options' => ['Frank', 'Secretive', 'Shy', 'Formal'], 'correct_index' => 0, 'explanation' => "'Candid' means being open and honest — closest to 'Frank'."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "Choose the antonym of 'Ancient':", 'options' => ['Old', 'Modern', 'Historic', 'Aged'], 'correct_index' => 1, 'explanation' => "'Modern' is the direct opposite of 'Ancient'."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'One who does not believe in the existence of God is called:', 'options' => ['Theist', 'Atheist', 'Agnostic', 'Pantheist'], 'correct_index' => 1, 'explanation' => "An 'Atheist' is someone who does not believe in the existence of God."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "Which sentence correctly conjugates the verb after 'doesn't'?", 'options' => ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], 'correct_index' => 2, 'explanation' => "With 'doesn't', the main verb stays in base form: 'doesn't like'."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'Fill in the blank: He is good ___ mathematics.', 'options' => ['in', 'at', 'on', 'with'], 'correct_index' => 1, 'explanation' => "'Good at' is the standard preposition pairing for a skill or subject."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "What does the idiom 'break the ice' mean?", 'options' => ['To start a conversation in a social setting', 'To end a relationship', 'To cause a problem', 'To destroy something'], 'correct_index' => 0, 'explanation' => "'Break the ice' means to initiate conversation and ease tension in a social setting."],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "Choose the synonym of 'Diligent':", 'options' => ['Lazy', 'Hardworking', 'Careless', 'Slow'], 'correct_index' => 1, 'explanation' => "'Diligent' means showing care and effort — closest to 'Hardworking'."],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => "Choose the antonym of 'Verbose':", 'options' => ['Wordy', 'Concise', 'Lengthy', 'Talkative'], 'correct_index' => 1, 'explanation' => "'Verbose' means using more words than needed; 'Concise' (brief and clear) is its opposite."],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'Which sentence correctly uses the past perfect tense?', 'options' => ['By the time we arrived, the movie had already started.', 'By the time we arrived, the movie has already started.', 'By the time we arrived, the movie already started.', 'By the time we arrive, the movie had already started.'], 'correct_index' => 0, 'explanation' => "The past perfect 'had already started' correctly shows an action completed before another past action."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A person who is new to a profession or activity is called:', 'options' => ['Veteran', 'Novice', 'Expert', 'Master'], 'correct_index' => 1, 'explanation' => "A 'Novice' is a person new to a field or activity."],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => "What does the idiom 'once in a blue moon' mean?", 'options' => ['Very rarely', 'Very often', 'Every month', 'Never'], 'correct_index' => 0, 'explanation' => "'Once in a blue moon' describes something that happens very rarely."],
        ];
    }

    private function situational(): array
    {
        $c = SoftSkillQuestion::CATEGORY_SITUATIONAL;

        return [
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'You notice a colleague taking credit for your work in a team meeting. What is the most professional response?', 'options' => ['Publicly confront them during the meeting', "Privately discuss the issue with them afterward, and clarify your contribution to your manager if needed", 'Ignore it and let it go', 'Complain to other colleagues about them'], 'correct_index' => 1, 'explanation' => 'Addressing it privately and professionally, while ensuring accurate credit with your manager, resolves the issue without unnecessary conflict.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'You are given a task with an unrealistic deadline. What should you do first?', 'options' => ['Silently work overtime without telling anyone', 'Communicate with your manager about the timeline and discuss possible solutions', 'Refuse to do the task', 'Do a rushed, incomplete job'], 'correct_index' => 1, 'explanation' => 'Proactive communication about a genuinely unrealistic deadline is the professional first step, before overworking or under-delivering.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'A team member consistently misses deadlines, affecting your work. What is the best approach?', 'options' => ['Complain about them to other teammates', 'Have a direct, respectful conversation with them to understand the issue', 'Report them to HR immediately without talking to them', 'Redo their work yourself without saying anything'], 'correct_index' => 1, 'explanation' => 'A direct, respectful conversation addresses the root cause and preserves the working relationship, before escalating.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => "During a meeting, you strongly disagree with your manager's decision. What is the most appropriate way to express this?", 'options' => ['Argue loudly in front of the team', 'Stay silent and comply even if you think it is wrong', 'Respectfully share your perspective, ideally in a private follow-up if the meeting is not the right setting', "Ignore the decision and do it your own way"], 'correct_index' => 2, 'explanation' => 'Respectfully raising concerns, especially privately if needed, is constructive; staying silent or acting unilaterally are both unprofessional extremes.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'You made a mistake that affected a client deliverable. What should you do?', 'options' => ['Hide the mistake and hope no one notices', 'Blame a teammate', 'Inform your manager promptly, take responsibility, and propose a fix', 'Wait for the client to notice and complain'], 'correct_index' => 2, 'explanation' => 'Prompt transparency and ownership, paired with a proposed fix, is the professional standard for handling mistakes.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'A new team member seems overwhelmed and hesitant to ask for help. What is the best thing to do?', 'options' => ['Ignore them, it is not your responsibility', 'Proactively offer support and make them feel comfortable asking questions', 'Report them as underperforming', 'Wait for the manager to intervene'], 'correct_index' => 1, 'explanation' => 'Proactively offering support builds trust and helps a new team member ramp up faster.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'You receive constructive criticism about your work that you do not fully agree with. What is the best response?', 'options' => ['Get defensive and dismiss the feedback', 'Listen carefully, ask clarifying questions, and reflect before responding', 'Ignore the feedback completely', 'Argue immediately without listening fully'], 'correct_index' => 1, 'explanation' => 'Listening and reflecting before responding shows maturity, even when you ultimately disagree.'],
            ['category' => $c, 'difficulty' => 'hard', 'question_text' => 'Your team is behind schedule on a project due to unclear requirements from a client. What is the most effective action?', 'options' => ['Wait silently for the client to clarify on their own', 'Guess the requirements and proceed without confirmation', 'Proactively reach out to the client to clarify requirements as soon as possible', 'Blame the client for the delay'], 'correct_index' => 2, 'explanation' => 'Proactively seeking clarification prevents wasted work and keeps the project moving.'],
            ['category' => $c, 'difficulty' => 'easy', 'question_text' => 'You are asked to work on a task outside your usual role during a busy period. What is the most professional attitude?', 'options' => ['Refuse outright, citing it is not your job', 'Approach it with a willingness to help, while communicating your current workload if it is a concern', 'Complain to colleagues about being overworked', 'Do it half-heartedly'], 'correct_index' => 1, 'explanation' => 'A flexible, communicative attitude balances helpfulness with honesty about capacity.'],
            ['category' => $c, 'difficulty' => 'medium', 'question_text' => 'You overhear two colleagues gossiping negatively about a team member. What is the best way to handle this?', 'options' => ['Join in the conversation', 'Politely steer the conversation away or excuse yourself, and avoid spreading it further', 'Repeat what you heard to the person being discussed, in front of others', 'Report both colleagues to HR without any context'], 'correct_index' => 1, 'explanation' => 'Disengaging from workplace gossip without escalating it is the professional response.'],
        ];
    }
}
