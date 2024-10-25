'use client';

import dynamic from 'next/dynamic';

const ErrorBoundary = dynamic(() => import('./ErrorBoundary'), { ssr: false });

const ClientErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default ClientErrorBoundary;
