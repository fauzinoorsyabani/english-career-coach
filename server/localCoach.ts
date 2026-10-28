import type { PracticeFeedback, PracticeType, TutorMode } from "./learning";

type Correction = {
  pattern: RegExp;
  replacement: string;
  category: string;
  note: string;
};

const corrections: Correction[] = [
  { pattern: /\bI am agree\b/gi, replacement: "I agree", category: "Grammar", note: "“Agree” is a verb, so it does not need “am”." },
  { pattern: /\bI am not agree\b/gi, replacement: "I don't agree", category: "Grammar", note: "Use “I don't agree” or “I disagree”." },
  { pattern: /\bwe are agree\b/gi, replacement: "we agree", category: "Grammar", note: "“Agree” is a verb, so it does not need “are”." },
  { pattern: /\bdiscuss about\b/gi, replacement: "discuss", category: "Prepositions", note: "We discuss something; “about” is not needed after “discuss”." },
  { pattern: /\binformations\b/gi, replacement: "information", category: "Word choice", note: "“Information” is uncountable, so it has no plural form." },
  { pattern: /\badvices\b/gi, replacement: "advice", category: "Word choice", note: "“Advice” is uncountable. Use “a piece of advice” for one item." },
  { pattern: /\bpeoples\b/gi, replacement: "people", category: "Word choice", note: "“People” is already plural." },
  { pattern: /\bmore better\b/gi, replacement: "better", category: "Grammar", note: "“Better” is already comparative, so “more” is unnecessary." },
  { pattern: /\bcan able to\b/gi, replacement: "can", category: "Grammar", note: "Use either “can” or “be able to”, not both." },
  { pattern: /\bI will can\b/gi, replacement: "I will be able to", category: "Grammar", note: "After “will”, use “be able to” rather than “can”." },
  { pattern: /\b(want|need|hope|plan|try|decide) (improve|go|learn|start|work|become|do|make|ask|know|build|move|change|join|speak|write|read|finish|send|talk|study|practice)\b/gi, replacement: "$1 to $2", category: "Grammar", note: "Use “to” before the verb after words such as “want”, “need”, or “plan”." },
  { pattern: /\bwe was\b/gi, replacement: "we were", category: "Verb tense", note: "“We” takes “were” in the past tense." },
  { pattern: /\bthey was\b/gi, replacement: "they were", category: "Verb tense", note: "“They” takes “were” in the past tense." },
  { pattern: /\bI didn't went\b/gi, replacement: "I didn't go", category: "Verb tense", note: "After “didn't”, use the base form of the verb." },
  { pattern: /\bI didn't found\b/gi, replacement: "I didn't find", category: "Verb tense", note: "After “didn't”, use the base form of the verb." },
  { pattern: /\bI have did\b/gi, replacement: "I have done", category: "Verb tense", note: "Use the past participle “done” after “have”." },
  { pattern: /\bI have went\b/gi, replacement: "I have gone", category: "Verb tense", note: "Use the past participle “gone” after “have”." },
  { pattern: /\bI has\b/gi, replacement: "I have", category: "Grammar", note: "Use “have” with “I”." },
  { pattern: /\b(he|she|it) don't\b/gi, replacement: "$1 doesn't", category: "Grammar", note: "Use “doesn't” with he, she, or it." },
  { pattern: /\bthere is many\b/gi, replacement: "there are many", category: "Grammar", note: "Use “there are” with a plural noun." },
  { pattern: /\bpeople is\b/gi, replacement: "people are", category: "Grammar", note: "“People” is plural, so it takes “are”." },
  { pattern: /\bone of my colleague\b/gi, replacement: "one of my colleagues", category: "Grammar", note: "Use the plural noun after “one of my”." },
  { pattern: /\bI have (\d+) years? experience\b/gi, replacement: "I have $1 years of experience", category: "Prepositions", note: "Use “years of experience”." },
  { pattern: /\bI am working (here|on this) since\b/gi, replacement: "I have been working $1 since", category: "Verb tense", note: "Use the present perfect continuous for an action that started in the past and continues now." },
  { pattern: /\bI'm working (here|on this) since\b/gi, replacement: "I have been working $1 since", category: "Verb tense", note: "Use the present perfect continuous for an action that started in the past and continues now." },
  { pattern: /\bI have been working here from\b/gi, replacement: "I have been working here since", category: "Prepositions", note: "Use “since” with a starting point in time." },
  { pattern: /\bI'm interested about\b/gi, replacement: "I'm interested in", category: "Prepositions", note: "The adjective “interested” is followed by “in”." },
  { pattern: /\bI am interested to\b/gi, replacement: "I am interested in", category: "Prepositions", note: "Use “interested in” before a noun or -ing form." },
  { pattern: /\bgood in\b/gi, replacement: "good at", category: "Prepositions", note: "Use “good at” for skills." },
  { pattern: /\bresponsible of\b/gi, replacement: "responsible for", category: "Prepositions", note: "Use “responsible for”." },
  { pattern: /\bparticipate to\b/gi, replacement: "participate in", category: "Prepositions", note: "Use “participate in”." },
  { pattern: /\bfocus in\b/gi, replacement: "focus on", category: "Prepositions", note: "Use “focus on”." },
  { pattern: /\bexplain me\b/gi, replacement: "explain to me", category: "Grammar", note: "We explain something to someone." },
  { pattern: /\bvery much good\b/gi, replacement: "very good", category: "Grammar", note: "Use “very good” or “really good”." },
  { pattern: /\bhow to say\b/gi, replacement: "how do you say", category: "Grammar", note: "Use “How do you say…?” for a direct question." },
  { pattern: /\bIn my opinion, I think\b/gi, replacement: "In my opinion", category: "Clarity", note: "Choose one opinion phrase to avoid repetition." },
  { pattern: /\bin the same time\b/gi, replacement: "at the same time", category: "Prepositions", note: "Use “at the same time”." },
  { pattern: /\bas per my opinion\b/gi, replacement: "in my opinion", category: "Clarity", note: "Use “in my opinion”." },
  { pattern: /\bme and my team\b/gi, replacement: "my team and I", category: "Grammar", note: "Put yourself second and use “I” as the subject." },
  { pattern: /\bI have a doubt\b/gi, replacement: "I have a question", category: "Word choice", note: "In workplace English, “I have a question” is the natural phrase." },
  { pattern: /\bdo the needful\b/gi, replacement: "take the necessary action", category: "Professional tone", note: "“Do the needful” is dated; use a specific action instead." },
  { pattern: /\brevert back\b/gi, replacement: "reply", category: "Professional tone", note: "Use “reply” or “get back to you”." },
  { pattern: /\bprepone\b/gi, replacement: "bring forward", category: "Word choice", note: "Use “bring forward” or “move earlier”." },
  { pattern: /\bkindly\b/gi, replacement: "please", category: "Professional tone", note: "“Please” is simpler and more natural in most workplace writing." },
];

const vocabularyIdeas: Array<{ word: string; definition: string; example: string }> = [
  { word: "stakeholder", definition: "a person who has an interest in a project or decision", example: "I will share the timeline with the key stakeholders." },
  { word: "blocker", definition: "a problem that prevents progress", example: "My only blocker is access to the test environment." },
  { word: "root cause", definition: "the underlying reason a problem happened", example: "We found the root cause of the login failure." },
  { word: "rollback", definition: "returning a system to a previous working version", example: "We performed a rollback after the release." },
  { word: "deployment", definition: "the process of releasing software to an environment", example: "The deployment is scheduled for Thursday evening." },
  { word: "mitigation", definition: "an action that reduces the impact of a problem", example: "Our mitigation reduced the impact on customers." },
  { word: "requirement", definition: "something the product must do to meet a business need", example: "We clarified the reporting requirement with the user." },
  { word: "deadline", definition: "the latest time by which work must be finished", example: "We can meet the deadline if testing finishes today." },
  { word: "incident", definition: "an unplanned event that disrupts a service", example: "The incident affected the customer portal for 20 minutes." },
  { word: "alignment", definition: "shared agreement between people or teams", example: "We need alignment on the scope before we start." },
  { word: "ETA", definition: "estimated time of arrival or completion", example: "The ETA for the fix is 30 minutes." },
  { word: "cross-functional", definition: "involving people from different teams or specialties", example: "A cross-functional team investigated the issue." },
  { word: "dashboard", definition: "a screen that summarises important information", example: "The dashboard shows weekly support volumes." },
  { word: "API", definition: "a defined way for two software systems to communicate", example: "The mobile app calls the payment API." },
  { word: "database", definition: "an organised store of data that applications can query", example: "The customer records are stored in a database." },
  { word: "cache", definition: "a temporary store that speeds up repeated access to data", example: "We cleared the cache after the update." },
  { word: "firewall", definition: "a security control that filters network traffic", example: "The firewall blocks unexpected inbound connections." },
  { word: "repository", definition: "a central place where code and its history are stored", example: "I pushed the fix to the repository." },
  { word: "bug", definition: "a defect in software that causes incorrect behaviour", example: "We found a bug in the password-reset flow." },
  { word: "scope", definition: "the agreed boundary of what a project will deliver", example: "That request is outside the scope of this release." },
];

function capitaliseFirst(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}

function hasSentenceEnding(text: string) {
  return /[.!?]$/.test(text.trim());
}

function finishSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return hasSentenceEnding(trimmed) ? trimmed : `${trimmed}.`;
}

function generalAlternative(text: string) {
  const clean = normaliseText(text).replace(/[.!?]+$/, "");
  if (/^help me\b/i.test(clean)) {
    return finishSentence(clean.replace(/^help me\b/i, "Could you help me"));
  }
  if (/^i want\b/i.test(clean)) {
    return finishSentence(clean.replace(/^i want\b/i, "I'd like"));
  }
  if (/^i need\b/i.test(clean)) {
    return finishSentence(clean.replace(/^i need\b/i, "I need"));
  }
  return finishSentence(clean);
}

function normaliseText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function correctEnglish(value: string) {
  let text = normaliseText(value);
  const notes: Array<{ category: string; note: string }> = [];
  for (const correction of corrections) {
    correction.pattern.lastIndex = 0;
    if (correction.pattern.test(text)) {
      text = text.replace(correction.pattern, correction.replacement);
      if (!notes.some(item => item.note === correction.note)) {
        notes.push({ category: correction.category, note: correction.note });
      }
    }
  }

  const capitalised = capitaliseFirst(text);
  if (capitalised !== text) {
    notes.push({ category: "Capitalisation", note: "Start a sentence with a capital letter." });
  }
  text = capitalised;

  if (text.length > 12 && !hasSentenceEnding(text)) {
    text = `${text}.`;
    notes.push({ category: "Punctuation", note: "Finish a complete sentence with a full stop." });
  }

  return { corrected: text, notes };
}

function pickVocabulary(text: string, limit = 3) {
  const lower = text.toLowerCase();
  const words = vocabularyIdeas.filter(item => lower.includes(item.word.toLowerCase()));
  if (words.length > 0) return words.slice(0, limit).map(item => item.word);
  return vocabularyIdeas.slice(0, limit).map(item => item.word);
}

function activityLabel(activityType: PracticeType) {
  return {
    vocabulary: "vocabulary",
    grammar: "grammar correction",
    rewrite: "sentence rewriting",
    writing: "writing",
  }[activityType];
}

export function localPracticeFeedback(input: {
  activityType: PracticeType;
  prompt: string;
  response: string;
}): PracticeFeedback {
  const { corrected, notes } = correctEnglish(input.response);
  const wordCount = input.response.trim().split(/\s+/).filter(Boolean).length;
  const categories = Array.from(new Set(notes.map(note => note.category)));
  let score = 90 - notes.length * 5;

  if (wordCount < 6) {
    score -= 12;
    categories.push("Development");
  } else if (wordCount > 35) {
    score -= 3;
  }
  if (input.activityType === "vocabulary") score += 2;
  if (input.activityType === "writing" && !/[.!?]/.test(input.response)) score -= 4;
  score = Math.max(42, Math.min(97, Math.round(score)));

  const strengths =
    notes.length === 0
      ? "Your sentence is clear and easy to follow."
      : `Your meaning comes across, and the ${activityLabel(input.activityType)} exercise is a useful step.`;
  const explanation =
    notes.length === 0
      ? `${strengths} Keep the sentence specific, and add one concrete detail from your IT work when you can.`
      : `${strengths} ${notes.map(note => note.note).join(" ")}`;

  const vocabulary = pickVocabulary(input.response);
  const naturalAlternative =
    input.activityType === "writing"
      ? `${finishSentence(corrected)} This version keeps your point direct, professional, and easy for a busy colleague to scan.`
      : input.activityType === "rewrite"
        ? `${finishSentence(corrected)} A more polished way to say it is to lead with the key point and then add the reason.`
        : input.activityType === "vocabulary"
          ? `${finishSentence(corrected)} A natural way to use this in your IT work is: “${vocabularyIdeas.find(item => item.word === vocabulary[0])?.example ?? "I used this term in a project update."}”`
          : `${finishSentence(corrected)} A natural alternative is: “${generalAlternative(input.response)}”`;

  return {
    score,
    correction: corrected || input.response,
    explanation,
    naturalAlternative,
    errorCategories: Array.from(new Set(categories)),
    vocabulary,
  };
}

function modeFromPrompt(systemPrompt: string): TutorMode {
  if (/supportive IT interviewer/i.test(systemPrompt)) return "interview";
  if (/concise, professional workplace/i.test(systemPrompt)) return "workplace";
  if (/accurate, accessible IT vocabulary/i.test(systemPrompt)) return "it_vocabulary";
  return "general";
}

function vocabularyExplanation(message: string) {
  const lower = message.toLowerCase();
  const match = vocabularyIdeas.find(item => lower.includes(item.word.toLowerCase()));
  if (!match) {
    return "A useful pattern for explaining an IT term is: “It is a ___ that helps people ___. For example, ___.” This keeps the definition concrete for a non-technical listener.";
  }
  return `“${match.word}” means ${match.definition}. For example: “${match.example}”`;
}

export function localTutorReply(input: {
  message: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
}): string {
  const message = normaliseText(input.message);
  const mode = modeFromPrompt(input.systemPrompt ?? "");
  const { corrected, notes } = correctEnglish(message);
  const correction =
    notes.length === 0
      ? "Your English is already clear. I would keep it as it is."
      : `${corrected}`;
  const why =
    notes.length === 0
      ? "The sentence has a clear main idea and correct basic structure."
      : notes.map(note => note.note).join(" ");

  let answer: string;
  let natural: string;
  let next: string;

  if (mode === "interview") {
    answer =
      "Thank you — that gives me a useful starting point. A strong interview answer usually follows Situation → Action → Result, so make the result explicit.";
    natural = `${finishSentence(corrected)} In an interview, you could add: “The result was ___, and it helped the team ___.”`;
    next = "Try answering this follow-up: “What was the hardest part of that project, and how did you handle it?”";
  } else if (mode === "workplace") {
    answer =
      "Here is a professional way to frame that for a colleague or stakeholder. Lead with the status, then the impact, then the next action.";
    natural = `Status: ${finishSentence(corrected)} Next step: I will share an update by the end of the day.`;
    next = "Rewrite it as a two-sentence update: one sentence for status and one for the next action or blocker.";
  } else if (mode === "it_vocabulary") {
    answer = vocabularyExplanation(message);
    natural = `A natural explanation is: ${finishSentence(corrected)}`;
    next = "Now explain the same idea to a non-technical stakeholder in two sentences, avoiding acronyms.";
  } else {
    answer =
      "You are communicating the main idea. I would tighten the sentence and make the purpose more direct.";
    natural = `${finishSentence(corrected)} Another natural option is: “${generalAlternative(message)}”`;
    next = "Use the corrected sentence in a new example about your own IT work.";
  }

  return [
    `**Answer**\n${answer}`,
    `**Correction**\n${correction}`,
    `**Why**\n${why}`,
    `**More natural way to say it**\n${natural}`,
    `**Try next**\n${next}`,
  ].join("\n\n");
}
