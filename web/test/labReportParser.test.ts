import { describe, expect, it } from 'vitest';
import { LAB_TESTS, type LabTest } from '../src/domain/health';
import { parseLabReport, textLine } from '../src/domain/labReportParser';
import { localDate } from '../src/domain/time';

/**
 * Positions taken from a real Cerballiance report (pdftotext -bbox), without the patient's
 * identity lines: label, result, unit, reference and previous result are separate
 * lines, aligned on the same row.
 */
describe('LabReportParserTest', () => {
  const line = (page: number, left: number, top: number, right: number, bottom: number, text: string) =>
    textLine(text, left, top, right, bottom, page);

  const cerballiance = [
    line(1, 31, 137, 155, 146, 'Prélevé le 19.10.2026 à 09:23'),
    line(1, 53, 497, 91, 506, 'Hématies'),
    line(1, 283, 497, 301, 506, '5,12'),
    line(1, 357, 498, 392, 506, '4,30 - 5,80'),
    line(1, 465, 498, 532, 506, '5,42 Le 08.04.2026'),
    line(1, 53, 509, 108, 518, 'Hémoglobine'),
    line(1, 283, 509, 301, 518, '16,1'),
    line(1, 321, 510, 337, 518, 'g/dL'),
    line(1, 357, 510, 392, 518, '13,4 - 16,7'),
    line(1, 465, 510, 479, 518, '17,1'),
    line(1, 53, 557, 108, 566, 'C.C.M.H'),
    line(1, 283, 557, 301, 566, '34,2'),
    line(1, 321, 558, 337, 566, 'g/dL'),
    line(1, 53, 701, 98, 710, 'Plaquettes'),
    line(1, 283, 701, 298, 710, '199'),
    line(1, 321, 702, 344, 710, 'Giga/L'),
    line(1, 357, 702, 388, 710, '161 - 398'),
    line(1, 465, 702, 477, 710, '204'),
    line(2, 249, 102, 322, 110, 'Prélevé le 19.10.2026'),
    // Read as-is by OCR on the emulator: "C" and "réactive" glued together.
    line(2, 53, 233, 136, 242, 'Protéine Créactive'),
    line(2, 247, 233, 266, 242, '<1,0'),
    line(2, 300, 234, 317, 242, 'mg/L'),
    line(2, 357, 234, 374, 242, '< 5,0'),
    line(2, 465, 234, 527, 242, '0,4 Le 08.04.2026'),
    line(2, 53, 581, 92, 590, 'Ferritine'),
    line(2, 247, 581, 262, 590, '190'),
    line(2, 300, 582, 315, 590, 'µg/L'),
    line(2, 357, 582, 384, 590, '30 - 300'),
    // Laboratory comment: "ferritine" is not at the start of the row there.
    line(2, 53, 700, 540, 709, 'Celui-ci est réalisé si la férritine est normale avec suspicion de carence 12 µg/L'),
  ];

  it('readsTheTrackedTestsOfACerballianceReport', () => {
    const scan = parseLabReport(cerballiance);

    expect(scan.sampleDate).toBe(localDate(2026, 10, 19));
    const byTest = new Map(scan.values.map((v) => [v.test, v]));
    expect(new Set(byTest.keys())).toEqual(
      new Set<LabTest>(['RED_BLOOD_CELLS', 'HEMOGLOBIN', 'MCHC', 'PLATELETS', 'CRP', 'FERRITIN']),
    );
    // "C.C.M.H" (34,2 g/dL) is a separate analysis, not hemoglobin.
    expect(byTest.get('MCHC')!.value).toBe(34.2);
    // Today's result, not the reference (13,4 - 16,7) nor the previous result (17,1).
    const hemoglobin = byTest.get('HEMOGLOBIN')!;
    expect(hemoglobin.value).toBe(16.1);
    expect(hemoglobin.referenceLow).toBe(13.4);
    expect(hemoglobin.referenceHigh).toBe(16.7);
    expect(byTest.get('PLATELETS')!.value).toBe(199.0);
    expect(byTest.get('PLATELETS')!.referenceLow).toBe(161.0);
    expect(byTest.get('FERRITIN')!.value).toBe(190.0);
    // Threshold "< 5,0": only an upper bound; the previous result "0,4" is not read.
    const crp = byTest.get('CRP')!;
    expect(crp.value).toBe(1.0);
    expect(crp.qualifier).toBe('BELOW');
    expect(crp.referenceLow).toBeNull();
    expect(crp.referenceHigh).toBe(5.0);
  });

  it('ignoresAReportWithoutTrackedTests', () => {
    // Unilabs respiratory PCR report: nothing to import.
    const scan = parseLabReport([
      line(1, 40, 120, 400, 130, 'Prélèvement du 05/12/22 à 11H58 au laboratoire'),
      line(1, 40, 200, 300, 210, '- Recherche du Virus SARS-Cov-2 : Positive'),
      line(1, 40, 215, 300, 225, '- Recherche du Virus de la Grippe A : Négative'),
    ]);

    expect(scan.sampleDate).toBe(localDate(2022, 12, 5));
    expect(scan.values).toHaveLength(0);
  });

  it('convertsUnitsAndSkipsLookAlikes', () => {
    const scan = parseLabReport([
      // OCR merging label and result on a single line.
      line(1, 40, 100, 400, 110, '25-OH Vitamine D (D2+D3) 75 nmol/L'),
      line(1, 40, 120, 400, 130, 'Hémoglobine glyquée (HbA1c) 5,6 %'),
      line(1, 40, 140, 120, 150, 'Préalbumine'),
      line(1, 200, 140, 220, 150, '0,25'),
      line(1, 230, 140, 250, 150, 'g/L'),
      line(1, 40, 160, 120, 170, 'Albumine'),
      line(1, 200, 160, 220, 170, '38'),
      line(1, 230, 160, 250, 170, 'g/L'),
      line(1, 40, 180, 120, 190, 'Hémoglobine'),
      line(1, 200, 180, 220, 190, '135'),
      line(1, 230, 180, 250, 190, 'g/L'),
      line(1, 260, 180, 300, 190, '120 - 160'),
    ]);

    const byTest = new Map(scan.values.map((v) => [v.test, v]));
    expect(new Set(byTest.keys())).toEqual(new Set<LabTest>(['VITAMIN_D', 'ALBUMIN', 'HEMOGLOBIN']));
    expect(byTest.get('VITAMIN_D')!.value).toBe(30.045);
    expect(byTest.get('ALBUMIN')!.value).toBe(38.0);
    expect(byTest.get('ALBUMIN')!.qualifier).toBe('EXACT');
    expect(byTest.get('ALBUMIN')!.referenceLow).toBeNull();
    // References are converted like the value: g/L → g/dL.
    const hemoglobin = byTest.get('HEMOGLOBIN')!;
    expect(hemoglobin.value).toBe(13.5);
    expect(hemoglobin.referenceLow).toBe(12.0);
    expect(hemoglobin.referenceHigh).toBe(16.0);
  });

  it('catalogCoversEveryLabTest', () => {
    // Sanity: the ordered catalog is exported and has the 47 tests (43 read from reports, 4 drug monitoring).
    expect(LAB_TESTS).toHaveLength(47);
  });
});
