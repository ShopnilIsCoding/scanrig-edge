/**
 * Mixamo exports may use prefixes such as `mixamorig6:` or `mixamorig9:`.
 * We remove that export-specific namespace so one animation set can target
 * James and Jody through the same canonical bone names.
 */
export function canonicalMixamoName(name = '') {
  return name.replace(/^mixamorig\d*:*/i, '').replace(/^mixamorig\d*/i, '');
}

export function normalizeMixamoRig(root) {
  root.traverse((node) => {
    if (!node.name) return;
    node.name = canonicalMixamoName(node.name);
  });
  return root;
}

export function normalizeMixamoClip(clip) {
  const normalized = clip.clone();
  normalized.tracks.forEach((track) => {
    track.name = track.name.replace(/mixamorig\d*:?/gi, '');
  });
  return normalized;
}
