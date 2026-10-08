<?php

namespace Database\Seeders;

use App\Models\ListeningLesson;
use App\Support\ListeningScript;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * The Listening Lab library: passages, conversations and dictations, graded
 * beginner -> advanced and themed around what a placement-season student
 * actually has to listen to — campus announcements, HR and technical
 * interviews, recruiter calls, stand-ups and client calls.
 *
 * Every lesson is read aloud client-side one sentence at a time (browser
 * text-to-speech), so the text is written for the ear: no abbreviations with
 * full stops (they would break the sentence split), numbers as words.
 *
 * Each question carries the SKILL it trains and an `evidence_quote` — a short
 * exact phrase from the script that contains the answer. The quote is resolved
 * to a sentence index here (ListeningScript::locate) and stored as `evidence`,
 * which the result screen uses to highlight "the answer was here". A quote
 * that is missing or matches more than one sentence aborts the seed rather
 * than shipping a wrong highlight, and ListeningLessonSeederTest runs this
 * over the whole library so a content typo fails CI.
 *
 * Idempotent: updateOrCreate by title within the shared library, so re-running
 * after an edit updates the lesson in place and never touches a student's own
 * generated lessons or their attempts.
 */
class ListeningLessonSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->lessons() as $order => $lesson) {
            ListeningLesson::updateOrCreate(
                ['title' => $lesson['title'], 'source' => ListeningLesson::SOURCE_LIBRARY],
                [
                    'user_id' => null,
                    'passage_text' => $lesson['passage_text'],
                    'category' => $lesson['category'],
                    'difficulty' => $lesson['difficulty'],
                    'format' => $lesson['format'],
                    'interest' => null,
                    'questions' => $lesson['questions'],
                    'speakers' => $lesson['speakers'],
                    'script' => $lesson['script'],
                    'is_active' => true,
                    'display_order' => $order,
                ]
            );
        }
    }

    /**
     * The fully-resolved library, exposed so a test can validate every lesson
     * without touching a database.
     *
     * @return list<array<string,mixed>>
     */
    public function lessons(): array
    {
        $B = ListeningLesson::DIFFICULTY_BEGINNER;
        $I = ListeningLesson::DIFFICULTY_INTERMEDIATE;
        $A = ListeningLesson::DIFFICULTY_ADVANCED;

        return [
            // ───────────────────────────── Beginner ─────────────────────────────
            $this->passage('Campus Orientation Day', 'Campus Life', $B,
                'Every new student at the college attends an orientation day before classes begin. The event starts at nine in the morning in the main auditorium, where the principal welcomes everyone. After that, students are divided into small groups of fifteen and taken on a tour of the library, the labs, and the sports ground. The day ends with a lunch in the cafeteria, where students can meet their classmates and ask senior students questions about college life.',
                [
                    $this->q('What time does orientation day start?', ['Seven in the morning', 'Nine in the morning', 'Noon', 'Two in the afternoon'], 1, 'numbers', 'starts at nine in the morning', 'The passage says the event starts at nine in the morning.'),
                    $this->q('How many students are in each tour group?', ['Ten', 'Twelve', 'Fifteen', 'Twenty'], 2, 'numbers', 'groups of fifteen', 'Students are divided into small groups of fifteen.'),
                    $this->q('Where does the day end?', ['The library', 'The sports ground', 'The auditorium', 'The cafeteria'], 3, 'detail', 'lunch in the cafeteria', 'The day ends with lunch in the cafeteria.'),
                    $this->q('What is the passage mainly about?', ['How new students are welcomed on their first day', 'How to apply for a hostel room', 'The rules of the sports ground', 'A timetable for final exams'], 0, 'main_idea', 'attends an orientation day before classes begin', 'It describes orientation day, which every new student attends before classes begin.'),
                ]),

            $this->passage("The Library's New Hours", 'Campus Life', $B,
                'Starting next month, the college library will stay open until ten at night instead of closing at six. The change was made after students asked for more time to study during exam season. The library will also open an hour earlier on Saturdays, at nine instead of ten. Students are reminded that the quiet study room on the second floor still closes at eight every evening, even though the rest of the library stays open later.',
                [
                    $this->q('What new closing time will the library have?', ['Eight at night', 'Nine at night', 'Ten at night', 'Midnight'], 2, 'numbers', 'open until ten at night', 'The library will stay open until ten at night.'),
                    $this->q('Why was the change made?', ['A new librarian was hired', 'Students asked for more study time', 'The building was renovated', 'Fewer students were visiting'], 1, 'detail', 'asked for more time to study', 'The change was made after students asked for more time to study during exam season.'),
                    $this->q('What time will the library open on Saturdays?', ['Eight', 'Nine', 'Ten', 'Eleven'], 1, 'numbers', 'at nine instead of ten', 'On Saturdays it will open an hour earlier, at nine instead of ten.'),
                    $this->q('What still closes at eight every evening?', ['The whole library', 'The main entrance', 'The quiet study room on the second floor', 'The computer lab'], 2, 'detail', 'quiet study room on the second floor', 'The quiet study room on the second floor still closes at eight, even though the rest of the library stays open later.'),
                ]),

            $this->passage('Building Good Study Habits', 'Career Readiness', $B,
                'Good study habits are built slowly, through small daily choices rather than one long session before an exam. Setting aside the same thirty minutes each day, in a quiet place without a phone nearby, trains the brain to focus faster over time. Reviewing notes shortly after a class, rather than weeks later, also makes information much easier to remember. Students who study a little every day usually feel calmer before exams than those who wait until the last few days.',
                [
                    $this->q('According to the passage, how should study habits be built?', ['Through one long session before exams', 'Slowly, through small daily choices', 'Only during exam week', 'By studying with a large group'], 1, 'main_idea', 'built slowly, through small daily choices', 'The passage says good study habits are built slowly, through small daily choices.'),
                    $this->q('How long should the daily study session be?', ['Ten minutes', 'Twenty minutes', 'Thirty minutes', 'Two hours'], 2, 'numbers', 'same thirty minutes each day', 'It recommends setting aside the same thirty minutes each day.'),
                    $this->q('What should be kept away during study time?', ['Notebooks', 'A phone', 'Water', 'A pen'], 1, 'detail', 'without a phone nearby', 'It recommends a quiet place without a phone nearby.'),
                    $this->q('When is the best time to review notes?', ['Weeks after class', 'Shortly after a class', 'The night before an exam', 'Only on weekends'], 1, 'detail', 'shortly after a class', 'Reviewing notes shortly after a class makes information much easier to remember.'),
                ]),

            $this->conversation('Asking for Directions on Campus', 'Campus Life', $B,
                [['key' => 'A', 'label' => 'Student', 'gender' => 'female'], ['key' => 'B', 'label' => 'Security Guard', 'gender' => 'male']],
                [
                    ['A', 'Excuse me, could you tell me where the placement office is?'],
                    ['B', 'Of course. It is in the administration building, on the first floor.'],
                    ['A', 'Is that the building next to the cafeteria?'],
                    ['B', 'No, that is the science block. The administration building is behind the library, near the main gate.'],
                    ['A', 'I see. And how do I get to the first floor?'],
                    ['B', 'Go through the glass doors and take the stairs on your left. The lift is out of order today.'],
                    ['A', 'Thank you. What time does the office close?'],
                    ['B', 'It closes at five, but the last interview slot starts at four thirty, so you should hurry.'],
                    ['A', 'Great, I will go right away. Thanks for your help!'],
                ],
                [
                    $this->q('Where is the placement office?', ['In the science block', 'In the administration building', 'Next to the cafeteria', 'Inside the library'], 1, 'detail', 'in the administration building, on the first floor', 'The guard says it is in the administration building, on the first floor.'),
                    $this->q('Why can the student not use the lift?', ['It is too crowded', 'It is out of order today', 'It is only for staff', 'It goes to the wrong floor'], 1, 'detail', 'The lift is out of order today', 'The guard says the lift is out of order today.'),
                    $this->q('What time does the last interview slot start?', ['Four', 'Four thirty', 'Five', 'Five thirty'], 1, 'numbers', 'last interview slot starts at four thirty', 'The last interview slot starts at four thirty.'),
                    $this->q('Which building is next to the cafeteria?', ['The library', 'The administration building', 'The science block', 'The main gate'], 2, 'inference', 'that is the science block', 'The student asks if it is the building next to the cafeteria, and the guard answers "No, that is the science block" — so the science block is the one beside it.'),
                ]),

            $this->conversation('Booking a Lab Slot', 'Campus Life', $B,
                [['key' => 'A', 'label' => 'Student', 'gender' => 'male'], ['key' => 'B', 'label' => 'Lab Assistant', 'gender' => 'female']],
                [
                    ['A', 'Hello, I would like to book a computer lab slot for tomorrow.'],
                    ['B', 'Sure. Which time would you prefer, morning or afternoon?'],
                    ['A', 'Afternoon, please. I have a class until one thirty.'],
                    ['B', 'Then I can offer you two o\'clock to four o\'clock, or four o\'clock to six o\'clock.'],
                    ['A', 'Two to four is perfect. Do I need to bring anything?'],
                    ['B', 'Please bring your student card, because the system asks for your number at the door.'],
                    ['A', 'Okay. Can I also use the printer?'],
                    ['B', 'Yes, but each student gets only ten free pages. After that, it costs one rupee per page.'],
                    ['A', 'That is fine. Thank you for your help.'],
                    ['B', 'You are welcome. Your booking is confirmed for tomorrow at two.'],
                ],
                [
                    $this->q('What is the main purpose of the conversation?', ['To report a broken computer', 'To book a computer lab slot', 'To ask about exam dates', 'To return a library book'], 1, 'main_idea', 'would like to book a computer lab slot', 'The student says at the start that he would like to book a computer lab slot.'),
                    $this->q('Why does the student choose the afternoon?', ['The lab is cheaper then', 'He has a class until one thirty', 'He wakes up late', 'The morning slots are full'], 1, 'detail', 'I have a class until one thirty', 'He explains that he has a class until one thirty.'),
                    $this->q('Which slot does the student book?', ['Ten to twelve', 'Two to four', 'Four to six', 'One thirty to three'], 1, 'numbers', 'Two to four is perfect', 'He says two to four is perfect, and the booking is confirmed for two.'),
                    $this->q('What should the student bring?', ['A laptop', 'His student card', 'A printout', 'A passport photo'], 1, 'detail', 'bring your student card', 'The assistant asks him to bring his student card.'),
                    $this->q('How many free pages does each student get?', ['Five', 'Ten', 'Twenty', 'Fifty'], 1, 'numbers', 'only ten free pages', 'Each student gets only ten free pages.'),
                ]),

            $this->passage('Placement Cell Announcement', 'Career Readiness', $B,
                'Attention, final-year students. The placement cell has scheduled a pre-placement talk for next Thursday at eleven in the morning in seminar hall two. A leading software company will explain its hiring process and answer your questions. Students must register on the placement portal before Tuesday evening, and attendance is compulsory for everyone who has registered. Please carry a printed copy of your resume and arrive fifteen minutes early. Students who arrive after the doors close at eleven will not be allowed inside.',
                [
                    $this->q('What is the announcement mainly about?', ['A campus cleaning drive', 'A pre-placement talk students should attend', 'A change in exam rules', 'A sports tournament'], 1, 'main_idea', 'scheduled a pre-placement talk', 'The placement cell has scheduled a pre-placement talk.'),
                    $this->q('When is the talk?', ['Next Tuesday at eleven', 'Next Thursday at eleven in the morning', 'This Thursday at ten', 'Next Thursday evening'], 1, 'numbers', 'next Thursday at eleven in the morning', 'It is next Thursday at eleven in the morning.'),
                    $this->q('Where will the talk be held?', ['The main auditorium', 'Seminar hall two', 'The library', 'Seminar hall one'], 1, 'detail', 'in seminar hall two', 'The talk is in seminar hall two.'),
                    $this->q('What must students do before Tuesday evening?', ['Pay a fee', 'Register on the placement portal', 'Submit their marksheets', 'Meet their teacher'], 1, 'detail', 'register on the placement portal', 'Students must register on the placement portal before Tuesday evening.'),
                    $this->q('How early should students arrive?', ['Five minutes', 'Ten minutes', 'Fifteen minutes', 'Thirty minutes'], 2, 'numbers', 'arrive fifteen minutes early', 'They should arrive fifteen minutes early.'),
                ]),

            $this->dictation('Dictation: Campus Sentences', 'Campus Life', $B, [
                'The library opens at nine every morning.',
                'Please submit your assignment before Friday.',
                'I would like to join the coding club.',
                'The canteen serves hot lunch from twelve to two.',
                'Our teacher explained the lesson very clearly.',
                'Can you tell me where the computer lab is?',
            ]),

            $this->dictation('Dictation: Introducing Yourself', 'Career Readiness', $B, [
                'Good morning, my name is Ananya Rao.',
                'I am a final-year student of computer science.',
                'I have built two small projects using Python.',
                'I enjoy solving problems and learning new things.',
                'I am looking for an opportunity to start my career.',
                'Thank you for giving me this chance.',
            ]),

            // ─────────────────────────── Intermediate ───────────────────────────
            $this->passage('Choosing a Career Path', 'Career Readiness', $I,
                'Choosing a career path can feel overwhelming, especially when there seem to be countless possible directions to take. Career counselors often suggest starting not with "what job should I choose," but with "what kind of problems do I enjoy solving." This shift in thinking helps students explore roles they might never have considered by title alone. It also helps to talk to people already working in a field of interest, since a job title rarely captures what the daily work actually involves. Trying a short internship, even an unpaid one, often reveals more in a few weeks than months of research online.',
                [
                    $this->q('What is the passage mainly about?', ['Ways to explore and choose a career', 'How to write a resume', 'Why internships are always paid', 'How to change jobs quickly'], 0, 'main_idea', 'Choosing a career path can feel overwhelming', 'It opens with how overwhelming choosing a career path can feel, then offers ways to explore.'),
                    $this->q('What do career counselors suggest starting with?', ['A list of high-paying jobs', 'What kind of problems you enjoy solving', 'Your parents\' opinion', 'The most popular career choice'], 1, 'detail', 'kind of problems do I enjoy solving', 'Counselors suggest starting with what kind of problems a student enjoys solving.'),
                    $this->q('Why should students talk to people already working in a field?', ['Because a job title rarely captures the daily work', 'Because it guarantees a job offer', 'Because online research is not allowed', 'Because it is required for graduation'], 0, 'inference', 'a job title rarely captures what the daily work', 'A job title rarely captures what the daily work actually involves.'),
                    $this->q('What does the passage say reveals more than months of online research?', ['Reading more articles', 'A short internship', 'Watching career videos', 'Taking a personality test'], 1, 'detail', 'Trying a short internship', 'A short internship, even unpaid, often reveals more in a few weeks than months of research online.'),
                ]),

            $this->passage('Remote Work Trends', 'Technology', $I,
                'Remote work, once considered a rare perk offered by a small number of companies, has become a standard option across many industries. Employees frequently report better focus and fewer daily interruptions when working from home, though many also describe feeling more isolated from their colleagues over time. In response, a growing number of companies now offer a hybrid model, asking employees to come into the office two or three days a week while working remotely the rest of the time. Surveys suggest that this middle ground, rather than either extreme, is what most employees actually prefer.',
                [
                    $this->q('What is the passage mainly about?', ['How remote work became common and what most employees prefer', 'Why offices are being closed', 'How to build a home office', 'A history of the internet'], 0, 'main_idea', 'has become a standard option across many industries', 'It describes how remote work became standard and ends with what most employees prefer.'),
                    $this->q('What do many remote employees report feeling over time?', ['More isolated from colleagues', 'Less productive', 'More interrupted', 'Less trusted by managers'], 0, 'detail', 'feeling more isolated from their colleagues', 'Many employees describe feeling more isolated from their colleagues over time.'),
                    $this->q('How many days a week do hybrid employees come to the office?', ['Every day', 'Two or three days', 'Once a month', 'Never'], 1, 'numbers', 'two or three days a week', 'Under a hybrid model employees come in two or three days a week.'),
                    $this->q('What does "hybrid model" mean here?', ['Working only from home', 'A mix of office days and remote days', 'Working for two companies', 'Working only at night'], 1, 'vocabulary', 'hybrid model, asking employees to come into the office', 'It is explained right after: some days in the office, the rest working remotely.'),
                    $this->q('What do surveys suggest most employees prefer?', ['Fully remote work', 'Fully in-office work', 'The hybrid middle ground', 'No preference at all'], 2, 'detail', 'this middle ground, rather than either extreme', 'Surveys suggest the hybrid middle ground is what most employees actually prefer.'),
                ]),

            $this->passage('The Science of Motivation', 'Professional Skills', $I,
                'Psychologists often separate motivation into two types: extrinsic, which comes from outside rewards like money or praise, and intrinsic, which comes from genuine personal interest in the task itself. Research consistently shows that intrinsic motivation produces more creative, higher-quality work over the long term, while extrinsic rewards work well for simple, repetitive tasks but can actually reduce performance on complex ones. This does not mean external rewards are useless; rather, they work best when paired with autonomy, letting people choose how they approach a task instead of dictating every step.',
                [
                    $this->q('What is intrinsic motivation, according to the passage?', ['Motivation from outside rewards', 'Motivation from genuine personal interest', 'Motivation from fear of punishment', 'Motivation that only applies to children'], 1, 'vocabulary', 'genuine personal interest in the task itself', 'Intrinsic motivation comes from genuine personal interest in the task itself.'),
                    $this->q('What does research show about extrinsic rewards on complex tasks?', ['They always improve performance', 'They can reduce performance', 'They have no effect at all', 'They only work for adults'], 1, 'detail', 'can actually reduce performance on complex ones', 'Extrinsic rewards can actually reduce performance on complex tasks.'),
                    $this->q('Which task would extrinsic rewards suit best?', ['Designing a new product', 'A simple, repetitive task', 'Writing an original story', 'Solving a complex puzzle'], 1, 'inference', 'work well for simple, repetitive tasks', 'They work well for simple, repetitive tasks but can hurt on complex ones.'),
                    $this->q('What do external rewards work best paired with?', ['Strict deadlines', 'Autonomy', 'Constant supervision', 'Public rankings'], 1, 'detail', 'paired with autonomy', 'External rewards work best when paired with autonomy.'),
                ]),

            $this->conversation('HR Round: Tell Me About Yourself', 'Interview Ready', $I,
                [['key' => 'A', 'label' => 'Interviewer', 'gender' => 'female'], ['key' => 'B', 'label' => 'Candidate', 'gender' => 'male']],
                [
                    ['A', 'Good morning, and thank you for coming in. Please start by telling me a little about yourself.'],
                    ['B', 'Good morning. My name is Karan, and I recently completed my engineering degree in information technology. During my final year, I led a team of four students to build an attendance app for our college.'],
                    ['A', 'That sounds interesting. What was the biggest challenge you faced in that project?'],
                    ['B', 'Our biggest challenge was time. We had only three months, and two of us were also preparing for exams, so I created a weekly plan and divided the work fairly.'],
                    ['A', 'And how did the app turn out?'],
                    ['B', 'It is now used by about two hundred students in our department, and the faculty have asked us to add a feature for leave requests.'],
                    ['A', 'Impressive. Why do you want to join our company?'],
                    ['B', 'I want to work on products that real people use every day, and I have read that your company gives young engineers a lot of responsibility early on.'],
                    ['A', 'Thank you. Do you have any questions for me?'],
                    ['B', 'Yes. What would my first three months in the team look like?'],
                ],
                [
                    $this->q('What did the candidate build in his final year?', ['A shopping website', 'An attendance app', 'A video game', 'A payment system'], 1, 'detail', 'build an attendance app', 'He led a team to build an attendance app for his college.'),
                    $this->q('How many students were in his team?', ['Two', 'Three', 'Four', 'Five'], 2, 'numbers', 'a team of four students', 'He led a team of four students.'),
                    $this->q('What was the biggest challenge?', ['A lack of money', 'A lack of time', 'A difficult teacher', 'A broken laptop'], 1, 'detail', 'Our biggest challenge was time', 'He says their biggest challenge was time.'),
                    $this->q('About how many students use the app now?', ['Fifty', 'One hundred', 'Two hundred', 'Two thousand'], 2, 'numbers', 'about two hundred students', 'It is used by about two hundred students in his department.'),
                    $this->q('Why does the candidate want to join the company?', ['The salary is the highest', 'To work on products people use and get early responsibility', 'His friends work there', 'The office is close to his home'], 1, 'purpose', 'products that real people use every day', 'He wants to work on products real people use daily, and has read the company gives young engineers early responsibility.'),
                ]),

            $this->conversation('Team Stand-up Meeting', 'Workplace', $I,
                [['key' => 'A', 'label' => 'Meera', 'gender' => 'female'], ['key' => 'B', 'label' => 'Rahul', 'gender' => 'male'], ['key' => 'C', 'label' => 'Sana', 'gender' => 'female']],
                [
                    ['A', 'Good morning, everyone. Let us keep this stand-up short. Rahul, you go first.'],
                    ['B', 'Yesterday I finished the login screen, and today I will start on the payment page. I am blocked on one thing, though. I still need the design files from the design team.'],
                    ['A', 'I will message them right after this meeting. Sana, what about you?'],
                    ['C', 'I tested the login screen and found two bugs. One is serious because the app crashes if the password is empty. The other is just a spelling mistake.'],
                    ['B', 'Thanks, Sana. I will fix the crash first, before lunch.'],
                    ['A', 'Good. Remember that the client demo is on Friday at three in the afternoon, so we only have four working days left.'],
                    ['C', 'I can also test the payment page as soon as it is ready, maybe by Wednesday.'],
                    ['A', 'Perfect. Let us meet again tomorrow at the same time.'],
                ],
                [
                    $this->q('What is the purpose of this meeting?', ['To plan the client\'s budget', 'To share progress and problems quickly', 'To interview a new developer', 'To celebrate a launch'], 1, 'purpose', 'Let us keep this stand-up short', 'Meera opens by saying they will keep the stand-up short — a quick check on progress and blockers.'),
                    $this->q('What is Rahul blocked on?', ['A server error', 'The design files', 'Permission from the client', 'A broken laptop'], 1, 'detail', 'need the design files from the design team', 'He still needs the design files from the design team.'),
                    $this->q('What happens when the password is empty?', ['The screen turns blank', 'The app crashes', 'A spelling mistake appears', 'The user is logged in'], 1, 'detail', 'the app crashes if the password is empty', 'Sana says the app crashes if the password is empty.'),
                    $this->q('Who will message the design team?', ['Rahul', 'Sana', 'Meera, the team lead', 'The client'], 2, 'inference', 'I will message them right after this meeting', 'Meera says "I will message them" in reply to Rahul\'s problem.'),
                    $this->q('When is the client demo?', ['Wednesday morning', 'Friday at three in the afternoon', 'Tomorrow at noon', 'Monday at nine'], 1, 'numbers', 'demo is on Friday at three in the afternoon', 'The client demo is on Friday at three in the afternoon.'),
                ]),

            $this->conversation('A Client Calls About a Delay', 'Workplace', $I,
                [['key' => 'A', 'label' => 'Client', 'gender' => 'male'], ['key' => 'B', 'label' => 'Project Manager', 'gender' => 'female']],
                [
                    ['A', 'Hello Neha, I am calling about the website. You promised to deliver it by the end of this week, but I have not received anything yet.'],
                    ['B', 'Good morning, and I am sorry for the delay. We faced a problem with the payment system, and it took us two extra days to fix it.'],
                    ['A', 'I understand, but I have already announced the launch date to my customers. It is the fifteenth of this month.'],
                    ['B', 'I appreciate that. Here is what I can do. We will send you the finished website by Monday morning, and our team will work this weekend to make sure it happens.'],
                    ['A', 'Will there be any extra cost for me?'],
                    ['B', 'No, there will be no extra cost. In fact, we would like to offer you one free month of support to make up for the inconvenience.'],
                    ['A', 'That is very kind. Please send me a short written update by this evening.'],
                    ['B', 'Certainly. I will email it to you before five o\'clock today.'],
                ],
                [
                    $this->q('Why is the client calling?', ['To cancel the project', 'Because the website has not been delivered', 'To ask for a discount', 'To praise the team'], 1, 'purpose', 'I am calling about the website', 'He is calling because the promised website has not arrived.'),
                    $this->q('What caused the delay?', ['A power cut', 'A problem with the payment system', 'A missing designer', 'A change in the contract'], 1, 'detail', 'problem with the payment system', 'The manager says they faced a problem with the payment system.'),
                    $this->q('When will the website be delivered?', ['Today evening', 'Monday morning', 'The fifteenth', 'Next month'], 1, 'numbers', 'finished website by Monday morning', 'They will send the finished website by Monday morning.'),
                    $this->q('What does the manager offer to make up for the delay?', ['A refund', 'One free month of support', 'A new logo', 'A faster server'], 1, 'detail', 'one free month of support', 'She offers one free month of support.'),
                    $this->q('How does the client feel at the end of the call?', ['Still very angry', 'Satisfied with the offer', 'Confused about the plan', 'Ready to cancel'], 1, 'inference', 'That is very kind', 'He says "That is very kind," which shows he is pleased with the offer.'),
                ]),

            $this->conversation('Offer Letter Call from HR', 'Career Readiness', $I,
                [['key' => 'A', 'label' => 'HR Executive', 'gender' => 'female'], ['key' => 'B', 'label' => 'Candidate', 'gender' => 'male']],
                [
                    ['A', 'Hello Rohan, this is Priya from the human resources team. I have good news for you.'],
                    ['B', 'Hello, Priya. Thank you for calling. I hope it is good news.'],
                    ['A', 'It is. We would like to offer you the position of software engineer. Your annual package will be six lakh fifty thousand rupees.'],
                    ['B', 'That is wonderful. Thank you so much. When would I need to join?'],
                    ['A', 'Your joining date is the first of next month, and you will report to our Pune office at nine thirty in the morning.'],
                    ['B', 'Understood. Is there anything I need to submit before that?'],
                    ['A', 'Yes. Please email your educational certificates and a copy of your identity card by this Friday. You will also receive the offer letter by email today.'],
                    ['B', 'I will send everything by Thursday evening. Thank you again.'],
                    ['A', 'Congratulations, Rohan, and welcome to the team.'],
                ],
                [
                    $this->q('What position is Rohan offered?', ['Software engineer', 'Project manager', 'Data analyst', 'Intern'], 0, 'detail', 'position of software engineer', 'She offers him the position of software engineer.'),
                    $this->q('What is his annual package?', ['Five lakh rupees', 'Six lakh fifty thousand rupees', 'Six lakh five thousand rupees', 'Seven lakh fifty thousand rupees'], 1, 'numbers', 'six lakh fifty thousand rupees', 'The annual package is six lakh fifty thousand rupees.'),
                    $this->q('On what date will he join?', ['This Friday', 'The first of next month', 'The fifteenth', 'Next week'], 1, 'numbers', 'joining date is the first of next month', 'His joining date is the first of next month.'),
                    $this->q('Where will he report on his first day?', ['The Pune office', 'The Mumbai office', 'A client site', 'He will work from home'], 0, 'detail', 'report to our Pune office', 'He will report to the Pune office at nine thirty in the morning.'),
                    $this->q('What must he email by this Friday?', ['His bank details', 'His educational certificates and identity card copy', 'A signed contract', 'A photograph'], 1, 'detail', 'email your educational certificates', 'He must email his educational certificates and a copy of his identity card.'),
                ]),

            $this->passage('Voicemail from a Recruiter', 'Interview Ready', $I,
                'Hello, this message is for Aditi Nair. My name is Sunil Mehta, and I am a recruiter at Brightway Technologies. I am calling about your application for the junior analyst role. We were impressed by your resume and would like to invite you for a video interview on Wednesday at three thirty in the afternoon. The interview will last about forty five minutes, and you will meet two members of our analytics team. Please confirm your availability by replying to the email I sent this morning. If that time does not suit you, call me back on the number in the email, and we will find another slot. I look forward to speaking with you.',
                [
                    $this->q('Why is the recruiter calling?', ['To reject her application', 'To invite her for an interview', 'To offer her a job', 'To ask for her references'], 1, 'purpose', 'would like to invite you for a video interview', 'He is inviting her for a video interview.'),
                    $this->q('Which role did Aditi apply for?', ['Junior analyst', 'Software tester', 'Sales executive', 'Project manager'], 0, 'detail', 'application for the junior analyst role', 'She applied for the junior analyst role.'),
                    $this->q('When is the interview?', ['Wednesday at three thirty in the afternoon', 'Wednesday at thirteen thirty', 'Thursday at three thirty', 'Friday morning'], 0, 'numbers', 'on Wednesday at three thirty in the afternoon', 'The interview is on Wednesday at three thirty in the afternoon.'),
                    $this->q('How long will the interview last?', ['About fifteen minutes', 'About thirty minutes', 'About forty five minutes', 'About two hours'], 2, 'numbers', 'about forty five minutes', 'It will last about forty five minutes.'),
                    $this->q('How should Aditi confirm her availability?', ['By replying to the email', 'By visiting the office', 'By sending a text message', 'By calling the college'], 0, 'detail', 'replying to the email I sent this morning', 'She should confirm by replying to the email he sent this morning.'),
                ]),

            $this->dictation('Dictation: Workplace Phrases', 'Workplace', $I, [
                'Could you please share the report by the end of the day?',
                'I will follow up with the client tomorrow morning.',
                'We need to discuss the project timeline in today\'s meeting.',
                'Thank you for your feedback; I will work on it immediately.',
                'The deadline has been extended until the end of the month.',
                'Please let me know if you have any questions.',
            ]),

            // ───────────────────────────── Advanced ─────────────────────────────
            $this->passage('The Rise of Renewable Energy', 'Technology', $A,
                'The cost of generating electricity from solar and wind power has fallen so dramatically over the past decade that, in most regions, renewable energy is now cheaper than building new coal or gas power plants. This shift has less to do with environmental policy and more to do with straightforward economics, as manufacturing efficiency and competition among suppliers have driven prices down far faster than early forecasts predicted. The remaining challenge is not generation but storage: because the sun does not always shine and the wind does not always blow, large-scale battery technology remains the critical bottleneck standing between current renewable capacity and a fully reliable, round-the-clock power grid.',
                [
                    $this->q('What does the passage say is now cheaper than new coal or gas plants in most regions?', ['Nuclear power', 'Renewable energy', 'Imported oil', 'Natural gas storage'], 1, 'detail', 'renewable energy is now cheaper than building new coal or gas', 'Renewable energy is now cheaper than building new coal or gas power plants in most regions.'),
                    $this->q('What does the passage credit for driving renewable prices down?', ['Government bans on fossil fuels', 'Manufacturing efficiency and competition among suppliers', 'A sudden drop in electricity demand', 'International trade tariffs'], 1, 'detail', 'manufacturing efficiency and competition among suppliers', 'Manufacturing efficiency and competition among suppliers drove prices down.'),
                    $this->q('What does the passage identify as the critical remaining bottleneck?', ['Solar panel manufacturing', 'Large-scale battery storage technology', 'Public support for renewables', 'Wind turbine design'], 1, 'detail', 'large-scale battery technology remains the critical bottleneck', 'Large-scale battery technology remains the critical bottleneck for a fully reliable grid.'),
                    $this->q('Which statement would the speaker most likely agree with?', ['Policy alone made renewables cheap', 'Renewable energy is cheap but still needs better storage', 'Coal is now the cheapest option', 'Wind power does not work in most regions'], 1, 'inference', 'not generation but storage', 'The speaker says the remaining challenge is storage, not generation.'),
                    $this->q('What does "bottleneck" mean here?', ['A point that limits overall progress', 'A type of battery', 'A cheap energy source', 'A government policy'], 0, 'vocabulary', 'critical bottleneck standing between', 'It is the one limit standing between today\'s capacity and a reliable round-the-clock grid.'),
                ]),

            $this->passage('Negotiating a Job Offer', 'Career Readiness', $A,
                'Many candidates accept the first salary figure offered simply because negotiation feels uncomfortable, yet most recruiters expect some back-and-forth and rarely withdraw an offer over a reasonable counter. The key is framing the conversation around market value and demonstrated impact rather than personal financial need, since the latter, however genuine, carries little weight in a business decision. It also helps to negotiate the entire package rather than fixating on base salary alone, since benefits like signing bonuses, additional leave, or flexible working arrangements can sometimes be adjusted even when the base figure genuinely cannot move.',
                [
                    $this->q('Why do many candidates accept the first salary offered, according to the passage?', ['Because negotiation feels uncomfortable', 'Because the first offer is always the best', 'Because recruiters forbid negotiation', 'Because it is illegal to negotiate'], 0, 'detail', 'simply because negotiation feels uncomfortable', 'Many candidates accept the first figure simply because negotiation feels uncomfortable.'),
                    $this->q('What should the negotiation conversation be framed around?', ['Personal financial need', 'Market value and demonstrated impact', 'How long the process has taken', 'Comparisons with coworkers\' salaries'], 1, 'detail', 'around market value and demonstrated impact', 'The key is framing the conversation around market value and demonstrated impact.'),
                    $this->q('What can sometimes be adjusted even when base salary cannot move?', ['The job title', 'Signing bonuses, leave, or flexible arrangements', 'The company\'s ownership structure', 'The interview process itself'], 1, 'detail', 'signing bonuses, additional leave', 'Benefits like signing bonuses, additional leave, or flexible working arrangements can sometimes be adjusted.'),
                    $this->q('Why do recruiters rarely withdraw an offer after a reasonable counter?', ['They expect some back-and-forth', 'They have no other candidates', 'It is against company law', 'They dislike the first figure'], 0, 'inference', 'most recruiters expect some back-and-forth', 'Most recruiters expect some back-and-forth, so a reasonable counter does not scare them off.'),
                    $this->q('What does "negotiate the entire package" mean?', ['Discuss benefits as well as base salary', 'Ask for the highest salary only', 'Negotiate with every recruiter', 'Accept the first offer'], 0, 'vocabulary', 'negotiate the entire package rather than fixating on base salary alone', 'It means discussing benefits like bonuses and leave, not only the base salary.'),
                ]),

            $this->conversation('Technical Interview: Explaining a Project', 'Interview Ready', $A,
                [['key' => 'A', 'label' => 'Interviewer', 'gender' => 'male'], ['key' => 'B', 'label' => 'Candidate', 'gender' => 'female']],
                [
                    ['A', 'Thank you for joining us today. I would like to begin with your capstone project. Could you walk me through the architecture?'],
                    ['B', 'Certainly. We built a ride-sharing platform with a mobile app, a backend API and a matching service. The matching service pairs riders with the nearest available driver using a priority queue.'],
                    ['A', 'Interesting. Why did you choose a priority queue instead of simply scanning all drivers?'],
                    ['B', 'Scanning every driver became slow once we simulated ten thousand drivers. The priority queue reduced the average matching time from eight hundred milliseconds to about one hundred and twenty.'],
                    ['A', 'That is a significant improvement. Did you face any trade-offs?'],
                    ['B', 'Yes. The queue needed constant updates as drivers moved, so we limited location updates to once every five seconds. That saved resources, but it meant matches were sometimes slightly out of date.'],
                    ['A', 'How would you improve that if you had more time?'],
                    ['B', 'I would use a spatial index so that nearby drivers can be found without updating the whole queue, and I would add monitoring to measure how stale the data really is.'],
                ],
                [
                    $this->q('What did the candidate\'s project do?', ['Delivered food orders', 'Matched riders with drivers', 'Sold movie tickets', 'Tracked student attendance'], 1, 'detail', 'built a ride-sharing platform', 'They built a ride-sharing platform with a matching service.'),
                    $this->q('Why did the team use a priority queue?', ['Scanning every driver became too slow', 'It was easier to explain', 'The interviewer asked for it', 'It used less memory'], 0, 'inference', 'Scanning every driver became slow', 'Scanning every driver became slow once they simulated ten thousand drivers.'),
                    $this->q('How did the average matching time change?', ['From eight hundred milliseconds to about one hundred and twenty', 'From one hundred and twenty to eight hundred', 'From ten seconds to five seconds', 'It did not change'], 0, 'numbers', 'from eight hundred milliseconds to about one hundred and twenty', 'It dropped from eight hundred milliseconds to about one hundred and twenty.'),
                    $this->q('What was the trade-off of limiting location updates?', ['Higher server costs', 'Matches could be slightly out of date', 'Drivers earned less', 'The app used more battery'], 1, 'detail', 'matches were sometimes slightly out of date', 'Matches were sometimes slightly out of date.'),
                    $this->q('How often were location updates sent?', ['Every second', 'Once every five seconds', 'Once a minute', 'Only when the driver stopped'], 1, 'numbers', 'once every five seconds', 'They limited location updates to once every five seconds.'),
                    $this->q('How would the candidate improve the system?', ['Use a spatial index and add monitoring', 'Rewrite the app in another language', 'Hire more drivers', 'Remove the priority queue'], 0, 'detail', 'I would use a spatial index', 'She would use a spatial index and add monitoring.'),
                ]),

            $this->conversation('Project Retrospective Meeting', 'Workplace', $A,
                [['key' => 'A', 'label' => 'Maya', 'gender' => 'female'], ['key' => 'B', 'label' => 'Rahul', 'gender' => 'male'], ['key' => 'C', 'label' => 'Vikram', 'gender' => 'male']],
                [
                    ['A', 'Welcome, everyone, to our sprint retrospective. Let us talk about what went well, what did not, and what we should change.'],
                    ['B', 'I think our code reviews improved a lot. Pull requests were merged within a day on average, compared with three days last sprint.'],
                    ['C', 'I agree, but I am concerned about the requirements. Twice this sprint we changed the scope after work had started, and that caused rework.'],
                    ['A', 'That is a fair point. Rahul, how much time did the rework cost the team?'],
                    ['B', 'Roughly twenty hours across the sprint, which is about ten percent of our capacity.'],
                    ['C', 'I accept responsibility for that. In future I will freeze the scope at the start of each sprint, except for critical bugs.'],
                    ['A', 'Excellent. Then our action items are these. First, keep the one-day review target. Second, freeze the scope at sprint start. Third, hold a short planning check on the second day.'],
                    ['B', 'Sounds good. I would also like to add automated tests for the payment module, because it broke twice this sprint.'],
                    ['A', 'Agreed. I will add that as the fourth action item.'],
                ],
                [
                    $this->q('What is the main purpose of the meeting?', ['To hire a new engineer', 'To review the sprint and agree improvements', 'To present the product to a client', 'To plan the next holiday'], 1, 'main_idea', 'to our sprint retrospective', 'Maya opens the sprint retrospective to discuss what went well, what did not and what to change.'),
                    $this->q('How long did pull requests take to merge on average this sprint?', ['Within a day', 'Three days', 'A week', 'Two hours'], 0, 'numbers', 'merged within a day on average', 'Pull requests were merged within a day on average, compared with three days before.'),
                    $this->q('Why is Vikram concerned?', ['The scope changed after work had started', 'The team is too small', 'The tests are failing', 'The deadline was moved earlier'], 0, 'detail', 'changed the scope after work had started', 'Twice this sprint the scope changed after work had started, causing rework.'),
                    $this->q('How much time did the rework cost?', ['Roughly twenty hours', 'Two hours', 'Roughly two hundred hours', 'A full month'], 0, 'numbers', 'Roughly twenty hours across the sprint', 'Rahul says roughly twenty hours across the sprint.'),
                    $this->q('What will Vikram do in future?', ['Freeze the scope at the start of each sprint', 'Write all the tests himself', 'Skip the retrospective', 'Change the scope every week'], 0, 'detail', 'freeze the scope at the start of each sprint', 'He will freeze the scope at the start of each sprint, except for critical bugs.'),
                    $this->q('Why does Rahul want automated tests for the payment module?', ['It broke twice this sprint', 'It is the biggest module', 'The client asked for them', 'He enjoys writing tests'], 0, 'detail', 'it broke twice this sprint', 'He explains that the payment module broke twice this sprint.'),
                ]),

            $this->passage('Product Launch Briefing', 'Professional Skills', $A,
                'Good afternoon, team. As you know, we launch the new budgeting app next Tuesday, so I want to walk you through what each department needs to do. The marketing team will begin the social media campaign on Saturday, and it must avoid promising features that are not ready yet, because last year such promises led to many complaints. Engineering will freeze all code on Monday at noon; after that, only fixes for serious problems will be accepted. The support team will receive a short training session on Monday afternoon so that they can answer the most common questions confidently. Finally, remember that early reviews matter enormously, so we will ask the first five hundred users for honest feedback within the first week. If we handle this launch carefully, we will build trust that lasts far beyond the first month.',
                [
                    $this->q('What is the speaker\'s main purpose?', ['To explain what each department must do for the launch', 'To announce a new office', 'To introduce a new manager', 'To report last year\'s profits'], 0, 'main_idea', 'walk you through what each department needs to do', 'The speaker walks the team through what each department needs to do for the launch.'),
                    $this->q('When does engineering freeze the code?', ['Saturday morning', 'Monday at noon', 'Tuesday evening', 'Friday at five'], 1, 'numbers', 'freeze all code on Monday at noon', 'Engineering freezes all code on Monday at noon.'),
                    $this->q('What does "freeze all code" mean here?', ['Delete the old code', 'Stop making non-critical changes', 'Move the code to a new server', 'Share the code with customers'], 1, 'vocabulary', 'freeze all code on Monday at noon', 'After the freeze, only fixes for serious problems are accepted — so no other changes.'),
                    $this->q('Why must marketing avoid promising unfinished features?', ['Last year such promises led to many complaints', 'The campaign has no budget', 'Engineering asked them not to', 'Customers dislike social media'], 0, 'detail', 'last year such promises led to many complaints', 'Last year such promises led to many complaints.'),
                    $this->q('What will the support team receive on Monday afternoon?', ['New laptops', 'A short training session', 'A list of customers', 'A salary bonus'], 1, 'detail', 'short training session on Monday afternoon', 'They will receive a short training session.'),
                    $this->q('Why will the company ask early users for feedback?', ['Early reviews strongly shape how people see the product', 'Feedback is required by law', 'The first users are employees', 'It saves marketing costs'], 0, 'inference', 'early reviews matter enormously', 'The speaker says early reviews matter enormously.'),
                ]),

            $this->dictation('Dictation: Professional Sentences', 'Professional Skills', $A, [
                'The quarterly review highlighted a significant improvement in customer satisfaction.',
                'Our team has successfully migrated the database without any downtime.',
                'I would appreciate your guidance on how to prioritise these competing tasks.',
                'Please find the revised proposal attached for your consideration.',
                'Effective communication is essential when collaborating across different time zones.',
                'We are committed to delivering high quality solutions within the agreed schedule.',
            ]),

            $this->conversation('Panel Discussion: AI in Hiring', 'Technology', $A,
                [['key' => 'A', 'label' => 'Anita', 'gender' => 'female'], ['key' => 'B', 'label' => 'Sameer', 'gender' => 'male'], ['key' => 'C', 'label' => 'Meena', 'gender' => 'female']],
                [
                    ['A', 'Welcome to today\'s panel. Our topic is whether artificial intelligence should be used to screen job applicants. Sameer, you work in recruitment, so let us start with you.'],
                    ['B', 'From my experience, it saves a huge amount of time. We receive about two thousand applications for each graduate role, and no team can read them all carefully.'],
                    ['C', 'That is true, but I worry about fairness. If a system learns from past hiring decisions, it may repeat old biases, for example by favouring candidates from certain colleges.'],
                    ['B', 'That risk is real, which is why we never let the software make the final decision. A human always reviews the shortlist.'],
                    ['C', 'Reviewing is good, but people often trust the machine too much. I would suggest regular audits, where independent experts test whether the system treats different groups equally.'],
                    ['A', 'Let me ask both of you a final question. What advice would you give to students applying for jobs today?'],
                    ['B', 'Keep your resume clear and honest, and use the exact skills mentioned in the job description.'],
                    ['C', 'And be ready to explain your projects in your own words, because that is something no software can do for you.'],
                ],
                [
                    $this->q('How many applications does the recruiter\'s company receive for each graduate role?', ['About two hundred', 'About two thousand', 'About twenty thousand', 'About fifty'], 1, 'numbers', 'about two thousand applications', 'Sameer says they receive about two thousand applications for each graduate role.'),
                    $this->q('What is the professor\'s main concern about using AI to screen applicants?', ['It costs too much', 'Fairness — it may repeat old biases', 'It is too slow', 'Students dislike it'], 1, 'detail', 'I worry about fairness', 'Meena says she worries about fairness.'),
                    $this->q('What does "biases" mean in this discussion?', ['Unfair preferences for some groups over others', 'Small technical errors', 'Fast decisions', 'Computer settings'], 0, 'vocabulary', 'it may repeat old biases', 'Biases are unfair preferences, such as favouring candidates from certain colleges.'),
                    $this->q('Why does the recruiter say the software never makes the final decision?', ['A human always reviews the shortlist', 'The software is too expensive', 'It is not allowed by the college', 'It makes too many errors'], 0, 'detail', 'never let the software make the final decision', 'A human always reviews the shortlist.'),
                    $this->q('What does the professor think about people trusting the machine?', ['They often trust it too much', 'They never trust it', 'They understand it very well', 'They should trust it fully'], 0, 'inference', 'people often trust the machine too much', 'She says people often trust the machine too much, which is why she suggests regular audits.'),
                    $this->q('What does the professor suggest to keep the system fair?', ['Regular audits by independent experts', 'Using more data from one college', 'Removing humans from the process', 'Shorter job descriptions'], 0, 'detail', 'regular audits', 'She suggests regular audits where independent experts test whether it treats groups equally.'),
                ]),
        ];
    }

    /**
     * @param  list<array<string,mixed>>  $questions
     * @return array<string,mixed>
     */
    private function passage(string $title, string $category, string $difficulty, string $text, array $questions): array
    {
        $sentences = ListeningScript::sentences($text, null);

        return [
            'title' => $title,
            'category' => $category,
            'difficulty' => $difficulty,
            'format' => ListeningLesson::FORMAT_COMPREHENSION,
            'passage_text' => $text,
            'speakers' => null,
            'script' => null,
            'questions' => $this->resolveQuestions($title, $sentences, $questions),
        ];
    }

    /**
     * @param  list<array{key:string,label:string,gender:string}>  $speakers
     * @param  list<array{0:string,1:string}>  $turns  [speaker key, text]
     * @param  list<array<string,mixed>>  $questions
     * @return array<string,mixed>
     */
    private function conversation(string $title, string $category, string $difficulty, array $speakers, array $turns, array $questions): array
    {
        $script = array_map(fn (array $t) => ['speaker' => $t[0], 'text' => $t[1]], $turns);
        $known = array_column($speakers, 'key');
        foreach ($script as $turn) {
            if (! in_array($turn['speaker'], $known, true)) {
                throw new RuntimeException("Listening lesson '{$title}': a turn is spoken by unknown speaker '{$turn['speaker']}'.");
            }
        }

        $passage = ListeningScript::flatten($script);

        return [
            'title' => $title,
            'category' => $category,
            'difficulty' => $difficulty,
            'format' => ListeningLesson::FORMAT_CONVERSATION,
            'passage_text' => $passage,
            'speakers' => $speakers,
            'script' => $script,
            'questions' => $this->resolveQuestions($title, ListeningScript::sentences($passage, $script), $questions),
        ];
    }

    /**
     * @param  list<string>  $sentences  one dictation item each
     * @return array<string,mixed>
     */
    private function dictation(string $title, string $category, string $difficulty, array $sentences): array
    {
        $passage = implode(' ', $sentences);

        // Each item must survive the shared split as exactly one sentence, or the
        // student would be asked to type half of one.
        if (count(ListeningScript::sentences($passage, null)) !== count($sentences)) {
            throw new RuntimeException("Listening lesson '{$title}': a dictation item does not split into exactly one sentence.");
        }

        return [
            'title' => $title,
            'category' => $category,
            'difficulty' => $difficulty,
            'format' => ListeningLesson::FORMAT_DICTATION,
            'passage_text' => $passage,
            'speakers' => null,
            'script' => null,
            'questions' => [],
        ];
    }

    /** @return array{question:string,options:list<string>,correct_index:int,skill:string,evidence_quote:string,explanation:string} */
    private function q(string $question, array $options, int $correctIndex, string $skill, string $evidenceQuote, string $explanation): array
    {
        return [
            'question' => $question,
            'options' => $options,
            'correct_index' => $correctIndex,
            'skill' => $skill,
            'evidence_quote' => $evidenceQuote,
            'explanation' => $explanation,
        ];
    }

    /**
     * Spreads the correct answer across all four positions, so a student can't
     * learn that "the answer is usually B". The order is derived from the text
     * itself (not a random generator), so re-seeding never reshuffles a lesson
     * under a student. Numeric choices (times, amounts, counts) keep the
     * natural order they were written in — shuffling "Four, Four thirty, Five"
     * would only make the question harder to read, not harder to answer.
     *
     * @param  list<string>  $options
     * @return array{0: list<string>, 1: int}
     */
    private function balancePosition(string $title, int $n, array $options, int $correctIndex, string $skill): array
    {
        if ($skill === ListeningLesson::SKILL_NUMBERS) {
            return [$options, $correctIndex];
        }

        $keyed = [];
        foreach ($options as $i => $option) {
            $keyed[] = ['i' => $i, 'text' => $option, 'rank' => crc32("{$title}|{$n}|{$option}")];
        }
        usort($keyed, fn (array $a, array $b) => $a['rank'] <=> $b['rank']);

        $shuffled = array_column($keyed, 'text');
        $newCorrect = (int) array_search($correctIndex, array_column($keyed, 'i'), true);

        return [$shuffled, $newCorrect];
    }

    /**
     * Validates each question and turns its evidence quote into a sentence
     * index. Throws on anything a student would experience as a wrong lesson.
     *
     * @param  list<array{index:int,text:string,speaker:?string}>  $sentences
     * @param  list<array<string,mixed>>  $questions
     * @return list<array<string,mixed>>
     */
    private function resolveQuestions(string $title, array $sentences, array $questions): array
    {
        $resolved = [];

        foreach ($questions as $n => $q) {
            $label = "Listening lesson '{$title}', question ".($n + 1);

            if (count($q['options']) !== 4 || count(array_unique($q['options'])) !== 4) {
                throw new RuntimeException("{$label}: needs exactly four distinct options.");
            }
            if ($q['correct_index'] < 0 || $q['correct_index'] > 3) {
                throw new RuntimeException("{$label}: correct_index must be 0-3.");
            }
            if (! in_array($q['skill'], ListeningLesson::QUESTION_SKILLS, true)) {
                throw new RuntimeException("{$label}: unknown skill '{$q['skill']}'.");
            }

            $evidence = ListeningScript::locate($sentences, $q['evidence_quote']);
            if ($evidence === null) {
                throw new RuntimeException("{$label}: evidence quote \"{$q['evidence_quote']}\" is missing from the script or matches more than one sentence.");
            }

            [$options, $correctIndex] = $this->balancePosition($title, $n, $q['options'], $q['correct_index'], $q['skill']);

            $resolved[] = [
                'question' => $q['question'],
                'options' => $options,
                'correct_index' => $correctIndex,
                'skill' => $q['skill'],
                'evidence' => $evidence,
                'explanation' => $q['explanation'],
            ];
        }

        return $resolved;
    }
}
