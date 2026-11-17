import test from 'node:test';
import assert from 'node:assert/strict';
import { getPreferredBarcodeCamera, sortBarcodeCameras } from '../lib/barcodeCamera.mjs';

test('camera choices favor the main rear lens over ultra-wide, telephoto and selfie', () => {
  const devices = [
    { deviceId: 'wide', label: 'Camera 2, facing back ultra-wide' },
    { deviceId: 'front', label: 'Camera 1, facing front' },
    { deviceId: 'main', label: 'Camera 0, facing back' },
    { deviceId: 'tele', label: 'Camera 3, facing back telephoto' },
  ];
  assert.deepEqual(sortBarcodeCameras(devices).map((camera) => camera.deviceId), [
    'main', 'wide', 'tele', 'front',
  ]);
  // Do not mutate browser-provided device lists.
  assert.equal(devices[0].deviceId, 'wide');
});

test('unlabelled cameras keep their browser-supplied order', () => {
  const devices = [
    { deviceId: 'first', label: '' },
    { deviceId: 'second', label: '' },
  ];
  assert.deepEqual(sortBarcodeCameras(devices), devices);
  assert.equal(getPreferredBarcodeCamera(devices), null);
});

test('automatic scanning selects camera zero over a second generic rear lens', () => {
  const devices = [
    { deviceId: 'rear2', label: 'Camera 2, facing back' },
    { deviceId: 'front', label: 'Camera 1, facing front' },
    { deviceId: 'rear0', label: 'Camera 0, facing back' },
  ];
  assert.equal(getPreferredBarcodeCamera(devices)?.deviceId, 'rear0');
});

test('automatic selection never picks a front-only or known blurry lens', () => {
  assert.equal(getPreferredBarcodeCamera([
    { deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
    { deviceId: 'front', label: 'Front Selfie Camera' },
  ]), null);
  assert.equal(getPreferredBarcodeCamera([
    { deviceId: 'main', label: 'Main Rear Camera' },
    { deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
  ])?.deviceId, 'main');
});
