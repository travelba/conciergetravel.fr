import { AccountSubPage } from '@/components/account/account-sub-page';

export default function AccountTripsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AccountSubPage params={params} namespace="account.tripsPage" />;
}
