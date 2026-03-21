// Resource pixel-art icons — 12×12 hand-drawn sprites for UI display
// Light source: upper-left. 3/4 top-down where applicable.
// 0 = transparent pixel, otherwise RGB hex (0xRRGGBB).

export type ResourceIconKey =
  | 'timber'
  | 'ore'
  | 'stone'
  | 'iron'
  | 'cloth'
  | 'gold'
  | 'grain'
  | 'cattle'
  | 'apples'
  | 'fish'
  | 'smoked_meat'
  | 'bread';

export interface PixelIcon {
  w: number;
  h: number;
  data: number[];
}

// Shorthand aliases used inside pixel grids
// timber
const TB = 0x5c4430; // bark brown
const TF = 0xc0a070; // cut face tan
const TR = 0x8a6a40; // rings

// ore
const OD = 0x6a3818; // dark
const OM = 0x8a5030; // medium
const OH = 0xa86840; // highlight

// stone
const SD = 0x585050; // dark grey
const SM = 0x787070; // medium
const SL = 0x989090; // light

// iron
const ID = 0x404048; // dark
const IM = 0x606068; // medium
const IH = 0x808088; // highlight
const IS = 0xa0a0a8; // shine

// cloth
const CS = 0xc0b098; // shadow
const CM = 0xd8c8a8; // mid
const CL = 0xf0e0c8; // light

// gold
const GD = 0x8a6a10; // dark
const GM = 0xc9a227; // medium
const GB = 0xe8c840; // bright
const GS = 0xf8e060; // shine

// grain
const GK = 0x8a7a30; // stalk
const GH = 0xc0a840; // grain head
const GL = 0xe0c850; // highlight

// cattle
const CB = 0x8a6830; // body
const CD = 0x6a4820; // dark
const CW = 0xc0a878; // belly / white patches

// apples
const AD = 0xa02020; // red dark
const AL = 0xd03030; // red light
const AF = 0x408020; // leaf
const AS = 0x5a3818; // stem

// fish
const FB = 0x8098b0; // body
const FW = 0xc0d0e0; // belly
const FF = 0x6080a0; // fin
const FE = 0x202020; // eye

// smoked_meat
const MD = 0x6a2018; // dark
const MM = 0x8a3828; // medium
const MF = 0xc09870; // fat

// bread
const BD = 0x8a6830; // dark crust
const BC = 0xb08840; // crust
const BB = 0xd8b860; // crumb
const BS = 0x9a7838; // score line

const __ = 0; // transparent

