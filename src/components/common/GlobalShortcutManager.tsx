import React, { useEffect, useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Zap, Command, CheckCircle2 } from 'lucide-react';

export const GlobalShortcutManager: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    isShortcutModalOpen,
    setIsShortcutModalOpen,
    openTab,
    tabs,
    setActiveTabId,
    openBranchForm
  } = useCoop();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 1500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = (e.key ?? '').toLowerCase();

      // Check if user is typing inside an input/textarea element
      const target = e.target as HTMLElement;
      const isInputField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // 1. Ctrl+K or Cmd+K: Open Global Search & Command Palette (Works Everywhere)
      if (isCtrlOrCmd && key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(!isGlobalSearchOpen);
        setIsShortcutModalOpen(false);
        showToast(isGlobalSearchOpen ? 'Command Palette Closed' : 'Command Palette Opened (Ctrl+K)');
        return;
      }

      // 2. Ctrl+M or Cmd+M: Quick Member Directory Jump
      if (isCtrlOrCmd && key === 'm') {
        e.preventDefault();
        openTab('member_directory', 'Member Directory', 'Users');
        setIsGlobalSearchOpen(false);
        setIsShortcutModalOpen(false);
        showToast('Jumped to Member Directory (Ctrl+M)');
        return;
      }

      // 3. Ctrl+/ or Cmd+/: Toggle Keyboard Shortcut Help
      if (isCtrlOrCmd && (key === '/' || key === '?')) {
        e.preventDefault();
        setIsShortcutModalOpen(!isShortcutModalOpen);
        setIsGlobalSearchOpen(false);
        showToast(isShortcutModalOpen ? 'Shortcuts Closed' : 'Shortcuts Console (Ctrl+/)');
        return;
      }

      // 4. Escape key: Close active search or shortcut modals
      if (e.key === 'Escape') {
        if (isGlobalSearchOpen) {
          setIsGlobalSearchOpen(false);
        }
        if (isShortcutModalOpen) {
          setIsShortcutModalOpen(false);
        }
        return;
      }

      // 5. Alt + Number (1-9) for Direct Tab Switch
      if (isAlt && !isInputField && !isNaN(Number(e.key))) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          const tabIndex = num - 1;
          if (tabs[tabIndex]) {
            e.preventDefault();
            setActiveTabId(tabs[tabIndex].id);
            showToast(`Switched to Tab #${num}: ${tabs[tabIndex].title}`);
            return;
          }
        }
      }

      // 6. Quick Module Jump Shortcuts (Alt + Key or Ctrl+Shift+Key)
      if ((isAlt || (isCtrlOrCmd && e.shiftKey)) && !isInputField) {
        if (key === 's') {
          e.preventDefault();
          openTab('savings_deposit', 'Savings Deposit', 'PiggyBank');
          showToast('Quick Jump: Savings Counter (Alt+S)');
        } else if (key === 'l') {
          e.preventDefault();
          openTab('loan_repayment', 'Loan Repayment', 'Landmark');
          showToast('Quick Jump: Loan Repayments (Alt+L)');
        } else if (key === 'v') {
          e.preventDefault();
          openTab('accounts_vouchers', 'Vouchers & GL', 'BookOpen');
          showToast('Quick Jump: GL Vouchers (Alt+V)');
        } else if (key === 'c') {
          e.preventDefault();
          openTab('cash_denom', 'Vault & Till Counter', 'Wallet');
          showToast('Quick Jump: Cash Denomination Vault (Alt+C)');
        } else if (key === 'h') {
          e.preventDefault();
          openTab('home', 'Dashboard Home', 'Home');
          showToast('Quick Jump: Dashboard Home (Alt+H)');
        } else if (key === 'b') {
          e.preventDefault();
          openBranchForm('add');
          showToast('Opening Branch Registration (Alt+B)');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    isShortcutModalOpen,
    setIsShortcutModalOpen,
    openTab,
    tabs,
    setActiveTabId,
    openBranchForm
  ]);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-12 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
      <div className="bg-white text-slate-800 border border-slate-300/80 rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold">
        <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
          <Zap className="w-4 h-4" />
        </div>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};
