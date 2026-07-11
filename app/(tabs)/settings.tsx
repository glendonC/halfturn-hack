import { Redirect } from 'expo-router';

/** Legacy Settings tab — durable controls live on Profile. */
export default function SettingsRedirect() {
  return <Redirect href="/profile" />;
}
