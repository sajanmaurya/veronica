import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

test('ZXing decodes an EAN-13 grocery barcode using the scanner format hints', () => {
  const barcode = '8901234567890';
  const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const even = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const right = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const parity = 'LGLGGL'; // EAN-13 leading digit 8

  let bits = '101';
  for (let index = 1; index <= 6; index++) {
    bits += (parity[index - 1] === 'L' ? left : even)[Number(barcode[index])];
  }
  bits += '01010';
  for (let index = 7; index < 13; index++) bits += right[Number(barcode[index])];
  bits += '101';

  const width = 480, height = 180, moduleWidth = 4;
  const luminance = new Uint8ClampedArray(width * height).fill(255);
  const startX = Math.floor((width - bits.length * moduleWidth) / 2);
  for (let index = 0; index < bits.length; index++) {
    if (bits[index] === '0') continue;
    for (let y = 20; y < height - 20; y++) {
      for (let x = startX + index * moduleWidth; x < startX + (index + 1) * moduleWidth; x++) {
        luminance[y * width + x] = 0;
      }
    }
  }

  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  ]);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
  // The initial, fast pass must work for clear retail barcodes.
  assert.equal(reader.decodeWithState(bitmap).getText(), barcode);

  // After a short timeout the scanner enables the more thorough pass.
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  assert.equal(reader.decodeWithState(bitmap).getText(), barcode);
});
