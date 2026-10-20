// A new question every day, picked by date from this list, so there is nothing to maintain.
// (Add more any time; the rotation just gets longer.)
const QUESTIONS = [
  "Worst excuse you ever used to skip class?",
  "What's something you pretend to understand in lectures?",
  "Who's the most underrated lecturer or teaching assistant on campus?",
  "What's the dumbest way you've lost money on campus?",
  "What's a secret talent nobody at school knows you have?",
  "Best thing you've ever eaten on campus?",
  "What's your most embarrassing moment in a lecture hall?",
  "What did you think university would be like, versus what it actually is?",
  "What's the worst group project role you've been stuck with?",
  "What would you tell yourself on your first day here?",
  "What's one thing you're secretly proud of this semester?",
  "What's the strangest place you've fallen asleep on campus?",
  "What do you always say you'll do tomorrow but never do?",
  "What's your go-to survival meal when money is finished?",
  "Which campus rule do you think nobody actually follows?",
  "What's the best advice a senior ever gave you?",
  "What's a small thing that made your week better?",
  "What's your most unpopular opinion about campus life?",
  "What's the worst thing that happened to you during exams?",
  "Who or what are you grateful for this semester?",
  "What's something you wish you'd started earlier?",
  "What's the funniest thing you've overheard on campus?",
  "What's a habit you're trying to break?",
  "What's the worst advice you've ever followed?",
  "If you could change one thing about your course, what would it be?",
  "What's your guilty pleasure that you'd never admit to your classmates?",
  "What's the bravest thing you've done at school?",
  "What do you miss most about before you started university?",
  "What's the one subject you'd happily never see again?",
  "What's something you learned the hard way this year?",
  "What's a tiny win you didn't tell anyone about?",
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Based on the UTC date, which is Ghana's local date (Ghana is on GMT all year).
export function questionOfTheDay(now: number = Date.now()): string {
  return QUESTIONS[Math.floor(now / DAY_MS) % QUESTIONS.length];
}

// Short sentence starters for someone who doesn't know what to write.
export const STARTERS = [
  "I secretly…",
  "Nobody knows that I…",
  "I still can't believe I…",
  "The truth is…",
  "I've never told anyone that…",
  "My biggest regret this semester is…",
];
