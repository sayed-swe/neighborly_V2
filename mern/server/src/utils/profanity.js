/**
 * Basic profanity filter for English, Bangla and romanised Bangla ("Banglish").
 *
 * Matches whole words, never raw substrings, so ordinary words that happen to
 * contain a bad one ("class", "Scunthorpe", "shiitake") pass. Common dodges are
 * normalised first: letter case, leetspeak (f4ck, $hit), stretched letters
 * (fuuuck), spaced or dotted letters (f.u.c.k) and invisible joiners inside
 * Bangla words.
 *
 * Lists are kept short on purpose: words that are also names or everyday words
 * (e.g. "dick", "cock", "শালা") are left out to avoid blocking real neighbours.
 */
export const PROFANITY_MESSAGE = 'Please keep it respectful and remove offensive language.';

// Whole words, compared after normalising and collapsing repeated letters.
const WORDS = [
  // English
  'fuck', 'fck', 'fcking', 'fuk', 'fuking', 'fukin', 'fcuk', 'fack', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'motherfucker', 'motherfucking',
  'shit', 'shits', 'shitty', 'shithead', 'bullshit', 'asshole', 'assholes', 'dumbass', 'jackass',
  'bitch', 'bitches', 'bitchy', 'bastard', 'bastards', 'cunt', 'cunts', 'slut', 'sluts', 'whore', 'whores',
  'pussy', 'dickhead', 'wanker', 'twat', 'retard', 'retarded', 'nigger', 'nigga', 'faggot', 'fag',
  // Banglish (romanised Bangla)
  'khanki', 'khankir', 'magir', 'madarchod', 'madarchud', 'maderchod', 'bainchod', 'banchod', 'bokachoda',
  'bokachuda', 'chudi', 'chudir', 'chodon', 'chudbo', 'choda', 'chuda', 'haramjada', 'haramjadi', 'harami',
  'tor maire', 'tor mayre', 'kuttar baccha', 'kuttar bachcha', 'shuorer baccha', 'shuorer bachcha',
  // Bangla
  'খানকি', 'খানকির', 'মাগি', 'মাগির', 'মাগী', 'হারামজাদা', 'হারামজাদি', 'হারামি', 'হারামী', 'বোকাচোদা', 'মাদারচোদ',
  'কুত্তার বাচ্চা', 'শুয়োরের বাচ্চা', 'শুওরের বাচ্চা', 'তোর মায়রে', 'বাল',
];

// Word stems: any word that starts with one of these is blocked (Bangla verbs
// inflect heavily: চোদা, চুদি, চোদাচুদি …).
const STEMS = ['চোদ', 'চুদ', 'motherfuck', 'fuck'];
// Real words that share a stem: চোদ্দ is "fourteen".
const ALLOW_STEMS = ['চোদ্দ'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
const INVISIBLE = /[­​-‍⁠﻿]/g;
const SPLIT = /[^\p{L}\p{M}]+/u;

const collapse = (w) => w.replace(/(.)\1+/gu, '$1');
const prep = (s) => s.normalize('NFC').toLowerCase().replace(INVISIBLE, '');

const single = new Set();
const phrases = [];
for (const w of WORDS) {
  const c = collapse(prep(w));
  if (c.includes(' ')) phrases.push(c.split(' ')); else single.add(c);
}
const stems = STEMS.map((s) => collapse(prep(s)));
const allowStems = ALLOW_STEMS.map((s) => collapse(prep(s)));

const isBad = (token) => single.has(token)
  || (stems.some((s) => token.startsWith(s)) && !allowStems.some((s) => token.startsWith(s)));

/** Splits text into normalised, collapsed word tokens. */
function tokenize(text) {
  const leet = prep(text).replace(/[013457@$!]/g, (ch, i, s) => {
    // Only treat symbols as letters when they sit inside a word ("f4ck", "$hit").
    const near = /\p{L}/u.test(s[i - 1] ?? '') || /\p{L}/u.test(s[i + 1] ?? '');
    return near ? LEET[ch] : ' ';
  });
  return leet.split(SPLIT).filter(Boolean).map(collapse);
}

/** Returns true if the text contains a blocked word or phrase. */
export function hasProfanity(text) {
  if (typeof text !== 'string' || !text) return false;
  const tokens = tokenize(text);

  // Re-join runs of single letters so "f u c k" and "f.u.c.k" are seen as one word.
  const joined = [];
  for (let i = 0; i < tokens.length; i++) {
    if ([...tokens[i]].length !== 1) continue;
    let j = i;
    while (j < tokens.length && [...tokens[j]].length === 1) j++;
    if (j - i >= 3) joined.push(collapse(tokens.slice(i, j).join('')));
    i = j;
  }

  if (tokens.some(isBad) || joined.some(isBad)) return true;
  return phrases.some((p) => tokens.some((_, i) => p.every((w, k) => tokens[i + k] === w)));
}

/** Adds the profanity check to a zod string schema (optional/empty values pass). */
export const clean = (schema) => schema.refine((v) => !hasProfanity(v), { message: PROFANITY_MESSAGE });
