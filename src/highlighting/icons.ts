const PATHS: Record<string, string> = {
  checklist: "M2 4h2v2H2zm4 .5h8v1H6zm-4 4h2v2H2zm4 .5h8v1H6zm-4 4h2v2H2zm4 .5h8v1H6z",
  flame: "M8 1s4 3 4 7a4 4 0 1 1-8 0c0-1 .5-2 1-3 0 1 1 2 2 2 0-2 1-4 1-6z",
  tools: "M6 2l2 2-4 4-2-2zm6 1l2 2-6 6-1-1 1-2zM2 12h12v2H2z",
  bug: "M6 3h4v2h2v2H4V5h2zm-2 5h8v1H4zm0 2h8v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
  note: "M3 2h7l3 3v9H3zm7 0v3h3",
  warning: "M8 1l7 13H1zm0 4v4m0 2v1",
  eye: "M1 8s3-5 7-5 7 5 7 5-3 5-7 5S1 8 1 8zm7 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  zap: "M9 1L3 9h5l-1 6 6-8H8z",
  circle: "M8 3a5 5 0 1 0 .01 10.01A5 5 0 0 0 8 3z",
};

export const iconSvg = (name: string, color: string): string => {
  const path = PATHS[name] ?? PATHS.circle;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="${color}" d="${path}"/></svg>`;
};

export const codiconFor = (name: string): string => {
  if (name === "circle") {
    return "circle-filled";
  }
  return name;
};
