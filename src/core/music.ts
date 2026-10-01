// Original chiptune compositions. Melody tokens are 8th notes: note | '.' sustain | '-' rest.
export interface Track {
  bpm: number;
  chords: string[]; // one per bar (4/4)
  melody: string[];
  harmony?: string[];
  lead?: string;
  bass?: 'drive' | 'walk' | 'half' | 'syncop' | 'gallop';
  bassUp?: boolean;
  arp?: 'up' | 'updown' | 'stab' | 'fast' | 'none';
  arpOct?: number;
  drums?: string;
  loop?: boolean;
  loopStart?: number;
  swing?: number;
}
const m = (s: string) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
const ch = (s: string) => s.split(/\s+/).filter(Boolean);

export const MUSIC: Record<string, Track> = {
  title: {
    bpm: 138,
    chords: ch('Am F G Em Am F G E Am F G Em F G E E'),
    melody: m(`a4 . c5 e5 a5 . g5 e5 | f5 . e5 c5 a4 . c5 . | d5 . b4 g4 d5 e5 g5 . | e5 . . . b4 . e5 . |
      a5 . g5 a5 c6 . b5 a5 | f5 . a5 . c6 . a5 f5 | g5 . f5 e5 d5 . b4 d5 | e5 . . . g#5 . b5 . |
      c6 . b5 a5 e5 . a5 . | f5 . g5 a5 c6 . a5 . | b5 . a5 g5 d5 . g5 . | e5 . . . e5 g5 b5 . |
      a5 . . c6 . . a5 . | g5 . . b5 . . g5 . | g#5 . e5 . b5 . g#5 . | e6 . . . - . - . |`),
    lead: 'sq25',
    bass: 'drive',
    arp: 'updown',
    drums: 'rock',
  },
  intro: {
    bpm: 92,
    chords: ch('Am F C G Am F E E'),
    melody: m(`e5 . . . a4 . c5 . | c5 . . . a4 . . . | g4 . c5 . e5 . d5 . | d5 . . . b4 . . . |
      a4 . c5 . e5 . a5 . | f5 . e5 . c5 . a4 . | b4 . . . g#4 . b4 . | e5 . . . . . . . |`),
    lead: 'sq12',
    bass: 'half',
    arp: 'up',
    drums: 'soft',
  },
  s1: {
    bpm: 150,
    chords: ch('D Bm G A D Bm G A Em A D Bm G A D D'),
    melody: m(`d5 . f#5 a5 b5 a5 f#5 . | e5 . d5 e5 f#5 . . . | b4 . d5 e5 g5 f#5 e5 d5 | e5 . . . a4 . . . |
      d5 . f#5 a5 d6 . b5 a5 | b5 . a5 f#5 e5 . f#5 . | g5 . e5 d5 b4 . d5 e5 | a4 . b4 d5 e5 . . . |
      e5 g5 e5 d5 b4 . e5 . | c#5 . e5 a5 g5 . e5 . | f#5 . a5 f#5 e5 d5 b4 . | d5 . . . f#5 . e5 . |
      d5 . b4 d5 g5 . b5 . | a5 . g5 e5 c#5 . e5 . | d5 . . a4 d5 . f#5 . | d5 . . . - . - . |`),
    harmony: m(`a4 . . . f#4 . . . | d4 . . . d4 . . . | g4 . . . b4 . . . | c#5 . . . e4 . . . |
      f#4 . . . a4 . . . | f#4 . . . d4 . . . | d4 . . . g4 . . . | e4 . . . c#4 . . . |
      b4 . . . g4 . . . | a4 . . . c#5 . . . | a4 . . . f#4 . . . | f#4 . . . b4 . . . |
      b4 . . . d5 . . . | c#5 . . . a4 . . . | f#4 . . . a4 . . . | f#4 . . . - . . . |`),
    lead: 'sq25',
    bass: 'drive',
    arp: 'none',
    drums: 'rock',
  },
  s2: {
    bpm: 162,
    chords: ch('Em C D B Em C D B Am Em C D Em C B B'),
    melody: m(`e5 . g5 . b5 . a5 g5 | e5 . . . c5 . e5 . | f#5 . a5 . d6 . c6 a5 | b5 . . . d#5 . f#5 . |
      g5 . e5 . b4 . e5 g5 | c6 . b5 . g5 . e5 . | d5 . f#5 . a5 . f#5 d5 | b4 . . . - . b4 . |
      c5 . e5 . a5 . g5 e5 | b4 . e5 . g5 . b5 . | c6 . b5 . a5 . g5 . | f#5 . a5 . d5 . f#5 . |
      e5 . . . g5 . b5 . | c6 . b5 a5 g5 . e5 . | d#5 . f#5 . b5 . a5 . | b5 . . . - . - . |`),
    lead: 'sq50',
    bass: 'gallop',
    arp: 'fast',
    drums: 'fast',
  },
  s3: {
    bpm: 154,
    chords: ch('G D Em C G D C D Em C G D C D G G'),
    melody: m(`g4 . b4 d5 g5 . f#5 . | f#5 . e5 d5 a4 . . . | b4 . d5 e5 g5 . e5 . | e5 . d5 c5 e5 . . . |
      d5 . g5 . b5 . a5 g5 | a5 . . . f#5 . d5 . | e5 . g5 . c6 . b5 a5 | a5 . . . . . - . |
      b5 . a5 g5 e5 . g5 . | g5 . e5 . c5 . e5 . | d5 . g5 . b5 . d6 . | c6 . b5 . a5 . . . |
      c6 . . b5 . . a5 . | a5 . . b5 . . c6 . | b5 . . . g5 . d5 . | g5 . . . - . - . |`),
    lead: 'sq25',
    bass: 'drive',
    arp: 'stab',
    drums: 'four',
  },
  s4: {
    bpm: 140,
    chords: ch('Cm Ab Eb Bb Cm Ab Fm G Cm Ab Eb Bb Ab Bb Cm Cm'),
    melody: m(`c5 . . d#5 . . g5 . | g#5 . g5 . d#5 . c5 . | a#4 . . d#5 . . g5 . | f5 . d5 . a#4 . . . |
      c6 . . a#5 . . g5 . | g#5 . . g5 . . d#5 . | f5 . g#5 . c6 . a#5 . | b5 . . . g5 . . . |
      d#5 c5 d#5 g5 c6 . g5 . | g#5 d#5 g#5 c6 d#6 . c6 . | g5 d#5 g5 a#5 d#6 . a#5 . | d6 . . . a#5 . f5 . |
      g#5 . c6 . d#6 . c6 . | a#5 . d6 . f6 . d6 . | c6 . . . g5 . . . | c6 . . . - . - . |`),
    lead: 'sq25',
    bass: 'syncop',
    arp: 'fast',
    arpOct: 0,
    drums: 'break',
  },
  s5: {
    bpm: 122,
    chords: ch('F#m D A E F#m D C#7 C#7 Bm D A E Bm D C#7 C#7'),
    melody: m(`f#5 . . . c#5 . f#5 . | a5 . . . f#5 . e5 . | e5 . c#5 . a4 . c#5 . | b4 . . . . . - . |
      f#5 . . . a5 . c#6 . | d6 . . . c#6 . a5 . | g#5 . . . f5 . g#5 . | c#6 . . . . . - . |
      d5 . f#5 . b5 . a5 . | a5 . . . f#5 . d5 . | e5 . a5 . c#6 . b5 . | b5 . . . g#5 . e5 . |
      f#5 . . b5 . . d6 . | d6 . c#6 . b5 . a5 . | g#5 . . . f5 . g#5 . | c#6 . . . - . - . |`),
    lead: 'sq12',
    bass: 'walk',
    arp: 'updown',
    drums: 'half',
  },
  s6: {
    bpm: 126,
    chords: ch('Gm7 C7 Gm7 C7 Ebmaj7 D7 Gm7 Gm7 Gm7 C7 Gm7 C7 Ebmaj7 F D7 D7'),
    melody: m(`g5 . - a#5 . g5 f5 . | e5 . c5 . - . g4 . | a#4 . d5 . f5 . g5 . | g5 . e5 . - . - . |
      d#5 . g5 . a#5 . d6 . | d6 . c6 . a5 . f#5 . | g5 . . . d5 . f5 . | g5 . . . - . - . |
      d6 . a#5 . g5 . a#5 . | c6 . . a#5 . . g5 . | f5 . g5 . a#5 . d6 . | c6 . . . - . - . |
      a#5 . . g5 . . d#5 . | f5 . a5 . c6 . a5 . | a5 . . . f#5 . . . | d5 . . . - . - . |`),
    lead: 'sq25',
    bass: 'syncop',
    arp: 'stab',
    drums: 'funk',
    swing: 0.12,
  },
  boss: {
    bpm: 172,
    chords: ch('Em F Em F Em F G F Am F Em F Am B Em Em'),
    melody: m(`e5 . e5 f5 . e5 d5 . | f5 . f5 g5 . f5 e5 . | b5 . a5 . g5 . f5 . | e5 . f5 . a5 . c6 . |
      b5 . . . a5 . g5 . | a5 . . . c6 . a5 . | b5 . d6 . b5 . g5 . | a5 . f5 . c5 . f5 . |
      e5 . a5 . c6 . e6 . | d6 . c6 . a5 . f5 . | g5 . e5 . b4 . e5 . | f5 . a5 . c6 . a5 . |
      c6 . . b5 . . a5 . | b5 . . a5 . . d#5 . | e5 . . . b4 . e5 . | e5 . . . . . - . |`),
    lead: 'sq50',
    bass: 'gallop',
    arp: 'fast',
    drums: 'fast',
  },
  final: {
    bpm: 180,
    chords: ch('Dm Bb C A Dm Bb C A Gm Dm Bb A Gm Bb A A'),
    melody: m(`d5 . f5 a5 d6 . c6 a5 | a#5 . a5 f5 d5 . f5 . | g5 . e5 c5 g5 . a5 . | a5 . . . c#6 . e6 . |
      d6 . . a5 . . f5 . | f5 g5 a5 . a#5 . d6 . | c6 . . g5 . . e5 . | e5 . c#5 . a4 . c#5 . |
      d5 . g5 . a#5 . d6 . | a5 . . . f5 . d5 . | f5 . a#5 . d6 . f6 . | e6 . c#6 . a5 . e5 . |
      g5 . a#5 . d6 . g6 . | f6 . d6 . a#5 . f5 . | e5 . a5 . c#6 . e6 . | a6 . . . - . - . |`),
    lead: 'sq25',
    bass: 'drive',
    bassUp: false,
    arp: 'fast',
    drums: 'fast',
  },
  clear: {
    bpm: 150,
    chords: ch('C F G C'),
    melody: m(`c5 e5 g5 c6 . . e6 . | f5 a5 c6 f6 . . a5 . | g5 . b5 . d6 . f6 . | e6 . . . . . - . |`),
    lead: 'sq25',
    bass: 'drive',
    arp: 'none',
    drums: 'rock',
    loop: false,
  },
  gameover: {
    bpm: 100,
    chords: ch('Am F Dm E'),
    melody: m(`e5 . . . c5 . . . | a4 . . . f4 . . . | d4 . f4 . a4 . d5 . | b4 . . . g#4 . . . |`),
    lead: 'sq12',
    bass: 'half',
    arp: 'none',
    drums: 'none',
    loop: false,
  },
  ending: {
    bpm: 104,
    chords: ch('C G Am F C G F G C G Am Em F C Dm G'),
    melody: m(`e5 . . d5 c5 . d5 . | d5 . . . g4 . . . | c5 . e5 . a5 . g5 . | f5 . . . a4 . . . |
      e5 . g5 . c6 . b5 . | b5 . a5 . g5 . d5 . | a5 . . g5 f5 . e5 . | d5 . . . . . - . |
      e5 . . d5 c5 . d5 . | d5 . g5 . b5 . d6 . | c6 . . b5 a5 . g5 . | g5 . . . e5 . . . |
      f5 . a5 . c6 . a5 . | g5 . e5 . c5 . e5 . | f5 . e5 . d5 . b4 . | c5 . . . . . . . |`),
    lead: 'sq25',
    bass: 'walk',
    arp: 'up',
    drums: 'soft',
  },
};
