import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, HelpCircle, CheckCircle2, ChevronRight, AlertCircle, ChevronLeft } from 'lucide-react';
import { fetchSecurityQuestions, type SecurityQuestion } from '../../api/security';

interface SecuritySetupWizardViewProps {
  /**
   * Persists the setup. Must reject if the server did not store the answers —
   * the wizard only reports success once this resolves.
   */
  onComplete: (payload: { mobileNumber: string; answers: { questionId: string; answer: string }[] }) => Promise<void>;
}

export const SecuritySetupWizardView: React.FC<SecuritySetupWizardViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState('');
  const [a2, setA2] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The question catalogue is server-owned (global rows + any the org added),
  // so an answer row can reference a real question id.
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { questions: rows } = await fetchSecurityQuestions();
        if (cancelled) return;
        setQuestions(rows);
        setQuestionsError(rows.length < 2 ? 'No security questions are configured. Contact your administrator.' : null);
      } catch (err: any) {
        if (!cancelled) setQuestionsError(err?.response?.data?.error || 'Could not load security questions. Check your connection and retry.');
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleNext = () => {
    setError(null);
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  /**
   * Saves, then hands off. On failure the user stays on this step with the
   * reason shown — previously this faked a 1500ms delay and reported success
   * without sending anything, so the answers were silently discarded.
   */
  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onComplete({
        mobileNumber: mobile,
        answers: [
          { questionId: q1, answer: a1 },
          { questionId: q2, answer: a2 },
        ],
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not save your security settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isStep1Valid = mobile.length === 10;
  const isStep2Valid = !!q1 && a1.trim().length > 2 && !!q2 && a2.trim().length > 2 && q1 !== q2;
  const questionText = (id: string) => questions.find(q => q.id === id)?.questionText ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-100 p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Secure Your Account</h1>
          <p className="text-sm text-slate-600 mt-2">
            To protect your enterprise data, please set up additional security methods.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex-1 flex flex-col items-center relative ${i !== 3 ? 'after:content-[""] after:h-[2px] after:w-[calc(100%-2rem)] after:bg-slate-200 after:absolute after:top-4 after:left-[calc(50%+1rem)]' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition ${step > i ? 'bg-emerald-500 text-white' : step === i ? 'bg-emerald-700 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
                </div>
                <span className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${step >= i ? 'text-slate-800' : 'text-slate-500'}`}>
                  {i === 1 ? 'Mobile' : i === 2 ? 'Questions' : 'Complete'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Mobile Verification</h2>
                  <p className="text-xs text-slate-500 mt-1">Provide your mobile number to receive security alerts and account recovery notices.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm font-medium">
                    +977
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    className="flex-1 bg-white border border-slate-300 rounded-r-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800">Your number will only be used for account security and critical system notifications.</p>
              </div>

              <button
                onClick={handleNext}
                disabled={!isStep1Valid}
                className={`w-full py-3 mt-4 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 ${isStep1Valid ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <HelpCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Security Questions</h2>
                  <p className="text-xs text-slate-500 mt-1">Set up two security questions to help recover your account if you lose access.</p>
                </div>
              </div>

              {questionsError && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-800">{questionsError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Question 1</label>
                    <select value={q1} onChange={e => setQ1(e.target.value)} disabled={loadingQuestions || questions.length === 0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 cursor-pointer text-slate-700 font-medium disabled:bg-slate-100 disabled:cursor-not-allowed">
                      <option value="">{loadingQuestions ? 'Loading questions...' : 'Select a question...'}</option>
                      {questions.filter(q => q.id !== q2).map(q => <option key={q.id} value={q.id}>{q.questionText}</option>)}
                    </select>
                  </div>
                  <div>
                    <input type="text" value={a1} onChange={e => setA1(e.target.value)} placeholder="Your answer" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Question 2</label>
                    <select value={q2} onChange={e => setQ2(e.target.value)} disabled={loadingQuestions || questions.length === 0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 cursor-pointer text-slate-700 font-medium disabled:bg-slate-100 disabled:cursor-not-allowed">
                      <option value="">{loadingQuestions ? 'Loading questions...' : 'Select a question...'}</option>
                      {questions.filter(q => q.id !== q1).map(q => <option key={q.id} value={q.id}>{q.questionText}</option>)}
                    </select>
                  </div>
                  <div>
                    <input type="text" value={a2} onChange={e => setA2(e.target.value)} placeholder="Your answer" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800">Answers are case-insensitive and stored one-way hashed — nobody, including an administrator, can read them back.</p>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={handleBack} className="px-4 py-3 rounded-xl font-bold text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={!isStep2Valid}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 ${isStep2Valid ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Review &amp; Confirm</h2>
                  <p className="text-xs text-slate-500 mt-1">Nothing has been saved yet. Confirm below to store these settings.</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs font-bold text-slate-700 shrink-0">Mobile</span>
                  <span className="text-xs text-slate-600 text-right">+977 {mobile}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 shrink-0">Question 1</span>
                  <span className="text-xs text-slate-600 text-right">{questionText(q1)}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 shrink-0">Question 2</span>
                  <span className="text-xs text-slate-600 text-right">{questionText(q2)}</span>
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-800">{error}</p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={handleBack} disabled={isLoading} className="px-4 py-3 rounded-xl font-bold text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Save & Continue'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
