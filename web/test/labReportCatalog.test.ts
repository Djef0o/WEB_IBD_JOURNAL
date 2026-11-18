import { describe, expect, it } from 'vitest';
import type { LabTest } from '../src/domain/health';
import { parseLabReport, textLine, type DetectedLabValue } from '../src/domain/labReportParser';
import { localDate } from '../src/domain/time';

/**
 * Rows of a real, complete Cerballiance report (pdftotext -bbox), without the identity
 * lines: white-cell differential in % then absolute value, converted units
 * (creatinine and bilirubin in mg/L → µmol/L), references "30 à 300", "> 60", "< 50".
 */
describe('LabReportCatalogTest', () => {
  const line = (page: number, left: number, top: number, right: number, bottom: number, text: string) =>
    textLine(text, left, top, right, bottom, page);

  const report = [
    line(1, 31, 137, 155, 146, 'Prélevé le 08.04.2026 à 07:26'),
    line(1, 53, 497, 103, 506, 'Hématocrite'),
    line(1, 234, 500, 237, 505, '*'),
    line(1, 247, 497, 265, 506, '49,4'),
    line(1, 307, 498, 314, 506, '%'),
    line(1, 357, 498, 392, 506, '39,0 - 49,0'),
    line(1, 465, 498, 479, 506, '45,0'),
    line(1, 53, 509, 82, 518, 'V.G.M'),
    line(1, 247, 509, 257, 518, '91'),
    line(1, 307, 510, 314, 518, 'fL'),
    line(1, 357, 510, 380, 518, '78 - 97'),
    line(1, 465, 510, 473, 518, '89'),
    line(1, 53, 605, 127, 614, 'Poly. neutrophiles'),
    line(1, 170, 606, 184, 614, '46,6'),
    line(1, 199, 606, 206, 614, '%'),
    line(1, 221, 606, 232, 614, 'soit'),
    line(1, 247, 605, 265, 614, '2,84'),
    line(1, 300, 606, 322, 614, 'Giga/L'),
    line(1, 357, 606, 394, 614, '1,78 - 6,95'),
    line(1, 465, 606, 479, 614, '3,06'),
    line(1, 53, 617, 127, 626, 'Poly. éosinophiles'),
    line(1, 170, 618, 180, 626, '2,0'),
    line(1, 199, 618, 206, 626, '%'),
    line(1, 221, 618, 232, 626, 'soit'),
    line(1, 247, 617, 265, 626, '0,12'),
    line(1, 300, 618, 322, 626, 'Giga/L'),
    line(1, 357, 618, 392, 626, '0,05 - 0,63'),
    line(1, 465, 618, 479, 626, '0,16'),
    line(2, 53, 269, 117, 278, 'CREATININE'),
    line(2, 247, 269, 265, 278, '11,2'),
    line(2, 300, 270, 317, 278, 'mg/L'),
    line(2, 357, 270, 388, 278, '7,2 - 11,8'),
    line(2, 465, 270, 532, 278, '10,2 Le 11.10.2025'),
    line(2, 54, 284, 142, 289, 'Enzymatique, AU Beckman (DI) (c)'),
    line(2, 206, 282, 218, 289, 'soit'),
    line(2, 249, 282, 263, 289, '99,0'),
    line(2, 300, 282, 324, 290, 'µmol/L'),
    line(2, 357, 282, 396, 290, '63,6 - 104,3'),
    line(2, 53, 365, 160, 374, 'Débit de filtration calculé:'),
    line(2, 247, 365, 257, 374, '75'),
    line(2, 300, 366, 347, 374, 'ml/mn/1,73m2'),
    line(2, 357, 366, 372, 374, '> 60'),
    // DFG evolution chart, further down: label repeated with no value on its row.
    line(2, 84, 385, 168, 393, 'Débit de filtration calculé:'),
    line(2, 53, 581, 113, 590, 'POTASSIUM'),
    line(2, 247, 581, 260, 590, '4,3'),
    line(2, 300, 582, 325, 590, 'mmol/L'),
    line(2, 357, 582, 384, 590, '3,4 - 4,5'),
    line(2, 465, 582, 475, 590, '4,1'),
    line(2, 53, 629, 109, 638, 'FERRITINE'),
    line(2, 247, 629, 262, 638, '167'),
    line(2, 300, 630, 319, 638, 'ng/ml'),
    line(2, 357, 630, 385, 638, '30 à 300'),
    line(2, 465, 630, 530, 638, '171 Le 09.04.2025'),
    line(3, 53, 329, 200, 338, 'TRANSAMINASES TGO (ASAT)'),
    line(3, 247, 329, 257, 338, '25'),
    line(3, 300, 330, 313, 338, 'U/L'),
    line(3, 357, 330, 372, 338, '< 50'),
    line(3, 465, 330, 526, 338, '25 Le 09.04.2025'),
    line(3, 53, 473, 157, 482, 'BILIRUBINE TOTALE'),
    line(3, 247, 473, 260, 482, '8,9'),
    line(3, 300, 474, 317, 482, 'mg/L'),
    line(3, 357, 474, 388, 482, '3,0 - 12,0'),
    line(3, 465, 474, 475, 482, '9,4'),
    line(3, 53, 497, 214, 506, 'BILIRUBINE DIRECTE (conjuguée)'),
    line(3, 247, 497, 260, 506, '1,9'),
    line(3, 300, 498, 317, 506, 'mg/L'),
    line(3, 357, 498, 374, 506, '< 2,0'),
    line(3, 465, 498, 475, 506, '1,4'),
  ];

  const assertClose = (expected: number, actual: number | null | undefined) => {
    expect(actual != null && Math.abs(expected - actual) < 0.01, `attendu ${expected}, lu ${actual}`).toBe(true);
  };

  const check = (
    byTest: Map<LabTest, DetectedLabValue>, test: LabTest, value: number, low: number | null, high: number | null,
  ) => {
    const detected = byTest.get(test)!;
    expect(detected, `${test} détecté`).toBeDefined();
    assertClose(value, detected.value);
    if (low === null) expect(detected.referenceLow, `${test} : borne basse`).toBeNull();
    else assertClose(low, detected.referenceLow);
    if (high === null) expect(detected.referenceHigh, `${test} : borne haute`).toBeNull();
    else assertClose(high, detected.referenceHigh);
  };

  it('readsEveryValueOfAFullReport', () => {
    const scan = parseLabReport(report);
    const byTest = new Map(scan.values.map((v) => [v.test, v]));

    expect(scan.sampleDate).toBe(localDate(2026, 4, 8));
    expect(byTest.size, [...byTest.keys()].toString()).toBe(11);
    check(byTest, 'HEMATOCRIT', 49.4, 39.0, 49.0);
    check(byTest, 'MCV', 91.0, 78.0, 97.0);
    // Absolute value, not the percentage printed before.
    check(byTest, 'NEUTROPHILS', 2.84, 1.78, 6.95);
    check(byTest, 'EOSINOPHILS', 0.12, 0.05, 0.63);
    // mg/L → µmol/L, references converted the same way (the lab prints 99,0 and 63,6 – 104,3).
    check(byTest, 'CREATININE', 99.0, 63.65, 104.31);
    check(byTest, 'EGFR', 75.0, 60.0, null);
    check(byTest, 'POTASSIUM', 4.3, 3.4, 4.5);
    check(byTest, 'FERRITIN', 167.0, 30.0, 300.0);
    check(byTest, 'AST', 25.0, null, 50.0);
    check(byTest, 'BILIRUBIN_TOTAL', 15.22, 5.13, 20.52);
    check(byTest, 'BILIRUBIN_DIRECT', 3.25, null, 3.42);
  });

  it('survivesTheUnitsTheOcrDrops', () => {
    // Real OCR readings from the emulator: date dot read as a comma, "%"
    // lost before the absolute value, DFG unit misread ("mI/mn") whose "1,73"
    // must not be mistaken for the result.
    const scan = parseLabReport([
      line(1, 31, 137, 155, 146, 'Prélevé le 19,05.2023 à 07:40'),
      line(1, 53, 593, 127, 602, 'Poly. basophiles'),
      line(1, 170, 594, 184, 602, '1.1'),
      line(1, 221, 593, 265, 602, 'Soit 0,07'),
      line(1, 300, 594, 322, 602, 'Giga/L'),
      line(1, 357, 593, 394, 602, '0,00 -0, 10'),
      line(1, 465, 594, 479, 602, '0,08'),
      line(1, 53, 605, 127, 614, 'Poly. neutrophiles'),
      line(1, 170, 606, 184, 614, '50,3'),
      line(1, 221, 606, 232, 614, 'soit'),
      line(1, 247, 605, 265, 614, '2,92'),
      line(1, 300, 606, 322, 614, 'Giga/L'),
      line(1, 357, 606, 394, 614, '1,78 - 6,95'),
      line(2, 53, 365, 160, 374, 'Débit de filtration calculé:'),
      line(2, 247, 365, 257, 374, '74'),
      line(2, 300, 366, 347, 374, 'mI/mn/1,73m2'),
      line(2, 357, 366, 372, 374, '> 60'),
    ]);
    const byTest = new Map(scan.values.map((v) => [v.test, v]));
    expect(scan.sampleDate).toBe(localDate(2023, 5, 19));
    check(byTest, 'NEUTROPHILS', 2.92, 1.78, 6.95);
    assertClose(74.0, byTest.get('EGFR')?.value);
    // "Soit 0,07" merged and reference "0,00 -0, 10" split by a space.
    check(byTest, 'BASOPHILS', 0.07, 0.0, 0.1);
  });

  it('neverTakesAReferenceForALostResult', () => {
    // OCR lost the result: neither the reference nor the previous result must replace it.
    const scan = parseLabReport([
      line(1, 53, 100, 120, 109, 'FER SERIQUE'),
      line(1, 300, 101, 320, 109, 'µg/dL'),
      line(1, 357, 101, 400, 109, 'à jeun 70-180'),
      line(1, 465, 101, 530, 109, '105 Le 17.08.2024'),
      line(1, 53, 120, 160, 129, 'Débit de filtration calculé:'),
      line(1, 300, 121, 347, 129, 'ml/mn/1,73m2'),
      line(1, 357, 121, 372, 129, '> 60'),
      line(1, 53, 140, 130, 149, 'Bilirubine totale'),
      line(1, 357, 141, 372, 149, '< 24'),
      // Unit unreadable too: the previous result "318" stays discarded.
      line(1, 53, 200, 160, 209, 'CAPACITE TOTALE DE FIXATION'),
      line(1, 300, 201, 320, 209, 'pg/dL'),
      line(1, 357, 201, 392, 209, '280 - 450'),
      line(1, 465, 201, 479, 209, '318'),
      // Unit lost but result read: it remains the first number.
      line(1, 53, 160, 110, 169, 'Hémoglobine'),
      line(1, 247, 160, 265, 169, '16,1'),
      line(1, 357, 161, 392, 169, '13,4 - 16,7'),
      line(1, 465, 161, 479, 169, '17,1'),
    ]);
    const byTest = new Map(scan.values.map((v) => [v.test, v]));
    expect(new Set(byTest.keys())).toEqual(new Set<LabTest>(['HEMOGLOBIN']));
    check(byTest, 'HEMOGLOBIN', 16.1, 13.4, 16.7);
  });
});
