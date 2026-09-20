/**
 * Loan Document Generator — generates 3 Nepali cooperative legal documents
 * from loan application data. Output is HTML that can be printed to PDF.
 */
import { numberToNepaliWords } from '../utils/numberToNepaliWords';
import { getTodayBS } from '../utils/nepaliCalendar';

export interface GuarantorInfo {
  fullName: string;
  address?: string;
  citizenshipNo?: string;
  relationship?: string;
  age?: number | string;
  occupation?: string;
}

export interface DocumentGeneratorInput {
  borrowerName: string;
  borrowerAddress: string;
  borrowerCitizenshipNo: string;
  borrowerMemberNo: string;
  fatherOrHusbandName: string;
  borrowerAge: number | string;
  borrowerTole: string;
  borrowerWardNo: string;
  borrowerMunicipality: string;
  borrowerDistrict: string;
  guarantorName: string;
  guarantorAddress: string;
  guarantor2Name: string;
  guarantor2Citizenship: string;
  guarantor2Relationship: string;
  guarantor1Citizenship: string;
  guarantor1Relationship: string;
  guarantors?: GuarantorInfo[];
  requestedAmount: number;
  approvedAmount?: number;
  tenureMonths: number;
  interestRate: number;
  loanProductName: string;
  purposeDetail: string;
  repaymentFrequency: string;
  emiAmount: number;
  collateralDescription: string;
  collateralValuation: number;
  collateralKittaNo: string;
  collateralAreaDetail: string;
  collateralBuildingDetail: string;
  collateralLandOfficeName: string;
  collateralBoundaryEast: string;
  collateralBoundaryWest: string;
  collateralBoundaryNorth: string;
  collateralBoundarySouth: string;
  collateralDistrict: string;
  collateralMunicipality: string;
  collateralWardNo: string;
  collateralTole: string;
  valuerName: string;
  valuationDateBs: string;
  cooperativeName: string;
  registrationNo: string;
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  branchName: string;
  branchAddress: string;
  applicationId: string;
  dateBs?: string;
  place: string;
  witness1Name: string;
  witness2Name: string;
  scribeStaffName: string;
  scribeDesignation: string;
  dayOfWeek: string;
}

function generateGuarantorSignatureBlocks(guarantors?: GuarantorInfo[]): string {
  if (!guarantors || guarantors.length === 0) {
    return `<div class="signature-block">
      <div>आवेदकको सही<br/><br/><br/>__________</div>
      <div>ग्यारेन्टरको सही<br/><br/><br/>__________</div>
      <div>प्राधिकृत अधिकारी<br/><br/><br/>__________</div>
    </div>`;
  }

  const guarantorBlocks = guarantors.map((g, i) => 
    `<div style="flex:1; min-width:120px; text-align:center; border-top:1px solid #000; padding-top:6px; margin:0 8px;">
      <div style="font-size:11px; color:#666;">जमानीदार ${i + 1} को सही</div>
      <div style="height:40px;"></div>
      <div style="font-size:12px; font-weight:bold;">${g.fullName || '__________'}</div>
      <div style="font-size:10px; color:#666;">${g.citizenshipNo ? `नाग. ${g.citizenshipNo}` : ''}</div>
    </div>`
  ).join('');

  return `<div style="display:flex; justify-content:space-between; margin-top:50px; flex-wrap:wrap;">
    <div style="flex:1; min-width:120px; text-align:center; border-top:1px solid #000; padding-top:6px; margin:0 8px;">
      <div style="font-size:11px; color:#666;">आवेदकको सही</div>
      <div style="height:40px;"></div>
      <div style="font-size:12px; font-weight:bold;">${guarantorBlocks.length > 0 ? '__________' : '__________'}</div>
    </div>
    ${guarantorBlocks}
    <div style="flex:1; min-width:120px; text-align:center; border-top:1px solid #000; padding-top:6px; margin:0 8px;">
      <div style="font-size:11px; color:#666;">प्राधिकृत अधिकारी</div>
      <div style="height:40px;"></div>
      <div style="font-size:12px; font-weight:bold;">__________</div>
    </div>
  </div>`;
}

