import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { Hash, CreditCard, Code, HardDrive, Sliders, Save } from 'lucide-react';

interface Props {
  activeSubKey?: string;
}

export const SetupSystemView: React.FC<Props> = ({ activeSubKey = 'setup_number_series' }) => {
  const { addNotification } = useCoop();
  const toast = useToast();
  const [subTab, setSubTab] = useState<string>(activeSubKey);

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  const [numberSeries, setNumberSeries] = useState([
    { id: '1', module: 'Member Registration No', prefix: 'MB-2083-', lastNo: 1045 },
    { id: '2', module: 'Cash Deposit Receipt Voucher', prefix: 'VR-DEP-', lastNo: 8902 },
    { id: '3', module: 'Loan Account Account No', prefix: 'LN-2083-', lastNo: 320 },
    { id: '4', module: 'Share Certificate Number', prefix: 'SC-2083-', lastNo: 750 },
  ]);

  const [paymentGateways, setPaymentGateways] = useState({
    esewaMerchantId: 'ESEWA_COOP_LIVE_9921',
    khaltiPublicKey: 'live_public_key_3902183901283',
    connectIpsAppId: 'CONN_IPS_2083_NP',
  });

  const handleSave = () => {
    addNotification('System Parameters Saved', 'Auto-numbering prefixes and payment gateway settings updated.', 'success');
    toast.showSuccess(
      'Auto-numbering prefixes and payment gateway settings were updated.',
      'System Settings Saved'
    );
  };

  return (
    <div className="space-y-6">

      {/* NUMBER SERIES */}
      {subTab === 'setup_number_series' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Automated Number Series & Document Prefixes</h3>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow"
            >
              <Save className="w-4 h-4" /> Save Prefixes
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Module Document Type</th>
                  <th className="p-3">Prefix Standard</th>
                  <th className="p-3">Current Running Number Counter</th>
                  <th className="p-3">Next Generated Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {numberSeries.map((ns) => (
                  <tr key={ns.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900">{ns.module}</td>
                    <td className="p-3 text-emerald-700 font-bold">{ns.prefix}</td>
                    <td className="p-3 text-slate-600">{ns.lastNo}</td>
                    <td className="p-3 font-bold text-amber-600">{ns.prefix}{(ns.lastNo + 1).toString().padStart(4, '0')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENT GATEWAY */}
      {subTab === 'setup_payment_gateway' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm">Digital Payment Gateway API Setup (Nepal)</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">eSewa Merchant Code ID</label>
              <input
                type="text"
                value={paymentGateways.esewaMerchantId}
                onChange={(e) => setPaymentGateways(prev => ({ ...prev, esewaMerchantId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs font-mono text-emerald-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Khalti Merchant Public Key</label>
              <input
                type="text"
                value={paymentGateways.khaltiPublicKey}
                onChange={(e) => setPaymentGateways(prev => ({ ...prev, khaltiPublicKey: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs font-mono text-emerald-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">ConnectIPS NCHL App ID</label>
              <input
                type="text"
                value={paymentGateways.connectIpsAppId}
                onChange={(e) => setPaymentGateways(prev => ({ ...prev, connectIpsAppId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs font-mono text-emerald-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Gateway Credentials
            </button>
          </div>
        </div>
      )}

      {/* API SETTINGS */}
      {subTab === 'setup_api_settings' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm">Mobile Banking App Rest API Endpoint Configuration</h3>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-emerald-700 font-mono">https://api.sahakarisathi.org.np/v1/mobile</div>
            <div className="text-slate-600 text-[11px]">Enables member mobile banking apps for balance inquiry, mini statement, and inter-branch QR transfer.</div>
          </div>
        </div>
      )}
    </div>
  );
};
