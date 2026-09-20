import React, { useState, useEffect } from 'react';
import { X, Printer, Palette, ShieldCheck, Download, Award, Loader2, AlertCircle } from 'lucide-react';
import { Member, ShareCertificate } from '../../types/coop';
import { apiClient } from '../../lib/apiClient';
import { fetchMemberShareCertificate, ShareCertificateData } from '../../api/shares';
import { DateConverter } from '../../utils/DateConverter';
import { 
  ShareCertificateCanvas, 
  CertificateConfig,
  CertificateTheme, 
  DEFAULT_CERT_CONFIG 
} from '../shares/ShareCertificateCanvas';

interface ShareCertificateModalProps {
  member: Member | null;
  certificate?: ShareCertificate | null;
  onClose: () => void;
}

const VALID_THEMES: CertificateTheme[] = ['royal_gold', 'emerald_heritage', 'crimson_prestige', 'executive_navy'];

export const ShareCertificateModal: React.FC<ShareCertificateModalProps> = ({
  member,
  certificate,
  onClose,
}) => {
  const [theme, setTheme] = useState<CertificateTheme>('royal_gold');
  // Saved design (configJson) from the organization's default Share Certificate
  // Format, fetched once when the modal mounts so the canvas renders the org's
  // real design. Falls back to the first active format, then the default design.
  const [savedConfig, setSavedConfig] = useState<Partial<CertificateConfig>>({});
  // Real member share data aggregated from the DB (total kitta, paid-up
  // capital, face value, distinctive kitta range, certificate no, issue date).
  const [data, setData] = useState<ShareCertificateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    (async () => {
      try {
        const [defRes, listRes] = await Promise.all([
          apiClient.get('/shares/settings/default-certificate-format'),
          apiClient.get('/share-settings/certificate-formats'),
        ]);
        if (!active) return;
        let cfg = defRes.data?.format?.configJson;
        if (!cfg || typeof cfg !== 'object') {
          const rows = Array.isArray(listRes.data) ? listRes.data : [];
          const activeRow = rows.find((r: any) => r.isActive) ?? rows[0];
          cfg = activeRow?.configJson;
        }
        if (cfg && typeof cfg === 'object') {
          setSavedConfig(cfg);
          if (VALID_THEMES.includes(cfg.theme)) setTheme(cfg.theme);
        }
      } catch {
        // Non-fatal: fall back to the default certificate design.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Fetch REAL share data whenever the member (or specific certificate) changes.
  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetchMemberShareCertificate(member.id!, certificate?.id ?? undefined);
        if (active) setData(res);
      } catch (e: any) {
        if (active) setLoadError(e?.response?.data?.error || e?.message || 'Could not load share data.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [member?.id, certificate?.id]);

  if (!member) return null;

  const handlePrint = () => {
    window.print();
  };

  // Merge the fetched real member data into the member object so the canvas
  // renders DB values (name, citizenship, address, total shares, share amount)
  // instead of the hardcoded fallbacks (50 kitta / रु. 5,000 / 1001–1050).
  const realMember: Member | null = data
    ? {
        ...member,
        fullName: data.member.fullName || member.fullName,
        memberNo: data.member.memberNo || member.memberNo,
        citizenshipNo: data.member.citizenshipNo !== 'N/A' ? data.member.citizenshipNo : member.citizenshipNo,
        address: data.member.address !== '—' ? data.member.address : member.address,
        membershipDateBS: data.member.membershipDateBS || member.membershipDateBS,
        totalShares: data.certificate.totalShares,
        shareAmount: data.certificate.totalCapital,
      }
    : member;

  let issuedDateAD = '';
  if (data?.certificate.issuedDateBS) {
    try { issuedDateAD = DateConverter.bsToAd(data.certificate.issuedDateBS); } catch { issuedDateAD = ''; }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[95vh] my-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out">
        
        {/* Modal Header (synced with real DB aggregation) */}
        <div className="p-4 bg-slate-50 /80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 /40 text-amber-800 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Share Certificate — {realMember.fullName}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Member ID: {realMember.memberNo} | Total Shares:{' '}
                <span className="font-bold text-emerald-700">
                  {loading ? '…' : data ? `${data.certificate.totalShares} (NPR ${data.certificate.totalCapital.toLocaleString()})` : `${realMember.totalShares} (NPR ${realMember.shareAmount.toLocaleString()})`}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Theme Selector */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <Palette className="w-3.5 h-3.5 text-amber-600 ml-1" />
              <button
                type="button"
                onClick={() => setTheme('royal_gold')}
                className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${ theme === 'royal_gold' ? 'bg-amber-100 text-amber-900 ' : 'text-slate-600' }`}
              >
                Gold
              </button>
              <button
                type="button"
                onClick={() => setTheme('emerald_heritage')}
                className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${ theme === 'emerald_heritage' ? 'bg-emerald-100 text-emerald-900 ' : 'text-slate-600' }`}
              >
                Emerald
              </button>
              <button
                type="button"
                onClick={() => setTheme('crimson_prestige')}
                className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${ theme === 'crimson_prestige' ? 'bg-rose-100 text-rose-900 ' : 'text-slate-600' }`}
              >
                Crimson
              </button>
              <button
                type="button"
                onClick={() => setTheme('executive_navy')}
                className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${ theme === 'executive_navy' ? 'bg-slate-200 text-slate-800 ' : 'text-slate-600' }`}
              >
                Navy
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Certificate</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body with Certificate Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading real share data…
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 py-12 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
            </div>
          ) : (
            <ShareCertificateCanvas 
              member={realMember} 
              config={{ ...DEFAULT_CERT_CONFIG, ...savedConfig, theme }} 
              certificateNo={data?.certificate.certificateNo}
              kittaStart={data?.certificate.kittaStart}
              kittaEnd={data?.certificate.kittaEnd}
              issuedDateBS={data?.certificate.issuedDateBS}
              issuedDateAD={issuedDateAD}
            />
          )}
        </div>

      </div>
    </div>
  );
};
