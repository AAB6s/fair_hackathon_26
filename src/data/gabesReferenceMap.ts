export interface MapPatch {
  id: string;
  path: string;
}

export interface MapLine {
  id: string;
  path: string;
}

export interface MapLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  tone?: "major" | "minor" | "water";
  size?: number;
  anchor?: "start" | "middle" | "end";
}

export interface RegionReferenceLayout {
  path: string;
  centroid: [number, number];
}

function buildPhosphogypsumDots() {
  const dots: Array<{ x: number; y: number; r: number }> = [];

  for (let row = 0; row < 13; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const x = 514 + col * 17 + (row % 2 === 0 ? 0 : 8);
      const y = 112 + row * 17;
      const inside =
        x < 690 - row * 1.5 &&
        y > 90 + col * 1.4 &&
        y < 318 + Math.sin(col * 0.55) * 4;

      if (inside) {
        dots.push({ x, y, r: row % 3 === 0 ? 2.6 : 2.2 });
      }
    }
  }

  return dots;
}

export const gabesReferenceMap = {
  viewBox: "0 0 780 540",
  seaPath:
    "M480 38 L742 38 L742 522 L650 522 L614 470 L590 408 L572 334 L556 252 L536 176 L510 108 Z",
  coastPath:
    "M476 38 C486 78 506 110 528 150 C544 186 554 220 558 252 C562 292 554 330 562 370 C570 418 584 470 612 522",
  urbanPatches: [
    {
      id: "ghannouch-urban",
      path: "M260 54 C292 42 338 54 360 88 C376 116 378 152 352 166 C324 184 278 170 252 140 C228 112 232 72 260 54 Z",
    },
    {
      id: "bouchemma-urban",
      path: "M248 214 C278 194 330 198 348 226 C360 248 346 276 314 292 C284 306 242 296 232 262 C226 242 234 226 248 214 Z",
    },
    {
      id: "jara-urban",
      path: "M392 246 C444 226 504 240 520 272 C534 300 512 334 456 342 C410 348 364 330 352 300 C342 274 356 260 392 246 Z",
    },
    {
      id: "gabes-urban",
      path: "M352 306 C414 286 488 294 520 330 C548 360 534 418 482 452 C430 486 350 482 302 438 C266 404 270 346 352 306 Z",
    },
    {
      id: "teboulbou-urban",
      path: "M448 402 C494 384 550 396 578 434 C598 462 590 498 548 516 C510 530 462 518 434 490 C408 462 408 422 448 402 Z",
    },
  ] as MapPatch[],
  oasisPatches: [
    {
      id: "ghannouch-oasis",
      path: "M236 58 C264 28 322 30 350 60 C382 96 382 156 338 178 C292 202 240 170 222 124 C212 96 216 78 236 58 Z",
    },
    {
      id: "bouchemma-oasis",
      path: "M294 212 C328 198 366 212 378 244 C390 274 374 304 338 314 C304 322 266 308 258 278 C250 246 262 224 294 212 Z",
    },
    {
      id: "chenini-oasis",
      path: "M298 300 C344 272 410 280 430 326 C446 364 430 414 386 430 C340 446 274 424 254 382 C238 346 252 320 298 300 Z",
    },
    {
      id: "south-oasis",
      path: "M492 430 C540 410 590 424 608 462 C628 506 608 534 556 532 C506 530 454 508 444 474 C436 452 450 442 492 430 Z",
    },
  ] as MapPatch[],
  industrialPatches: [
    {
      id: "port-industrial-a",
      path: "M398 124 L436 112 L482 126 L500 152 L488 188 L444 198 L402 180 L388 150 Z",
    },
    {
      id: "port-industrial-b",
      path: "M370 170 L412 160 L432 184 L424 214 L388 218 L360 202 L352 182 Z",
    },
    {
      id: "port-industrial-c",
      path: "M430 194 L468 186 L500 202 L504 236 L470 250 L430 242 L412 218 Z",
    },
    {
      id: "port-industrial-d",
      path: "M346 138 L372 132 L384 152 L378 174 L352 176 L334 160 Z",
    },
  ] as MapPatch[],
  roads: [
    { id: "road-west-top", path: "M78 36 C88 88 138 128 166 174 C198 224 214 292 226 370 C236 434 282 496 378 524" },
    { id: "road-west", path: "M50 150 C88 162 110 204 146 238 C186 276 238 300 286 330 C330 358 372 402 408 520" },
    { id: "road-central", path: "M228 54 C274 112 324 164 368 212 C412 260 446 320 448 520" },
    { id: "road-coast", path: "M330 210 C382 244 416 284 444 332 C470 382 494 450 548 520" },
    { id: "road-south", path: "M470 254 C504 290 534 336 548 390 C558 428 574 472 624 522" },
    { id: "road-nahal", path: "M146 86 C174 114 192 154 216 190 C246 236 294 270 338 300" },
  ] as MapLine[],
  railways: [
    { id: "rail-main", path: "M204 38 C250 80 302 120 346 156 C388 190 430 220 468 272 C494 306 510 342 528 396" },
  ] as MapLine[],
  labels: [
    { id: "ghannouch", x: 326, y: 90, text: "غنوش", tone: "major" },
    { id: "industrial-zone", x: 348, y: 170, text: "المنطقة الصناعية", tone: "minor", size: 12 },
    { id: "bouchemma", x: 270, y: 246, text: "بوشمة", tone: "major" },
    { id: "jara", x: 434, y: 314, text: "جرّة", tone: "major" },
    { id: "chott", x: 426, y: 252, text: "شط السلام", tone: "major" },
    { id: "gabes", x: 468, y: 356, text: "قابس", tone: "major", size: 28 },
    { id: "menzel", x: 424, y: 336, text: "منزل", tone: "major" },
    { id: "sidi", x: 400, y: 420, text: "سيدي بولبابة", tone: "minor" },
    { id: "mtorrech", x: 510, y: 430, text: "مطرش", tone: "minor" },
    { id: "teboulbou", x: 512, y: 494, text: "تبلبو", tone: "major" },
    { id: "port-industrial", x: 510, y: 124, text: "الميناء الصناعي", tone: "water", anchor: "start" },
    { id: "phospho", x: 520, y: 204, text: "مصب الفوسفوجيبس", tone: "water", size: 12, anchor: "start" },
    { id: "port-fishing", x: 550, y: 286, text: "ميناء الصيد", tone: "water", size: 12, anchor: "start" },
    { id: "north", x: 66, y: 470, text: "الشمال", tone: "minor", size: 12 },
  ] as MapLabel[],
  northArrow: {
    x: 58,
    y: 468,
  },
  scale: {
    x: 56,
    y: 504,
  },
  regionLayouts: {
    "ghannouch-north": {
      path: "M244 60 L334 56 L372 112 L354 176 L284 178 L238 128 Z",
      centroid: [304, 114],
    },
    "industrial-core": {
      path: "M378 120 L442 114 L490 142 L500 216 L444 240 L380 212 L356 170 Z",
      centroid: [434, 176],
    },
    "school-belt": {
      path: "M448 206 L502 190 L544 232 L546 286 L500 316 L450 294 Z",
      centroid: [500, 252],
    },
    "agri-basin": {
      path: "M272 238 L348 250 L354 324 L304 414 L246 390 L230 298 Z",
      centroid: [296, 320],
    },
    "gabes-central": {
      path: "M350 268 L442 264 L462 352 L454 458 L334 442 L312 346 Z",
      centroid: [392, 358],
    },
    "canal-mouth": {
      path: "M426 232 L488 228 L520 274 L510 350 L450 356 L438 294 Z",
      centroid: [474, 292],
    },
    "south-coast": {
      path: "M414 354 L506 350 L548 426 L536 504 L444 512 L404 448 Z",
      centroid: [476, 442],
    },
  } as Record<string, RegionReferenceLayout>,
  phosphogypsumDots: buildPhosphogypsumDots(),
} as const;
