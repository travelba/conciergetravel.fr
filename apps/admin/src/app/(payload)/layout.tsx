import type { Metadata } from 'next';
import type { ServerFunctionClient } from 'payload';
import { RootLayout } from '@payloadcms/next/layouts';
import config from '@payload-config';
import { handleServerFunctions } from '@payloadcms/next/layouts';
import '@payloadcms/next/css';

import './globals.css';

import { payloadAdminImportMap } from './payload-import-map';

export const metadata: Metadata = {
  title: 'MyConciergeHotel — Back-office',
  description: 'Administration MyConciergeHotel.com',
};

const adminConfigPromise = Promise.resolve(config);

const serverFunction: ServerFunctionClient = async function (fnArgs) {
  'use server';
  return handleServerFunctions({
    ...fnArgs,
    config: adminConfigPromise,
    importMap: payloadAdminImportMap,
  });
};

export default function PayloadAdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <RootLayout
      config={adminConfigPromise}
      importMap={payloadAdminImportMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  );
}
