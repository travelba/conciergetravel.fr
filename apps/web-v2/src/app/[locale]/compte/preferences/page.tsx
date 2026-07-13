import { AccountSubPage } from '@/components/account/account-sub-page';

export default function AccountPreferencesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AccountSubPage params={params} namespace="account.preferencesPage" />;
}
