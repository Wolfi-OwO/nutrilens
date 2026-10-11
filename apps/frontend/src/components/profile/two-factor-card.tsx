import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';

// Optional TOTP two-factor sign-in (apps/api: /users/me/2fa/*). The secret is shown as text
// and as an otpauth link rather than a QR image: no QR dependency is in the bundle, and every
// authenticator app accepts a typed secret or the link.
type Step = 'loading' | 'off' | 'setup' | 'codes' | 'on';

export function TwoFactorCard() {
    const intl = useIntl();
    const [step, setStep] = useState<Step>('loading');
    const [secret, setSecret] = useState('');
    const [uri, setUri] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get<{ enabled: boolean }>('/users/me/2fa')
            .then((status) => setStep(status.enabled ? 'on' : 'off'))
            .catch(() => setStep('off'));
    }, []);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : intl.formatMessage({ id: 'common.genericError' }));
        } finally {
            setBusy(false);
        }
    };

    const begin = () =>
        run(async () => {
            const result = await api.post<{ secret: string; otpauthUri: string }>('/users/me/2fa/setup');
            setSecret(result.secret);
            setUri(result.otpauthUri);
            setCode('');
            setStep('setup');
        });

    const enable = () =>
        run(async () => {
            const result = await api.post<{ recoveryCodes: string[] }>('/users/me/2fa/enable', { code });
            setRecoveryCodes(result.recoveryCodes);
            setCode('');
            setStep('codes');
        });

    const disable = () =>
        run(async () => {
            await api.post('/users/me/2fa/disable', { code, ...(password ? { password } : {}) });
            setCode('');
            setPassword('');
            setStep('off');
        });

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="twofactor.title" />
                </CardTitle>
                <CardDescription>
                    <FormattedMessage id="twofactor.description" />
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {step === 'off' && (
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            <FormattedMessage id="twofactor.off" />
                        </p>
                        <Button type="button" size="sm" disabled={busy} onClick={() => void begin()}>
                            <FormattedMessage id="twofactor.setUp" />
                        </Button>
                    </div>
                )}

                {step === 'setup' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            <FormattedMessage id="twofactor.setupBody" />
                        </p>
                        <code className="break-all rounded-md bg-muted px-3 py-2 text-sm">{secret}</code>
                        <a className="text-sm underline" href={uri}>
                            <FormattedMessage id="twofactor.openApp" />
                        </a>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="twofactor-code">
                                <FormattedMessage id="twofactor.codeLabel" />
                            </Label>
                            <Input
                                id="twofactor-code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                        </div>
                        <div>
                            <Button type="button" size="sm" disabled={busy || code.trim().length < 6} onClick={() => void enable()}>
                                <FormattedMessage id="twofactor.turnOn" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'codes' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm font-medium text-foreground">
                            <FormattedMessage id="twofactor.recoveryTitle" />
                        </p>
                        <p className="text-sm text-muted-foreground">
                            <FormattedMessage id="twofactor.recoveryBody" />
                        </p>
                        <ul className="grid grid-cols-2 gap-1 rounded-md bg-muted p-3 font-mono text-sm">
                            {recoveryCodes.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ul>
                        <div>
                            <Button type="button" size="sm" onClick={() => setStep('on')}>
                                <FormattedMessage id="twofactor.saved" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'on' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-foreground">
                            <FormattedMessage id="twofactor.on" />
                        </p>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="twofactor-disable-code">
                                <FormattedMessage id="twofactor.disableCodeLabel" />
                            </Label>
                            <Input
                                id="twofactor-disable-code"
                                autoComplete="one-time-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="twofactor-disable-password">
                                <FormattedMessage id="twofactor.passwordLabel" />{' '}
                                <span className="font-normal text-muted-foreground">
                                    <FormattedMessage id="twofactor.passwordHint" />
                                </span>
                            </Label>
                            <PasswordInput
                                id="twofactor-disable-password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <Button type="button" variant="destructive" size="sm" disabled={busy || code.trim().length < 6} onClick={() => void disable()}>
                                <FormattedMessage id="twofactor.turnOff" />
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
