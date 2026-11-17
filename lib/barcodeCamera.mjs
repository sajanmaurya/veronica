/** Sort physical camera choices so a usable main rear lens is listed first. */
export function sortBarcodeCameras(devices = []) {
  const rank = (device) => {
    const label = String(device.label || '').toLowerCase();
    let score = 0;
    if (/back|rear|environment/.test(label)) score += 20;
    if (/main|primary|standard|camera\s*0\b|camera2\s*0\b/.test(label)) score += 10;
    if (/ultra.?wide|0\.5x|telephoto|\btele\b|\bzoom\b|\bmacro\b/.test(label)) score -= 30;
    if (/front|selfie|user facing/.test(label)) score -= 50;
    return score;
  };

  return [...devices]
    .map((device, index) => ({ device, index }))
    .sort((a, b) => rank(b.device) - rank(a.device) || a.index - b.index)
    .map(({ device }) => device);
}

/** Prefer a main rear lens when labels identify one. "Camera 0" is a helpful
 * Android heuristic, not a guaranteed lens mapping across phone models.
 */
export function getPreferredBarcodeCamera(devices = []) {
  return sortBarcodeCameras(devices).find((device) => {
    if (!device.deviceId) return false;
    const label = String(device.label || '').toLowerCase();
    const isRear = /back|rear|environment/.test(label);
    const isMain = /main|primary|standard|camera\s*0\b|camera2\s*0\b/.test(label);
    const isUnsuitable = /front|selfie|user facing|ultra.?wide|0\.5x|telephoto|\btele\b|\bzoom\b|\bmacro\b/.test(label);
    return !isUnsuitable && (isRear || isMain);
  }) || null;
}
