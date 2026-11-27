import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { addPasskey, listPasskeys, passkeysSupported, removePasskey } from '@/lib/passkeys';
import type { PasskeyInfo } from '@/lib/passkeys';

// Passkeys (apps/api: /users/me/passkeys*): a fingerprint, face, screen lock or security key signs in without a
// password. They sit next to the password and two-factor, none of them replaces another.
export function PasskeysCard() {
    const intl = useIntl();
    const [keys, setKeys] = useState<PasskeyInfo[]>([]);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const reload = useCallback(() => {
        listPasskeys()
            .then(setKeys)
            .catch(() => setKeys([]));
    }, []);
    useEffect(reload, [reload]);

    if (!passkeysSupported()) return null;

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            reload();
        } catch (err) {
            // Closing the browser's own prompt is not an error worth showing.
            if (err instanceof DOMException && err.name === 'NotAllowedError') return;
            setError(
                err instanceof ApiError
                    ? err.message
                    : intl.formatMessage({ id: 'common.genericError' }),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="passkey.title" />
                </CardTitle>
                <CardDescription>
                    <FormattedMessage id="passkey.description" />
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {keys.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {keys.map((key) => (
                            <li
                                key={key.id}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                <span>
                                    <strong>{key.name}</strong>{' '}
                                    <span className="text-muted-foreground">
                                        {new Date(key.createdAt).toLocaleDateString(intl.locale)}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void run(() => removePasskey(key.id))}
                                >
                                    <FormattedMessage id="passkey.remove" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex flex-wrap gap-2">
                    <Input
                        aria-label={intl.formatMessage({ id: 'passkey.nameLabel' })}
                        placeholder={intl.formatMessage({ id: 'passkey.namePlaceholder' })}
                        maxLength={60}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="max-w-xs"
                    />
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                            void run(async () => {
                                await addPasskey(
                                    name.trim() ||
                                        intl.formatMessage({ id: 'passkey.defaultName' }),
                                );
                                setName('');
                            })
                        }
                    >
                        <FormattedMessage id="passkey.add" />
                    </Button>
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive-strong">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
