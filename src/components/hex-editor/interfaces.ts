export interface IRegion {
  start: number;
  end: number;
  name?: string;
  description?: string;
  color?: string;
  subRegions?: IRegion[];
}

export enum EditingMode {
  ASCII,
  BYTE,
  BIT
}
export enum SearchType {
  ASCII,
  BYTE,
  INTEGER,
  FLOAT
}
export enum NonLetter {
  DOT = "\u2022",
  CROSS = "\u2573",
  FULL_BLOCK = "\u2588",
  LIGHT_SHADE = "\u2591",
  MEDIUM_SHADE = "\u2592",
  DARK_SHADE = "\u2593",
  DASH = "-",
  PLUS = "+"
}

export type Endianness = 'big' | 'little';