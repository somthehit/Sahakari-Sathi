/**
 * Nepal Administrative Master Data
 * 7 provinces and 77 official districts (with Nepali names).
 * Municipalities and wards are intentionally not pre-seeded in bulk;
 * they are managed per-organization during onboarding.
 */
export interface ProvinceSeed {
  code: string;
  name: string;
  nameNepali: string;
  districts: { code: string; name: string; nameNepali: string }[];
}

export const NEPAL_PROVINCES: ProvinceSeed[] = [
  {
    code: '1',
    name: 'Koshi',
    nameNepali: 'कोशी',
    districts: [
      { code: '01', name: 'Bhojpur', nameNepali: 'भोजपुर' },
      { code: '02', name: 'Dhankuta', nameNepali: 'धनकुटा' },
      { code: '03', name: 'Ilam', nameNepali: 'इलाम' },
      { code: '04', name: 'Jhapa', nameNepali: 'झापा' },
      { code: '05', name: 'Khotang', nameNepali: 'खोटाङ' },
      { code: '06', name: 'Morang', nameNepali: 'मोरङ' },
      { code: '07', name: 'Okhaldhunga', nameNepali: 'ओखलढुङ्गा' },
      { code: '08', name: 'Panchthar', nameNepali: 'पाँचथर' },
      { code: '09', name: 'Sankhuwasabha', nameNepali: 'सङ्खुवासभा' },
      { code: '10', name: 'Solukhumbu', nameNepali: 'सोलुखुम्बु' },
      { code: '11', name: 'Sunsari', nameNepali: 'सुनसरी' },
      { code: '12', name: 'Taplejung', nameNepali: 'ताप्लेजुङ' },
      { code: '13', name: 'Terhathum', nameNepali: 'तेह्रथुम' },
      { code: '14', name: 'Udayapur', nameNepali: 'उदयपुर' },
    ],
  },
  {
    code: '2',
    name: 'Madhesh',
    nameNepali: 'मधेश',
    districts: [
      { code: '15', name: 'Bara', nameNepali: 'बारा' },
      { code: '16', name: 'Dhanusha', nameNepali: 'धनुषा' },
      { code: '17', name: 'Mahottari', nameNepali: 'महोत्तरी' },
      { code: '18', name: 'Parsa', nameNepali: 'पर्सा' },
      { code: '19', name: 'Rautahat', nameNepali: 'रौतहट' },
      { code: '20', name: 'Saptari', nameNepali: 'सप्तरी' },
      { code: '21', name: 'Sarlahi', nameNepali: 'सर्लाही' },
      { code: '22', name: 'Siraha', nameNepali: 'सिराहा' },
    ],
  },
  {
    code: '3',
    name: 'Bagmati',
    nameNepali: 'बागमती',
    districts: [
      { code: '23', name: 'Bhaktapur', nameNepali: 'भक्तपुर' },
      { code: '24', name: 'Chitwan', nameNepali: 'चितवन' },
      { code: '25', name: 'Dhading', nameNepali: 'धादिङ' },
      { code: '26', name: 'Dolakha', nameNepali: 'दोलखा' },
      { code: '27', name: 'Kathmandu', nameNepali: 'काठमाडौं' },
      { code: '28', name: 'Kavrepalanchok', nameNepali: 'काभ्रेपलान्चोक' },
      { code: '29', name: 'Lalitpur', nameNepali: 'ललितपुर' },
      { code: '30', name: 'Makwanpur', nameNepali: 'मकवानपुर' },
      { code: '31', name: 'Nuwakot', nameNepali: 'नुवाकोट' },
      { code: '32', name: 'Ramechhap', nameNepali: 'रामेछाप' },
      { code: '33', name: 'Rasuwa', nameNepali: 'रसुवा' },
      { code: '34', name: 'Sindhuli', nameNepali: 'सिन्धुली' },
      { code: '35', name: 'Sindhupalchok', nameNepali: 'सिन्धुपाल्चोक' },
    ],
  },
  {
    code: '4',
    name: 'Gandaki',
    nameNepali: 'गण्डकी',
    districts: [
      { code: '36', name: 'Baglung', nameNepali: 'बागलुङ' },
      { code: '37', name: 'Gorkha', nameNepali: 'गोरखा' },
      { code: '38', name: 'Kaski', nameNepali: 'कास्की' },
      { code: '39', name: 'Lamjung', nameNepali: 'लमजुङ' },
      { code: '40', name: 'Manang', nameNepali: 'मनाङ' },
      { code: '41', name: 'Mustang', nameNepali: 'मुस्ताङ' },
      { code: '42', name: 'Myagdi', nameNepali: 'म्याग्दी' },
      { code: '43', name: 'Nawalpur', nameNepali: 'नवलपुर' },
      { code: '44', name: 'Parbat', nameNepali: 'पर्वत' },
      { code: '45', name: 'Syangja', nameNepali: 'स्याङ्जा' },
      { code: '46', name: 'Tanahun', nameNepali: 'तनहुँ' },
    ],
  },
  {
    code: '5',
    name: 'Lumbini',
    nameNepali: 'लुम्बिनी',
    districts: [
      { code: '47', name: 'Arghakhanchi', nameNepali: 'अर्घाखाँची' },
      { code: '48', name: 'Banke', nameNepali: 'बाँके' },
      { code: '49', name: 'Bardiya', nameNepali: 'बर्दिया' },
      { code: '50', name: 'Dang', nameNepali: 'दाङ' },
      { code: '51', name: 'Eastern Rukum', nameNepali: 'पूर्वी रुकुम' },
      { code: '52', name: 'Gulmi', nameNepali: 'गुल्मी' },
      { code: '53', name: 'Kapilvastu', nameNepali: 'कपिलवस्तु' },
      { code: '54', name: 'Parasi', nameNepali: 'परासी' },
      { code: '55', name: 'Palpa', nameNepali: 'पाल्पा' },
      { code: '56', name: 'Pyuthan', nameNepali: 'प्युठान' },
      { code: '57', name: 'Rolpa', nameNepali: 'रोल्पा' },
      { code: '58', name: 'Rupandehi', nameNepali: 'रुपन्देही' },
    ],
  },
  {
    code: '6',
    name: 'Karnali',
    nameNepali: 'कर्णाली',
    districts: [
      { code: '59', name: 'Dailekh', nameNepali: 'दैलेख' },
      { code: '60', name: 'Dolpa', nameNepali: 'डोल्पा' },
      { code: '61', name: 'Humla', nameNepali: 'हुम्ला' },
      { code: '62', name: 'Jajarkot', nameNepali: 'जाजरकोट' },
      { code: '63', name: 'Jumla', nameNepali: 'जुम्ला' },
      { code: '64', name: 'Kalikot', nameNepali: 'कालिकोट' },
      { code: '65', name: 'Mugu', nameNepali: 'मुगु' },
      { code: '66', name: 'Salyan', nameNepali: 'सल्यान' },
      { code: '67', name: 'Surkhet', nameNepali: 'सुर्खेत' },
      { code: '68', name: 'Western Rukum', nameNepali: 'पश्चिम रुकुम' },
    ],
  },
  {
    code: '7',
    name: 'Sudurpashchim',
    nameNepali: 'सुदूरपश्चिम',
    districts: [
      { code: '69', name: 'Achham', nameNepali: 'अछाम' },
      { code: '70', name: 'Baitadi', nameNepali: 'बैतडी' },
      { code: '71', name: 'Bajhang', nameNepali: 'बझाङ' },
      { code: '72', name: 'Bajura', nameNepali: 'बाजुरा' },
      { code: '73', name: 'Dadeldhura', nameNepali: 'डडेलधुरा' },
      { code: '74', name: 'Darchula', nameNepali: 'दार्चुला' },
      { code: '75', name: 'Doti', nameNepali: 'डोटी' },
      { code: '76', name: 'Kailali', nameNepali: 'कैलाली' },
      { code: '77', name: 'Kanchanpur', nameNepali: 'कञ्चनपुर' },
    ],
  },
];
