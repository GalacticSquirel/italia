import { router } from 'expo-router';

import { formatBytes } from '@/features/models/format';
import { useModels } from '@/models';
import { useTutorModel, type TutorModelChoice } from '@/tutor';
import { Card, List, ListItem, Screen } from '@/ui';

/** What the speech models give, for the status line. */
function modelStatus(sttReady: boolean, scorerReady: boolean): string {
  if (sttReady && scorerReady)
    return 'Speech recognition and pronunciation scoring run on this phone.';
  if (sttReady)
    return 'Speech recognition runs on this phone. Download pronunciation scoring for feedback on your sounds.';
  return "Using your phone's own speech recognition. Download the on-device models for offline recognition and pronunciation feedback.";
}

/** What the conversation card says about the model. */
function conversationSubtitle(choice: TutorModelChoice): string {
  switch (choice.state) {
    case 'ready':
      return 'Role-play everyday scenes with the on-device tutor';
    case 'needs_download':
      return `Role-play with an on-device tutor (${formatBytes(choice.model.bytesTotal)} download)`;
    case 'unsupported':
      return 'Needs a phone with more memory';
    case 'unavailable':
      return 'Not available yet';
  }
}

/** The Speak tab: conversation, speaking drill, hands-free drill, ear training and shadowing. */
export function SpeakScreen() {
  const models = useModels();
  const tutor = useTutorModel();
  const installed = (kind: string) =>
    models.some((m) => m.spec.kind === kind && m.status === 'installed');
  return (
    <Screen title="Speak">
      <Card>
        <ListItem
          title="Conversation"
          subtitle={conversationSubtitle(tutor)}
          onPress={() => {
            router.push('/speak/converse');
          }}
        />
      </Card>
      <Card>
        <List>
          <ListItem
            title="Speaking drill"
            subtitle="Hear English, say it in Italian, hear the answer"
            onPress={() => {
              router.push('/speak/drill');
            }}
          />
          <ListItem
            title="Hands-free drill"
            subtitle="Audio only: no taps, screen stays on"
            onPress={() => {
              router.push({ pathname: '/speak/drill', params: { handsFree: '1' } });
            }}
          />
          <ListItem
            title="Ear training"
            subtitle="Tell apart words that sound alike"
            onPress={() => {
              router.push('/speak/ear');
            }}
          />
          <ListItem
            title="Shadowing"
            subtitle="Repeat after a model and compare"
            onPress={() => {
              router.push('/speak/shadow');
            }}
          />
        </List>
      </Card>
      <Card>
        <ListItem
          title="On-device models"
          subtitle={modelStatus(installed('stt'), installed('phonemes'))}
          onPress={() => {
            router.push('/models');
          }}
        />
      </Card>
    </Screen>
  );
}