// prettier-ignore
const TIMBER_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, TF, TF, TR, TB, __, __, __, __, __,
  __, __, TF, TF, TR, TF, TB, TB, __, __, __, __,
  __, TF, TF, TR, TF, TF, TB, TB, TB, __, __, __,
  __, TB, TB, TB, TB, TB, TB, TB, TB, __, __, __,
  __, __, __, TF, TF, TR, TB, __, __, __, __, __,
  __, __, TF, TF, TR, TF, TB, TB, __, __, __, __,
  __, TB, TB, TB, TB, TB, TB, TB, __, __, __, __,
  __, __, TF, TF, TF, TR, TB, __, __, __, __, __,
  __, TF, TF, TR, TF, TF, TB, TB, __, __, __, __,
  __, TB, TB, TB, TB, TB, TB, TB, TB, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const ORE_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, OH, OM, __, __, __, __, __, __,
  __, __, __, OH, OM, OD, OM, __, __, __, __, __,
  __, __, OH, OM, OD, OM, OD, __, __, __, __, __,
  __, __, OM, OD, OM, OD, __, __, OH, __, __, __,
  __, __, __, OM, OD, __, __, OH, OM, __, __, __,
  __, __, __, __, __, OH, OH, OM, OD, OM, __, __,
  __, __, OH, OM, OH, OM, OM, OD, OM, OD, __, __,
  __, OH, OM, OD, OM, OD, OD, OM, OD, __, __, __,
  __, OM, OD, OM, OD, OM, OM, OD, __, __, __, __,
  __, __, OM, OD, OM, OD, OD, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const STONE_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, SL, SL, SL, SL, SL, SM, SM, SD, __, __,
  __, __, SL, SL, SM, SL, SM, SM, SD, SD, __, __,
  __, __, SL, SM, SD, SM, SM, SM, SD, SD, __, __,
  __, __, SL, SM, SM, SM, SM, SD, SD, SD, __, __,
  __, __, SM, SM, SD, SM, SM, SD, SD, SD, __, __,
  __, __, SM, SM, SM, SD, SM, SD, SD, SD, __, __,
  __, __, SM, SD, SM, SM, SD, SD, SD, SD, __, __,
  __, __, SM, SM, SD, SM, SD, SD, SD, SD, __, __,
  __, __, SD, SD, SD, SD, SD, SD, SD, SD, __, __,
  __, __, SD, SD, SD, SD, SD, SD, SD, SD, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const IRON_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, IS, IH, IH, IH, IM, __, __, __, __,
  __, __, IS, IS, IH, IH, IM, IM, ID, __, __, __,
  __, __, IS, IH, IH, IM, IM, ID, ID, __, __, __,
  __, __, IH, IH, IM, IM, ID, ID, ID, __, __, __,
  __, __, IH, IM, IM, ID, ID, ID, ID, __, __, __,
  __, __, IM, IM, ID, ID, ID, ID, ID, __, __, __,
  __, __, IM, ID, ID, ID, ID, ID, ID, __, __, __,
  __, __, __, ID, ID, ID, ID, ID, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const CLOTH_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, CL, CL, CM, __, __, __, __, __,
  __, __, __, CL, CL, CM, CM, CS, __, __, __, __,
  __, __, CL, CL, CM, CM, CS, CS, __, __, __, __,
  __, __, CL, CM, CM, CS, CS, CS, __, __, __, __,
  __, __, CL, CM, CM, CS, CS, CS, __, __, __, __,
  __, __, CL, CM, CM, CS, CS, CS, __, __, __, __,
  __, __, CL, CM, CM, CS, CS, CS, __, __, __, __,
  __, __, CL, CM, CM, CS, CS, CS, __, __, __, __,
  __, __, CM, CM, CS, CS, CS, CS, __, __, __, __,
  __, __, CS, CS, CS, CS, CS, CS, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const GOLD_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, GS, GB, GB, GM, __, __, __, __, __,
  __, __, GS, GB, GB, GM, GM, GD, __, __, __, __,
  __, __, GM, GM, GD, GD, GD, GD, __, __, __, __,
  __, __, __, GS, GB, GB, GM, __, __, __, __, __,
  __, __, GS, GB, GB, GM, GM, GD, __, __, __, __,
  __, __, GM, GM, GD, GD, GD, GD, __, __, __, __,
  __, __, __, GS, GB, GB, GM, __, __, __, __, __,
  __, __, GS, GB, GB, GM, GM, GD, __, __, __, __,
  __, __, GM, GM, GD, GD, GD, GD, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const GRAIN_DATA: number[] = [
  __, __, __, __, __, GL, __, __, __, __, __, __,
  __, __, __, __, GL, GH, GL, __, __, __, __, __,
  __, __, __, GL, GH, GK, GH, GL, __, __, __, __,
  __, __, __, GH, GK, GK, GK, GH, __, __, __, __,
  __, __, __, __, GH, GK, GH, __, __, __, __, __,
  __, __, __, __, GL, GK, GL, __, __, __, __, __,
  __, __, __, __, __, GK, __, __, __, __, __, __,
  __, __, __, __, __, GK, __, __, __, __, __, __,
  __, __, __, __, __, GK, __, __, __, __, __, __,
  __, __, __, __, __, GK, __, __, __, __, __, __,
  __, __, __, __, GK, GK, GK, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const CATTLE_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, CD, CD, __, __, __, __, __, __, __, __,
  __, CD, CB, CB, CD, __, __, __, __, __, __, __,
  __, __, CB, CB, CB, CB, CB, CB, CB, __, __, __,
  __, __, CB, CB, CB, CB, CB, CB, CB, CB, __, __,
  __, __, CW, CB, CB, CB, CB, CB, CB, CB, __, __,
  __, __, __, CW, CW, CW, CB, CB, CB, CB, __, __,
  __, __, __, CB, CW, CW, CW, CB, CB, __, __, __,
  __, __, __, CD, __, __, __, CD, __, __, __, __,
  __, __, __, CD, __, __, __, CD, __, __, __, __,
  __, __, CD, CD, __, __, CD, CD, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const APPLES_DATA: number[] = [
  __, __, __, __, __, AS, __, __, __, __, __, __,
  __, __, __, __, AS, AS, AF, AF, __, __, __, __,
  __, __, __, __, __, AF, AF, AF, __, __, __, __,
  __, __, __, AL, AL, AL, AL, __, __, __, __, __,
  __, __, AL, AL, AL, AL, AL, AL, __, __, __, __,
  __, AL, AL, AL, AL, AD, AL, AL, AL, __, __, __,
  __, AL, AL, AD, AL, AD, AD, AL, AL, __, __, __,
  __, AL, AL, AD, AD, AD, AD, AL, AL, __, __, __,
  __, __, AL, AD, AD, AD, AD, AL, __, __, __, __,
  __, __, __, AD, AD, AD, AD, __, __, __, __, __,
  __, __, __, __, AD, AD, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const FISH_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, FB, FB, __, __, __,
  __, FF, __, __, __, FB, FB, FB, FB, FB, __, __,
  FF, FF, FF, FB, FB, FB, FB, FB, FE, FB, FB, __,
  __, FF, FB, FB, FB, FB, FB, FB, FB, FB, FB, FB,
  __, FF, FB, FW, FW, FW, FW, FW, FB, FB, FB, FB,
  FF, FF, FF, FW, FW, FW, FW, FW, FW, FB, FB, __,
  __, FF, __, __, FW, FW, FW, FW, FW, FB, __, __,
  __, __, __, __, __, __, __, FW, FB, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const SMOKED_MEAT_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, MM, MM, MM, MM, MM, __, __, __, __,
  __, __, MM, MM, MM, MF, MM, MM, MM, __, __, __,
  __, MM, MM, MF, MF, MF, MM, MM, MM, MM, __, __,
  __, MM, MF, MF, MF, MM, MM, MD, MM, MM, __, __,
  __, MM, MM, MF, MM, MM, MD, MD, MD, MM, __, __,
  __, MM, MM, MM, MM, MD, MD, MD, MD, MM, __, __,
  __, __, MM, MM, MD, MD, MD, MD, MD, __, __, __,
  __, __, __, MD, MD, MD, MD, MD, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

// prettier-ignore
const BREAD_DATA: number[] = [
  __, __, __, __, __, __, __, __, __, __, __, __,
  __, __, __, __, BB, BB, BB, __, __, __, __, __,
  __, __, __, BB, BB, BB, BB, BB, __, __, __, __,
  __, __, BB, BB, BS, BB, BS, BB, BC, __, __, __,
  __, BB, BB, BS, BB, BS, BB, BB, BC, BC, __, __,
  __, BB, BB, BB, BS, BB, BS, BC, BC, BC, __, __,
  __, BB, BC, BB, BB, BS, BC, BC, BD, BC, __, __,
  __, BC, BC, BC, BC, BC, BC, BD, BD, BD, __, __,
  __, __, BC, BC, BC, BD, BD, BD, BD, __, __, __,
  __, __, __, BC, BD, BD, BD, BD, __, __, __, __,
  __, __, __, __, BD, BD, BD, __, __, __, __, __,
  __, __, __, __, __, __, __, __, __, __, __, __,
];

export const RESOURCE_ICONS: Record<ResourceIconKey, PixelIcon> = {
  timber:      { w: 12, h: 12, data: TIMBER_DATA },
  ore:         { w: 12, h: 12, data: ORE_DATA },
  stone:       { w: 12, h: 12, data: STONE_DATA },
  iron:        { w: 12, h: 12, data: IRON_DATA },
  cloth:       { w: 12, h: 12, data: CLOTH_DATA },
  gold:        { w: 12, h: 12, data: GOLD_DATA },
  grain:       { w: 12, h: 12, data: GRAIN_DATA },
  cattle:      { w: 12, h: 12, data: CATTLE_DATA },
  apples:      { w: 12, h: 12, data: APPLES_DATA },
  fish:        { w: 12, h: 12, data: FISH_DATA },
  smoked_meat: { w: 12, h: 12, data: SMOKED_MEAT_DATA },
  bread:       { w: 12, h: 12, data: BREAD_DATA },
};

// ---------------------------------------------------------------------------
// Helper: render a PixelIcon to a data-URL (cached)
// ---------------------------------------------------------------------------

const dataUrlCache = new Map<ResourceIconKey, string>();

/** Render a resource icon to a data URL for use in React components */
export function resourceIconDataUrl(key: ResourceIconKey): string {
  const cached = dataUrlCache.get(key);
  if (cached) return cached;

  const icon = RESOURCE_ICONS[key];
  const canvas = document.createElement('canvas');
  canvas.width = icon.w;
  canvas.height = icon.h;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(icon.w, icon.h);
  const buf = imageData.data; // Uint8ClampedArray, 4 bytes per pixel

  for (let i = 0; i < icon.data.length; i++) {
    const hex = icon.data[i];
    const off = i * 4;
    if (hex === 0) {
      // transparent
      buf[off] = 0;
      buf[off + 1] = 0;
      buf[off + 2] = 0;
      buf[off + 3] = 0;
    } else {
      buf[off] = (hex >> 16) & 0xff;     // R
      buf[off + 1] = (hex >> 8) & 0xff;  // G
      buf[off + 2] = hex & 0xff;         // B
      buf[off + 3] = 255;                // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const url = canvas.toDataURL('image/png');
  dataUrlCache.set(key, url);
  return url;
}
