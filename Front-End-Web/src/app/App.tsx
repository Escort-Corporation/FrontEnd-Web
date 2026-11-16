import { RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { SubscriptionProvider } from './billing/SubscriptionContext';
import { PreferencesProvider } from './preferences/PreferencesContext';
import { router } from './routes';

export default function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <RouterProvider router={router} />
        </SubscriptionProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
