import { SignInForm } from '@/components/sign-in-form';
import { Card, Screen, T } from '@/components/ui';

export default function SignIn() {
  return (
    <Screen>
      <T variant="title" style={{ marginTop: 48 }}>FairTab</T>
      <T muted>Split expenses with friends. Free, unlimited, no ads.</T>
      <Card>
        <SignInForm />
      </Card>
    </Screen>
  );
}
