import React, { useState } from 'react';
import { SuperAdminSidebar } from '../layout/SuperAdminSidebar';
import { SuperAdminHeader } from '../layout/SuperAdminHeader';
import { SuperAdminDashboardView } from './dashboard/SuperAdminDashboardView';
import { OrganizationsView } from './organizations/OrganizationsView';
import { PlatformUsersView } from './users/PlatformUsersView';
import { PlatformRolesView } from './roles/PlatformRolesView';
import { ModuleManagementView } from './modules/ModuleManagementView';
import { SubscriptionsView } from './subscriptions/SubscriptionsView';
import { PlatformAuditLogsView } from './audit/PlatformAuditLogsView';
import { SystemSettingsView } from './system/SystemSettingsView';
import { DatabaseAdminView } from './database/DatabaseAdminView';
import { AnnouncementsView } from './notifications/AnnouncementsView';
import { ApiKeysView } from './api/ApiKeysView';
import { SupportView } from './support/SupportView';

import { SuperAdminUsersView } from './admins/SuperAdminUsersView';

type PageId =
  | 'sa_dashboard'
  | 'sa_organizations'
  | 'sa_users'
  | 'sa_admin_users'
  | 'sa_roles'
  | 'sa_modules'
  | 'sa_subscriptions'
  | 'sa_audit'
  | 'sa_system'
  | 'sa_database'
  | 'sa_notifications'
  | 'sa_api'
  | 'sa_support';

const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  sa_dashboard:    { title: 'Dashboard',       subtitle: 'System-wide overview & health metrics' },
  sa_organizations:{ title: 'Organizations',   subtitle: 'Manage all registered cooperatives' },
  sa_users:        { title: 'Platform Users',  subtitle: 'All organization-level users across the platform' },
  sa_admin_users:  { title: 'Admin Users',     subtitle: 'Super administrator accounts — platform access only' },
  sa_roles:        { title: 'Roles & Access',  subtitle: 'Manage platform-wide roles and permissions' },
  sa_modules:      { title: 'Modules',         subtitle: 'Enable or disable modules per organization' },
  sa_subscriptions:{ title: 'Subscriptions',   subtitle: 'Billing and subscription management' },
  sa_audit:        { title: 'Audit Logs',      subtitle: 'Complete system audit trail' },
  sa_system:       { title: 'System Settings', subtitle: 'Global configuration and environment' },
  sa_database:     { title: 'Database Admin',  subtitle: 'Database health, backups, and queries' },
  sa_notifications:{ title: 'Announcements',   subtitle: 'System-wide broadcasts and notices' },
  sa_api:          { title: 'API Keys',        subtitle: 'Manage API access tokens' },
  sa_support:      { title: 'Support',         subtitle: 'Tickets, feedback, and help requests' },
};

export const SuperAdminWorkspace: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>('sa_dashboard');

  const meta = PAGE_META[activePage];

  const renderPage = () => {
    switch (activePage) {
      case 'sa_dashboard':      return <SuperAdminDashboardView />;
      case 'sa_organizations':  return <OrganizationsView />;
      case 'sa_users':          return <PlatformUsersView />;
      case 'sa_admin_users':    return <SuperAdminUsersView />;
      case 'sa_roles':          return <PlatformRolesView />;
      case 'sa_modules':       return <ModuleManagementView />;
      case 'sa_subscriptions': return <SubscriptionsView />;
      case 'sa_audit':         return <PlatformAuditLogsView />;
      case 'sa_system':        return <SystemSettingsView />;
      case 'sa_database':      return <DatabaseAdminView />;
      case 'sa_notifications': return <AnnouncementsView />;
      case 'sa_api':           return <ApiKeysView />;
      case 'sa_support':       return <SupportView />;
      default:                 return <SuperAdminDashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <SuperAdminSidebar
        activePage={activePage}
        onNavigate={(id) => setActivePage(id as PageId)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SuperAdminHeader
          pageTitle={meta.title}
          pageSubtitle={meta.subtitle}
        />
        <main className="flex-1 overflow-y-auto bg-slate-100 p-5">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};
