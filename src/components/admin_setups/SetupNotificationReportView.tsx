import React, { useState, useEffect, useCallback } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  MessageSquare, Mail, FileCheck, Save, Send, Settings, 
  Bell, Clock, CheckCircle, AlertCircle, RefreshCw,
  Edit3, Trash2, Plus, ToggleLeft, ToggleRight, Copy,
  Phone
} from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import {
  getNotificationSettings,
  updateNotificationSettings,
  testSmsConfiguration,
  testEmailConfiguration,
  testWhatsAppConfiguration,
  checkSmsBalance,
  checkWhatsAppBalance,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  OrgNotificationSettings,
  NotificationTemplate,
  ReminderRule,
} from '../../api/notificationSettings';

interface Props {
  activeSubKey?: string;
}

export const SetupNotificationReportView: React.FC<Props> = ({ activeSubKey = 'setup_sms_gateway' }) => {
  const { addNotification, currentOrganization } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');

  // Organization ID from context
  const organizationId = currentOrganization?.id || '';

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // =============================================
  // SMS GATEWAY STATE
  // =============================================
  const [smsConfig, setSmsConfig] = useState<OrgNotificationSettings>({
    organizationId,
    smsProvider: 'aakash',
    smsApiKey: '',
    smsSenderId: '',
    smsEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: '',
    smtpFromEmail: '',
    smtpSecure: true,
    emailEnabled: false,
    whatsappProvider: 'meta',
    whatsappApiKey: '',
    whatsappApiSecret: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappAccessToken: '',
    whatsappEnabled: false,
    usePlatformCredentials: true,
    smsCreditBalance: 0,
    whatsappCreditBalance: 0,
  });

  // =============================================
  // EMAIL SERVER STATE
  // =============================================
  const [emailConfig, setEmailConfig] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: '',
    smtpFromEmail: '',
    smtpSecure: true,
    emailEnabled: false,
  });

  // =============================================
  // WHATSAPP STATE
  // =============================================
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'meta',
    apiKey: '',
    apiSecret: '',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    enabled: false,
  });

  // =============================================
  // TEMPLATES STATE
  // =============================================
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    code: '',
    channel: 'SMS' as 'Email' | 'SMS' | 'Push' | 'In_App',
    category: 'transaction',
    subject: '',
    bodyTemplate: '',
    isActive: true,
  });

  // =============================================
  // REMINDER RULES STATE
  // =============================================
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    code: '',
    name: '',
    description: '',
    triggerType: 'days_before',
    triggerDays: 3,
    triggerTime: '09:00',
    eventType: 'emi_due',
    sendSms: true,
    sendEmail: false,
    sendInApp: true,
    recipientType: 'member',
    isActive: true,
  });

  // =============================================
  // TEST MODAL STATE
  // =============================================
  const [showTestModal, setShowTestModal] = useState(false);
  const [testType, setTestType] = useState<'sms' | 'email'>('sms');
  const [testValue, setTestValue] = useState('');

  // =============================================
  // LOAD DATA
  // =============================================
  const loadSettings = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const settings = await getNotificationSettings(organizationId);
      setSmsConfig(settings);
      setEmailConfig({
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser || '',
        smtpPass: settings.smtpPass || '',
        smtpFromName: settings.smtpFromName || '',
        smtpFromEmail: settings.smtpFromEmail || '',
        smtpSecure: settings.smtpSecure,
        emailEnabled: settings.emailEnabled,
      });
      setWhatsappConfig({
        provider: settings.whatsappProvider || 'meta',
        apiKey: settings.whatsappApiKey || '',
        apiSecret: settings.whatsappApiSecret || '',
        phoneNumberId: settings.whatsappPhoneNumberId || '',
        businessAccountId: settings.whatsappBusinessAccountId || '',
        accessToken: settings.whatsappAccessToken || '',
        enabled: settings.whatsappEnabled,
      });
    } catch (error: any) {
      console.error('Failed to load notification settings:', error);
      addNotification('Error', 'Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [organizationId, addNotification]);

  const loadTemplates = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const data = await getTemplates(organizationId);
      setTemplates(data);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
    }
  }, [organizationId]);

  const loadReminderRules = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const data = await getReminderRules(organizationId);
      setReminderRules(data);
    } catch (error: any) {
      console.error('Failed to load reminder rules:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  useEffect(() => {
    loadSettings();
    loadTemplates();
    loadReminderRules();
  }, [loadSettings, loadTemplates, loadReminderRules]);

  // =============================================
  // SMS GATEWAY HANDLERS
  // =============================================
  const handleSaveSmsConfig = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(organizationId, {
        smsProvider: smsConfig.smsProvider,
        smsApiKey: smsConfig.smsApiKey,
        smsSenderId: smsConfig.smsSenderId,
        smsEnabled: smsConfig.smsEnabled,
        usePlatformCredentials: smsConfig.usePlatformCredentials,
      });
      addNotification('Success', 'SMS Gateway settings saved successfully', 'success');
    } catch (error: any) {
      addNotification('Error', 'Failed to save SMS settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testValue) {
      addNotification('Error', 'Please enter a phone number', 'error');
      return;
    }
    
    setTesting(true);
    try {
      await testSmsConfiguration(organizationId, testValue);
      addNotification('Success', 'Test SMS sent successfully', 'success');
      setShowTestModal(false);
      setTestValue('');
    } catch (error: any) {
      addNotification('Error', 'Failed to send test SMS', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleCheckSmsBalance = async () => {
    try {
      const result = await checkSmsBalance(organizationId);
      setSmsConfig(prev => ({ ...prev, smsCreditBalance: result.balance }));
      addNotification('Info', `SMS Balance: ${result.balance} credits`, 'info');
    } catch (error: any) {
      addNotification('Error', 'Failed to check SMS balance', 'error');
    }
  };

  // =============================================
  // WHATSAPP HANDLERS
  // =============================================
  const handleSaveWhatsAppConfig = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(organizationId, {
        whatsappProvider: whatsappConfig.provider,
        whatsappApiKey: whatsappConfig.apiKey,
        whatsappApiSecret: whatsappConfig.apiSecret,
        whatsappPhoneNumberId: whatsappConfig.phoneNumberId,
        whatsappBusinessAccountId: whatsappConfig.businessAccountId,
        whatsappAccessToken: whatsappConfig.accessToken,
        whatsappEnabled: whatsappConfig.enabled,
        usePlatformCredentials: smsConfig.usePlatformCredentials,
      });
      addNotification('Success', 'WhatsApp settings saved successfully', 'success');
    } catch (error: any) {
      addNotification('Error', 'Failed to save WhatsApp settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testValue) {
      addNotification('Error', 'Please enter a phone number', 'error');
      return;
    }
    
    setTesting(true);
    try {
      await testWhatsAppConfiguration(organizationId, testValue);
      addNotification('Success', 'Test WhatsApp message sent successfully', 'success');
      setShowTestModal(false);
      setTestValue('');
    } catch (error: any) {
      addNotification('Error', 'Failed to send test WhatsApp message', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleCheckWhatsAppBalance = async () => {
    try {
      const result = await checkWhatsAppBalance(organizationId);
      setSmsConfig(prev => ({ ...prev, whatsappCreditBalance: result.balance }));
      addNotification('Info', `WhatsApp Balance: ${result.balance} credits`, 'info');
    } catch (error: any) {
      addNotification('Error', 'Failed to check WhatsApp balance', 'error');
    }
  };

  // =============================================
  // EMAIL SERVER HANDLERS
  // =============================================
  const handleSaveEmailConfig = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(organizationId, {
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpUser: emailConfig.smtpUser,
        smtpPass: emailConfig.smtpPass,
        smtpFromName: emailConfig.smtpFromName,
        smtpFromEmail: emailConfig.smtpFromEmail,
        smtpSecure: emailConfig.smtpSecure,
        emailEnabled: emailConfig.emailEnabled,
      });
      addNotification('Success', 'Email Server settings saved successfully', 'success');
    } catch (error: any) {
      addNotification('Error', 'Failed to save email settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testValue) {
      addNotification('Error', 'Please enter an email address', 'error');
      return;
    }
    
    setTesting(true);
    try {
      await testEmailConfiguration(organizationId, testValue);
      addNotification('Success', 'Test email sent successfully', 'success');
      setShowTestModal(false);
      setTestValue('');
    } catch (error: any) {
      addNotification('Error', 'Failed to send test email', 'error');
    } finally {
      setTesting(false);
    }
  };

  // =============================================
  // TEMPLATE HANDLERS
  // =============================================
  const handleCreateTemplate = async () => {
    if (!templateForm.code || !templateForm.bodyTemplate) {
      addNotification('Error', 'Code and body template are required', 'error');
      return;
    }
    
    setSaving(true);
    try {
      await createTemplate(organizationId, templateForm);
      addNotification('Success', 'Template created successfully', 'success');
      setShowTemplateForm(false);
      setTemplateForm({ code: '', channel: 'SMS', category: 'transaction', subject: '', bodyTemplate: '', isActive: true });
      loadTemplates();
    } catch (error: any) {
      addNotification('Error', 'Failed to create template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    
    setSaving(true);
    try {
      await updateTemplate(organizationId, editingTemplate.id, templateForm);
      addNotification('Success', 'Template updated successfully', 'success');
      setEditingTemplate(null);
      setShowTemplateForm(false);
      loadTemplates();
    } catch (error: any) {
      addNotification('Error', 'Failed to update template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteTemplate(organizationId, templateId);
      addNotification('Success', 'Template deleted successfully', 'success');
      loadTemplates();
    } catch (error: any) {
      addNotification('Error', 'Failed to delete template', 'error');
    }
  };

  const startEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      code: template.code,
      channel: template.channel,
      category: template.category || 'transaction',
      subject: template.subject || '',
      bodyTemplate: template.bodyTemplate,
      isActive: template.isActive,
    });
    setShowTemplateForm(true);
  };

  // =============================================
  // REMINDER RULE HANDLERS
  // =============================================
  const handleCreateRule = async () => {
    if (!ruleForm.code || !ruleForm.name) {
      addNotification('Error', 'Code and name are required', 'error');
      return;
    }
    
    setSaving(true);
    try {
      await createReminderRule(organizationId, ruleForm);
      addNotification('Success', 'Reminder rule created successfully', 'success');
      setShowRuleForm(false);
      setRuleForm({
        code: '', name: '', description: '', triggerType: 'days_before',
        triggerDays: 3, triggerTime: '09:00', eventType: 'emi_due',
        sendSms: true, sendEmail: false, sendInApp: true,
        recipientType: 'member', isActive: true,
      });
      loadReminderRules();
    } catch (error: any) {
      addNotification('Error', 'Failed to create reminder rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    
    setSaving(true);
    try {
      await updateReminderRule(organizationId, editingRule.id, ruleForm);
      addNotification('Success', 'Reminder rule updated successfully', 'success');
      setEditingRule(null);
      setShowRuleForm(false);
      loadReminderRules();
    } catch (error: any) {
      addNotification('Error', 'Failed to update reminder rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this reminder rule?')) return;
    
    try {
      await deleteReminderRule(organizationId, ruleId);
      addNotification('Success', 'Reminder rule deleted successfully', 'success');
      loadReminderRules();
    } catch (error: any) {
      addNotification('Error', 'Failed to delete reminder rule', 'error');
    }
  };

  const startEditRule = (rule: ReminderRule) => {
    setEditingRule(rule);
    setRuleForm({
      code: rule.code,
      name: rule.name,
      description: rule.description || '',
      triggerType: rule.triggerType,
      triggerDays: rule.triggerDays || 3,
      triggerTime: rule.triggerTime || '09:00',
      eventType: rule.eventType,
      sendSms: rule.sendSms,
      sendEmail: rule.sendEmail,
      sendInApp: rule.sendInApp,
      recipientType: rule.recipientType,
      isActive: rule.isActive,
    });
    setShowRuleForm(true);
  };

  // =============================================
  // FILTER TEMPLATES
  // =============================================
  const filteredTemplates = templates.filter(t =>
    (t.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (t.bodyTemplate || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (t.subject || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  // =============================================
  // RENDER SMS GATEWAY
  // =============================================
  const renderSmsGateway = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">SMS Gateway Configuration</h3>
          <p className="text-slate-500 text-xs">Configure SMS provider credentials for notifications</p>
        </div>
        {smsConfig.smsCreditBalance !== undefined && smsConfig.smsCreditBalance > 0 && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded font-mono text-[10px] font-bold">
            Balance: {smsConfig.smsCreditBalance} SMS
          </span>
        )}
      </div>

      {/* Platform Credentials Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-slate-700">Use Platform Credentials</p>
          <p className="text-xs text-slate-500">Use super admin SMS credentials as fallback</p>
        </div>
        <button
          onClick={() => setSmsConfig(prev => ({ ...prev, usePlatformCredentials: !prev.usePlatformCredentials }))}
          className="text-emerald-600"
        >
          {smsConfig.usePlatformCredentials ? (
            <ToggleRight className="w-8 h-8" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-slate-400" />
          )}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">SMS Provider</label>
          <select
            value={smsConfig.smsProvider || 'aakash'}
            onChange={(e) => setSmsConfig(prev => ({ ...prev, smsProvider: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900"
          >
            <option value="aakash">Aakash SMS Nepal API</option>
            <option value="sparrow">Sparrow SMS API</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">SMS API Secret Token / Key</label>
          <input
            type="password"
            value={smsConfig.smsApiKey || ''}
            onChange={(e) => setSmsConfig(prev => ({ ...prev, smsApiKey: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-emerald-700 font-mono focus:outline-none focus:border-emerald-500"
            placeholder="Enter your API key"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">Approved Sender Mask ID</label>
          <input
            type="text"
            value={smsConfig.smsSenderId || ''}
            onChange={(e) => setSmsConfig(prev => ({ ...prev, smsSenderId: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            placeholder="e.g., SAHAKARI"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-slate-700">Enable SMS Notifications</p>
            <p className="text-xs text-slate-500">Send SMS alerts for transactions</p>
          </div>
          <button
            onClick={() => setSmsConfig(prev => ({ ...prev, smsEnabled: !prev.smsEnabled }))}
            className="text-emerald-600"
          >
            {smsConfig.smsEnabled ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveSmsConfig}
            disabled={saving}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Gateway Settings'}
          </button>
          <button
            onClick={handleCheckSmsBalance}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check Balance
          </button>
          <button
            onClick={() => { setTestType('sms'); setShowTestModal(true); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200"
          >
            <Send className="w-3.5 h-3.5" /> Test SMS
          </button>
        </div>
      </div>
    </div>
  );

  // =============================================
  // RENDER EMAIL SERVER
  // =============================================
  const renderEmailServer = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">SMTP Mail Server Settings</h3>
          <p className="text-slate-500 text-xs">Configure email server for notifications</p>
        </div>
      </div>

      {/* Platform Credentials Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-slate-700">Use Platform Credentials</p>
          <p className="text-xs text-slate-500">Use super admin SMTP credentials as fallback</p>
        </div>
        <button
          onClick={() => setEmailConfig(prev => ({ ...prev, usePlatformCredentials: !prev.usePlatformCredentials }))}
          className="text-emerald-600"
        >
          {smsConfig.usePlatformCredentials ? (
            <ToggleRight className="w-8 h-8" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-slate-400" />
          )}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">SMTP Hostname</label>
          <input
            type="text"
            value={emailConfig.smtpHost}
            onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            placeholder="smtp.gmail.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">SMTP Port</label>
            <input
              type="number"
              value={emailConfig.smtpPort}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPort: Number(e.target.value) }))}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">Security</label>
            <select
              value={emailConfig.smtpSecure ? 'tls' : 'none'}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpSecure: e.target.value === 'tls' }))}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900"
            >
              <option value="tls">TLS/SSL</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">SMTP Username</label>
          <input
            type="text"
            value={emailConfig.smtpUser}
            onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            placeholder="your-email@gmail.com"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">SMTP Password</label>
          <input
            type="password"
            value={emailConfig.smtpPass}
            onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPass: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">From Name</label>
            <input
              type="text"
              value={emailConfig.smtpFromName}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpFromName: e.target.value }))}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              placeholder="Sahakari Sathi"
            />
          </div>
          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">From Email</label>
            <input
              type="email"
              value={emailConfig.smtpFromEmail}
              onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpFromEmail: e.target.value }))}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
              placeholder="noreply@example.com"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-slate-700">Enable Email Notifications</p>
            <p className="text-xs text-slate-500">Send email alerts and reports</p>
          </div>
          <button
            onClick={() => setEmailConfig(prev => ({ ...prev, emailEnabled: !prev.emailEnabled }))}
            className="text-emerald-600"
          >
            {emailConfig.emailEnabled ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveEmailConfig}
            disabled={saving}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Mail Server Configuration'}
          </button>
          <button
            onClick={() => { setTestType('email'); setShowTestModal(true); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200"
          >
            <Send className="w-3.5 h-3.5" /> Test Email
          </button>
        </div>
      </div>
    </div>
  );

  // =============================================
  // RENDER WHATSAPP CONFIGURATION
  // =============================================
  const renderWhatsApp = () => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">WhatsApp Business Configuration</h3>
          <p className="text-slate-500 text-xs">Configure WhatsApp API for notifications</p>
        </div>
        {whatsappConfig.enabled && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded font-mono text-[10px] font-bold flex items-center gap-1">
            <Phone className="w-3 h-3" /> Enabled
          </span>
        )}
      </div>

      {/* Platform Credentials Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-slate-700">Use Platform Credentials</p>
          <p className="text-xs text-slate-500">Use super admin WhatsApp credentials as fallback</p>
        </div>
        <button
          onClick={() => setSmsConfig(prev => ({ ...prev, usePlatformCredentials: !prev.usePlatformCredentials }))}
          className="text-emerald-600"
        >
          {smsConfig.usePlatformCredentials ? (
            <ToggleRight className="w-8 h-8" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-slate-400" />
          )}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">WhatsApp Provider</label>
          <select
            value={whatsappConfig.provider}
            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900"
          >
            <option value="meta">Meta (WhatsApp Business API)</option>
            <option value="twilio">Twilio WhatsApp</option>
            <option value="textme">TextMe Bot</option>
          </select>
        </div>

        {whatsappConfig.provider === 'meta' && (
          <>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Phone Number ID</label>
              <input
                type="text"
                value={whatsappConfig.phoneNumberId}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter Phone Number ID"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Business Account ID</label>
              <input
                type="text"
                value={whatsappConfig.businessAccountId}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, businessAccountId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter Business Account ID"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Access Token</label>
              <input
                type="password"
                value={whatsappConfig.accessToken}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter Access Token"
              />
            </div>
          </>
        )}

        {whatsappConfig.provider === 'twilio' && (
          <>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Account SID (API Key)</label>
              <input
                type="password"
                value={whatsappConfig.apiKey}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter Twilio Account SID"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Auth Token (API Secret)</label>
              <input
                type="password"
                value={whatsappConfig.apiSecret}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter Twilio Auth Token"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Twilio Phone Number</label>
              <input
                type="text"
                value={whatsappConfig.phoneNumberId}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="+1234567890"
              />
            </div>
          </>
        )}

        {whatsappConfig.provider === 'textme' && (
          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">API Key</label>
            <input
              type="password"
              value={whatsappConfig.apiKey}
              onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
              placeholder="Enter TextMe API Key"
            />
          </div>
        )}

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-slate-700">Enable WhatsApp Notifications</p>
            <p className="text-xs text-slate-500">Send WhatsApp alerts for transactions</p>
          </div>
          <button
            onClick={() => setWhatsappConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className="text-emerald-600"
          >
            {whatsappConfig.enabled ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveWhatsAppConfig}
            disabled={saving}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save WhatsApp Settings'}
          </button>
          <button
            onClick={handleCheckWhatsAppBalance}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check Balance
          </button>
          <button
            onClick={() => { setTestType('whatsapp'); setShowTestModal(true); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200"
          >
            <Send className="w-3.5 h-3.5" /> Test
          </button>
        </div>
      </div>
    </div>
  );

  // =============================================
  // RENDER TEMPLATES
  // =============================================
  const renderTemplates = () => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 max-w-2xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-sm">Notification Templates</h3>
        <button
          onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Template
        </button>
      </div>

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-700 text-sm">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Template Code</label>
              <input
                type="text"
                value={templateForm.code}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono"
                placeholder="e.g., EMI_REMINDER"
                disabled={!!editingTemplate}
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Channel</label>
              <select
                value={templateForm.channel}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, channel: e.target.value as any }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
              >
                <option value="SMS">SMS</option>
                <option value="Email">Email</option>
                <option value="Push">Push</option>
                <option value="In_App">In-App</option>
              </select>
            </div>
          </div>

          {templateForm.channel === 'Email' && (
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Subject</label>
              <input
                type="text"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                placeholder="Email subject line"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">Template Body</label>
            <textarea
              value={templateForm.bodyTemplate}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, bodyTemplate: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono h-24"
              placeholder="Use {VARIABLE_NAME} for dynamic content"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Available variables: {'{MEMBER_NAME}'}, {'{AMOUNT}'}, {'{ACCOUNT_NO}'}, {'{BALANCE}'}, {'{DUE_DATE}'}, {'{OTP_CODE}'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
            >
              {saving ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
            </button>
            <button
              onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-2 text-xs">
        {filteredTemplates.length === 0 ? (
          <div className="p-4 text-center text-slate-500">No templates found</div>
        ) : (
          filteredTemplates.map((t) => (
            <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-700">{t.code}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    t.channel === 'SMS' ? 'bg-blue-100 text-blue-700' :
                    t.channel === 'Email' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {t.channel}
                  </span>
                  {!t.isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditTemplate(t)}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  {!t.isSystem && (
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-slate-700 font-mono text-[11px]">
                {t.bodyTemplate}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // =============================================
  // RENDER REMINDER RULES
  // =============================================
  const renderReminderRules = () => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 max-w-2xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-sm">Reminder Rules</h3>
        <button
          onClick={() => { setEditingRule(null); setShowRuleForm(true); }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      {/* Rule Form Modal */}
      {showRuleForm && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-700 text-sm">
            {editingRule ? 'Edit Reminder Rule' : 'Create New Reminder Rule'}
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Rule Code</label>
              <input
                type="text"
                value={ruleForm.code}
                onChange={(e) => setRuleForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono"
                placeholder="e.g., EMI_DUE_3DAYS"
                disabled={!!editingRule}
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Rule Name</label>
              <input
                type="text"
                value={ruleForm.name}
                onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                placeholder="e.g., EMI Due 3 Days Before"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 text-xs mb-1 font-medium">Description</label>
            <input
              type="text"
              value={ruleForm.description}
              onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Trigger Type</label>
              <select
                value={ruleForm.triggerType}
                onChange={(e) => setRuleForm(prev => ({ ...prev, triggerType: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
              >
                <option value="days_before">Days Before</option>
                <option value="days_after">Days After</option>
                <option value="on_date">On Date</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Trigger Days</label>
              <input
                type="number"
                value={ruleForm.triggerDays}
                onChange={(e) => setRuleForm(prev => ({ ...prev, triggerDays: Number(e.target.value) }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Event Type</label>
              <select
                value={ruleForm.eventType}
                onChange={(e) => setRuleForm(prev => ({ ...prev, eventType: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
              >
                <option value="emi_due">EMI Due</option>
                <option value="deposit_maturity">Deposit Maturity</option>
                <option value="share_dividend">Share Dividend</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 text-xs mb-1 font-medium">Recipient Type</label>
              <select
                value={ruleForm.recipientType}
                onChange={(e) => setRuleForm(prev => ({ ...prev, recipientType: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="all_members">All Members</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ruleForm.sendSms}
                onChange={(e) => setRuleForm(prev => ({ ...prev, sendSms: e.target.checked }))}
                className="rounded"
              />
              Send SMS
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ruleForm.sendEmail}
                onChange={(e) => setRuleForm(prev => ({ ...prev, sendEmail: e.target.checked }))}
                className="rounded"
              />
              Send Email
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ruleForm.sendInApp}
                onChange={(e) => setRuleForm(prev => ({ ...prev, sendInApp: e.target.checked }))}
                className="rounded"
              />
              In-App Notification
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={editingRule ? handleUpdateRule : handleCreateRule}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
            >
              {saving ? 'Saving...' : (editingRule ? 'Update' : 'Create')}
            </button>
            <button
              onClick={() => { setShowRuleForm(false); setEditingRule(null); }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2 text-xs">
        {reminderRules.length === 0 ? (
          <div className="p-4 text-center text-slate-500">No reminder rules configured</div>
        ) : (
          reminderRules.map((rule) => (
            <div key={rule.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-700">{rule.code}</span>
                  <span className="text-slate-600">{rule.name}</span>
                  {!rule.isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditRule(rule)}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{rule.triggerType.replace('_', ' ')} {rule.triggerDays} days</span>
                <span>•</span>
                <span>{rule.eventType.replace('_', ' ')}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {rule.sendSms && <MessageSquare className="w-3 h-3" />}
                  {rule.sendEmail && <Mail className="w-3 h-3" />}
                  {rule.sendInApp && <Bell className="w-3 h-3" />}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // =============================================
  // RENDER TEST MODAL
  // =============================================
  const renderTestModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 space-y-4">
        <h3 className="font-bold text-slate-900">
          Test {testType === 'sms' ? 'SMS' : testType === 'email' ? 'Email' : 'WhatsApp'} Configuration
        </h3>
        <div>
          <label className="block text-slate-600 text-xs mb-1 font-medium">
            {testType === 'sms' ? 'Phone Number' : testType === 'email' ? 'Email Address' : 'WhatsApp Number'}
          </label>
          <input
            type={testType === 'email' ? 'email' : 'tel'}
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
            placeholder={testType === 'email' ? 'test@example.com' : '+977-98XXXXXXXX'}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={testType === 'sms' ? handleTestSms : testType === 'email' ? handleTestEmail : handleTestWhatsApp}
            disabled={testing || !testValue}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Send Test'}
          </button>
          <button
            onClick={() => { setShowTestModal(false); setTestValue(''); }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // =============================================
  // MAIN RENDER
  // =============================================
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-slate-600 text-sm">Loading notification settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Persistent Search and Filter Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search notification settings, gateways, or message templates..."
      />

      {/* SMS GATEWAY */}
      {subTab === 'setup_sms_gateway' && renderSmsGateway()}

      {/* EMAIL SERVER */}
      {subTab === 'setup_email_server' && renderEmailServer()}

      {/* WHATSAPP */}
      {subTab === 'setup_whatsapp' && renderWhatsApp()}

      {/* TEMPLATES */}
      {subTab === 'setup_notif_templates' && renderTemplates()}

      {/* REMINDER RULES */}
      {subTab === 'setup_reminder_rules' && renderReminderRules()}

      {/* TEST MODAL */}
      {showTestModal && renderTestModal()}
    </div>
  );
};