import { SketchTemplate } from '../types';

// Crisp, high-contrast SVG templates styled for SketchFlow AR paper tracing
export const SAMPLE_TEMPLATES: SketchTemplate[] = [
  {
    id: 'anime-gojo',
    title: 'Gojo Anime Hero',
    category: 'Anime & Manga',
    difficulty: 'Medium',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="65 60 290 425" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="65" y="60" width="290" height="425" fill="transparent"/>
        <g stroke="#1e1e2d" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Spiky White Anime Hair -->
          <path d="M 110 220 L 75 170 L 120 180 L 95 120 L 155 145 L 180 75 L 210 135 L 250 65 L 265 140 L 315 100 L 295 175 L 345 170 L 305 230" stroke-width="4"/>
          <!-- Hair Bangs on Forehead -->
          <path d="M 125 185 Q 160 225 175 235 Q 190 205 205 180 Q 220 225 235 240 Q 255 200 285 190"/>
          <path d="M 150 160 Q 180 200 185 220"/>
          <path d="M 230 160 Q 240 195 245 220"/>
          <!-- Jaw & Face Outline -->
          <path d="M 125 225 L 135 270 Q 145 330 210 365 Q 275 330 285 270 L 295 225"/>
          <!-- Round Dark Sunglasses -->
          <ellipse cx="165" cy="255" rx="28" ry="14" fill="#2d2d3a" stroke="#111118" stroke-width="4"/>
          <ellipse cx="255" cy="255" rx="28" ry="14" fill="#2d2d3a" stroke="#111118" stroke-width="4"/>
          <path d="M 193 255 L 227 255" stroke="#111118" stroke-width="4"/>
          <!-- Intense Eyes behind glasses -->
          <path d="M 150 240 Q 165 230 180 240" stroke-width="3"/>
          <path d="M 240 240 Q 255 230 270 240" stroke-width="3"/>
          <!-- Nose and Smirking Mouth -->
          <path d="M 208 280 L 212 292"/>
          <path d="M 195 315 Q 210 322 228 314" stroke-width="4"/>
          <!-- High Collar Jacket -->
          <path d="M 135 345 L 120 405 L 175 375 L 175 480" stroke-width="4.5"/>
          <path d="M 285 345 L 300 405 L 245 375 L 245 480" stroke-width="4.5"/>
          <path d="M 120 405 L 70 480" stroke-width="4"/>
          <path d="M 300 405 L 350 480" stroke-width="4"/>
          <path d="M 175 375 L 210 395 L 245 375"/>
          <!-- Shading Crosshatch lines -->
          <line x1="130" y1="365" x2="160" y2="395" stroke-width="2"/>
          <line x1="140" y1="365" x2="170" y2="395" stroke-width="2"/>
          <line x1="260" y1="365" x2="290" y2="395" stroke-width="2"/>
          <line x1="250" y1="365" x2="280" y2="395" stroke-width="2"/>
        </g>
      </svg>
    `)}`
  },
  {
    id: 'cute-pikachu',
    title: 'Electric Mascot',
    category: 'Easy Tracing',
    difficulty: 'Easy',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="transparent"/>
        <g stroke="#1e1e2d" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Ears -->
          <path d="M 125 140 C 95 80 50 35 50 35 C 50 35 105 50 145 95" stroke-width="4"/>
          <polygon points="50,35 75,55 60,75" fill="#1e1e2d"/>
          <path d="M 275 140 C 305 80 350 35 350 35 C 350 35 295 50 255 95" stroke-width="4"/>
          <polygon points="350,35 325,55 340,75" fill="#1e1e2d"/>
          <!-- Head -->
          <path d="M 125 140 C 100 190 95 240 135 270 C 175 300 225 300 265 270 C 305 240 300 190 275 140 C 240 120 160 120 125 140 Z" stroke-width="4"/>
          <!-- Eyes -->
          <circle cx="150" cy="195" r="14" fill="#1e1e2d"/>
          <circle cx="146" cy="190" r="5" fill="#ffffff"/>
          <circle cx="250" cy="195" r="14" fill="#1e1e2d"/>
          <circle cx="246" cy="190" r="5" fill="#ffffff"/>
          <!-- Nose & Mouth -->
          <circle cx="200" cy="210" r="2.5" fill="#1e1e2d"/>
          <path d="M 190 220 Q 200 226 210 220 Q 220 226 230 220"/>
          <!-- Cheeks -->
          <circle cx="125" cy="235" r="15" stroke="#e11d48" stroke-width="3" fill="#ffe4e6"/>
          <circle cx="275" cy="235" r="15" stroke="#e11d48" stroke-width="3" fill="#ffe4e6"/>
          <!-- Body outline & paws -->
          <path d="M 140 265 C 130 310 130 350 165 370 L 235 370 C 270 350 270 310 260 265"/>
          <path d="M 170 300 Q 200 320 230 300"/>
        </g>
      </svg>
    `)}`
  },
  {
    id: 'kuromi-sketch',
    title: 'Cute Devil Kitty',
    category: 'Anime & Manga',
    difficulty: 'Easy',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="transparent"/>
        <g stroke="#1e1e2d" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Jester Hat / Devil Ears -->
          <path d="M 130 160 C 90 90 70 40 70 40 C 70 40 120 70 160 115" stroke-width="4"/>
          <circle cx="70" cy="40" r="9" fill="#1e1e2d"/>
          <path d="M 270 160 C 310 90 330 40 330 40 C 330 40 280 70 240 115" stroke-width="4"/>
          <circle cx="330" cy="40" r="9" fill="#1e1e2d"/>
          <!-- Head Contour -->
          <path d="M 130 160 C 80 200 80 270 130 310 C 180 340 220 340 270 310 C 320 270 320 200 270 160 C 230 135 170 135 130 160 Z" stroke-width="4"/>
          <!-- Pink Skull in Hat Center -->
          <ellipse cx="200" cy="140" rx="14" ry="12" fill="#f43f5e" stroke="#1e1e2d" stroke-width="2"/>
          <circle cx="194" cy="138" r="3" fill="#ffffff"/>
          <circle cx="206" cy="138" r="3" fill="#ffffff"/>
          <!-- Big Winking Anime Eyes -->
          <ellipse cx="155" cy="225" rx="14" ry="20" fill="#1e1e2d"/>
          <circle cx="151" cy="217" r="5" fill="#ffffff"/>
          <!-- Winking Eye -->
          <path d="M 235 225 Q 255 205 275 225" stroke-width="4.5"/>
          <!-- Small Cute Nose & Mouth -->
          <ellipse cx="200" cy="245" rx="3.5" ry="2.5" fill="#1e1e2d"/>
          <path d="M 192 258 Q 200 266 208 258" stroke-width="3"/>
          <!-- Hearts -->
          <path d="M 290 190 C 290 180 280 175 275 182 C 270 175 260 180 260 190 C 260 205 275 215 275 215 C 275 215 290 205 290 190 Z" fill="#f43f5e" stroke="#f43f5e"/>
        </g>
      </svg>
    `)}`
  },
  {
    id: 'cute-cat',
    title: 'Minimalist Kitty',
    category: 'Animals',
    difficulty: 'Easy',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="transparent"/>
        <g stroke="#1e1e2d" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Head & Ears -->
          <path d="M 120 180 C 110 130 90 90 90 90 L 150 120 C 175 110 225 110 250 120 L 310 90 C 310 90 290 130 280 180 C 320 220 320 280 280 320 C 240 350 160 350 120 320 C 80 280 80 220 120 180 Z"/>
          <!-- Eyes -->
          <ellipse cx="150" cy="210" rx="14" ry="18" fill="#1e1e2d"/>
          <ellipse cx="250" cy="210" rx="14" ry="18" fill="#1e1e2d"/>
          <circle cx="154" cy="205" r="5" fill="#ffffff"/>
          <circle cx="254" cy="205" r="5" fill="#ffffff"/>
          <!-- Nose & Mouth -->
          <polygon points="194,240 206,240 200,248" fill="#e11d48" stroke="#e11d48"/>
          <path d="M 200 248 Q 185 262 170 255"/>
          <path d="M 200 248 Q 215 262 230 255"/>
          <!-- Whiskers -->
          <line x1="130" y1="240" x2="60" y2="230"/>
          <line x1="125" y1="255" x2="55" y2="260"/>
          <line x1="270" y1="240" x2="340" y2="230"/>
          <line x1="275" y1="255" x2="345" y2="260"/>
        </g>
      </svg>
    `)}`
  },
  {
    id: 'botanical-rose',
    title: 'Red Rose Blossom',
    category: 'Nature',
    difficulty: 'Easy',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <rect width="400" height="400" fill="transparent"/>
        <g stroke="#1e1e2d" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Rose Petals -->
          <path d="M 195 140 Q 205 130 215 140 Q 220 155 200 160 Q 185 160 185 145 Q 185 125 215 120 Q 240 120 235 155 Q 230 175 190 180 Q 170 180 165 150 Q 165 110 215 105 Q 260 105 255 160 Q 250 200 180 200 Q 145 195 145 140" stroke="#e11d48"/>
          <path d="M 150 160 C 130 190 140 230 180 245 C 220 255 260 230 270 190 C 275 160 260 140 250 140" stroke="#e11d48"/>
          <!-- Stem & Leaves -->
          <path d="M 200 270 Q 205 330 195 380" stroke-width="4.5"/>
          <path d="M 200 310 Q 140 300 130 330 Q 160 350 200 325"/>
          <path d="M 200 335 Q 260 320 270 355 Q 240 375 198 350"/>
        </g>
      </svg>
    `)}`
  }
];
