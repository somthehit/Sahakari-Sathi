import { Member } from '../types/coop';
import { CertificateConfig } from '../components/shares/ShareCertificateCanvas';
import { formatNPR } from './nepaliCalendar';

export interface CertificateTag {
  tag: string;
  labelNp: string;
  labelEn: string;
  category: 'member' | 'share' | 'certificate' | 'institution';
  exampleValue: string;
  description: string;
}

export interface TagContext {
  member: Member;
  config: CertificateConfig;
  certificateNo: string;
  kittaStart: number;
  kittaEnd: number;
  issuedDateBS: string;
  issuedDateAD: string;
}

export const AVAILABLE_CERTIFICATE_TAGS: CertificateTag[] = [
  // Member Information Tags
  {
    tag: '{member_name}',
    labelNp: 'सदस्यको नाम',
    labelEn: 'Member Name',
    category: 'member',
    exampleValue: 'रामकृष्ण शर्मा',
    description: 'Full registered name of the cooperative member',
  },
  {
    tag: '{member_no}',
    labelNp: 'सदस्य नम्बर',
    labelEn: 'Member Number',
    category: 'member',
    exampleValue: 'MBR-2083-0101',
    description: 'Unique member ID code',
  },
  {
    tag: '{citizenship_no}',
    labelNp: 'नागरिकता नम्बर',
    labelEn: 'Citizenship No.',
    category: 'member',
    exampleValue: '२७-०१-७८-०१२३४',
    description: 'National Citizenship ID card number',
  },
  {
    tag: '{address}',
    labelNp: 'ठेगाना',
    labelEn: 'Address',
    category: 'member',
    exampleValue: 'कोटेश्वर-३२, काठमाडौँ',
    description: 'Permanent or current address of the member',
  },
  {
    tag: '{phone_no}',
    labelNp: 'फोन नम्बर',
    labelEn: 'Phone Number',
    category: 'member',
    exampleValue: '९८४१२३४५६७',
    description: 'Contact phone number of member',
  },
  {
    tag: '{father_name}',
    labelNp: 'बुबाको नाम',
    labelEn: 'Father Name',
    category: 'member',
    exampleValue: 'श्यामप्रसाद शर्मा',
    description: 'Father name for 3-puste legal identification',
  },
  {
    tag: '{grandfather_name}',
    labelNp: 'बाजेको नाम',
    labelEn: 'Grandfather Name',
    category: 'member',
    exampleValue: 'हरिप्रसाद शर्मा',
    description: 'Grandfather name for legal heir records',
  },
  {
    tag: '{spouse_name}',
    labelNp: 'पति/पत्नीको नाम',
    labelEn: 'Spouse Name',
    category: 'member',
    exampleValue: 'गंगा शर्मा',
    description: 'Spouse name if married',
  },
  {
    tag: '{nominee_name}',
    labelNp: 'हकवालाको नाम',
    labelEn: 'Nominee Name',
    category: 'member',
    exampleValue: 'सुरेश शर्मा',
    description: 'Designated legal heir/nominee name',
  },

  // Share & Financial Tags
  {
    tag: '{share_count}',
    labelNp: 'कुल कित्ता संख्या',
    labelEn: 'Total Share Count',
    category: 'share',
    exampleValue: '५० कित्ता',
    description: 'Total number of shares held by member',
  },
  {
    tag: '{face_value}',
    labelNp: 'प्रति शेयर दर',
    labelEn: 'Face Value per Share',
    category: 'share',
    exampleValue: 'रु. १००',
    description: 'Par value per share unit in NPR',
  },
  {
    tag: '{total_amount}',
    labelNp: 'कुल शेयर रकम',
    labelEn: 'Total Share Amount',
    category: 'share',
    exampleValue: 'रु. ५,०००/-',
    description: 'Total monetary value of shares in formatted NPR',
  },
  {
    tag: '{total_amount_words}',
    labelNp: 'रकम अक्षरेपी',
    labelEn: 'Amount in Words',
    category: 'share',
    exampleValue: 'पाँच हजार रुपैयाँ मात्र',
    description: 'Total share value spelled out in Nepali text',
  },
  {
    tag: '{kitta_range}',
    labelNp: 'कित्ता नम्बर दायरा',
    labelEn: 'Kitta Serial Range',
    category: 'share',
    exampleValue: '१००१ देखि १०५० सम्म',
    description: 'Distinctive starting to ending serial kitta numbers',
  },
  {
    tag: '{kitta_start}',
    labelNp: 'शुरु कित्ता नं.',
    labelEn: 'Kitta Start No.',
    category: 'share',
    exampleValue: '१००१',
    description: 'Starting share serial number',
  },
  {
    tag: '{kitta_end}',
    labelNp: 'अन्तिम कित्ता नं.',
    labelEn: 'Kitta End No.',
    category: 'share',
    exampleValue: '१०५०',
    description: 'Ending share serial number',
  },

  // Certificate & Issue Date Tags
  {
    tag: '{cert_no}',
    labelNp: 'प्रमाण-पत्र नम्बर',
    labelEn: 'Certificate No.',
    category: 'certificate',
    exampleValue: 'SC-2083-0101',
    description: 'Unique share certificate serial number',
  },
  {
    tag: '{date_of_issue}',
    labelNp: 'जारी मिति (बि.सं.)',
    labelEn: 'Date of Issue (BS)',
    category: 'certificate',
    exampleValue: '२०८३-०४-१५',
    description: 'Certificate issuance date in Bikram Sambat',
  },
  {
    tag: '{date_ad}',
    labelNp: 'जारी मिति (ई.सं.)',
    labelEn: 'Date of Issue (AD)',
    category: 'certificate',
    exampleValue: '2026-07-31',
    description: 'Certificate issuance date in Anno Domini calendar',
  },

  // Institution & Signatories Tags
  {
    tag: '{coop_name_np}',
    labelNp: 'संस्थाको नाम (नेपाली)',
    labelEn: 'Coop Name (Nepali)',
    category: 'institution',
    exampleValue: 'साझा स्वावलम्बन बचत तथा ऋण सहकारी संस्था लि.',
    description: 'Cooperative name in Nepali script',
  },
  {
    tag: '{coop_name_en}',
    labelNp: 'संस्थाको नाम (अंग्रेजी)',
    labelEn: 'Coop Name (English)',
    category: 'institution',
    exampleValue: 'Sajha Swabalamban Savings & Credit Co-operative Ltd.',
    description: 'Cooperative name in English script',
  },
  {
    tag: '{regd_no}',
    labelNp: 'दर्ता नम्बर',
    labelEn: 'Registration No.',
    category: 'institution',
    exampleValue: 'दर्ता नं.: ५६२/०६४/०६५',
    description: 'Official government registration code',
  },
  {
    tag: '{chairman_name}',
    labelNp: 'अध्यक्षको नाम',
    labelEn: 'Chairman Name',
    category: 'institution',
    exampleValue: 'रामकृष्ण शर्मा',
    description: 'Name of the Board Chairman',
  },
  {
    tag: '{manager_name}',
    labelNp: 'व्यवस्थापकको नाम',
    labelEn: 'General Manager Name',
    category: 'institution',
    exampleValue: 'सुरेश श्रेष्ठ',
    description: 'Name of the General Manager',
  },
];