const NEPALI_BANK_STYLE = `
  body { font-family: 'Noto Sans Devanagari', 'Noto Serif Devanagari', sans-serif; color: #1a1a1a; padding: 40px; }
  h1 { text-align: center; font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 14px; margin-top: 0; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  td, th { border: 1px solid #000; padding: 6px 10px; }
  th { background: #f0f0f0; font-weight: bold; }
  .section-title { font-weight: bold; margin-top: 20px; font-size: 14px; border-left: 3px solid #000; padding-left: 8px; }
  .amount-words { background: #f5f5f5; padding: 10px; border: 1px dashed #aaa; margin: 12px 0; font-style: italic; }
  .signature-block { margin-top: 50px; display: flex; justify-content: space-between; }
  .signature-block div { width: 30%; text-align: center; border-top: 1px solid #000; padding-top: 6px; }
  .nepali { font-weight: bold; }
  @media print { body { padding: 20px; } }
`;

// ═══════════════════════════════════════════════════════════════
// 1. ऋण माग फारम (Loan Demand Form)
// ═══════════════════════════════════════════════════════════════
export function generateLoanDemandForm(input: DocumentGeneratorInput): string {
  const dateBs = input.dateBs || getTodayBS();
  const amountWords = numberToNepaliWords(input.requestedAmount);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${NEPALI_BANK_STYLE}</style></head><body>
<h1>ऋण माग फारम</h1>
<h2>Loan Demand Form</h2>

<table>
  <tr><th style="width:30%">मिति (Date)</th><td>${dateBs}</td></tr>
  <tr><th>शाखा (Branch)</th><td>${input.branchName}, ${input.branchAddress}</td></tr>
</table>

<div class="section-title">१. ऋण आवेदकको विवरण (Applicant Details)</div>
<table>
  <tr><th style="width:30%">नाम (Full Name)</th><td>${input.borrowerName}</td></tr>
  <tr><th>ठेगाना (Address)</th><td>${input.borrowerAddress}</td></tr>
  <tr><th>नागरिकता नं. (Citizenship No.)</th><td>${input.borrowerCitizenshipNo}</td></tr>
  <tr><th>ऋण उत्पादन (Loan Product)</th><td>${input.loanProductName}</td></tr>
</table>

<div class="section-title">२. ऋण विवरण (Loan Details)</div>
<table>
  <tr><th style="width:30%">माग गरिएको रकम (Requested Amount)</th><td>रु. ${input.requestedAmount.toLocaleString()}</td></tr>
  <tr><th>शब्दमा (In Words)</th><td class="nepali">${amountWords}</td></tr>
  <tr><th>अवधि (Tenure)</th><td>${input.tenureMonths} महिना</td></tr>
  <tr><th>ब्याजदर (Interest Rate)</th><td>${input.interestRate}% प्रतिवर्ष</td></tr>
</table>

<div class="section-title">३. जम्मा विवरण (Collateral Details)</div>
<table>
  <tr><th style="width:30%">जम्मा विवरण (Description)</th><td>${input.collateralDescription}</td></tr>
  <tr><th>मूल्यांकन रकम (Valuation)</th><td>रु. ${input.collateralValuation.toLocaleString()}</td></tr>
</table>

<div class="section-title">४. ऋणीको घोषणा (Borrower Declaration)</div>
<p style="font-size:13px; text-align:justify;">
  म, ${input.borrowerName}, उपरोक्त विवरण अनुसार ऋण माग गर्दछु। उक्त ऋण माथि उल्लेखित शर्त र नियम अनुसार तिर्ने प्रतिबद्ध गर्दछु।
  ऋण नतिरेमा ब्याजसहित उजुरी तिर्न वा सम्पत्ति जफत गर्ने सहमति दिन्छु।
</p>
<p style="font-size:13px;">
  मूल रकम: रु. ${input.requestedAmount.toLocaleString()} (${amountWords})
</p>

${generateGuarantorSignatureBlocks(input.guarantors)}
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// 2. ऋण सम्झौता फारम (Loan Agreement Form)
// ═══════════════════════════════════════════════════════════════
export function generateLoanAgreementForm(input: DocumentGeneratorInput): string {
  const dateBs = input.dateBs || getTodayBS();
  const amountWords = numberToNepaliWords(input.requestedAmount);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${NEPALI_BANK_STYLE}</style></head><body>
<h1>ऋण सम्झौता फारम</h1>
<h2>Loan Agreement Form</h2>

<table>
  <tr><th style="width:30%">मिति (Date)</th><td>${dateBs}</td></tr>
  <tr><th>शाखा (Branch)</th><td>${input.branchName}, ${input.branchAddress}</td></tr>
  <tr><th>आवेदन क्र. (Application No.)</th><td>${input.applicationId.slice(0, 8).toUpperCase()}</td></tr>
</table>

<div class="section-title">१. ऋणी र प्रतिबद्ध व्यक्तिको विवरण</div>
<table>
  <tr><th style="width:30%">ऋणीको नाम</th><td>${input.borrowerName}</td></tr>
  <tr><th>ठेगाना</th><td>${input.borrowerAddress}</td></tr>
  <tr><th>नागरिकता नं.</th><td>${input.borrowerCitizenshipNo}</td></tr>
  <tr><th>ग्यारेन्टर</th><td>${input.guarantorName}</td></tr>
  <tr><th>ग्यारेन्टर ठेगाना</th><td>${input.guarantorAddress}</td></tr>
</table>

<div class="section-title">२. ऋण सम्झौता शर्तहरू (Loan Terms)</div>
<table>
  <tr><th style="width:30%">ऋण रकम</th><td>रु. ${input.requestedAmount.toLocaleString()} (${amountWords})</td></tr>
  <tr><th>ब्याजदर</th><td>${input.interestRate}% प्रतिवर्ष</td></tr>
  <tr><th>अवधि</th><td>${input.tenureMonths} महिना</td></tr>
  <tr><th>जम्मा ब्याज</th><td>ब्याज गणना विधि अनुसार</td></tr>
  <tr><th>जम्मा ऋण रकम</th><td>रु. ${input.requestedAmount.toLocaleString()}</td></tr>
</table>

<div class="section-title">३. शर्तहरू र नियमहरू</div>
<ol style="font-size:12px; line-height:1.7;">
  <li>ऋणीले प्रत्येक महिनाको EMI निर्धारित मितिभित्र तिर्नुपर्ने छ।</li>
  <li>ब्याज ऋणीले प्रयोग गरेको रकममाथि मात्र गणना गरिनेछ।</li>
  <li>समयमा नतिरेमा प्रत्येक दिनको लागि १.५% उजुरी लाग्नेछ।</li>
  <li>जम्मा ऋण रकम एकैपटक तिर्न सकिने छ।</li>
  <li>ग्यारेन्टरले ऋणीले नतिरेमा पूर्ण जिम्मेवारी लिनुपर्ने छ।</li>
  <li>झूटो विवरण दिएमा ऋण रद्द गर्न सकिनेछ र कानुनी कारवाही हुन सक्छ।</li>
  <li>सम्पत्ति जम्मा गरेमा ऋण बन्द हुनेछ, शेष रकम फिर्ता गरिनेछ।</li>
</ol>

<div class="section-title">४. जम्मा विवरण (Collateral Details)</div>
<table>
  <tr><th style="width:30%">विवरण</th><td>${input.collateralDescription}</td></tr>
  <tr><th>मूल्यांकन रकम</th><td>रु. ${input.collateralValuation.toLocaleString()}</td></tr>
  <tr><th>बीमा आवश्यक</th><td>हो / छैन</td></tr>
</table>

${generateGuarantorSignatureBlocks(input.guarantors)}
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// 3. तमसुक फारम — दृष्टिबन्धक (Schedule-2, Negotiable Instruments Act 2045)
// ═══════════════════════════════════════════════════════════════
export function generateTamsukForm(input: DocumentGeneratorInput): string {
  const dateBs = input.dateBs || getTodayBS();
  const amountWords = numberToNepaliWords(input.requestedAmount);
  const collateralWords = numberToNepaliWords(input.collateralValuation);
  const [yearPart, monthPart, dayPart] = dateBs.split('-');
  const dayBs = dayPart?.replace(/^0/, '') || '';
  const monthBs = monthPart?.replace(/^0/, '') || '';
  const yearBs = yearPart || '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${NEPALI_BANK_STYLE}
.legal-note { font-size: 11px; color: #555; background: #f8f8f8; padding: 10px 14px; border-left: 3px solid #888; margin-top: 24px; line-height: 1.6; }
.boundary-table td, .boundary-table th { border: 1px solid #000; padding: 4px 8px; font-size: 12px; text-align: center; }
.sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 60px; text-align: center; }
.sig-grid div { border-top: 1px solid #000; padding-top: 6px; font-size: 11px; }
.witness-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
.witness-grid div { font-size: 12px; }
</style></head><body>

<h1>सहकारी कर्जा तमसुक (धितो बन्धक)</h1>
<h2>दृष्टिबन्धक तमसुक — ऐन, २०४५ को अनुसूची–२</h2>

<p style="font-size:12px; color:#444; text-align:center; margin-top:-8px;">
  (निजी व्यवहारको लिखत ढाँचा सम्बन्धी ऐन, २०४५ को अनुसूची–२ "दृष्टिबन्धक तमसुक" को ढाँचामा आधारित)
</p>

<table>
  <tr><th style="width:30%">मिति</th><td>${dateBs}</td></tr>
  <tr><th>आवेदन क्र.</th><td>${input.applicationId.slice(0, 8).toUpperCase()}</td></tr>
</table>

<div class="section-title">लिखितम्</div>

<p style="font-size:13px; line-height:1.8; text-align:justify;">
  लिखितम् धनी: <strong>${input.cooperativeName}</strong>, दर्ता नं. ${input.registrationNo},
  ${input.province} प्रदेश, ${input.district} जिल्ला, ${input.municipality} वडा नं. ${input.wardNo}
  (शाखा: ${input.branchName}) — यसपछि <strong>"साहू"</strong> भनिएको।
</p>

<p style="font-size:13px; line-height:1.8; text-align:justify;">
  धनवेहोऋणीको नाम: <strong>${input.borrowerName}</strong>, बाबु/पतिको नाम ${input.fatherOrHusbandName},
  ${input.borrowerDistrict} जिल्ला ${input.borrowerMunicipality} गाउँ/नगरपालिका वडा नं. ${input.borrowerWardNo}
  (टोल ${input.borrowerTole}) बस्ने वर्ष ${input.borrowerAge} को, नागरिकता प्रमाणपत्र नं. ${input.borrowerCitizenshipNo},
  सदस्य नं. ${input.borrowerMemberNo} — यसपछि <strong>"ऋणी"</strong> भनिएको।
</p>

<p style="font-size:13px; line-height:1.8; text-align:justify;">
  ${input.purposeDetail} वापत तपाई साहूबाट आजका मितिमा रू. ${input.requestedAmount.toLocaleString()}/.-
  अक्षरेपी ${amountWords} ऋण लिएँ। सो रूपैयाँको वार्षिक
  ${input.interestRate} प्रतिशतका दरले हुने ब्याज समेत सावा आजका मितिले
  ${input.tenureMonths} महिना भित्र ${input.repaymentFrequency} किस्ताबन्दी रू.
  ${input.emiAmount.toLocaleString()}/.- का दरले बुझाउँला।
</p>

<p style="font-size:13px; line-height:1.8; text-align:justify;">
  सो म्याद भित्र किस्ता बुझाइन भने मेरो घर घरानाबाट सावा ब्याज असूल
  उपर गरी लिनु भनी, र म्याद नाघेको अवस्थामा तपसिलमा उल्लेखित मेरो
  एकलौटी हकको धितो सम्पत्तिबाट प्रचलित कानून बमोजिम असुल उपर गरी
  लिन तपाई साहूलाई अधिकार हुनेछ भनी आफ्नो खुशीराजीले किनाराका
  साक्षीको रोहबरमा ${input.place} मा बसी यो तमसुक लेखी रजिष्ट्रेशन पारित
  गरी तपाई साहूलाई दिएँ।
</p>

<div class="section-title">तपसिल</div>

<p style="font-size:13px; line-height:1.8;">
  ${input.collateralDistrict} जिल्ला ${input.collateralMunicipality} गाउँ/नगरपालिका वडा नं.
  ${input.collateralWardNo} (टोल ${input.collateralTole}) मा रहेको
</p>

<table class="boundary-table" style="width:100%; margin:10px 0;">
  <tr>
    <th style="width:15%">पूर्व</th><td style="width:35%">${input.collateralBoundaryEast || '__________'}</td>
    <th style="width:15%">पश्चिम</th><td style="width:35%">${input.collateralBoundaryWest || '__________'}</td>
  </tr>
  <tr>
    <th>उत्तर</th><td>${input.collateralBoundaryNorth || '__________'}</td>
    <th>दक्षिण</th><td>${input.collateralBoundarySouth || '__________'}</td>
  </tr>
</table>

<p style="font-size:13px; line-height:1.8;">
  यती चार किल्ला भित्रको
  <strong>${input.collateralLandOfficeName || '__________'}</strong> कार्यालयमा दर्ता भएको
  कित्ता नं. <strong>${input.collateralKittaNo}</strong> को जग्गा,
  क्षेत्रफल <strong>${input.collateralAreaDetail}</strong>,
  र सो जग्गामा बनेको घर <strong>${input.collateralBuildingDetail || '__________'}</strong>।
</p>

<table>
  <tr><th style="width:30%">धितो मूल्याङ्कन</th><td>रू. ${input.collateralValuation.toLocaleString()}/.- (${collateralWords})</td></tr>
  <tr><th>मूल्याङ्कनकर्ता</th><td>${input.valuerName}</td></tr>
  <tr><th>मिति</th><td>${input.valuationDateBs}</td></tr>
</table>

<div class="section-title">जमानीदार</div>
<table>
  ${(input.guarantors || []).length > 0 
    ? (input.guarantors || []).map((g, i) => `
    <tr>
      <th style="width:5%">${i + 1}.</th>
      <th style="width:20%">नाम</th><td>${g.fullName || '__________'}</td>
      <th style="width:20%">नागरिकता नं.</th><td>${g.citizenshipNo || '__________'}</td>
      <th style="width:15%">नाता</th><td>${g.relationship || '__________'}</td>
    </tr>`).join('')
    : `
    <tr>
      <th style="width:5%">१.</th>
      <th style="width:20%">नाम</th><td>${input.guarantorName}</td>
      <th style="width:20%">नागरिकता नं.</th><td>${input.guarantor1Citizenship || '__________'}</td>
      <th style="width:15%">नाता</th><td>${input.guarantor1Relationship || '__________'}</td>
    </tr>
    <tr>
      <th>२.</th>
      <th>नाम</th><td>${input.guarantor2Name || '__________'}</td>
      <th>नागरिकता नं.</th><td>${input.guarantor2Citizenship || '__________'}</td>
      <th>नाता</th><td>${input.guarantor2Relationship || '__________'}</td>
    </tr>`
  }
</table>

<p style="font-size:12px; margin-top:20px; text-align:center;">
  इति सम्बत् ${yearBs} साल ${monthBs} महिना ${dayBs} गते रोज ${input.dayOfWeek || '__________'} शुभम्
</p>

<div class="sig-grid">
  <div>
    दा. वा.<br/><br/><br/>
    हस्ताक्षरको सही
  </div>
  <div>
    ऋणीको सही<br/><br/><br/>
    ${input.borrowerName}
  </div>
  ${(input.guarantors || []).length > 0 
    ? `<div>
    जमानीदार १ को सही<br/><br/><br/>
    ${(input.guarantors || [])[0]?.fullName || '__________'}
  </div>`
    : `<div>
    जमानीदार १ को सही<br/><br/><br/>
    ${input.guarantorName}
  </div>`
  }
</div>

${(input.guarantors || []).length > 1 
  ? (input.guarantors || []).slice(1).map((g, i) => `
<div class="sig-grid" style="margin-top:20px;">
  <div></div>
  <div></div>
  <div>
    जमानीदार ${i + 2} को सही<br/><br/><br/>
    ${g.fullName || '__________'}
  </div>
</div>`).join('')
  : (input.guarantor2Name 
    ? `<div class="sig-grid" style="margin-top:20px;">
  <div></div>
  <div></div>
  <div>
    जमानीदार २ को सही<br/><br/><br/>
    ${input.guarantor2Name}
  </div>
</div>`
    : '')
}

<div class="witness-grid" style="margin-top:40px;">
  <div>
    <strong>साक्षी:</strong><br/>
    १. ${input.witness1Name || '__________'} .................... (सही)
  </div>
  <div>
    <strong>साक्षी:</strong><br/>
    २. ${input.witness2Name || '__________'} .................... (सही)
  </div>
</div>

<p style="font-size:11px; margin-top:30px; text-align:right;">
  लेखक: ${input.scribeStaffName || '__________'}, पद: ${input.scribeDesignation || '__________'}
</p>

<div class="legal-note">
  <strong>किन दृष्टिबन्धक ढाँचा (अनुसूची–२), भोगबन्धक (अनुसूची–३) होइन</strong><br/>
  <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:11px;">
    <tr style="background:#eee;"><th style="border:1px solid #999;padding:4px 8px;">विषय</th><th style="border:1px solid #999;padding:4px 8px;">दृष्टिबन्धक (अनुसूची–२)</th><th style="border:1px solid #999;padding:4px 8px;">भोगबन्धक (अनुसूची–३)</th></tr>
    <tr><td style="border:1px solid #999;padding:4px 8px;">धितोको भोग</td><td style="border:1px solid #999;padding:4px 8px;">ऋणीकै भोगमा रहन्छ</td><td style="border:1px solid #999;padding:4px 8px;">साहूको भोगमा जान्छ</td></tr>
    <tr><td style="border:1px solid #999;padding:4px 8px;">ब्याज</td><td style="border:1px solid #999;padding:4px 8px;">छुट्टै तिर्नुपर्छ</td><td style="border:1px solid #999;padding:4px 8px;">भोगबाटै ब्याज तिरेको मानिन्छ</td></tr>
    <tr><td style="border:1px solid #999;padding:4px 8px;">आधुनिक सहकारी अभ्यास</td><td style="border:1px solid #999;padding:4px 8px;">✓ ठ्याक्कै मिल्छ (सदस्यले जग्गा/घर आफैं प्रयोग गर्दै किस्ता तिर्छन्)</td><td style="border:1px solid #999;padding:4px 8px;">घर बहाल लगाउने खालको पुरानो अभ्यास</td></tr>
  </table>
  <strong>Legal validity note (ऐनको दफा ६ अनुसार)</strong><br/>
  Act को दफा ६ ("अरू लिखतको सम्बन्धमा परम्परागत ढाँचालाई नै प्रयोगमा ल्याउन सकिने") ले
  cooperative-specific fields (सदस्य नं., शाखा, EMI किस्ताबन्दी, जमानीदार बहुविध) थप्न बाधा
  पुऱ्याउँदैन — ऐनले तोकेको मूल संरचना र आवश्यक व्यहोरा (धनी-ऋणीको पूर्ण परिचय, रकम
  अक्षरेपी सहित, ब्याज दर, भुक्तान शर्त, धितो विवरण, दस्तखत/साक्षी) कायम राखेर थप विवरण
  समावेश गर्दा दफा ६ को उपदफा (३) अनुसार "शब्दावली वा भाषागत हेरफेर भएकोले लिखतको
  सामूहिक स्वरूपमा सारभूत परिवर्तन भएको छैन भने त्यस्तो भिन्नताले लिखतलाई प्रतिकूल असर
  पर्दैन" भनिएको प्रावधान अन्तर्गत यो ढाँचा वैध रहन्छ।
</div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Unified generator
// ═══════════════════════════════════════════════════════════════

export type LegalDocumentType = 'demand' | 'agreement' | 'tamsuk';

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, { nepali: string; english: string }> = {
  demand: { nepali: 'ऋण माग फारम', english: 'Loan Demand Form' },
  agreement: { nepali: 'सम्झौता फारम', english: 'Loan Agreement Form' },
  tamsuk: { nepali: 'तमसुक फारम', english: 'Mortgage Undertaking' },
};

export function generateLegalDocument(type: LegalDocumentType, input: DocumentGeneratorInput): string {
  switch (type) {
    case 'demand': return generateLoanDemandForm(input);
    case 'agreement': return generateLoanAgreementForm(input);
    case 'tamsuk': return generateTamsukForm(input);
    default: return '';
  }
}
