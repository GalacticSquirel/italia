import { router } from 'expo-router';

import { ConverseScreen } from '@/features/converse/ConverseScreen';

export default function ConverseRoute() {
  return (
    <ConverseScreen
      onOpen={(scenario) => {
        router.push({ pathname: '/speak/converse/[scenario]', params: { scenario } });
      }}
    />
  );
}
