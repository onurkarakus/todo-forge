const PATHS: Record<string, string> = {
  checklist: "M2 4h2v2H2zm4 .5h8v1H6zm-4 4h2v2H2zm4 .5h8v1H6zm-4 4h2v2H2zm4 .5h8v1H6z",
  flame: "M8 1s4 3 4 7a4 4 0 1 1-8 0c0-1 .5-2 1-3 0 1 1 2 2 2 0-2 1-4 1-6z",
  tools: "M6 2l2 2-4 4-2-2zm6 1l2 2-6 6-1-1 1-2zM2 12h12v2H2z",
  bug: "M6 3h4v2h2v2H4V5h2zm-2 5h8v1H4zm0 2h8v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
  note: "M3 2h7l3 3v9H3zm7 0v3h3",
  warning: "M8 1l7 13H1zm-1 5v4h2V6zm0 5v2h2v-2z",
  eye: "M1 8s3-5 7-5 7 5 7 5-3 5-7 5S1 8 1 8zm7 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  zap: "M9 1L3 9h5l-1 6 6-8H8z",
  circle: "M8 3a5 5 0 1 0 .01 10.01A5 5 0 0 0 8 3z",
  history: "M8 2a6 6 0 1 1-5.7 4.1l1.9.6A4 4 0 1 0 8 4V2zm-.75 2.5h1.5v3.2l2.3 1.4-.8 1.3-3-1.8z",
  "circle-slash": "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 1.6c.9 0 1.8.3 2.5.8L4.4 10.5A4.4 4.4 0 0 1 8 3.6zm0 8.8c-.9 0-1.8-.3-2.5-.8l6.1-6.1A4.4 4.4 0 0 1 8 12.4z",
  archive: "M2 3h12v3H2zm1 4h10v7H3zm3 2v1.5h4V9z",
  pin: "M10 1l5 5-2 1-3 3 .5 3-1.5 1.5L6 11l-4 4-1-1 4-4-3.5-3L3 5.5l3 .5 3-3z",
  star: "M8 1l2.1 4.6 4.9.5-3.7 3.3 1.1 4.9L8 11.8l-4.4 2.5 1.1-4.9L1 6.1l4.9-.5z",
  check: "M6.2 12.5L2.5 8.8l1.4-1.4 2.3 2.3 5.9-5.9 1.4 1.4z",
  x: "M4.1 3L8 6.9 11.9 3 13 4.1 9.1 8 13 11.9 11.9 13 8 9.1 4.1 13 3 11.9 6.9 8 3 4.1z",
  info: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.7 6h-1.4v5h1.4zM8 3.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z",
  lightbulb: "M8 1a5 5 0 0 0-3 9v2h6V10a5 5 0 0 0-3-9zM6.5 13h3v1.2l-1.5 1-1.5-1z",
  beaker: "M5 1h6v2l-2 5v6H7V8L5 3z",
  comment: "M2 2h12v9H7l-3 3v-3H2z",
  link: "M6 8a3 3 0 0 1 3-3h3v2H9a1 1 0 0 0 0 2h1v2H9a3 3 0 0 1-3-3zm4 0a3 3 0 0 1 3 3h-2a1 1 0 0 0 0-2H9V7h1z",
  clock: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.7 3H7.3v4.2l3 1.8.7-1.2-2.3-1.4z",
  bookmark: "M4 1h8v14l-4-3-4 3z",
  shield: "M8 1l6 2v5c0 4-3 6.5-6 8-3-1.5-6-4-6-8V3z",
  sparkle: "M8 1l1.2 4.2L13 6.5 9.2 8.3 8 13 6.8 8.3 3 6.5l3.8-1.3z",
  key: "M9 2a4 4 0 1 0 2.3 7.3L15 13v2h-3v-2h-2v-2.1A4 4 0 0 0 9 2zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
};

export const iconSvg = (name: string, color: string): string => {
  const path = PATHS[name] ?? PATHS.circle;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="${color}" fill-rule="evenodd" d="${path}"/></svg>`;
};

/** Codicon id for the tree view. */
export const codiconFor = (name: string): string => {
  if (name === "circle") {
    return "circle-filled";
  }
  if (name === "x") {
    return "close";
  }
  return name;
};
