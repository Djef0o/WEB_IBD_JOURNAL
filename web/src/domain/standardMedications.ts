export const MEDICATION_CATEGORIES = [
  'AMINOSALICYLATES',
  'CORTICOSTEROIDS',
  'IMMUNOSUPPRESSANTS',
  'BIOLOGICS',
  'SMALL_MOLECULES',
  'ANTIBIOTICS',
  'SUPPORTIVE',
] as const;
export type MedicationCategory = (typeof MEDICATION_CATEGORIES)[number];

export const INDICATIONS = ['CROHN', 'UC'] as const;
export type Indication = (typeof INDICATIONS)[number];

/** Supportive treatments whose name is translated (unlike INNs). */
export const SUPPORTIVE_MEDICATIONS = [
  'IRON', 'VITAMIN_D', 'VITAMIN_B12', 'FOLIC_ACID', 'CALCIUM', 'LOPERAMIDE',
] as const;
export type SupportiveMedication = (typeof SUPPORTIVE_MEDICATIONS)[number];

/**
 * Medication from the standard list: an INN (`inn`, identical across languages) or a
 * supportive treatment (`supportive`) whose label is translated by the UI.
 */
export interface StandardMedication {
  readonly category: MedicationCategory;
  readonly indications: readonly Indication[];
  readonly inn: string | null;
  readonly supportive: SupportiveMedication | null;
}

const BOTH: readonly Indication[] = ['CROHN', 'UC'];
const CROHN: readonly Indication[] = ['CROHN'];
const UC: readonly Indication[] = ['UC'];

const INNS: ReadonlyArray<readonly [MedicationCategory, ReadonlyArray<readonly [string, readonly Indication[]]>]> = [
  ['AMINOSALICYLATES', [['Mesalazine', BOTH], ['Sulfasalazine', BOTH], ['Olsalazine', UC], ['Balsalazide', UC]]],
  ['CORTICOSTEROIDS', [
    ['Prednisone', BOTH], ['Prednisolone', BOTH], ['Methylprednisolone', BOTH],
    ['Budesonide', BOTH], ['Beclometasone', UC], ['Hydrocortisone', BOTH],
  ]],
  ['IMMUNOSUPPRESSANTS', [
    ['Azathioprine', BOTH], ['Mercaptopurine', BOTH], ['Methotrexate', CROHN],
    ['Ciclosporin', UC], ['Tacrolimus', UC],
  ]],
  ['BIOLOGICS', [
    ['Infliximab', BOTH], ['Adalimumab', BOTH], ['Golimumab', UC], ['Certolizumab pegol', CROHN],
    ['Vedolizumab', BOTH], ['Ustekinumab', BOTH], ['Risankizumab', BOTH], ['Mirikizumab', BOTH],
    ['Guselkumab', BOTH],
  ]],
  ['SMALL_MOLECULES', [
    ['Tofacitinib', UC], ['Upadacitinib', BOTH], ['Filgotinib', UC], ['Ozanimod', UC], ['Etrasimod', UC],
  ]],
  ['ANTIBIOTICS', [['Metronidazole', CROHN], ['Ciprofloxacin', CROHN]]],
];

/** Usual treatments for Crohn's disease and ulcerative colitis, in display order. */
export const STANDARD_MEDICATIONS: readonly StandardMedication[] = [
  ...INNS.flatMap(([category, items]) =>
    items.map(([inn, indications]): StandardMedication => ({ category, indications, inn, supportive: null }))),
  ...SUPPORTIVE_MEDICATIONS.map((supportive): StandardMedication => ({
    category: 'SUPPORTIVE', indications: [], inn: null, supportive,
  })),
];
