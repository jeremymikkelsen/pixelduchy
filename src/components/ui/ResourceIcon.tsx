/**
 * ResourceIcon — renders pixel art resource icons inline, replacing emoji icons.
 * Falls back to the emoji string if the resource type isn't in our icon set.
 */

import { resourceIconDataUrl, type ResourceIconKey, RESOURCE_ICONS } from '../../generators/ResourceIcons';

const VALID_KEYS = new Set<string>(Object.keys(RESOURCE_ICONS));

interface ResourceIconProps {
  /** Resource type key (e.g. 'timber', 'gold') */
  type: string;
  /** Fallback emoji string if type isn't in our icon set */
  fallback?: string;
  /** Display size in px (default 16) */
  size?: number;
}

export function ResourceIcon({ type, fallback, size = 16 }: ResourceIconProps) {
  if (VALID_KEYS.has(type)) {
    const url = resourceIconDataUrl(type as ResourceIconKey);
    return (
      <img
        src={url}
        alt={type}
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated', verticalAlign: 'middle' }}
      />
    );
  }
  // Fallback to emoji
  return <span>{fallback ?? type}</span>;
}
