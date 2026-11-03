"""Narration script for TWO ROADS.

Every statement is limited to the facts given in the brief:
  Messi   - born Rosario, Argentina, 1987; street / family / local club football;
            growth hormone deficiency diagnosed around 10-11, costly treatment;
            2000, age 13: FC Barcelona offered to cover treatment, moved to Spain
            with his father, leaving his country.
  Ronaldo - born Funchal, Madeira, Portugal, 1985; modest home, little money;
            street / local club football; joined Sporting CP academy at 12,
            leaving home; 2000, age 15: surgery for a racing-heart condition
            (tachycardia), then returned to the pitch.
  End     - both became the greatest players of their generation.

`tts` is what the voice reads (spelled for the TTS engine);
`text` is what the captions show.
"""

# section ids: title, b1..b4 (split screen beats), drift, final
# side: L = Messi panel, R = Ronaldo panel, C = centred
LINES = [
    dict(id="t0", section="title", side="C",
         text="Two boys, born two years apart, in two corners of the world."),
    dict(id="b1L", section="b1", side="L",
         text="In Rosario, Argentina, Lionel Messi was born in 1987.",
         tts="In Rosario, Argentina, Lionel Messi was born in nineteen eighty-seven."),
    dict(id="b1R", section="b1", side="R",
         text="In Funchal, on the Portuguese island of Madeira, Cristiano Ronaldo was born in 1985.",
         tts="In Foonshahl, on the Portuguese island of Madeira, Cristiano Ronaldo was born in nineteen eighty-five."),
    dict(id="b2L", section="b2", side="L",
         text="As a small boy, Lionel played in the streets, with his family, and for his local club."),
    dict(id="b2R", section="b2", side="R",
         text="Cristiano grew up in a modest home, in a family with little money, playing in the streets and for a local club."),
    dict(id="b3L", section="b3", side="L",
         text="At about ten or eleven, Lionel was diagnosed with a growth hormone deficiency. The treatment was costly."),
    dict(id="b3R", section="b3", side="R",
         text="At twelve, Cristiano joined the youth academy of Sporting CP, and left home.",
         tts="At twelve, Cristiano joined the youth academy of Sporting C P, and left home."),
    dict(id="b4L", section="b4", side="L",
         text="In 2000, at thirteen, FC Barcelona offered to cover his treatment. He left his country for Spain, with his father.",
         tts="In two thousand, at thirteen, F.C. Barcelona offered to cover his treatment. He left his country for Spain, with his father."),
    dict(id="b4R", section="b4", side="R",
         text="That same year, at fifteen, Cristiano had surgery for a racing heart condition. Then he returned to the pitch."),
    dict(id="d1", section="drift", side="C",
         text="Different homes. Different challenges. The same ball at their feet."),
    dict(id="d2", section="drift", side="C",
         text="As the boys grew, their roads drew closer."),
    dict(id="d3", section="drift", side="C",
         text="Both became the greatest players of their generation."),
    dict(id="f1", section="final", side="C",
         text="Same game. Different roads."),
]

for _l in LINES:
    _l.setdefault("tts", _l["text"])

WORDS = sum(len(l["text"].split()) for l in LINES)

if __name__ == "__main__":
    print("lines:", len(LINES), "words:", WORDS)
