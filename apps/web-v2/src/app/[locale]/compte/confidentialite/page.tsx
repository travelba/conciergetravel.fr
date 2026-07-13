import { AccountSubPage } from '@/components/account/account-sub-page';

export default function AccountPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AccountSubPage params={params} namespace="account.privacyPage" />;
}