// Number to Nepali Words helper
export function numberToNepaliWords(num: number): string {
  if (!num || isNaN(num)) return 'शून्य रुपैयाँ मात्र';
  
  if (num === 100) return 'एक सय रुपैयाँ मात्र';
  if (num === 1000) return 'एक हजार रुपैयाँ मात्र';
  if (num === 5000) return 'पाँच हजार रुपैयाँ मात्र';
  if (num === 10000) return 'दश हजार रुपैयाँ मात्र';
  if (num === 50000) return 'पचास हजार रुपैयाँ मात्र';
  if (num === 100000) return 'एक लाख रुपैयाँ मात्र';

  return `${num.toLocaleString('ne-NP')} रुपैयाँ मात्र`;
}

// Function to resolve all tags in a template string dynamically from context
export function resolveCertificateTags(template: string, ctx: TagContext): string {
  if (!template) return '';

  const totalShares = ctx.member?.totalShares || 50;
  const faceValue = ctx.config?.faceValuePerShare || 100;
  const totalAmount = ctx.member?.shareAmount || totalShares * faceValue;

  const replacements: Record<string, string> = {
    '{member_name}': ctx.member?.fullName || 'श्रीमान् / श्रीमती',
    '{member_no}': ctx.member?.memberNo || 'MBR-2083-0101',
    '{citizenship_no}': ctx.member?.citizenshipNo || '---',
    '{address}': ctx.member?.address || 'काठमाडौँ',
    '{phone_no}': ctx.member?.phone || '---',
    '{father_name}': ctx.member?.fatherName || '---',
    '{grandfather_name}': ctx.member?.grandfatherName || '---',
    '{spouse_name}': ctx.member?.spouseName || '---',
    '{nominee_name}': ctx.member?.nomineeName || '---',

    '{share_count}': `${totalShares}`,
    '{face_value}': `रु. ${faceValue}`,
    '{total_amount}': formatNPR(totalAmount),
    '{total_amount_words}': numberToNepaliWords(totalAmount),
    '{kitta_range}': `${ctx.kittaStart} देखि ${ctx.kittaEnd} सम्म`,
    '{kitta_start}': `${ctx.kittaStart}`,
    '{kitta_end}': `${ctx.kittaEnd}`,

    '{cert_no}': ctx.certificateNo,
    '{date_of_issue}': ctx.issuedDateBS,
    '{issued_date_bs}': ctx.issuedDateBS,
    '{date_ad}': ctx.issuedDateAD,

    '{coop_name_np}': ctx.config?.coopNameNp || '',
    '{coop_name_en}': ctx.config?.coopNameEn || '',
    '{regd_no}': ctx.config?.regdNo || '',
    '{chairman_name}': ctx.config?.signatory1?.name || '',
    '{manager_name}': ctx.config?.signatory2?.name || '',
  };

  let result = template;
  Object.entries(replacements).forEach(([tagKey, tagVal]) => {
    // Regex replace all occurrences of key
    const regex = new RegExp(tagKey.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, tagVal);
  });

  return result;
}
