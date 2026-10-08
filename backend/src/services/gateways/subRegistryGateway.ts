/**
 * Ministry of Law Sub-Registry Gateway (e-Registration / Dalil Ledger)
 * Simulates Sub-Registry Book 1 archives, deed of sale execution,
 * search for registered conveyances, and mandatory 52A verification.
 */

export interface RegisteredDeedRecord {
  deedNumber: string;
  volumeNumber: string;
  pageNumber: string;
  subRegistryOffice: string;
  deedType: 'KABALA' | 'HEBA' | 'MORTGAGE' | 'PARTITION' | 'POWER_OF_ATTORNEY';
  parcelId: string;
  sellerNid: string;
  sellerName: string;
  buyerNid: string;
  buyerName: string;
  areaDecimal: number;
  considerationBdt: number;
  registrationDate: string;
  isCancelled: boolean;
}

const SUB_REGISTRY_BOOK1_ARCHIVES: RegisteredDeedRecord[] = [
  {
    deedNumber: 'DALIL-2018-SAV-4821',
    volumeNumber: '104',
    pageNumber: '42-49',
    subRegistryOffice: 'Savar Sub-Registry Office, Dhaka',
    deedType: 'KABALA',
    parcelId: 'BD-DHK-SAV-000001',
    sellerNid: '19602692019900011',
    sellerName: 'Late Abdul Karim Mia',
    buyerNid: '19852692011000123',
    buyerName: 'Kamal Hossain',
    areaDecimal: 5.5,
    considerationBdt: 3200000,
    registrationDate: '2018-04-18T11:00:00.000Z',
    isCancelled: false,
  },
  {
    deedNumber: 'DALIL-2021-SRM-1092',
    volumeNumber: '88',
    pageNumber: '112-118',
    subRegistryOffice: 'Sreemangal Sub-Registry Office, Moulvibazar',
    deedType: 'HEBA',
    parcelId: 'BD-SYL-SRM-000108',
    sellerNid: '19622691002233999',
    sellerName: 'Alhaj Shamsul Huda',
    buyerNid: '19882691002233441',
    buyerName: 'Tanvir Ahmed',
    areaDecimal: 45.0,
    considerationBdt: 0,
    registrationDate: '2021-11-05T10:15:00.000Z',
    isCancelled: false,
  },
];

export class SubRegistryGateway {
  /**
   * Searches Sub-Registry Book 1 archives for all recorded deeds on a parcel
   */
  public static searchDeedHistory(parcelId: string): RegisteredDeedRecord[] {
    const cleanId = (parcelId || '').trim().toLowerCase();
    return SUB_REGISTRY_BOOK1_ARCHIVES.filter((d) => d.parcelId.toLowerCase() === cleanId);
  }

  /**
   * Verifies if a specific deed number exists in Book 1 archives
   */
  public static verifyDeed(deedNumber: string): RegisteredDeedRecord | null {
    const clean = (deedNumber || '').trim().toLowerCase();
    return SUB_REGISTRY_BOOK1_ARCHIVES.find((d) => d.deedNumber.toLowerCase() === clean) || null;
  }

  /**
   * Registers a new conveyance deed in Sub-Registry Book 1
   */
  public static recordDeed(record: Omit<RegisteredDeedRecord, 'volumeNumber' | 'pageNumber' | 'isCancelled'>): RegisteredDeedRecord {
    const volumeNumber = String(Math.floor(100 + Math.random() * 900));
    const pageNumber = `${Math.floor(1 + Math.random() * 50)}-${Math.floor(51 + Math.random() * 50)}`;

    const newRecord: RegisteredDeedRecord = {
      ...record,
      volumeNumber,
      pageNumber,
      isCancelled: false,
    };

    SUB_REGISTRY_BOOK1_ARCHIVES.unshift(newRecord);
    return newRecord;
  }
}
