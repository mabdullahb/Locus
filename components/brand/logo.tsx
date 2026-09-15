import { useId } from "react";
import { cn } from "@/lib/utils";

/* The globe that stands in for the O. Authored once in a base coordinate
   system (centre 258,150, radius 80) and reframed by each lockup's viewBox.
   Ring takes `currentColor`. The grid and continents take the accent. */

const CONTINENTS = [
  // North America: broad top, pointed Central-America taper toward the middle
  "203 96 219 87 235 89 248 96 245 110 253 118 244 125 240 137 231 134 227 145 220 152 215 143 219 129 208 124 203 111",
  // Greenland
  "243 79 253 76 260 82 257 90 248 90 243 85",
  // South America: hangs off Central America, tilts, tapers to a point
  "227 150 241 151 246 164 242 179 240 194 231 210 224 217 222 203 226 187 221 174 224 160",
  // Europe: small, bumpy, above Africa with the Mediterranean gap below it
  "256 99 271 93 285 98 282 107 271 111 261 108 254 103",
  // Africa: wide rounded shoulders, narrowing to a rounded point
  "267 117 285 112 301 119 307 132 302 144 306 155 299 167 291 184 283 193 277 183 276 166 269 152 265 135",
  // Asia: partial, upper-right limb
  "305 90 324 87 334 98 329 109 316 111 305 104 301 96",
];

function GlobeArt({ idBase }: { idBase: string }) {
  // Authored at centre 258,150 / r 80. Placed as an oversized letter O that
  // sits between L and cus: top aligns with the cap line, bottom overshoots
  // the baseline the way a round glyph does.
  return (
    <g transform="translate(5.16 5) scale(0.98)">
      <circle cx="258" cy="150" r="80" stroke="currentColor" strokeWidth="13" fill="none" />
      <g clipPath={`url(#${idBase}-clip)`}>
        <g
          stroke="hsl(var(--primary))"
          strokeWidth="2.4"
          fill="none"
          opacity="0.55"
          strokeLinecap="round"
        >
          <ellipse cx="258" cy="150" rx="27" ry="74" />
          <ellipse cx="258" cy="150" rx="54" ry="74" />
          <path d="M184 110q74-9 148 0" />
          <path d="M180 130q78-6 156 0" />
          <path d="M180 150h156" />
          <path d="M180 170q78 6 156 0" />
          <path d="M184 190q74 9 148 0" />
        </g>
        <g fill="hsl(var(--primary))">
          {CONTINENTS.map((pts, i) => (
            <polygon key={i} points={pts} />
          ))}
        </g>
      </g>
    </g>
  );
}

function GlobeDefs({ idBase }: { idBase: string }) {
  return (
    <defs>
      <clipPath id={`${idBase}-clip`}>
        <circle cx="258" cy="150" r="73" />
      </clipPath>
    </defs>
  );
}

const WORD = "var(--font-geist-sans), system-ui, sans-serif";

/**
 * Full Locus lockup: wordmark with the globe standing in for the O, plus the
 * "LOCATE / CONNECT / SUCCEED" tagline. Wordmark and tagline text take
 * `currentColor`. The globe grid and continents take the accent.
 */
export function LocusLogo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 860 320"
      className={cn("shrink-0", className)}
      fill="none"
      role="img"
      aria-label="Locus — Locate, Connect, Succeed"
      xmlns="http://www.w3.org/2000/svg"
    >
      <GlobeDefs idBase={id} />
      <text x="34" y="216" fontFamily={WORD} fontSize="204" fontWeight="800" letterSpacing="-4" fill="currentColor">L</text>
      <text x="352" y="216" fontFamily={WORD} fontSize="204" fontWeight="800" letterSpacing="-4" fill="currentColor">cus</text>
      <GlobeArt idBase={id} />
      <g fontFamily={WORD} fontSize="24" fontWeight="600" letterSpacing="6" fill="currentColor">
        <text x="130" y="286">LOCATE</text>
        <text x="342" y="286">CONNECT</text>
        <text x="576" y="286">SUCCEED</text>
        <circle cx="305" cy="279" r="4.5" fill="hsl(var(--primary))" />
        <circle cx="543" cy="279" r="4.5" fill="hsl(var(--primary))" />
      </g>
    </svg>
  );
}

/**
 * Horizontal Locus wordmark, no tagline. For the app shell and other tight
 * horizontal spots.
 */
export function LocusWordmark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="24 52 792 196"
      className={cn("shrink-0", className)}
      fill="none"
      role="img"
      aria-label="Locus"
      xmlns="http://www.w3.org/2000/svg"
    >
      <GlobeDefs idBase={id} />
      <text x="34" y="216" fontFamily={WORD} fontSize="204" fontWeight="800" letterSpacing="-4" fill="currentColor">L</text>
      <text x="352" y="216" fontFamily={WORD} fontSize="204" fontWeight="800" letterSpacing="-4" fill="currentColor">cus</text>
      <GlobeArt idBase={id} />
    </svg>
  );
}

/**
 * The Locus globe mark on its own, for tight square spots (collapsed rail,
 * favicon fallback). Ring takes `currentColor`, grid and continents the accent.
 */
export function LocusMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="164 56 188 188"
      className={cn("shrink-0", className)}
      fill="none"
      role="img"
      aria-label="Locus"
      xmlns="http://www.w3.org/2000/svg"
    >
      <GlobeDefs idBase={id} />
      <GlobeArt idBase={id} />
    </svg>
  );
}
