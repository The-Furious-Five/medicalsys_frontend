export interface Specialty {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

export interface Icd10Entry {
  readonly code: string;
  readonly description: string;
  readonly chapter: string | null;
  readonly category: string | null;
  readonly applicableSex: string | null;
  readonly active: boolean;
}

export interface Medication {
  readonly id: number;
  readonly code: string;
  readonly genericName: string;
  readonly tradeName: string | null;
  readonly concentration: string | null;
  readonly pharmaceuticalForm: string | null;
  readonly administrationRoute: string | null;
  readonly controlled: boolean;
  readonly requiresPrescription: boolean;
  readonly active: boolean;
}

export interface StudyType {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly category: string | null;
  readonly requiresFasting: boolean;
  readonly generatesImage: boolean;
  readonly resultUnit: string | null;
  readonly referenceMin: number | null;
  readonly referenceMax: number | null;
  readonly active: boolean;
}
